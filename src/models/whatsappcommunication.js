const Joi = require("joi");
const mongoose = require("mongoose");
// 4. WhatsApp Communication Model (Core Feature)
const { Hr } = require("../models/hrSchema");
const whatsappCommunicationSchema = new mongoose.Schema(
  {
    // Unique Tracking
    trackingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Core References
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    initiatorHrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hr",
      required: true,
    },
    recipientHrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hr",
      required: true,
    },

    // WhatsApp Details
    whatsapp: {
      deepLink: { type: String, required: true },
      message: { type: String, required: true, maxlength: 1000 },
      recipientPhone: { type: String, required: true },
      templateUsed: {
        type: String,
        enum: [
          "DUPLICATE_OFFER",
          "TIMELINE_SYNC",
          "SALARY_DISCUSSION",
          "CUSTOM",
        ],
        default: "DUPLICATE_OFFER",
      },
    },

    // Status Tracking (Core)
    status: {
      type: String,
      enum: ["INITIATED", "OPENED", "RESPONDED", "RESOLVED", "EXPIRED"],
      default: "INITIATED",
      index: true,
    },

    // Outcome (Growth Feature)
    outcome: {
      result: {
        type: String,
        enum: [
          "TIMELINE_AGREED",
          "PRIORITY_SET",
          "SALARY_ADJUSTED",
          "CONFLICT_RESOLVED",
          "NO_AGREEMENT",
          "CANDIDATE_WITHDREW",
        ],
      },
      description: String,
      actions: [String],
      followUpNeeded: { type: Boolean, default: false },
      followUpDate: Date,
    },

    // Related Offers
    offers: [
      {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
        role: { type: String, enum: ["INITIATOR", "RECIPIENT"] },
      },
    ],

    // Metrics (Growth Analytics)
    metrics: {
      generatedAt: { type: Date, default: Date.now },
      openedAt: Date,
      respondedAt: Date,
      resolvedAt: Date,
      responseTimeMinutes: Number,
      resolutionTimeHours: Number,
    },

    // Priority
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },

    // Auto-expire after 7 days
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "WhatsappCommunication",
  whatsappCommunicationSchema
);
