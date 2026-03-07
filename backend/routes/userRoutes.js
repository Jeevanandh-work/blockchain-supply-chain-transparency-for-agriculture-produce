const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Get all users
router.get('/', protect, userController.getAllUsers);

// Get users by role
router.get('/role/:role', protect, userController.getUsersByRole);

// Get user by wallet address
router.get('/wallet/:address', protect, userController.getUserByWallet);

// Update profile
router.put('/profile', protect, userController.updateProfile);

module.exports = router;
