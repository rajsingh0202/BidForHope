const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema({
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  bidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  isAutoBid: {
    type: Boolean,
    default: false
  },
  maxAutoBidAmount: {
    type: Number
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'outbid', 'winning', 'won', 'lost'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bid', BidSchema);
