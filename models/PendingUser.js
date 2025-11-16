const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: String,
  otpExpires: Date,
});

module.exports = mongoose.model('PendingUser', PendingUserSchema);
