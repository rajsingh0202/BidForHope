const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction'
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  splitDonations: [{
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NGO'
    },
    amount: Number,
    percentage: Number
  }],
  isMatched: {
    type: Boolean,
    default: false
  },
  matchedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  matchedAmount: {
    type: Number,
    default: 0
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Donation', DonationSchema);
