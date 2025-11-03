const NGO = require('../models/NGO');
const User = require('../models/User'); 
const Transaction = require('../models/Transaction');

// @desc    Create new NGO (registration)
// @route   POST /api/ngos
exports.createNGO = async (req, res) => {
  try {
    const {
      name,
      registrationNumber,
      email,
      phone,
      description,
      address,
      website,
      logo,
      causesSupported,
      workingYears,
      domains,
    } = req.body;

    // Always set status to pending
    const ngo = await NGO.create({
      name,
      registrationNumber,
      email,
      phone,
      description,
      address,
      website,
      logo,
      causesSupported,
      workingYears,
      domains,
      status: 'pending', // Approval required
    });

    res.status(201).json({
      success: true,
      message: "Registration successful! Awaiting admin approval.",
      data: ngo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all NGOs
// @route   GET /api/ngos
exports.getNGOs = async (req, res) => {
  try {
    const ngos = await NGO.find();
    res.status(200).json({
      success: true,
      count: ngos.length,
      data: ngos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update supported causes
exports.updateCauses = async (req, res) => {
  const { causesSupported } = req.body;
  if (!Array.isArray(causesSupported)) {
    return res.status(400).json({ message: "Causes must be an array" });
  }
  const ngo = await NGO.findById(req.user.id);
  ngo.causesSupported = causesSupported;
  await ngo.save();
  res.json({ success: true, causesSupported: ngo.causesSupported });
};

// ------------------- ADMIN ENDPOINTS -------------------

// @desc   Get all pending NGOs
// @route  GET /api/ngos/pending
exports.getPendingNGOs = async (req, res) => {
  try {
    const ngos = await NGO.find({ status: 'pending' });
    res.status(200).json({
      success: true,
      count: ngos.length,
      data: ngos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc   Approve or reject NGO
// @route  PUT /api/ngos/:id/status
exports.updateNGOStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, password } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ngo = await NGO.findById(id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    ngo.status = status;
    await ngo.save();

    // CREATE USER ACCOUNT IF NGO IS APPROVED
    if (status === 'approved') {
      const userExists = await User.findOne({ email: ngo.email });
      if (!userExists) {
        if (!password) {
          return res.status(400).json({ 
            success: false, 
            message: "Password required for NGO login account." 
          });
        }
        await User.create({
          name: ngo.name,
          email: ngo.email,
          password, // Must be hashed in User model pre-save
          role: 'ngo',
          status: 'approved'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `NGO ${status}`,
      data: ngo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc   Get all transactions for an NGO
// @route  GET /api/ngos/:id/transactions
exports.getNGOTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ ngoId: req.params.id }).sort({ createdAt: -1 });

    // Calculate wallet balance
    const walletAmount = transactions.reduce((total, tx) => 
      tx.type === 'credit' ? total + tx.amount : total - tx.amount, 0
    );

    res.status(200).json({
      success: true,
      walletAmount,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Add debit transaction (NGO only)
// @route  POST /api/ngos/:id/transactions/debit
exports.addDebitTransaction = async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    const { amount, description, domain } = req.body;
    const transaction = await Transaction.create({
      ngoId: req.params.id,
      ngoEmail: ngo.email,      // <-- Save the NGO email
      type: 'debit',
      amount,
      description,
      domain
    });
    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Add debit transaction (NGO only)
// @route  POST /api/ngos/:id/transactions/debit
exports.addDebitTransaction = async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    const { amount, description, domain } = req.body;
    const debitAmount = Number(amount);

    // Calculate wallet balance before debiting
    const transactions = await Transaction.find({ ngoId: req.params.id });
    const walletAmount = transactions.reduce((total, tx) =>
      tx.type === 'credit' ? total + tx.amount : total - tx.amount, 0
    );

    if (debitAmount > walletAmount) {
      return res.status(400).json({ success: false, message: 'Debit amount cannot exceed wallet amount!' });
    }

    const transaction = await Transaction.create({
      ngoId: req.params.id,
      ngoEmail: ngo.email,      // <-- Save the NGO email
      type: 'debit',
      amount: debitAmount,
      description,
      domain
    });
    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Add credit transaction (admin or for testing)
// @route  POST /api/ngos/:id/transactions/credit
exports.addCreditTransaction = async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found' });
    }

    const { amount, reference, description } = req.body;
    const transaction = await Transaction.create({
      ngoId: req.params.id,
      ngoEmail: ngo.email,      // <-- Save the NGO email
      type: 'credit',
      amount,
      reference,
      description
    });
    res.status(201).json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
