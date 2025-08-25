const request = require('supertest');
const express = require('express');

// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

// Mock DashboardService and auth middleware
jest.mock('../src/services/dashboard.service', () => ({
  getDashboardData: jest.fn(),
  getPublicDashboardData: jest.fn(),
}));
const DashboardService = require('../src/services/dashboard.service');

// Mock auth middleware to inject req.user
const mockAuth = (req, res, next) => {
  req.user = { id: 'hr123' };
  next();
};
jest.mock('../src/middleware/auth', () => mockAuth);

const dashboardRouter = require('../src/controllers/dashboard.controller');
const app = express();
app.use(express.json());
app.use('/dashboard', dashboardRouter);

describe('Dashboard Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('GET /dashboard', () => {
    it('should return dashboard data for logged-in HR', async () => {
      DashboardService.getDashboardData.mockResolvedValue({ offers: 5 });
      const res = await request(app).get('/dashboard');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('offers', 5);
      expect(DashboardService.getDashboardData).toHaveBeenCalledWith('hr123');
    });

    it('should handle errors and return 500', async () => {
      DashboardService.getDashboardData.mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/dashboard');
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('fail');
    });
  });

  describe('GET /dashboard/public', () => {
    it('should return public dashboard data', async () => {
      DashboardService.getPublicDashboardData.mockResolvedValue({ totalOffers: 10 });
      const res = await request(app).get('/dashboard/public');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalOffers', 10);
      expect(DashboardService.getPublicDashboardData).toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      DashboardService.getPublicDashboardData.mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/dashboard/public');
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('fail');
    });
  });
});