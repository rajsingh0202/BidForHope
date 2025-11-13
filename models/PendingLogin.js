const mongoose = require('mongoose');

const PendingLoginSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: String,
  otpExpires: Date,
});

module.exports = mongoose.model('PendingLogin', PendingLoginSchema);
