const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentTransaction = require('../models/PaymentTransaction');
const NGO = require('../models/NGO');
const Auction = require('../models/Auction');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, ngoId, auctionId, type } = req.body; // type: 'bid' or 'donation'
    
    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Validate NGO exists
    const ngo = await NGO.findById(ngoId);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    // Create Razorpay order (amount must be in paise: ₹1 = 100 paise)
    const options = {
      amount: amount * 100, // Convert rupees to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        ngoId,
        auctionId: auctionId || 'direct_donation',
        type,
        userId: req.user.id
      }
    };

    const order = await razorpay.orders.create(options);

    // Save transaction record as pending
    const transaction = await PaymentTransaction.create({
      user: req.user.id,
      ngo: ngoId,
      auction: auctionId || null,
      amount,
      type,
      razorpayOrderId: order.id,
      status: 'pending'
    });

    res.json({ 
      success: true, 
      order,
      transactionId: transaction._id
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Payment and Credit NGO Wallet
exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      transactionId 
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
          status: 'failed'
        });
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

   // Payment verified (or test payment)! Update transaction
const transaction = await PaymentTransaction.findByIdAndUpdate(
  transactionId,
  {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    status: 'success'
  },
  { new: true }
).populate('ngo');

if (!transaction) {
  return res.status(404).json({ success: false, message: 'Transaction not found' });
}

if (!transaction.ngo || !transaction.ngo._id) {
  return res.status(404).json({ success: false, message: 'NGO not found for this transaction' });
}

// Auto-credit NGO wallet
const ngo = await NGO.findById(transaction.ngo._id);

if (!ngo) {
  return res.status(404).json({ success: false, message: 'NGO not found in database' });
}

ngo.transactions.push({
  type: 'credit',
  amount: transaction.amount,
  description: isTestPayment 
    ? `Test payment received (${transaction.type})` 
    : transaction.type === 'bid' 
      ? `Payment received for auction bid` 
      : `Direct donation received`,
  relatedPayment: transaction._id,
  date: new Date()
});

await ngo.save();

    res.json({ 
      success: true, 
      message: isTestPayment 
        ? 'Test payment verified and NGO wallet credited!' 
        : 'Payment verified and NGO wallet credited!',
      transaction,
      ngoBalance: ngo.transactions.reduce((acc, t) => 
        t.type === 'credit' ? acc + t.amount : acc - t.amount, 0
      )
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
      .populate('ngo', 'name')
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
    const { ngoId } = req.params;

    const payments = await PaymentTransaction.find({ 
      ngo: ngoId,
      status: 'success' 
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
