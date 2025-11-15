const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ngo: {
    type: String, // CHANGE: store ngo email as String, not ObjectId!
    required: true
  },
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    default: null // null for direct donations
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['bid', 'donation'],
    required: true
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
