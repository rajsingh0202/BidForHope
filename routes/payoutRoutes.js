const express = require('express');
const {
  createRazorpayContact,
  createRazorpayFundAccount,
  initiatePayoutToNGO,
  processWithdrawalAndPayout
} = require('../controllers/payoutController');
const router = express.Router();

router.post('/ngo/contact', createRazorpayContact);
router.post('/ngo/fund-account', createRazorpayFundAccount);
router.post('/ngo/send-money', initiatePayoutToNGO);

// For admin withdrawal approval with payout
router.post('/withdrawal/:id/process-and-pay', processWithdrawalAndPayout);

module.exports = router;
