const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const OfferService = require('../services/offer.service');



// Get an offer by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const offer = await OfferService.getOfferById(req.params.id);
    return res.status(200).json({ success: true, data: offer });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
});

// List offers with filters
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const result = await OfferService.listOffers(filters, parseInt(page), parseInt(limit));
    
    // Return the data in the new structure
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});



// Update status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { 
      status,
      validTill,    // Add these new fields
      followUpDate  // from the UI
    } = req.body;

    // First update the status
    const updated = await OfferService.updateStatus(
      req.params.id, 
      status,
      {
        validTill,
        followUpDate
      }
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    const statusCode = error.code === 'VALIDATION_ERROR' ? 400 : (error.message === 'Offer not found' ? 404 : 400);
    return res.status(statusCode).json({ success: false, message: error.message });
  }
});




// Delete offer
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await OfferService.removeOffer(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const status = error.message === 'Offer not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
});



module.exports = router;