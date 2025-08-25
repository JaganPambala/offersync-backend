const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const DashboardService = require('../services/dashboard.service');


// GET /dashboard - analytics for logged-in HR (private)
router.get('/', auth, async (req, res) => {
  try {
    const hrId = req.user.id;
    const data = await DashboardService.getDashboardData(hrId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /dashboard/public - analytics for all users (public)
router.get('/public', async (req, res) => {
  try {
    const data = await DashboardService.getPublicDashboardData();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
