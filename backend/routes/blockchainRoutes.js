const express = require('express');
const router = express.Router();
const blockchainController = require('../controllers/blockchainController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/verify/:batchId', blockchainController.verifyBatch);
router.get('/transaction/:txHash', blockchainController.getTransaction);
router.get('/network', blockchainController.getNetworkInfo);

// Protected routes
router.get('/batch/:batchId', protect, blockchainController.getBlockchainBatch);
router.get('/batches', protect, blockchainController.getAllBatches);
router.post('/verify-multiple', protect, blockchainController.verifyMultipleBatches);

module.exports = router;
