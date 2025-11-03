const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auctionController = require('../controllers/auctionController');
const { directDonate } = require('../controllers/auctionController');

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

module.exports = router;
