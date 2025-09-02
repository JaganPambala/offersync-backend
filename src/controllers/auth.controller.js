const express = require('express');
const router = express.Router(); 
const { Hr, validateHRUpdate } = require('../models/hrSchema');
const {registerHRService,loginHRService} = require('../services/auth.service')
const jwt = require('jsonwebtoken');
const config= require("config");
const authMiddleware = require('../middleware/auth');


router.post('/register', async (req, res) => {
    try {
        console.log(req.body);
        const savedHR = await registerHRService(req.body);

        res.status(201).json({
            message: 'HR registered successfully',
            data: savedHR
        });
    } catch (error) {
        console.error('Error in registerHRController:', error.message);
        res.status(error.statusCode || 500).json({
            error: error.message || 'Internal Server Error'
        });
    }
    
}); 

router.post('/login', async(req, res)=>{
    try {
        console.log("Login request body:", req.body);

        const loggedHR = await loginHRService(req.body);

        
        if (!loggedHR) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        
        const token = jwt.sign(
            { id: loggedHR._id, role: "HR" }, 
            config.get("jwtSecret"), 
            { expiresIn: '12h' } 
        );

        res.status(200).json({
            message: "HR logged in successfully",
            token: token,
            data: loggedHR
        });

    } catch (error) {
        console.error('Error in loginHRController:', error.message);
        res.status(error.statusCode || 500).json({
            error: error.message || 'Internal Server Error'
        });
    }
})


router.get('/myProfile', authMiddleware, async(req, res)=>{
    try {
        const hr = await Hr.findById(req.user.id).select('-password');
        
        if (!hr) {
            return res.status(404).json({ error: "HR profile not found" });
        }

        res.status(200).json({
            message: "Profile fetched successfully",
            data: hr
        });
        
    } catch (error) {
        console.error('Error in getHRProfile:', error.message);
        res.status(500).json({
            error: error.message || 'Internal Server Error'
        });
    }
});

router.put('/updateProfile', authMiddleware, async(req, res) => {
    try {
        // Validate the update data
        const { error } = validateHRUpdate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Find and update the HR profile
        const updatedHR = await Hr.findByIdAndUpdate(
            req.user.id,
            { 
                $set: {
                    ...req.body,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedHR) {
            return res.status(404).json({ error: "HR profile not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            data: updatedHR
        });

    } catch (error) {
        console.error('Error in updateHRProfile:', error.message);
        res.status(500).json({
            error: error.message || 'Internal Server Error'
        });
    }
});

module.exports = router;
