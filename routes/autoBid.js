const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const AutoBid = require('../models/AutoBid');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const io = global._io;

// Enable or update auto-bid
router.post('/enable', protect, async (req, res) => {
  const { auctionId, maxAmount } = req.body;
  if (!auctionId || !maxAmount) {
    return res.status(400).json({ success: false, message: "auctionId and maxAmount are required." });
  }
  try {
    const autoBid = await AutoBid.findOneAndUpdate(
      { user: req.user._id, auction: auctionId },
      { maxAmount, isActive: true, stopReason: null },
      { upsert: true, new: true }
    );

    // === AUTO-BID INSTANT BID LOGIC ===
    const auction = await Auction.findById(auctionId);
    if (!auction || auction.status !== "active") {
      return res.status(404).json({ success: false, message: "Auction not found or not active." });
    }
    const highestBid = await Bid.findOne({ auction: auctionId }).sort('-amount');

    if (!highestBid || highestBid.bidder.toString() !== req.user._id.toString()) {
      // Place the next minimum bid, but not exceeding user's max amount
      const nextBidAmount = Math.min(auction.currentPrice + auction.bidIncrement, maxAmount);
      if (nextBidAmount > auction.currentPrice) {
        const bid = await Bid.create({
          auction: auctionId,
          bidder: req.user._id,
          amount: nextBidAmount,
          time: Date.now(),
        });
        auction.currentPrice = nextBidAmount;
        auction.totalBids = (auction.totalBids || 0) + 1;
        await auction.save();

        // If auto-bid did not go above their own max, check and disable
        if (nextBidAmount >= maxAmount) {
          // Disable auto-bid and add stopReason
          await AutoBid.findOneAndUpdate(
            { user: req.user._id, auction: auctionId },
            { isActive: false, stopReason: 'max-amount' }
          );
        }

        // Emit socket event for real-time bid update
        const allBids = await Bid.find({ auction: auctionId })
          .populate('bidder', 'name email')
          .sort('-time');
        io.to(auctionId.toString()).emit('auctionBidUpdate', allBids);
      } else {
        // User's next bid would exceed max even if not top: disable & add reason
        await AutoBid.findOneAndUpdate(
          { user: req.user._id, auction: auctionId },
          { isActive: false, stopReason: 'max-amount' }
        );
      }
    }
    // === END AUTO-BID LOGIC ===

    res.json({ success: true, autoBid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to enable auto-bid." });
  }
});

// Disable auto-bid
router.post('/disable', protect, async (req, res) => {
  const { auctionId } = req.body;
  if (!auctionId)
    return res.status(400).json({ success: false, message: "auctionId required" });
  try {
    await AutoBid.findOneAndUpdate(
      { user: req.user._id, auction: auctionId },
      { isActive: false, stopReason: 'manual' }
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
