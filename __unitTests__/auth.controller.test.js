const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('config');

// Suppress console.log and console.error during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

// Mock the auth service methods
jest.mock('../src/services/auth.service', () => ({
  registerHRService: jest.fn(),
  loginHRService: jest.fn(),
}));
const { registerHRService, loginHRService } = require('../src/services/auth.service');

// Mock config and jwt
jest.mock('config');
jest.mock('jsonwebtoken');

// Import the router
const authRouter = require('../src/controllers/auth.controller');

const app = express();
app.use(express.json());
app.use('/', authRouter);

describe('Auth Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register HR and return 201', async () => {
      const hrData = { name: 'Test HR' };
      registerHRService.mockResolvedValue(hrData);

      const res = await request(app)
        .post('/register')
        .send(hrData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        message: 'HR registered successfully',
        data: hrData,
      });
      expect(registerHRService).toHaveBeenCalledWith(hrData);
    });

    it('should handle errors and return 500', async () => {
      registerHRService.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/register')
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'DB error');
    });
  });

  describe('POST /login', () => {
    it('should login HR and return token', async () => {
      const hrData = { _id: '123', name: 'Test HR' };
      loginHRService.mockResolvedValue(hrData);
      config.get.mockReturnValue('secret');
      jwt.sign.mockReturnValue('mockedToken');

      const res = await request(app)
        .post('/login')
        .send({ email: 'test@test.com', password: 'pass' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: 'HR logged in successfully',
        token: 'mockedToken',
        data: hrData,
      });
      expect(loginHRService).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: hrData._id, role: 'HR' },
        'secret',
        { expiresIn: '12h' }
      );
    });

    it('should return 401 for invalid credentials', async () => {
      loginHRService.mockResolvedValue(null);

      const res = await request(app)
        .post('/login')
        .send({ email: 'wrong', password: 'wrong' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should handle errors and return 500', async () => {
      loginHRService.mockRejectedValue(new Error('Login error'));

      const res = await request(app)
        .post('/login')
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'Login error');
    });
  });
});