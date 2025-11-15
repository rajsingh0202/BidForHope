const express = require('express');
const {
  createNGO,
  getNGOs,
  getPendingNGOs,
  updateNGOStatus,
  getNGOTransactions,
  addDebitTransaction
} = require('../controllers/ngoController');
const { protect, authorize } = require('../middleware/auth');
const { updateBankDetails, getBankDetails } = require('../controllers/withdrawalController');
const router = express.Router();

const { addCreditTransaction } = require('../controllers/ngoController');
// Add route (add `protect` middleware if you want to restrict)
router.post('/:id/transactions/credit', addCreditTransaction);


// Public NGO registration (no protect)
router.post('/', createNGO);

// Protected: Get all NGOs
router.get('/', getNGOs);

// Admin: Get all pending NGOs
router.get('/pending', protect, authorize('admin'), getPendingNGOs);

// Admin: Approve or reject NGO by id
router.put('/:id/status', protect, authorize('admin'), updateNGOStatus);

// GET all transactions for an NGO (public)
router.get('/:id/transactions', getNGOTransactions);

// POST debit transaction - only logged-in NGO
router.post('/:id/transactions/debit', addDebitTransaction);

router.get('/bank-details', getBankDetails);
router.put('/bank-details', updateBankDetails);

module.exports = router;
