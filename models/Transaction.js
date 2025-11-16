const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO', required: true },
  ngoEmail: { type: String, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  reference: { type: String },
  description: { type: String },
  domain: { type: String },
  status: { type: String, enum: ['pending', 'debited','completed'], default: 'pending' }, // <-- Add this line!
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
