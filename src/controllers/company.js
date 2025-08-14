const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// minimal placeholder routes to keep server healthy
router.get('/health', auth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;


