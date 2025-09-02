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

// Mock the HR model
jest.mock('../src/models/hrSchema', () => ({
  Hr: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  validateHRUpdate: jest.fn()
}));
const { Hr, validateHRUpdate } = require('../src/models/hrSchema');

// Mock config and jwt
jest.mock('config');
jest.mock('jsonwebtoken');

// Mock auth middleware
jest.mock('../src/middleware/auth', () => (
  (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid_token') {
      req.user = { id: 'mock_user_id' };
      next();
    } else {
      res.status(401).json({ error: 'Access denied. No token provided.' });
    }
  }
));

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

  describe('GET /myProfile', () => {
    it('should return HR profile when valid token is provided', async () => {
      const mockHR = {
        _id: 'mock_user_id',
        name: 'Test HR',
        email: 'test@test.com',
        company: { name: 'Test Company' }
      };
      
      Hr.findById.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(mockHR)
      }));

      const res = await request(app)
        .get('/myProfile')
        .set('Authorization', 'Bearer valid_token');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: 'Profile fetched successfully',
        data: mockHR
      });
      expect(Hr.findById).toHaveBeenCalledWith('mock_user_id');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .get('/myProfile');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Access denied. No token provided.');
    });

    it('should return 404 when HR profile is not found', async () => {
      Hr.findById.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(null)
      }));

      const res = await request(app)
        .get('/myProfile')
        .set('Authorization', 'Bearer valid_token');

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'HR profile not found');
    });

    it('should handle database errors', async () => {
      Hr.findById.mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      const res = await request(app)
        .get('/myProfile')
        .set('Authorization', 'Bearer valid_token');

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('PUT /updateProfile', () => {
    const updateData = {
      name: 'Updated Name',
      company: { name: 'Updated Company' }
    };

    it('should update HR profile when valid data is provided', async () => {
      validateHRUpdate.mockReturnValue({ error: null });
      
      const updatedHR = { ...updateData, _id: 'mock_user_id' };
      Hr.findByIdAndUpdate.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(updatedHR)
      }));

      const res = await request(app)
        .put('/updateProfile')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: 'Profile updated successfully',
        data: updatedHR
      });
      expect(Hr.findByIdAndUpdate).toHaveBeenCalledWith(
        'mock_user_id',
        expect.objectContaining({
          $set: expect.objectContaining(updateData)
        }),
        expect.any(Object)
      );
    });

    it('should return 400 when validation fails', async () => {
      validateHRUpdate.mockReturnValue({
        error: { details: [{ message: 'Invalid data' }] }
      });

      const res = await request(app)
        .put('/updateProfile')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid data');
    });

    it('should return 404 when HR profile is not found', async () => {
      validateHRUpdate.mockReturnValue({ error: null });
      Hr.findByIdAndUpdate.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(null)
      }));

      const res = await request(app)
        .put('/updateProfile')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'HR profile not found');
    });

    it('should handle database errors during update', async () => {
      validateHRUpdate.mockReturnValue({ error: null });
      Hr.findByIdAndUpdate.mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      const res = await request(app)
        .put('/updateProfile')
        .set('Authorization', 'Bearer valid_token')
        .send(updateData);

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'Database error');
    });
  });
});