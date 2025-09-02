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

  // Common test data
  const mockInitiatorHR = {
    _id: 'hr123',
    name: 'Initiator HR',
    whatsapp: '+919876543210',
    company: { name: 'Company A' }
  };

  const mockRecipientHR = {
    _id: 'hr456',
    name: 'Recipient HR',
    whatsapp: '+919876543211',
    company: { name: 'Company B' }
  };

  const mockCandidate = {
    _id: 'cand123',
    name: 'John Doe',
    email: 'john@example.com'
  };

  const mockOffers = [
    {
      _id: 'offer1',
      position: { title: 'Software Engineer' },
      company: 'Company A',
      hr: { _id: 'hr123' }
    },
    {
      _id: 'offer2',
      position: { title: 'Senior Developer' },
      company: 'Company B',
      hr: { _id: 'hr456' }
    }
  ];

  describe('POST /initiate', () => {
    const validInitiateData = {
      initiatorHR: mockInitiatorHR,
      recipientHR: mockRecipientHR,
      candidate: mockCandidate,
      offers: mockOffers
    };

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/initiate').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Missing required fields');
    });

    it('should return 400 if whatsapp numbers missing', async () => {
      const invalidData = {
        ...validInitiateData,
        initiatorHR: { ...mockInitiatorHR, whatsapp: undefined },
        recipientHR: { ...mockRecipientHR, whatsapp: undefined }
      };
      const res = await request(app).post('/initiate').send(invalidData);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('WhatsApp numbers are required');
    });

    it('should return 200 if communication already exists', async () => {
      const mockExistingComm = {
        alreadyExists: true,
        communicationId: 'comm123',
        trackingId: 'TRACK123',
        whatsappLink: 'https://wa.me/123'
      };
      CommunicationService.initiateCommunication.mockResolvedValue(mockExistingComm);

      const res = await request(app).post('/initiate').send(validInitiateData);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/already exists/i);
      expect(res.body.data).toEqual(mockExistingComm);
    });

    it('should return 201 if communication initiated successfully', async () => {
      const mockNewComm = {
        alreadyExists: false,
        communicationId: 'comm123',
        trackingId: 'TRACK123',
        whatsappLink: 'https://wa.me/123'
      };
      CommunicationService.initiateCommunication.mockResolvedValue(mockNewComm);

      const res = await request(app).post('/initiate').send(validInitiateData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/initiated successfully/i);
      expect(res.body.data).toEqual(mockNewComm);
      expect(CommunicationService.initiateCommunication).toHaveBeenCalledWith(
        expect.objectContaining({
          initiatorHR: expect.objectContaining({ _id: 'hr123' }),
          recipientHR: expect.objectContaining({ _id: 'hr456' })
        })
      );
    });

    it('should handle service errors and return 500', async () => {
      CommunicationService.initiateCommunication.mockRejectedValue(
        new Error('Database error')
      );

      const res = await request(app).post('/initiate').send(validInitiateData);
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Database error');
    });
  });

  describe('POST /:communicationId/outcome', () => {
    const validOutcomeData = {
      result: 'TIMELINE_AGREED',
      description: 'Agreed on new timeline',
      actions: ['Postponed joining date'],
      offerUpdates: {
        postponedOfferId: 'offer1',
        newJoinDate: '2024-03-01'
      }
    };

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/comm123/outcome').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Result and description are required');
    });

    it('should return 200 if outcome recorded successfully', async () => {
      const mockOutcome = {
        _id: 'comm123',
        status: 'RESOLVED',
        outcome: validOutcomeData
      };
      CommunicationService.recordOutcome.mockResolvedValue(mockOutcome);

      const res = await request(app)
        .post('/comm123/outcome')
        .send(validOutcomeData);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/recorded successfully/i);
      expect(res.body.data).toEqual(mockOutcome);
      expect(CommunicationService.recordOutcome).toHaveBeenCalledWith(
        'comm123',
        validOutcomeData,
        'hr123'
      );
    });

    it('should handle unauthorized outcome recording', async () => {
      CommunicationService.recordOutcome.mockRejectedValue(
        new Error('Unauthorized to record outcome')
      );

      const res = await request(app)
        .post('/comm123/outcome')
        .send(validOutcomeData);
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('should handle invalid outcome results', async () => {
      const invalidOutcome = {
        ...validOutcomeData,
        result: 'INVALID_RESULT'
      };

      CommunicationService.recordOutcome.mockRejectedValue(
        new Error('Invalid outcome result')
      );

      const res = await request(app)
        .post('/comm123/outcome')
        .send(invalidOutcome);
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid outcome result');
    });
  });

  describe('GET /:communicationId', () => {
    const mockCommunication = {
      _id: 'comm123',
      trackingId: 'TRACK123',
      status: 'INITIATED',
      candidateId: mockCandidate,
      initiatorHrId: mockInitiatorHR,
      recipientHrId: mockRecipientHR,
      offers: mockOffers.map(o => ({ offerId: o._id }))
    };

    it('should return 404 if communication not found', async () => {
      CommunicationService.getCommunicationDetails.mockResolvedValue(null);
      
      const res = await request(app).get('/comm123');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Communication not found');
    });

    it('should return 200 and communication details for authorized HR', async () => {
      CommunicationService.getCommunicationDetails.mockResolvedValue(mockCommunication);
      
      const res = await request(app).get('/comm123');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockCommunication);
      expect(CommunicationService.getCommunicationDetails).toHaveBeenCalledWith(
        'comm123',
        'hr123'
      );
    });

    it('should handle unauthorized access', async () => {
      CommunicationService.getCommunicationDetails.mockRejectedValue(
        new Error('Unauthorized to view this communication')
      );

      const res = await request(app).get('/comm123');
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('should handle invalid communication ID', async () => {
      CommunicationService.getCommunicationDetails.mockRejectedValue(
        new Error('Invalid communication ID')
      );

      const res = await request(app).get('/invalid-id');
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid communication ID');
    });
  });

  describe('GET /', () => {
    const mockCommunicationsList = [
      {
        id: 'comm123',
        trackingId: 'TRACK123',
        candidate: {
          id: mockCandidate._id,
          name: mockCandidate.name
        },
        status: 'INITIATED',
        role: 'INITIATOR',
        otherParty: {
          id: mockRecipientHR._id,
          name: mockRecipientHR.name,
          company: mockRecipientHR.company.name,
          whatsapp: mockRecipientHR.whatsapp
        },
        metrics: {
          responseTimeMinutes: 30,
          resolutionTimeHours: null
        },
        // Fix: Use ISO string format instead of Date object
        createdAt: new Date().toISOString()
      }
    ];

    it('should return 404 if no communications found', async () => {
      CommunicationService.listCommunications.mockResolvedValue([]);
      
      const res = await request(app).get('/');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No communications found');
    });

    it('should return 200 and communications list', async () => {
      CommunicationService.listCommunications.mockResolvedValue(mockCommunicationsList);
      
      const res = await request(app).get('/');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Fix: Use toMatchObject instead of toEqual for more flexible date matching
      expect(res.body.data).toMatchObject(
        mockCommunicationsList.map(comm => ({
          ...comm,
          createdAt: expect.any(String) // Accept any valid date string
        }))
      );
      expect(CommunicationService.listCommunications).toHaveBeenCalledWith('hr123');
    });

    it('should handle service errors', async () => {
      CommunicationService.listCommunications.mockRejectedValue(
        new Error('Database error')
      );

      const res = await request(app).get('/');
      
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Database error');
    });
  });
});