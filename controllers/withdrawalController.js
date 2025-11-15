const WithdrawalRequest = require('../models/WithdrawalRequest');
const NGO = require('../models/NGO');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Helper to calculate wallet from transactions
function getWalletBalance(transactions = []) {
  let balance = 0;
  transactions.forEach(tx => {
    if (tx.type === 'credit') balance += tx.amount;
    if (tx.type === 'debit') balance -= tx.amount;
  });
  return balance;
}

// @desc    Update NGO bank details (no auth)
// @route   PUT /api/ngos/bank-details
exports.updateBankDetails = async (req, res) => {
  try {
    const { email, accountHolderName, accountNumber, ifscCode, bankName, branch, phone } = req.body;
    const ngo = await NGO.findOne({ email: email.toLowerCase() });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }
    ngo.bankDetails = { accountHolderName, accountNumber, ifscCode, bankName, branch, phone };
    await ngo.save();
    res.status(200).json({
      success: true,
      message: 'Bank details saved successfully',
      data: ngo.bankDetails
    });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get NGO bank details by email (no auth)
// @route   GET /api/ngos/bank-details?email=...
exports.getBankDetails = async (req, res) => {
  try {
    const email = req.query.email && req.query.email.toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const ngo = await NGO.findOne({ email });
    if (!ngo || !ngo.bankDetails) {
      return res.status(404).json({ success: false, message: 'No bank details found' });
    }
    res.status(200).json({ success: true, data: ngo.bankDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create withdrawal request (no auth, sends ngoEmail in body)
// @route   POST /api/withdrawals/request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { amount, ngoEmail, domain, description } = req.body;
    const ngo = await NGO.findOne({ email: ngoEmail.toLowerCase() });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }
    if (!ngo.bankDetails || !ngo.bankDetails.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please add bank details before requesting withdrawal'
      });
    }
    // Calculate wallet using Transaction model
    const transactions = await Transaction.find({ ngoId: ngo._id });
    const walletAmount = getWalletBalance(transactions);
    if (walletAmount < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${walletAmount}`
      });
    }
    const pendingRequest = await WithdrawalRequest.findOne({
      ngo: ngoEmail.toLowerCase(),
      status: 'pending'
    });
    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request'
      });
    }
    const withdrawal = await WithdrawalRequest.create({
      ngo: ngoEmail.toLowerCase(),
      amount,
      domain,
      description,
      bankDetails: ngo.bankDetails
    });
    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawal
    });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get NGO's withdrawal requests (no auth, sends ngoEmail as query param)
// @route   GET /api/withdrawals/my-requests?ngoEmail=...
exports.getMyWithdrawalRequests = async (req, res) => {
  try {
    const ngoEmail = req.query.ngoEmail && req.query.ngoEmail.toLowerCase();
    const withdrawals = await WithdrawalRequest.find({ ngo: ngoEmail })
      .populate('processedBy', 'name email')
      .sort({ requestedAt: -1 });
    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawals
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all withdrawal requests (unprotected for now, future: admin only)
// @route   GET /api/withdrawals/all
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find()
      .populate('processedBy', 'name email')
      .sort({ requestedAt: -1 });

    const ngoEmails = withdrawals.map(w => w.ngo);
    const ngos = await NGO.find({ email: { $in: ngoEmails } });

    const ngoMap = {};
    ngos.forEach(n => { ngoMap[n.email] = n; });

    const withdrawalsWithNgoData = withdrawals.map(w => ({
      ...w.toObject(),
      ngo: ngoMap[w.ngo] || null
    }));

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawalsWithNgoData
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve/Reject withdrawal request (unprotected for now)
// @route   PUT /api/withdrawals/:id/process
exports.processWithdrawalRequest = async (req, res) => {
  try {
    const { status, adminNote } = req.body; // status: 'approved' or 'rejected'
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been processed'
      });
    }
    // Find NGO by email
    const ngo = await NGO.findOne({ email: withdrawal.ngo });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }
    // If approved, deduct from wallet using Transaction model
    if (status === 'approved') {
      // Calculate wallet balance using Transaction model
      const transactions = await Transaction.find({ ngoId: ngo._id });
      const walletAmount = getWalletBalance(transactions);
      if (walletAmount < withdrawal.amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds in NGO wallet'
        });
      }
      // Create the debit transaction
      await Transaction.create({
        ngoId: ngo._id,
        ngoEmail: ngo.email,
        type: 'debit',
        amount: withdrawal.amount,
        domain: withdrawal.domain,
        description: withdrawal.description || `Withdrawal approved - ${withdrawal.bankDetails.accountNumber}`,
        reference: withdrawal._id.toString()
      });
    }
    // Update withdrawal request
    withdrawal.status = status;
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = adminNote || '';
    await withdrawal.save();
    res.status(200).json({
      success: true,
      message: `Withdrawal request ${status} successfully`,
      data: withdrawal
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// @desc    Approve withdrawal manually (secret code, debits NGO wallet only, no payout)
// @route   POST /api/withdrawals/:id/approve-manual
exports.approveManualWithdrawal = async (req, res) => {
  try {
    const { code } = req.body;
    if (code !== "TEST123") {
      return res.status(401).json({ success: false, message: "Invalid code" });
    }

    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found or already processed' });
    }

    const ngo = await NGO.findOne({ email: withdrawal.ngo });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    // Calculate wallet balance using Transaction model
    const transactions = await Transaction.find({ ngoId: ngo._id });
    const walletAmount = getWalletBalance(transactions);
    if (walletAmount < withdrawal.amount) {
      return res.status(400).json({ success: false, message: 'Insufficient funds in NGO wallet' });
    }
    // Create the debit transaction
    await Transaction.create({
      ngoId: ngo._id,
      ngoEmail: ngo.email,
      type: 'debit',
      amount: withdrawal.amount,
      domain: withdrawal.domain,
      description: withdrawal.description || `Withdrawal approved - ${withdrawal.bankDetails.accountNumber}`,
      reference: withdrawal._id.toString()
    });

    // Update withdrawal request
    withdrawal.status = "approved";
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = "Manual approval using secret code";
    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal manually approved & amount debited.",
      data: withdrawal
    });
  } catch (error) {
    console.error("Error in manual withdrawal approval:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
