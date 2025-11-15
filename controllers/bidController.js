const Bid = require('../models/Bid');
const Auction = require('../models/Auction');
const io = global._io;

// Place a bid
exports.placeBid = async (req, res) => {
  try {
    const { amount } = req.body;
    const auctionId = req.params.id;
    const bidderId = req.user._id;

    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (auction.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Auction is not active' });
    }
    if (amount < auction.currentPrice + auction.bidIncrement) {
      return res.status(400).json({
        success: false,
        message: `Bid must be at least ₹${auction.currentPrice + auction.bidIncrement}`,
      });
    }

    const bid = await Bid.create({
      auction: auctionId,
      bidder: bidderId,
      amount,
    });

    // update auction current price, total bids, etc.
    auction.currentPrice = amount;
    auction.totalBids = (auction.totalBids || 0) + 1;
    await auction.save();

    // Emit bid update event for this auction (real-time refresh for all clients)
    if (io) {
      io.to(auctionId.toString()).emit('bidPlaced');
    }

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully!',
      data: bid,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all bids for an auction
exports.getAuctionBids = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const bids = await Bid.find({ auction: auctionId })
      .populate('bidder', 'name email')
      .sort('-time');
    res.status(200).json({
      success: true,
      count: bids.length,
      data: bids,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all bids for logged-in user
exports.getUserBids = async (req, res) => {
  try {
    const userId = req.user._id;
    const bids = await Bid.find({ bidder: userId })
      .populate('auction', 'title currentPrice status')
      .sort('-time');
    res.status(200).json({
      success: true,
      count: bids.length,
      data: bids,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
