const Joi = require('joi');
const mongoose = require('mongoose');

// 7. Company Model (for company management)
const companySchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    industry: String,
    size: {
      type: String,
      enum: ['Startup', 'Small', 'Medium', 'Large', 'Enterprise']
    },
    headquarters: {
      city: String,
      state: String,
      country: String
    },
    website: String,
    description: String,
    isActive: {
      type: Boolean,
      default: true
    },
    settings: {
      allowDuplicateOffers: { type: Boolean, default: false },
      autoExpireOffers: { type: Boolean, default: true },
      defaultOfferValidityDays: { type: Number, default: 15 },
      enableHRCommunication: { type: Boolean, default: true },
      dataRetentionDays: { type: Number, default: 365 }
    },
    statistics: {
      totalHRs: { type: Number, default: 0 },
      totalOffers: { type: Number, default: 0 },
      successfulHires: { type: Number, default: 0 },
      averageTimeToHire: Number // in days
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });

