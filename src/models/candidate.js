
const Joi = require('joi');
const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    // Personal Info (Encrypted)
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    hashedPAN: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    hashedAadhaar: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    whatsappNumber: String,
    
    // Location
    location: {
      city: String,
      state: String,
      country: { type: String, default: 'India' }
    },
    
    // Professional Profile
    profile: {
      currentCompany: String,
      currentRole: String,
      totalExperience: Number, // months
      skills: [String],
      salaryRange: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'INR' }
      },
      noticePeriod: { type: Number, default: 30 }, // days
      immediateJoiner: { type: Boolean, default: false }
    },
    
    // Core Status Management
    status: {
      type: String,
      enum: ['AVAILABLE', 'OFFERED', 'MULTIPLE_OFFERS', 'ACCEPTED', 'JOINED', 'WITHDRAWN'],
      default: 'AVAILABLE',
      index: true
    },
    
    // Growth Metrics
    metrics: {
      totalOffers: { type: Number, default: 0 },
      activeOffers: { type: Number, default: 0 },
      acceptedOffers: { type: Number, default: 0 },
      averageOfferValue: Number,
      highestOfferValue: Number,
      totalCommunications: { type: Number, default: 0 }
    },
    
    // Communication Tracking
    communications: [{
      withHrId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hr' },
      status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
      startedAt: { type: Date, default: Date.now },
      resolvedAt: Date
    }],
    
    // Privacy & Consent
    consent: {
      dataSharing: { type: Boolean, default: false },
      whatsappContact: { type: Boolean, default: false },
      marketingEmails: { type: Boolean, default: false },
      consentDate: Date
    },
    
    // Metadata
    source: {
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Hr' },
      method: { type: String, enum: ['MANUAL', 'BULK_UPLOAD', 'API'], default: 'manual' }
    },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, {
    timestamps: true
  });
  

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate;