const express = require('express');
const { 
  createOrder, 
  verifyPayment, 
  getUserPayments,
  getNGOPayments 
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Payment routes (protected - user must be logged in)
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/user-payments', protect, getUserPayments);
router.get('/ngo-payments/:ngoId', protect, getNGOPayments);

module.exports = router;
