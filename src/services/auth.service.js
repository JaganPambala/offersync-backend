const { Hr, validateHRRegister,validateHRLogin } = require('../models/hrSchema');

const bcrypt = require('bcryptjs');
const registerHRService = async (hrDetails) => {
    const { error } = validateHRRegister(hrDetails);
    if (error) {
        const validationError = new Error(error.details[0].message);
        validationError.statusCode = 400;
        throw validationError;
    }

    
    const existingHR = await Hr.findOne({ email: hrDetails.email });
    if (existingHR) {
        const err = new Error('Email already registered');
        err.statusCode = 409;
        throw err;
    }

    
    const existingPhone = await Hr.findOne({ 'whatsapp.phoneNumber': hrDetails.whatsapp.phoneNumber });
    if (existingPhone) {
        const err = new Error('WhatsApp phone number already registered');
        err.statusCode = 409;
        throw err;
    }

    
    const salt = await bcrypt.genSalt(10);
    hrDetails.password = await bcrypt.hash(hrDetails.password, salt);

    
    const hr = new Hr(hrDetails);
    const savedHR = await hr.save();

    // Return a sanitized object without password
    const { _id, name, email, role, company } = savedHR.toObject();
    return { _id, name, email, role, company };
};



const loginHRService = async (loginDetails) => {
    
    const { error } = validateHRLogin(loginDetails);
    if (error) {
        const validationError = new Error(error.details[0].message);
        validationError.statusCode = 400;
        throw validationError;
    }

    
    // Fetch full document to compare hashed password and keep _id for token
    const hr = await Hr.findOne({ email: loginDetails.email });
    if (!hr) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    
    const isMatch = await bcrypt.compare(loginDetails.password, hr.password);
    if (!isMatch) {
        const err = new Error('Invalid password');
        err.statusCode = 401;
        throw err;
    }

    
    hr.lastLogin = new Date();
    await hr.save();

    // Build a sanitized response without password
    const { _id, name, email, role } = hr.toObject();
    return { _id, name, email, role };
};

module.exports = {
    registerHRService,
    loginHRService
};
