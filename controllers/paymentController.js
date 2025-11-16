const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentTransaction = require('../models/PaymentTransaction');
const NGO = require('../models/NGO');
const Auction = require('../models/Auction');
const Transaction = require('../models/Transaction'); // Make sure this is imported

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET, // <-- Fixed typo
});

// Create Razorpay Order
exports.createOrder = async (req, res) => {
  console.log('PAYMENT CREATE BODY:', req.body);
  try {
    const { amount, ngoEmail, auctionId, type } = req.body;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Validate NGO exists
    const ngo = await NGO.findOne({ email: ngoEmail.toLowerCase() });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    // Create Razorpay order (amount must be in paise: ₹1 = 100 paise)
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        ngoEmail: ngo.email,
        auctionId: auctionId || 'direct_donation',
        type,
        userId: req.user.id,
      },
    };

    const order = await razorpay.orders.create(options);

    // Save transaction record as pending
    const transaction = await PaymentTransaction.create({
      user: req.user.id,
      ngo: ngo.email, // store as string email
      auction: auctionId || null,
      amount,
      type,
      razorpayOrderId: order.id,
      status: 'pending',
    });

    res.json({
      success: true,
      order,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Payment and Credit NGO Wallet (for both donations and winning bids!)
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transactionId,
    } = req.body;

    // Check if it's a test payment (for development)
    const isTestPayment = razorpay_payment_id.startsWith('test_');

    if (!isTestPayment) {
      // Real payment verification
      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest('hex');

      if (razorpay_signature !== expectedSign) {
        await PaymentTransaction.findByIdAndUpdate(transactionId, {
          status: 'failed',
        });
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payment signature' });
      }
    }

    // Payment verified (or test payment)! Update transaction
    const transaction = await PaymentTransaction.findByIdAndUpdate(
      transactionId,
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'success',
      },
      { new: true }
    );

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: 'Transaction not found' });
    }

    // --- For email-based NGO reference & save Transaction model ---
    const ngo = await NGO.findOne({ email: transaction.ngo.toLowerCase() });
    if (!ngo) {
      return res
        .status(404)
        .json({ success: false, message: 'NGO not found in database' });
    }

    // Save credit to Transaction model (for wallet logic)
    await Transaction.create({
      ngoId: ngo._id,
      ngoEmail: ngo.email,
      type: 'credit',
      amount: transaction.amount,
      domain: transaction.type === 'bid' ? 'auction' : 'donation',
      description: isTestPayment
        ? `Test payment received (${transaction.type})`
        : transaction.type === 'bid'
        ? `Payment received for auction bid`
        : `Direct donation received`,
      reference: transaction._id.toString(),
      status: 'completed', // <-- This is correct
    });

    // Emit real-time wallet update event
    if (global._io) {
      // Use global._io
      global._io.emit(`walletUpdate:${ngo._id.toString()}`);
    }

    res.json({
      success: true,
      message: isTestPayment
        ? 'Test payment verified and NGO wallet credited!'
        : 'Payment verified and NGO wallet credited!',
      transaction,
      // No need to send wallet balance here, frontend will refetch
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's payment history
exports.getUserPayments = async (req, res) => {
  try {
    const payments = await PaymentTransaction.find({ user: req.user.id })
      // .populate('ngo', 'name email') // REMOVE: ngo is now a string
      .populate('auction', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get NGO's received payments
exports.getNGOPayments = async (req, res) => {
  try {
    const { ngoEmail } = req.params; // expect param to be email string
    const payments = await PaymentTransaction.find({
      ngo: ngoEmail.toLowerCase(),
      status: 'success',
    })
      .populate('user', 'name email')
      .populate('auction', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Get NGO payments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};