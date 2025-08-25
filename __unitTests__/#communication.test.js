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

// Mock CommunicationService and auth middleware
jest.mock('../src/services/comunication.service', () => ({
  initiateCommunication: jest.fn(),
  recordOutcome: jest.fn(),
  getCommunicationDetails: jest.fn(),
  listCommunications: jest.fn(),
}));
const CommunicationService = require('../src/services/comunication.service');

// Mock auth middleware to inject req.user
const mockAuth = (req, res, next) => {
  req.user = { id: 'hr123' };
  next();
};
jest.mock('../src/middleware/auth', () => mockAuth);

const communicationRouter = require('../src/controllers/communication.controller');
const app = express();
app.use(express.json());
app.use('/', communicationRouter);

describe('Communication Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('POST /initiate', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/initiate').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if whatsapp numbers missing', async () => {
      const body = {
        initiatorHR: { name: 'A' },
        recipientHR: { name: 'B' },
        candidate: { name: 'C' },
        offers: [{ id: 1 }]
      };
      const res = await request(app).post('/initiate').send(body);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 if communication already exists', async () => {
      CommunicationService.initiateCommunication.mockResolvedValue({ alreadyExists: true });
      const body = {
        initiatorHR: { name: 'A', whatsapp: '111' },
        recipientHR: { name: 'B', whatsapp: '222' },
        candidate: { name: 'C' },
        offers: [{ id: 1 }]
      };
      const res = await request(app).post('/initiate').send(body);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should return 201 if communication initiated', async () => {
      CommunicationService.initiateCommunication.mockResolvedValue({ alreadyExists: false });
      const body = {
        initiatorHR: { name: 'A', whatsapp: '111' },
        recipientHR: { name: 'B', whatsapp: '222' },
        candidate: { name: 'C' },
        offers: [{ id: 1 }]
      };
      const res = await request(app).post('/initiate').send(body);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/initiated/i);
    });

    it('should handle errors and return 500', async () => {
      CommunicationService.initiateCommunication.mockRejectedValue(new Error('fail'));
      const body = {
        initiatorHR: { name: 'A', whatsapp: '111' },
        recipientHR: { name: 'B', whatsapp: '222' },
        candidate: { name: 'C' },
        offers: [{ id: 1 }]
      };
      const res = await request(app).post('/initiate').send(body);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /:communicationId/outcome', () => {
    it('should return 400 if result or description missing', async () => {
      const res = await request(app).post('/123/outcome').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 if outcome recorded', async () => {
      CommunicationService.recordOutcome.mockResolvedValue({ outcome: 'ok' });
      const res = await request(app).post('/123/outcome').send({
        result: 'Selected',
        description: 'Candidate selected',
        actions: []
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/outcome recorded/i);
    });

    it('should handle errors and return 500', async () => {
      CommunicationService.recordOutcome.mockRejectedValue(new Error('fail'));
      const res = await request(app).post('/123/outcome').send({
        result: 'Selected',
        description: 'Candidate selected',
        actions: []
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /:communicationId', () => {
    it('should return 404 if communication not found', async () => {
      CommunicationService.getCommunicationDetails.mockResolvedValue(null);
      const res = await request(app).get('/123');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 and communication details', async () => {
      CommunicationService.getCommunicationDetails.mockResolvedValue({ id: '123' });
      const res = await request(app).get('/123');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', '123');
    });

    it('should handle errors and return 500', async () => {
      CommunicationService.getCommunicationDetails.mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/123');
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /', () => {
    it('should return 404 if no communications found', async () => {
      CommunicationService.listCommunications.mockResolvedValue([]);
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 and communications', async () => {
      CommunicationService.listCommunications.mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should handle errors and return 500', async () => {
      CommunicationService.listCommunications.mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});