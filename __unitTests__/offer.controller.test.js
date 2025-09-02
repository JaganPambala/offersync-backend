const request = require("supertest");
const express = require("express");

// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

// Mock OfferService and auth middleware
jest.mock("../src/services/offer.service", () => ({
  getOfferById: jest.fn(),
  listOffers: jest.fn(),
  updateStatus: jest.fn(),
  deleteOffer: jest.fn(), // Fixed: renamed from removeOffer to deleteOffer
}));
const OfferService = require("../src/services/offer.service");

// Mock auth middleware to inject req.user
const mockAuth = (req, res, next) => {
  req.user = { id: "hr123" };
  next();
};
jest.mock("../src/middleware/auth", () => mockAuth);

const offerRouter = require("../src/controllers/offers.controller");
const app = express();
app.use(express.json());
app.use("/", offerRouter);

describe("Offers Controller", () => {
  afterEach(() => jest.clearAllMocks());

  describe("GET /:id", () => {
    it("should return offer by id", async () => {
      const mockOffer = {
        _id: "1",
        hrId: { _id: "hr123" },
        position: "Developer",
        status: "ACTIVE"
      };
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      
      const res = await request(app).get("/1");
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockOffer);
      expect(OfferService.getOfferById).toHaveBeenCalledWith("1");
    });

    it("should return 404 if offer not found", async () => {
      OfferService.getOfferById.mockRejectedValue(new Error("Offer not found"));
      const res = await request(app).get("/1");
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Offer not found");
    });
  });

  describe("GET /", () => {
    const mockOffersList = {
      data: [
        {
          candidate: {
            id: "c1",
            name: "John Doe",
            status: "ACTIVE"
          },
          offers: [
            {
              id: "1",
              position: "Developer",
              status: "ACTIVE"
            }
          ]
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        pages: 1
      }
    };

    it("should list offers with default pagination", async () => {
      OfferService.listOffers.mockResolvedValue(mockOffersList);
      
      const res = await request(app).get("/");
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockOffersList.data);
      expect(res.body.pagination).toEqual(mockOffersList.pagination);
      expect(OfferService.listOffers).toHaveBeenCalledWith({}, 1, 10);
    });

    it("should list offers with query parameters", async () => {
      OfferService.listOffers.mockResolvedValue(mockOffersList);
      
      const res = await request(app)
        .get("/?page=2&limit=5&status=ACTIVE&priority=HIGH");
      
      expect(res.statusCode).toBe(200);
      expect(OfferService.listOffers).toHaveBeenCalledWith(
        { status: "ACTIVE", priority: "HIGH" },
        2,
        5
      );
    });

    it("should handle errors and return 500", async () => {
      OfferService.listOffers.mockRejectedValue(new Error("Database error"));
      const res = await request(app).get("/");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Database error");
    });
  });

  describe("PATCH /:id/status", () => {
    const mockOffer = {
      _id: "1",
      hrId: { _id: "hr123" },
      status: "ACTIVE"
    };

    it("should update status with timeline data", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      const updatedOffer = {
        ...mockOffer,
        status: "ACCEPTED",
        timeline: {
          validTill: "2024-12-31",
          followUpDate: "2024-01-15"
        }
      };
      OfferService.updateStatus.mockResolvedValue(updatedOffer);

      const res = await request(app)
        .patch("/1/status")
        .send({
          status: "ACCEPTED",
          validTill: "2024-12-31",
          followUpDate: "2024-01-15"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedOffer);
      expect(OfferService.updateStatus).toHaveBeenCalledWith(
        "1",
        "ACCEPTED",
        {
          validTill: "2024-12-31",
          followUpDate: "2024-01-15"
        }
      );
    });

    it("should return 404 if offer not found", async () => {
      OfferService.getOfferById.mockResolvedValue(null);
      
      const res = await request(app)
        .patch("/1/status")
        .send({ status: "ACCEPTED" });
      
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Offer not found");
    });

    it("should return 403 if HR is not owner", async () => {
      OfferService.getOfferById.mockResolvedValue({
        _id: "1",
        hrId: { _id: "otherHR" },
      });
      
      const res = await request(app)
        .patch("/1/status")
        .send({ status: "ACCEPTED" });
      
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("You are not authorized to update this offer.");
    });

    it("should handle invalid status value", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      const error = new Error("Invalid status. Allowed: DRAFT, ACTIVE, ACCEPTED...");
      error.code = "VALIDATION_ERROR";
      OfferService.updateStatus.mockRejectedValue(error);

      const res = await request(app)
        .patch("/1/status")
        .send({ status: "INVALID_STATUS" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid status");
    });

    it("should handle validation errors", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      const error = new Error("Validation failed");
      error.code = "VALIDATION_ERROR";
      OfferService.updateStatus.mockRejectedValue(error);
      
      const res = await request(app)
        .patch("/1/status")
        .send({ status: "ACCEPTED" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
    });
  });

  describe("DELETE /:id", () => {
    const mockOffer = {
      _id: "1",
      hrId: { _id: "hr123" },
      status: "ACTIVE"
    };

    it("should delete offer when HR is owner", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      OfferService.deleteOffer.mockResolvedValue({
        success: true,
        message: "Offer deleted successfully"
      });

      const res = await request(app).delete("/1");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe("Offer deleted successfully");
      expect(OfferService.deleteOffer).toHaveBeenCalledWith("1", "hr123");
    });

    it("should return 404 if offer not found", async () => {
      OfferService.getOfferById.mockResolvedValue(null);
      
      const res = await request(app).delete("/1");
      
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Offer not found");
    });

    it("should return 403 if HR is not owner", async () => {
      OfferService.getOfferById.mockResolvedValue({
        _id: "1",
        hrId: { _id: "otherHR" },
      });
      
      const res = await request(app).delete("/1");
      
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("You are not authorized to delete this offer.");
    });

    it("should handle unauthorized deletion", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      OfferService.deleteOffer.mockRejectedValue(new Error("Unauthorized"));
      
      const res = await request(app).delete("/1");
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("should handle other errors", async () => {
      OfferService.getOfferById.mockResolvedValue(mockOffer);
      OfferService.deleteOffer.mockRejectedValue(new Error("Database error"));
      
      const res = await request(app).delete("/1");
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Database error");
    });
  });
});
