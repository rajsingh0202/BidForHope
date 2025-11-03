const mongoose = require('mongoose');

const NGOSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add NGO name'],
    trim: true,
    unique: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Please add registration number'],
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Please add email'],
    unique: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    // Add for direct Place Address
    placeAddress: String
  },
  website: String,
  logo: {
    type: String,
    default: 'default-ngo-logo.jpg'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  causesSupported: [{
    type: String,
    required : true
  }],
  // Field for years in operation
  workingYears: {
    type: Number,
    required: [true, 'Please add number of working years']
  },
  // Domains/tags
  domains: [{
    type: String,
    required: true
  }],
  // Approval workflow status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  totalFundsReceived: {
    type: Number,
    default: 0
  },
  activeAuctions: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('NGO', NGOSchema);
