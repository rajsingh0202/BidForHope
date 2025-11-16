const WithdrawalRequest = require('../models/WithdrawalRequest');
const NGO = require('../models/NGO');
const Transaction = require('../models/Transaction');
const axios = require('axios');

// Create Razorpay Contact for NGO (RazorpayX)
exports.createRazorpayContact = async (req, res) => {
  try {
    const ngo = req.body;
    const auth =
      'Basic ' +
      Buffer.from(
        process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
      ).toString('base64');

    const contactResponse = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      {
        name: ngo.name,
        email: ngo.email,
        contact: ngo.phone,
        type: 'vendor',
        notes: {
          ngoId: ngo._id,
          description: 'NGO contact for charity payouts',
        }
      },
      {
        headers: { Authorization: auth }
      }
    );

    res.json({ success: true, contact: contactResponse.data });
  } catch (error) {
    console.error('Razorpay contact creation error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
};

// Create Razorpay Fund Account for NGO & save fundAccountId to NGO document
exports.createRazorpayFundAccount = async (req, res) => {
  try {
    const { ngoId, ngoEmail, bankDetails, razorpayContactId } = req.body;
    const { accountHolderName, accountNumber, ifscCode, bankName } = bankDetails;
    const auth =
      'Basic ' +
      Buffer.from(
        process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
      ).toString('base64');

    const fundResponse = await axios.post(
      'https://api.razorpay.com/v1/fund_accounts',
      {
        contact_id: razorpayContactId,
        account_type: 'bank_account',
        bank_account: {
          name: accountHolderName,
          ifsc: ifscCode,
          account_number: accountNumber,
        }
      },
      {
        headers: { Authorization: auth }
      }
    );

    let ngo;
    if (ngoId) {
      ngo = await NGO.findById(ngoId);
    } else if (ngoEmail) {
      ngo = await NGO.findOne({ email: ngoEmail.toLowerCase() });
    }
    let saved = false;
    if (ngo) {
      console.log('Attempting to update NGO:', ngo);
      ngo.fundAccountId = fundResponse.data.id;
      await ngo.save();
      console.log('NGO Saved with fundAccountId:', fundResponse.data.id);
      saved = true;
    }

    res.json({
      success: true,
      fundAccount: fundResponse.data,
      fundAccountId: fundResponse.data.id,
      savedToNgo: saved
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
};

// Initiate direct payout (admin-triggered, generic)
exports.initiatePayoutToNGO = async (req, res) => {
  try {
    const { fundAccountId, amount, narration } = req.body;
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;
    const payoutOptions = {
      account_number: accountNumber,
      fund_account_id: fundAccountId,
      amount: amount * 100,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      narration: narration || 'Charity payout to NGO',
      reference_id: `ngo_payout_${Date.now()}`
    };

    const auth =
      'Basic ' +
      Buffer.from(
        process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
      ).toString('base64');

    const payoutResponse = await axios.post(
      'https://api.razorpay.com/v1/payouts',
      payoutOptions,
      {
        headers: { Authorization: auth }
      }
    );

    res.json({ success: true, payout: payoutResponse.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
};

// Process withdrawal and pay out to NGO fund account (admin Approve flow)
exports.processWithdrawalAndPayout = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found or already processed' });
    }
    const ngo = await NGO.findOne({ email: withdrawal.ngo });
    if (!ngo || !ngo.fundAccountId) {
      return res.status(404).json({ success: false, message: 'NGO or Fund Account not found' });
    }

    const amount = withdrawal.amount;
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;
    const payoutOptions = {
      account_number: accountNumber,
      fund_account_id: ngo.fundAccountId,
      amount: amount * 100,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      narration: withdrawal.description || 'Charity payout to NGO',
      reference_id: withdrawal._id.toString()
    };

    const auth =
      'Basic ' +
      Buffer.from(
        process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
      ).toString('base64');

    const payoutResponse = await axios.post(
      'https://api.razorpay.com/v1/payouts',
      payoutOptions,
      {
        headers: { Authorization: auth }
      }
    );

    const payout = payoutResponse.data;
    if (!['processing', 'queued'].includes(payout.status)) {
      return res.status(500).json({ success: false, message: 'Razorpay payout failed to initiate', payout });
    }

    withdrawal.status = 'approved';
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = 'Paid out via RazorpayX';
    await withdrawal.save();

    await Transaction.create({
      ngoId: ngo._id,
      ngoEmail: ngo.email,
      type: 'debit',
      amount,
      domain: withdrawal.domain,
      description: withdrawal.description || `Withdrawal approved - ${withdrawal.bankDetails.accountNumber}`,
      reference: withdrawal._id.toString()
    });

    res.status(200).json({ success: true, payout, withdrawalId: withdrawal._id });
  } catch (error) {
    console.error('Error in payout processing:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
};
