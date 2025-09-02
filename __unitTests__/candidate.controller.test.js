const request = require("supertest");
const express = require("express");

// Mock CandidateService and auth middleware
jest.mock("../src/services/candidate.service", () => ({
  checkDuplicates: jest.fn(),
  createCandidateWithOffer: jest.fn(),
  getCandidateById: jest.fn(),
  createOfferForExistingCandidate: jest.fn(),
  searchCandidates: jest.fn(),
  getCandidateAnalytics: jest.fn(),
  getRecentActivity: jest.fn(),
  updateCandidateStatus: jest.fn(),
  calculateDuplicateRate: jest.fn(),
  getCandidateWithOffers: jest.fn(), // Add this mock
}));
const CandidateService = require("../src/services/candidate.service");

// Mock models used directly
jest.mock("../src/models/hrSchema", () => ({
  Hr: { findById: jest.fn() },
}));
jest.mock("../src/models/candidate", () => ({
  countDocuments: jest.fn(),
}));

// Mock auth middleware to inject req.user
const mockAuth = (req, res, next) => {
  req.user = { id: "hr123", name: "HR User", company: { name: "TestCo" } };
  next();
};
jest.mock("../src/middleware/auth", () => mockAuth);

const candidateRouter = require("../src/controllers/candidate.controller");
const app = express();
app.use(express.json());
app.use("/", candidateRouter);

describe("Candidate Controller", () => {
  afterEach(() => jest.clearAllMocks());

  describe("GET /:id", () => {
    it("should return 200 and candidate details when found", async () => {
      const mockCandidate = {
        success: true,
        candidate: {
          _id: "123",
          name: "Test Candidate",
          email: "test@example.com",
          phone: "1234567890",
          status: "ACTIVE"
        },
        offers: [
          {
            position: "Developer",
            compensation: { total: 100000 }
          }
        ]
      };

      CandidateService.getCandidateWithOffers.mockResolvedValue(mockCandidate);

      const res = await request(app).get("/123");
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockCandidate);
      expect(CandidateService.getCandidateWithOffers).toHaveBeenCalledWith("123", "hr123");
    });

    it("should return 404 when candidate not found", async () => {
      CandidateService.getCandidateWithOffers.mockRejectedValue(new Error("Candidate not found"));

      const res = await request(app).get("/123");
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: "Candidate not found"
      });
    });

    it("should return 500 on server error", async () => {
      CandidateService.getCandidateWithOffers.mockRejectedValue(new Error("Database error"));

      const res = await request(app).get("/123");
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Internal server error while fetching candidate",
        error: "Database error"
      });
    });
  });

  describe("POST /check", () => {
    const validCheckData = {
      pan: "ABCDE1234F",
      aadhaar: "123456789012",
      email: "test@example.com",
      phone: "9876543210"
    };

    it("should return 400 if required fields are missing", async () => {
      const res = await request(app).post("/check").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Missing required fields");
    });

    it("should return 200 and duplicate check result", async () => {
      const mockResult = {
        hasDuplicates: false,
        message: "No duplicates found. Safe to proceed with offer.",
        data: null
      };

      CandidateService.checkDuplicates.mockResolvedValue(mockResult);
      
      const res = await request(app)
        .post("/check")
        .send(validCheckData);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: mockResult.message,
        data: mockResult.data,
        hasDuplicates: false
      });
      expect(CandidateService.checkDuplicates).toHaveBeenCalledWith(validCheckData);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.checkDuplicates.mockRejectedValue(new Error("Database error"));
      
      const res = await request(app)
        .post("/check")
        .send(validCheckData);
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Internal server error during duplicate check",
        error: "Database error"
      });
    });
  });

  describe("POST /offers/create", () => {
    it("should return 400 if candidate fields missing", async () => {
      const res = await request(app).post("/offers/create").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 if offer fields missing", async () => {
      const res = await request(app).post("/offers/create").send({
        pan: "P",
        aadhaar: "A",
        email: "e",
        phone: "1",
        name: "n",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 409 if duplicates found", async () => {
      CandidateService.checkDuplicates.mockResolvedValue({
        hasDuplicates: true,
        data: [{ id: 1 }],
      });
      const res = await request(app).post("/offers/create").send({
        pan: "P",
        aadhaar: "A",
        email: "e",
        phone: "1",
        name: "n",
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(409);
      expect(res.body.hasDuplicates).toBe(true);
    });

    it("should return 201 on successful creation", async () => {
      CandidateService.checkDuplicates.mockResolvedValue({
        hasDuplicates: false,
      });
      CandidateService.createCandidateWithOffer.mockResolvedValue({
        success: true,
      });
      const res = await request(app).post("/offers/create").send({
        pan: "P",
        aadhaar: "A",
        email: "e",
        phone: "1",
        name: "n",
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.checkDuplicates.mockResolvedValue({
        hasDuplicates: false,
      });
      CandidateService.createCandidateWithOffer.mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app).post("/offers/create").send({
        pan: "P",
        aadhaar: "A",
        email: "e",
        phone: "1",
        name: "n",
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /:candidateId/offer", () => {
    it("should return 400 if offer fields missing", async () => {
      const res = await request(app).post("/123/offer").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 if candidate not found", async () => {
      CandidateService.getCandidateById.mockResolvedValue({ success: false });
      const res = await request(app).post("/123/offer").send({
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 201 on successful offer creation", async () => {
      CandidateService.getCandidateById.mockResolvedValue({ success: true });
      CandidateService.createOfferForExistingCandidate.mockResolvedValue({
        success: true,
      });
      const res = await request(app).post("/123/offer").send({
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.getCandidateById.mockResolvedValue({ success: true });
      CandidateService.createOfferForExistingCandidate.mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app).post("/123/offer").send({
        position: "dev",
        compensation: 100,
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /search", () => {
    const mockSearchResults = {
      success: true,
      data: {
        candidates: [
          {
            _id: "cand123",
            name: "Test Candidate",
            status: "ACTIVE",
            location: { city: "Bangalore" },
            profile: { totalExperience: 5 }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1
        }
      }
    };

    it("should return 200 and search results with no filters", async () => {
      CandidateService.searchCandidates.mockResolvedValue({
        success: true,
        data: mockSearchResults.data
      });
      
      const res = await request(app).get("/search").query({});
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockSearchResults.data
      });
      expect(CandidateService.searchCandidates).toHaveBeenCalledWith(
        {},
        1,
        10
      );
    });

    it("should return 200 and search results with filters", async () => {
      CandidateService.searchCandidates.mockResolvedValue({
        success: true,
        data: mockSearchResults.data
      });
      
      const res = await request(app)
        .get("/search")
        .query({
          status: "ACTIVE",
          location: "Bangalore",
          experience: "5",
          page: "2",
          limit: "20"
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockSearchResults.data
      });
      expect(CandidateService.searchCandidates).toHaveBeenCalledWith(
        {
          status: "ACTIVE",
          "location.city": { $regex: "Bangalore", $options: "i" },
          "profile.totalExperience": { $gte: 5 }
        },
        2,
        20
      );
    });

    it("should handle errors and return 500", async () => {
      CandidateService.searchCandidates.mockRejectedValue(new Error("Database error"));
      
      const res = await request(app).get("/search");
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Internal server error while searching candidates",
        error: "Database error"
      });
    });
  });

  describe("GET /analytics/overview", () => {
    it("should return 200 and analytics", async () => {
      CandidateService.getCandidateAnalytics.mockResolvedValue({
        success: true,
      });
      const res = await request(app).get("/analytics/overview");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.getCandidateAnalytics.mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app).get("/analytics/overview");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /analytics/recent-activity", () => {
    it("should return 200 and recent activity", async () => {
      CandidateService.getRecentActivity.mockResolvedValue([]);
      const res = await request(app).get("/analytics/recent-activity");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.getRecentActivity.mockRejectedValue(new Error("fail"));
      const res = await request(app).get("/analytics/recent-activity");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /:id/communicate", () => {
    const validCommunicateData = {
      targetHrId: "hr456",
      message: "Let's coordinate about the candidate",
      communicationType: "WHATSAPP_COORDINATION"
    };

    it("should return 400 if targetHrId or message missing", async () => {
      const res = await request(app).post("/123/communicate").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Target HR ID and message are required");
    });

    it("should return 404 if target HR not found", async () => {
      CandidateService.getCandidateById.mockResolvedValue({
        data: { name: "Test Candidate" }
      });
      const hrSchema = require("../src/models/hrSchema");
      hrSchema.Hr.findById.mockResolvedValue(null);

      const res = await request(app)
        .post("/123/communicate")
        .send(validCommunicateData);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: "Target HR not found"
      });
    });

    it("should return 200 and communication data with whatsapp message", async () => {
      const mockCandidate = {
        data: { name: "Test Candidate" }
      };
      const mockTargetHr = {
        name: "Target HR",
        company: { name: "Target Company" },
        whatsapp: { phoneNumber: "9876543210" }
      };

      CandidateService.getCandidateById.mockResolvedValue(mockCandidate);
      const hrSchema = require("../src/models/hrSchema");
      hrSchema.Hr.findById.mockResolvedValue(mockTargetHr);
      CandidateService.updateCandidateStatus.mockResolvedValue({});

      const res = await request(app)
        .post("/123/communicate")
        .send(validCommunicateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("whatsappMessage");
      expect(res.body.data).toHaveProperty("targetHr");
      expect(res.body.data.targetHr).toEqual({
        name: mockTargetHr.name,
        company: mockTargetHr.company.name,
        whatsapp: mockTargetHr.whatsapp.phoneNumber
      });
    });

    it("should handle errors and return 500", async () => {
      CandidateService.getCandidateById.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .post("/123/communicate")
        .send(validCommunicateData);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Internal server error while initiating communication",
        error: "Database error"
      });
    });
  });

  describe("GET /duplicates/summary", () => {
    it("should return 200 and summary", async () => {
      CandidateService.calculateDuplicateRate.mockResolvedValue(0.5);
      const candidateModel = require("../src/models/candidate");
      candidateModel.countDocuments
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      const res = await request(app).get("/duplicates/summary");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("duplicateRate");
    });

    it("should handle errors and return 500", async () => {
      CandidateService.calculateDuplicateRate.mockRejectedValue(
        new Error("fail")
      );
      const res = await request(app).get("/duplicates/summary");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
