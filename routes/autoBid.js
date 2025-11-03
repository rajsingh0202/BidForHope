const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const AutoBid = require('../models/AutoBid');

// Enable or update auto-bid
router.post('/enable', protect, async (req, res) => {
  const { auctionId, maxAmount } = req.body;
  if (!auctionId || !maxAmount) {
    return res.status(400).json({ success: false, message: "auctionId and maxAmount are required." });
  }
  try {
    const autoBid = await AutoBid.findOneAndUpdate(
      { user: req.user._id, auction: auctionId },
      { maxAmount, isActive: true },
      { upsert: true, new: true }
    );
    res.json({ success: true, autoBid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to enable auto-bid." });
  }
});

// Disable auto-bid
router.post('/disable', protect, async (req, res) => {
  const { auctionId } = req.body;
  if (!auctionId) return res.status(400).json({ success: false, message: "auctionId required" });
  try {
    await AutoBid.findOneAndUpdate(
      { user: req.user._id, auction: auctionId },
      { isActive: false }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to disable auto-bid." });
  }
});

// Optional: Get user's auto-bid status for an auction
router.get('/status/:auctionId', protect, async (req, res) => {
  const { auctionId } = req.params;
  try {
    const autoBid = await AutoBid.findOne({ user: req.user._id, auction: auctionId });
    res.json({ success: true, autoBid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
