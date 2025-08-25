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

  describe("POST /check", () => {
    it("should return 400 if required fields are missing", async () => {
      const res = await request(app).post("/check").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 and duplicate check result", async () => {
      CandidateService.checkDuplicates.mockResolvedValue({
        hasDuplicates: false,
        message: "No duplicates",
        data: [],
      });
      const res = await request(app).post("/check").send({
        pan: "P123",
        aadhaar: "A123",
        email: "a@b.com",
        phone: "123",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(CandidateService.checkDuplicates).toHaveBeenCalled();
    });

    it("should handle errors and return 500", async () => {
      CandidateService.checkDuplicates.mockRejectedValue(new Error("fail"));
      const res = await request(app).post("/check").send({
        pan: "P123",
        aadhaar: "A123",
        email: "a@b.com",
        phone: "123",
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
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
    it("should return 200 and search results", async () => {
      CandidateService.searchCandidates.mockResolvedValue({
        success: true,
        data: [],
      });
      const res = await request(app).get("/search");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle errors and return 500", async () => {
      CandidateService.searchCandidates.mockRejectedValue(new Error("fail"));
      const res = await request(app).get("/search");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
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
    it("should return 400 if targetHrId or message missing", async () => {
      const res = await request(app).post("/123/communicate").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 if target HR not found", async () => {
      CandidateService.getCandidateById.mockResolvedValue({
        data: { name: "C" },
      });
      const hrSchema = require("../src/models/hrSchema");
      hrSchema.Hr.findById.mockResolvedValue(null);
      const res = await request(app).post("/123/communicate").send({
        targetHrId: "hr2",
        message: "msg",
      });
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 and communication data", async () => {
      CandidateService.getCandidateById.mockResolvedValue({
        data: { name: "C" },
      });
      const hrSchema = require("../src/models/hrSchema");
      hrSchema.Hr.findById.mockResolvedValue({
        name: "HR2",
        company: { name: "Co" },
        whatsapp: { phoneNumber: "999" },
      });
      CandidateService.updateCandidateStatus.mockResolvedValue({});
      const res = await request(app).post("/123/communicate").send({
        targetHrId: "hr2",
        message: "msg",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("whatsappMessage");
    });

    it("should handle errors and return 500", async () => {
      CandidateService.getCandidateById.mockRejectedValue(new Error("fail"));
      const res = await request(app).post("/123/communicate").send({
        targetHrId: "hr2",
        message: "msg",
      });
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
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
