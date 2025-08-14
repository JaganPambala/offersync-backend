
const Joi = require('joi');
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    // Core References
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true
    },
    hrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hr',
      required: true,
      index: true
    },
    
    // Position Details
    position: {
      title: { type: String, required: true },
      level: { 
        type: String, 
        enum: ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director'], 
        default: 'Mid' 
      },
    },
    
    // Compensation (Detailed for Growth)
    compensation: {
      base: { type: Number, required: true },
      variable: { type: Number, default: 0 },
      stocks: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      total: Number, // auto-calculated
      currency: { type: String, default: 'INR' },
      
    },
    
    // Timeline Management
    timeline: {
      offerDate: { type: Date, default: Date.now },
      validTill: { type: Date, required: true },
      expectedJoinDate: Date,
      actualJoinDate: Date,
      followUpDate: Date
    },
    
    // Status Management (Core Feature)
    status: {
      type: String,
      enum: [
        'DRAFT', 'ACTIVE', 'ACCEPTED', 'REJECTED', 
        'EXPIRED', 'WITHDRAWN', 'ON_HOLD', 'JOINED'
      ],
      default: 'ACTIVE',
      index: true
    },
    
    // Competition Tracking (Growth Feature)
    competition: {
      isCompetitive: { type: Boolean, default: false },
      competitorCount: { type: Number, default: 0 },
      marketRank: { 
        type: String, 
        enum: ['LEADING', 'COMPETITIVE', 'BELOW_MARKET'], 
        default: 'COMPETITIVE' 
      },
      collaborationNeeded: { type: Boolean, default: false }
    },
    
    // Priority & Urgency
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    
    // Growth Analytics Fields
    analytics: {
      viewCount: { type: Number, default: 0 },
      updateCount: { type: Number, default: 0 },
      communicationCount: { type: Number, default: 0 },
      daysActive: Number, // auto-calculated
      conversionProbability: Number // ML prediction (future)
    },
    
    // Tags for Growth (Searchability)
    tags: [String],
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, {
    timestamps: true
  });
  
  // Auto-calculate total compensation
  offerSchema.pre('save', function(next) {
    this.compensation.total = 
      (this.compensation.base || 0) + 
      (this.compensation.variable || 0) +
      (this.compensation.stocks || 0) + 
      (this.compensation.bonus || 0);
    
    // Calculate days active
    if (this.createdAt) {
      this.analytics.daysActive = Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
    }
    next();
  });

  // Export the Offer model
  module.exports = mongoose.model('Offer', offerSchema);