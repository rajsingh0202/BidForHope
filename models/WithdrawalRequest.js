const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  ngo: {
    type: String, // Email instead of ObjectId
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  domain: String,
  description: String,
  bankDetails: {
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    branch: String,
    phone : String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNote: String
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
