const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const batchController = require('../controllers/batchController');

// Create batch (Farmer only)
router.post(
  '/create',
  protect,
  authorize('Farmer'),
  batchController.createBatch
);

// Transfer batch (Distributor, Transport, Retailer)
router.post(
  '/transfer',
  protect,
  authorize('Distributor', 'Transport', 'Retailer'),
  batchController.transferBatch
);

// Record quality (Authorized roles)
router.post(
  '/quality',
  protect,
  authorize('Farmer', 'Distributor', 'Transport', 'Retailer'),
  batchController.recordQuality
);

// Update quantity sold (Distributor only)
router.patch(
  '/sales',
  protect,
  authorize('Distributor'),
  batchController.updateQuantitySold
);

// Update transport status (Transport only)
router.post(
  '/transport/status',
  protect,
  authorize('Transport'),
  batchController.updateTransportStatus
);

// Update live transport GPS location (Transport only)
router.post(
  '/transport/location',
  protect,
  authorize('Transport'),
  batchController.updateTransportLocation
);

// Confirm delivery (Transport only)
router.post(
  '/transport/deliver',
  protect,
  authorize('Transport'),
  batchController.confirmDelivery
);

// Retailer batch decision (Retailer only)
router.post(
  '/retailer/decision',
  protect,
  authorize('Retailer'),
  batchController.retailerDecision
);

// Create payment order (Distributor and Retailer)
router.post(
  '/payment/order',
  protect,
  authorize('Distributor', 'Retailer'),
  batchController.createPaymentOrder
);

// Verify payment (Distributor and Retailer)
router.post(
  '/payment/verify',
  protect,
  authorize('Distributor', 'Retailer'),
  batchController.verifyPayment
);

// Payment history for current user
router.get('/payment/history', protect, batchController.getPaymentHistory);

// Get batch GPS tracking (Public)
router.get('/:id/tracking', batchController.getBatchTracking);

// Get user's batches (Private) - Must come before /:id
router.get('/my/batches', protect, batchController.getMyBatches);

// Get all batches (Private)
router.get('/all', protect, batchController.getAllBatches);

// Get batch by ID (Public)
router.get('/:id', batchController.getBatch);

module.exports = router;
