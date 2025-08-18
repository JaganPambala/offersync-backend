// src/controllers/communication.controller.js

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const CommunicationService = require("../services/comunication.service");

// 1. Initiate Communication
router.post("/initiate", auth, async (req, res) => {
  try {
    console.log("Initiate communication request:", req.body);
    const hrId = req.user.id; // From auth middleware

    // Validate required fields
    const { initiatorHR, recipientHR, candidate, offers } = req.body;
    if (!initiatorHR || !recipientHR || !candidate || !offers) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: initiatorHR, recipientHR, candidate, and offers are required",
      });
    }

    // Validate phone numbers
    if (!recipientHR.whatsapp || !initiatorHR.whatsapp) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp numbers are required for both HRs",
      });
    }

    // Ensure initiator is current HR
    const data = {
      initiatorHR: {
        ...initiatorHR,
        _id: hrId, // Use authenticated HR's ID
      },
      recipientHR,
      candidate,
      offers,
    };

    const result = await CommunicationService.initiateCommunication(data);

    res.status(201).json({
      success: true,
      message: "Communication initiated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in initiateCommunication:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

// 2. Update Communication Status
router.patch("/:communicationId/status", auth, async (req, res) => {
  try {
    console.log("Update status request:", req.params.communicationId, req.body);
    const hrId = req.user.id;

    const { status, remarks } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const result = await CommunicationService.updateStatus(
      req.params.communicationId,
      status,
      remarks,
      hrId // Pass HR ID for validation
    );

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in updateStatus:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

// 3. Record Outcome
router.post("/:communicationId/outcome", auth, async (req, res) => {
  try {
    console.log(
      "Record outcome request:",
      req.params.communicationId,
      req.body
    );
    const hrId = req.user.id;

    const { result, description, actions } = req.body;
    if (!result || !description) {
      return res.status(400).json({
        success: false,
        message: "Result and description are required",
      });
    }

    const outcome = await CommunicationService.recordOutcome(
      req.params.communicationId,
      req.body,
      hrId
    );

    res.status(200).json({
      success: true,
      message: "Outcome recorded successfully",
      data: outcome,
    });
  } catch (error) {
    console.error("Error in recordOutcome:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

// 4. Get Communication Details
router.get("/:communicationId", auth, async (req, res) => {
  try {
    console.log(
      "Get communication details request:",
      req.params.communicationId
    );
    const hrId = req.user.id;

    const communication = await CommunicationService.getCommunicationDetails(
      req.params.communicationId,
      hrId
    );

    if (!communication) {
      return res.status(404).json({
        success: false,
        message: "Communication not found",
      });
    }

    res.status(200).json({
      success: true,
      data: communication,
    });
  } catch (error) {
    console.error("Error in getCommunicationDetails:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

// 5. List HR's Communications
router.get("/", auth, async (req, res) => {
  try {
    console.log("List communications request");
    const hrId = req.user.id;

    const communications = await CommunicationService.listCommunications(hrId);
    if (!communications || communications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No communications found",
      });
    }

    res.status(200).json({
      success: true,
      data: communications,
    });
  } catch (error) {
    console.error("Error in listCommunications:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

module.exports = router;
