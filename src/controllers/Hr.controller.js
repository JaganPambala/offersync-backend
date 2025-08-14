const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/health', auth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;


