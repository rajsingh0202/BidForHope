const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route (requires login)
router.get('/me', protect, getMe);

module.exports = router;
