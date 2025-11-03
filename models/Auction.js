const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add auction title'],
    trim: true
  },
  images: [{
    url: String,
    publicId: String
  }],
  logo: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: [true, 'Please add description']
  },
  itemType: {
    type: String,
    enum: ['physical', 'service', 'experience', 'nft', 'digital'],
    required: true
  },
  startingPrice: {
    type: Number,
    required: [true, 'Please add starting price'],
    min: 0
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  bidIncrement: {
    type: Number,
    default: 100
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'ended'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  urgentCause: {
    type: String,
    enum: ['disaster-relief', 'medical-emergency', 'humanitarian-crisis', 'other'],
    required: false
  },
  ngo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: true
  },
  beneficiaryNGOs: [{
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NGO'
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  totalBids: {
    type: Number,
    default: 0
  },
  totalDonations: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  allowDirectDonation: {
    type: Boolean,
    default: true
  },
  enableAutoBidding: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    enum: ['art', 'collectibles', 'fashion', 'tech', 'experiences', 'other']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Auction', AuctionSchema);
