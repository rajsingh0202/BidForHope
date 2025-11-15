const express = require('express');
const {
  createWithdrawalRequest,
  getMyWithdrawalRequests,
  getAllWithdrawalRequests,
  processWithdrawalRequest,
  approveManualWithdrawal
} = require('../controllers/withdrawalController');

const router = express.Router();

// Create a new withdrawal request (POST /api/withdrawals/request)
router.post('/request', createWithdrawalRequest);

// Get all withdrawal requests for a particular NGO by EMAIL (GET /api/withdrawals/my-requests?ngoEmail=...)
router.get('/my-requests', getMyWithdrawalRequests);

// Admin: Get all withdrawal requests (GET /api/withdrawals/all)
router.get('/all', getAllWithdrawalRequests);

// Admin: Approve or reject withdrawal request (PUT /api/withdrawals/:id/process)
router.put('/:id/process', processWithdrawalRequest);

// Admin: Approve withdrawal manually (POST /api/withdrawals/:id/approve-manual)
router.post('/:id/approve-manual', approveManualWithdrawal);

module.exports = router;
