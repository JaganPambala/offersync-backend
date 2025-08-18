const Joi = require('joi');
const mongoose = require('mongoose');

const hrSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
        match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
    },

    // WhatsApp Integration (Core Feature)
  whatsapp: {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    isBusinessAccount: {
      type: Boolean,
      default: false
    },
    preferredHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
      timezone: { type: String, default: 'Asia/Kolkata' }
    },
    autoReplyMessage: {
      type: String,
      maxlength: 500,
      default: "Hi! I'm an HR reaching out regarding a mutual candidate. I'll respond during business hours."
    }
  },
  
    //company details
    company:{
        name:{
            type: String,
            required: true,
        },
        industry:String,
        size:{
            type: String,
            enum:['Startup', "Small", "Medium", "Large"],
            default: "Medium"
        },
        location:{
            city: String,
            state: String,
           country:{type:String, default:"India"}
        },
       
    },
    role:{
        type: String,
        enum:["HR Executive", "Senior HR", "HR Manager", "HR Director"],
        default: "HR Executive"
    },
    permissions: {
        canCreateOffers: { type: Boolean, default: true },
        canViewAllCandidates: { type: Boolean, default: true },
        canInitiateWhatsApp: { type: Boolean, default: true },
        canViewAnalytics: { type: Boolean, default: true },
        canExportData: { type: Boolean, default: false }
      },
      stats: {
        totalOffersCreated: { type: Number, default: 0 },
        successfulHires: { type: Number, default: 0 },
        whatsappCommunications: { type: Number, default: 0 },
        responseRate: { type: Number, default: 0 }, // percentage
      },
      preferences: {
        emailNotifications: { type: Boolean, default: true },
        whatsappNotifications: { type: Boolean, default: true },
        weeklyReports: { type: Boolean, default: true },
        theme: { type: String, enum: ['light', 'dark'], default: 'light' }
      },
      isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }  
},
{
    timestamps: true
}) ;

const Hr= mongoose.model('Hr', hrSchema); 

// Validation for HR Registration
const validateHRRegister = (hr) => {
    console.log(hr);
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required()
            .messages({
                'string.min': 'Name must be at least 3 characters long',
                'string.max': 'Name cannot exceed 50 characters',
                'any.required': 'Name is required'
            }),
        email: Joi.string().email().required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string().min(8).required()
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
                'any.required': 'Password is required'
            }),
        company: Joi.object({
            name: Joi.string().required()
                .messages({
                    'any.required': 'Company name is required'
                }),
            industry: Joi.string().optional(),
            size: Joi.string().valid('Startup', 'Small', 'Medium', 'Large').default('Medium'),
            location: Joi.object({
                city: Joi.string().optional(),
                state: Joi.string().optional(),
                country: Joi.string().default('India')
            }).optional(),
            logo: Joi.string().uri().optional()
        }).required(),
        role: Joi.string().valid('HR Executive', 'Senior HR', 'HR Manager', 'HR Director').default('HR Executive'),
        whatsapp: Joi.object({
            phoneNumber: Joi.string().pattern(/^(\+91|91|0)?[6-9]\d{9}$/).required()
                .messages({
                    'string.pattern.base': 'Please provide a valid Indian phone number (e.g., +919876543210, 919876543210, 9876543210, or 09876543210)',
                    'any.required': 'WhatsApp phone number is required'
                }),
            isBusinessAccount: Joi.boolean().default(false),
            preferredHours: Joi.object({
                start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00')
                    .messages({
                        'string.pattern.base': 'Start time must be in HH:MM format (e.g., 09:00)'
                    }),
                end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('18:00')
                    .messages({
                        'string.pattern.base': 'End time must be in HH:MM format (e.g., 18:00)'
                    }),
                timezone: Joi.string().default('Asia/Kolkata')
            }).default(),
            autoReplyMessage: Joi.string().max(500).default("Hi! I'm an HR reaching out regarding a mutual candidate. I'll respond during business hours.")
                .messages({
                    'string.max': 'Auto-reply message cannot exceed 500 characters'
                })
        }).required()
    });
    
    return schema.validate(hr);
};

// Validation for HR Login
const validateHRLogin = (loginData) => {
    const schema = Joi.object({
        email: Joi.string().email().required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string().required()
            .messages({
                'any.required': 'Password is required'
            })
    });
    
    return schema.validate(loginData);
};

// Validation for HR Profile Update
const validateHRUpdate = (hr) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).optional(),
        company: Joi.object({
            name: Joi.string().optional(),
            industry: Joi.string().optional(),
            size: Joi.string().valid('Startup', 'Small', 'Medium', 'Large').optional(),
            location: Joi.object({
                city: Joi.string().optional(),
                state: Joi.string().optional(),
                country: Joi.string().optional()
            }).optional(),
            logo: Joi.string().uri().optional()
        }).optional(),
        role: Joi.string().valid('HR Executive', 'Senior HR', 'HR Manager', 'HR Director').optional(),
        whatsapp: Joi.object({
            phoneNumber: Joi.string().pattern(/^(\+91|91|0)?[6-9]\d{9}$/).optional()
                .messages({
                    'string.pattern.base': 'Please provide a valid Indian phone number (e.g., +919876543210, 919876543210, 9876543210, or 09876543210)'
                }),
            isBusinessAccount: Joi.boolean().optional(),
            preferredHours: Joi.object({
                start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
                    .messages({
                        'string.pattern.base': 'Start time must be in HH:MM format (e.g., 09:00)'
                    }),
                end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
                    .messages({
                        'string.pattern.base': 'End time must be in HH:MM format (e.g., 18:00)'
                    }),
                timezone: Joi.string().optional()
            }).optional(),
            autoReplyMessage: Joi.string().max(500).optional()
                .messages({
                    'string.max': 'Auto-reply message cannot exceed 500 characters'
                })
        }).optional(),
        preferences: Joi.object({
            emailNotifications: Joi.boolean().optional(),
            whatsappNotifications: Joi.boolean().optional(),
            weeklyReports: Joi.boolean().optional(),
            theme: Joi.string().valid('light', 'dark').optional()
        }).optional()
    });
    
    return schema.validate(hr);
};

// Legacy validation function (keeping for backward compatibility)
const validateHR = (hr) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
    });
    return schema.validate(hr);
};

module.exports = {
    Hr,
    validateHR,
    validateHRRegister,
    validateHRLogin,
    validateHRUpdate
}

