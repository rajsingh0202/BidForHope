const express = require('express');
const { 
  register, login, getMe,
  requestOtp, verifyOtp,
  loginSendOtp, loginVerifyOtp // <-- added for login OTP flow
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// OTP-related routes FIRST
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);

// Login OTP routes
router.post('/login-send-otp', loginSendOtp);
router.post('/login-verify-otp', loginVerifyOtp);

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route (requires login)
router.get('/me', protect, getMe);

module.exports = router;
