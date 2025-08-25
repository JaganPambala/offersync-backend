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

// Mock OfferService and auth middleware
jest.mock('../src/services/offer.service', () => ({
  getOfferById: jest.fn(),
  listOffers: jest.fn(),
  updateStatus: jest.fn(),
  removeOffer: jest.fn(),
}));
const OfferService = require('../src/services/offer.service');

// Mock auth middleware to inject req.user
const mockAuth = (req, res, next) => {
  req.user = { id: 'hr123' };
  next();
};
jest.mock('../src/middleware/auth', () => mockAuth);

const offerRouter = require('../src/controllers/offers.controller');
const app = express();
app.use(express.json());
app.use('/', offerRouter);

describe('Offers Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('GET /:id', () => {
    it('should return offer by id', async () => {
      OfferService.getOfferById.mockResolvedValue({ _id: '1', hrId: { _id: 'hr123' } });
      const res = await request(app).get('/1');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id', '1');
    });

    it('should return 404 if offer not found', async () => {
      OfferService.getOfferById.mockRejectedValue(new Error('Offer not found'));
      const res = await request(app).get('/1');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Offer not found');
    });
  });

  describe('GET /', () => {
    it('should list offers with pagination', async () => {
      OfferService.listOffers.mockResolvedValue({
        data: [{ _id: '1' }],
        pagination: { page: 1, limit: 10, total: 1 }
      });
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toHaveProperty('page', 1);
    });

    it('should handle errors and return 500', async () => {
      OfferService.listOffers.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('DB error');
    });
  });

  describe('PATCH /:id/status', () => {
    it('should update status if HR is owner', async () => {
      OfferService.getOfferById.mockResolvedValue({ _id: '1', hrId: { _id: 'hr123' } });
      OfferService.updateStatus.mockResolvedValue({ _id: '1', status: 'Accepted' });
      const res = await request(app)
        .patch('/1/status')
        .send({ status: 'Accepted' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'Accepted');
    });

    it('should return 404 if offer not found', async () => {
      OfferService.getOfferById.mockResolvedValue(null);
      const res = await request(app)
        .patch('/1/status')
        .send({ status: 'Accepted' });
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Offer not found');
    });

    it('should return 403 if HR is not owner', async () => {
      OfferService.getOfferById.mockResolvedValue({ _id: '1', hrId: { _id: 'otherHR' } });
      const res = await request(app)
        .patch('/1/status')
        .send({ status: 'Accepted' });
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('You are not authorized to update this offer.');
    });

    it('should handle validation error', async () => {
      OfferService.getOfferById.mockResolvedValue({ _id: '1', hrId: { _id: 'hr123' } });
      const error = new Error('Validation failed');
      error.code = 'VALIDATION_ERROR';
      OfferService.updateStatus.mockRejectedValue(error);
      const res = await request(app)
        .patch('/1/status')
        .send({ status: 'Accepted' });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });

    it('should handle other errors', async () => {
      OfferService.getOfferById.mockResolvedValue({ _id: '1', hrId: { _id: 'hr123' } });
      OfferService.updateStatus.mockRejectedValue(new Error('Some error'));
      const res = await request(app)
        .patch('/1/status')
        .send({ status: 'Accepted' });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Some error');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete offer', async () => {
      OfferService.removeOffer.mockResolvedValue({ deleted: true });
      const res = await request(app).delete('/1');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('deleted', true);
    });

    it('should return 404 if offer not found', async () => {
      OfferService.removeOffer.mockRejectedValue(new Error('Offer not found'));
      const res = await request(app).delete('/1');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Offer not found');
    });

    it('should handle other errors', async () => {
      OfferService.removeOffer.mockRejectedValue(new Error('Some error'));
      const res = await request(app).delete('/1');
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Some error');
    });
  });
});