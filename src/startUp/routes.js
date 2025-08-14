const express = require('express');
const authRoutes = require('../controllers/auth.controller');
const candidateRoutes = require('../controllers/candidate.controller');
const companyRoutes = require('../controllers/company');
const hrRoutes = require('../controllers/Hr.controller');
const offerRoutes = require('../controllers/offers.controller');

module.exports = function(app) {
    console.log('Routes loaded');
    if (authRoutes) app.use('/api/auth', authRoutes);
    if (companyRoutes) app.use('/api/company', companyRoutes);
    if (hrRoutes) app.use('/api/hr', hrRoutes);
    if (candidateRoutes) app.use('/api/candidate', candidateRoutes);
    if (offerRoutes) app.use('/api/offers', offerRoutes);
}



