const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const bidController = require('../controllers/bidController');

// Place bid (must be authenticated)
router.post('/:id', protect, bidController.placeBid);

// Get all bids for an auction
router.get('/auction/:id', bidController.getAuctionBids);

// Get all bids for logged-in user
router.get('/user', protect, bidController.getUserBids);

module.exports = router;
