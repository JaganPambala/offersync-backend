const express = require('express');
const router = express.Router(); 
const Hr = require('../models/hrSchema');
const {registerHRService,loginHRService} = require('../services/auth.service')
const jwt = require('jsonwebtoken');
const config= require("config");


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
            { expiresIn: '1h' } 
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

module.exports = router;