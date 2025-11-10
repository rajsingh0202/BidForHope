const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auctionController = require('../controllers/auctionController');
const { directDonate } = require('../controllers/auctionController');
const Auction = require('../models/Auction'); // <-- import your model

// Public routes
router.get('/', auctionController.getAuctions);
router.get('/urgent', auctionController.getUrgentAuctions);

// Admin approval routes (MUST come BEFORE /:id)
router.get('/pending', protect, authorize('admin'), auctionController.getPendingAuctions);

// All auctions for authenticated users (MUST come BEFORE /:id)
router.get('/all', protect, auctionController.getAllAuctionsForUser);

// Single auction route (comes AFTER specific routes like /pending and /all)
router.get('/:id', auctionController.getAuction);

// Protected routes
router.post('/', protect, authorize('admin', 'ngo'), auctionController.createAuction);
router.put('/:id', protect, authorize('admin', 'ngo'), auctionController.updateAuction);
router.delete('/:id', protect, authorize('admin'), auctionController.deleteAuction);

// Admin approval actions
router.put('/:id/approve', protect, authorize('admin'), auctionController.approveAuction);
router.put('/:id/reject', protect, authorize('admin'), auctionController.rejectAuction);
router.put('/:id/end', protect, authorize('admin'), auctionController.endAuction);

router.post('/:id/donate', directDonate);

// --- Add this at the bottom for lightweight count ---
router.get('/pending/count', async (req, res) => {
  try {
    const count = await Auction.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
