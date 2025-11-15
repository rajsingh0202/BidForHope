// utils/razorpay.js
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // from your .env
  key_secret: process.env.RAZORPAY_KEY_SECRET, // from your .env
});

module.exports = razorpay;
