const express = require("express");
const router = express.Router();
const CandidateService = require("../services/candidate.service");
const auth = require("../middleware/auth");

//candidate duplicate check-api
router.post("/check", auth, async (req, res) => {
  try {
    const { pan, aadhaar, email, phone } = req.body;
    const hrId = req.user.id; // From auth middleware

    // Validate required fields
    if (!pan || !aadhaar || !email || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: PAN, Aadhaar, Email, and Phone are required",
      });
    }

    // Check for duplicates
    const duplicateCheck = await CandidateService.checkDuplicates({
      pan,
      aadhaar,
      email,
      phone,
    });

    // Log the duplicate check for analytics
    console.log(
      `Duplicate check performed by HR ${hrId}: ${
        duplicateCheck.hasDuplicates ? "Duplicates found" : "No duplicates"
      }`
    );

    return res.status(200).json({
      success: true,
      message: duplicateCheck.message,
      data: duplicateCheck.data,
      hasDuplicates: duplicateCheck.hasDuplicates,
    });
  } catch (error) {
    console.error("Error in candidate duplicate check:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during duplicate check",
      error: error.message,
    });
  }
});

// NEW: Comprehensive candidate + offer creation API
router.post("/offers/create", auth, async (req, res) => {
  try {
    const {
      // Candidate fields
      pan,
      aadhaar,
      email,
      phone,
      name,
      location,
      profile,
      skills, // Extract skills from request
      whatsappNumber,
      consent,
      // Offer fields
      position,
      compensation,
      timeline,
      priority,
      competition,
      tags,
    } = req.body;

    const hrId = req.user.id;

    // Validate required fields
    if (!pan || !aadhaar || !email || !phone || !name) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required candidate fields: PAN, Aadhaar, Email, Phone, and Name are required",
      });
    }

    if (!position || !compensation) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required offer fields: Position and Compensation are required",
      });
    }

    // Check for duplicates first
    const duplicateCheck = await CandidateService.checkDuplicates({
      pan,
      aadhaar,
      email,
      phone,
    });

    if (duplicateCheck.hasDuplicates) {
      return res.status(409).json({
        success: false,
        message: "Candidate already exists with duplicate information",
        data: duplicateCheck.data,
        hasDuplicates: true,
      });
    }

    // Create candidate and offer in a single transaction
    const result = await CandidateService.createCandidateWithOffer(
      {
        pan,
        aadhaar,
        email,
        phone,
        name,
        location,
        profile: {
          ...profile,
          skills: skills || [], // Ensure skills are properly set
        },
        whatsappNumber,
        consent,
      },
      {
        position,
        compensation,
        timeline,
        priority,
        competition,
        tags,
      },
      hrId
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error creating candidate with offer:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating candidate with offer",
      error: error.message,
    });
  }
});

// NEW: Direct offer creation for existing candidate
router.post("/:candidateId/offer", auth, async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { position, compensation, timeline, priority, competition, tags } =
      req.body;
    const hrId = req.user.id;

    // Validate required fields
    if (!position || !compensation) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required offer fields: Position and Compensation are required",
      });
    }

    // Check if candidate exists
    const candidate = await CandidateService.getCandidateById(candidateId);
    if (!candidate.success) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // Create offer for existing candidate
    const result = await CandidateService.createOfferForExistingCandidate(
      candidateId,
      {
        position,
        compensation,
        timeline,
        priority,
        competition,
        tags,
      },
      hrId
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error creating offer for existing candidate:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating offer",
      error: error.message,
    });
  }
});

//candidate get by id-api
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const hrId = req.user.id;
    const result = await CandidateService.getCandidateWithOffers(id, hrId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching candidate:", error);

    if (error.message === "Candidate not found") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching candidate",
      error: error.message,
    });
  }
});

// //candidate update status-api
// router.put("/:id/status", auth, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;
//     const hrId = req.user.id;

//     if (!status) {
//       return res.status(400).json({
//         success: false,
//         message: "Status is required",
//       });
//     }

//     const result = await CandidateService.updateCandidateStatus(
//       id,
//       status,
//       hrId
//     );

//     return res.status(200).json(result);
//   } catch (error) {
//     console.error("Error updating candidate status:", error);

//     if (error.message === "Candidate not found") {
//       return res.status(404).json({
//         success: false,
//         message: "Candidate not found",
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error while updating candidate status",
//       error: error.message,
//     });
//   }
// });

//candidate search-api
router.get("/search", auth, async (req, res) => {
  try {
    const {
      status,
      location,
      experience,
      skills,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (location) {
      filters["location.city"] = { $regex: location, $options: "i" };
    }
    if (experience) {
      filters["profile.totalExperience"] = { $gte: parseInt(experience) };
    }
    if (skills) filters.skills = skills.split(",").map((s) => s.trim());

    const result = await CandidateService.searchCandidates(
      filters,
      parseInt(page),
      parseInt(limit)
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error searching candidates:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while searching candidates",
      error: error.message,
    });
  }
});

//candidate analytics overview-api
router.get("/analytics/overview", auth, async (req, res) => {
  try {
    const result = await CandidateService.getCandidateAnalytics();

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching candidate analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching analytics",
      error: error.message,
    });
  }
});

//candidate recent activity-api
router.get("/analytics/recent-activity", auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recentActivity = await CandidateService.getRecentActivity(
      parseInt(limit)
    );

    return res.status(200).json({
      success: true,
      data: recentActivity,
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching recent activity",
      error: error.message,
    });
  }
});

//candidate communicate-api
router.post("/:id/communicate", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetHrId, message, communicationType } = req.body;
    const hrId = req.user.id;

    if (!targetHrId || !message) {
      return res.status(400).json({
        success: false,
        message: "Target HR ID and message are required",
      });
    }

    // Get candidate and target HR details
    const candidate = await CandidateService.getCandidateById(id);
    const targetHr = await require("../models/hrSchema").Hr.findById(
      targetHrId
    );

    if (!targetHr) {
      return res.status(404).json({
        success: false,
        message: "Target HR not found",
      });
    }

    // Generate WhatsApp message for coordination
    const whatsappMessage = `Hi ${targetHr.name} from ${targetHr.company.name}! 

I'm reaching out regarding candidate ${candidate.data.name} who appears to have multiple offers.

${message}

Let's coordinate to avoid candidate confusion. Please respond at your convenience.

Best regards,
${req.user.name}
${req.user.company.name}`;

    // Add communication record
    await CandidateService.updateCandidateStatus(id, "MULTIPLE_OFFERS", hrId);

    return res.status(200).json({
      success: true,
      message: "Communication initiated successfully",
      data: {
        whatsappMessage,
        targetHr: {
          name: targetHr.name,
          company: targetHr.company.name,
          whatsapp: targetHr.whatsapp.phoneNumber,
        },
        communicationType: communicationType || "WHATSAPP_COORDINATION",
      },
    });
  } catch (error) {
    console.error("Error initiating communication:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while initiating communication",
      error: error.message,
    });
  }
});

//candidate duplicate summary-api
router.get("/duplicates/summary", auth, async (req, res) => {
  try {
    const duplicateRate = await CandidateService.calculateDuplicateRate();
    const totalCandidates =
      await require("../models/candidate").countDocuments();
    const candidatesWithCommunications =
      await require("../models/candidate").countDocuments({
        "communications.0": { $exists: true },
      });

    return res.status(200).json({
      success: true,
      data: {
        duplicateRate: Math.round(duplicateRate * 100) / 100,
        totalCandidates,
        candidatesWithCommunications,
        resolutionNeeded: candidatesWithCommunications,
      },
    });
  } catch (error) {
    console.error("Error fetching duplicate summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching duplicate summary",
      error: error.message,
    });
  }
});

module.exports = router;
