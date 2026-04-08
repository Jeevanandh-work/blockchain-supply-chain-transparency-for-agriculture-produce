const Batch = require('../models/Batch');
const User = require('../models/User');
const crypto = require('crypto');
const blockchainService = require('../services/blockchainService');
const ipfsService = require('../services/ipfsService');
const qrService = require('../services/qrService');

let Razorpay = null;
try {
  Razorpay = require('razorpay');
} catch (error) {
  Razorpay = null;
}

const PAYMENT_STAGE_CONFIG = {
  farmer: { payerRoles: ['Distributor'], payeeRole: 'Farmer' },
  transport: { payerRoles: ['Distributor'], payeeRole: 'Transport' },
  distributor: { payerRoles: ['Retailer'], payeeRole: 'Distributor' },
};

const PAYMENT_SEQUENCE_BLOCK_MESSAGE = 'Complete previous payments before proceeding';

const isPaid = (batch, stage) => String(batch?.payments?.[stage]?.status || '').toLowerCase() === 'paid';

const validatePaymentSequence = (batch, stage) => {
  if (stage === 'transport' && !isPaid(batch, 'farmer')) {
    return PAYMENT_SEQUENCE_BLOCK_MESSAGE;
  }

  return '';
};

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !Razorpay) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

const resolveStageRecipient = async (batch, stage) => {
  if (stage === 'farmer') {
    const farmerUser = await User.findById(batch.farmer);
    return farmerUser || null;
  }

  if (stage === 'transport') {
    if (String(batch.currentOwnerRole || '').toLowerCase() === 'transport' && batch.currentOwner) {
      const currentTransport = await User.findById(batch.currentOwner);
      if (currentTransport) return currentTransport;
    }

    const transportEvent = [...(batch.statusHistory || [])]
      .reverse()
      .find((entry) => String(entry?.updatedBy?.role || '').toLowerCase() === 'transport');

    if (transportEvent?.updatedBy?._id) {
      const transportUser = await User.findById(transportEvent.updatedBy._id);
      if (transportUser) return transportUser;
    }
    return null;
  }

  if (stage === 'distributor') {
    if (String(batch.currentOwnerRole || '').toLowerCase() === 'distributor' && batch.currentOwner) {
      const currentDistributor = await User.findById(batch.currentOwner);
      if (currentDistributor) return currentDistributor;
    }

    const distributorEvent = [...(batch.statusHistory || [])]
      .reverse()
      .find((entry) => String(entry?.updatedBy?.role || '').toLowerCase() === 'distributor');

    if (distributorEvent?.updatedBy?._id) {
      const distributorUser = await User.findById(distributorEvent.updatedBy._id);
      if (distributorUser) return distributorUser;
    }
  }

  return null;
};

/**
 * @desc    Create new batch
 * @route   POST /api/batch/create
 * @access  Private (Farmer only)
 */
exports.createBatch = async (req, res) => {
  try {
    const { batchId, productName, quantity, unit, price, metadata } = req.body;
    const farmer = req.user;

    // Check if batch already exists
    const batchExists = await Batch.findOne({ batchId });
    if (batchExists) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID already exists',
      });
    }

    // Prepare metadata for IPFS
    const ipfsData = {
      batchId,
      productName,
      quantity,
      unit,
      price: Number(price || 0),
      farmer: {
        name: farmer.name,
        walletAddress: farmer.walletAddress,
        organization: farmer.organization,
      },
      createdAt: new Date().toISOString(),
      ...metadata,
    };

    // Upload to IPFS
    const ipfsHash = await ipfsService.uploadJSON(ipfsData);

    // Create batch on blockchain (optional for development)
    let blockchainTx = { transactionHash: 'dev-mock-tx-' + Date.now() };
    try {
      if (process.env.FARMER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        blockchainTx = await blockchainService.createBatch(
          batchId,
          ipfsHash,
          process.env.FARMER_PRIVATE_KEY
        );
      } else {
        console.log('⚠️  Blockchain not configured - using mock transaction');
      }
    } catch (error) {
      console.log('⚠️  Blockchain error (using mock):', error.message);
    }

    // Generate QR code
    const contractAddress = process.env.CONTRACT_ADDRESS || 'mock-contract';
    const qrCode = await qrService.generateBatchQR(batchId, contractAddress);

    // Generate public QR code URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrCodeUrl = `${frontendUrl}/batch/${batchId}`;

    // Save to database
    const batch = await Batch.create({
      batchId,
      productName,
      quantity,
      price: Number(price || 0),
      unit,
      farmer: farmer._id,
      currentOwner: farmer._id,
      currentOwnerRole: 'Farmer',
      ipfsHash,
      qrCode,
      qrCodeUrl,
      blockchainTxHash: blockchainTx.transactionHash,
      status: 'Created',
      payments: {
        farmer: {
          status: 'Pending',
          amount: Number(price || 0),
        },
        transport: {
          status: 'Pending',
          amount: Number(price || 0) * 0.15,
        },
        distributor: {
          status: 'Pending',
          amount: Number(price || 0),
        },
      },
      statusHistory: [
        {
          status: 'Created',
          message: 'Batch created by farmer',
          updatedBy: farmer._id,
          blockchainHash: blockchainTx.transactionHash,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: {
        batch,
        ipfsUrl: ipfsService.getGatewayUrl(ipfsHash),
        blockchainTx: blockchainTx.transactionHash,
      },
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create batch',
      error: error.message,
    });
  }
};

/**
 * @desc    Transfer batch
 * @route   POST /api/batch/transfer
 * @access  Private (Distributor, Transport, Retailer)
 */
exports.transferBatch = async (req, res) => {
  try {
    const { batchId, toAddress, message, deliveryAddress, transportDetails } = req.body;
    const currentUser = req.user;

    // Find batch
    const batch = await Batch.findOne({ batchId }).populate('currentOwner');
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const currentRole = String(batch.currentOwnerRole || batch.currentOwner?.role || '').toLowerCase();
    const requesterRole = String(currentUser.role || '').toLowerCase();
    const isActualOwner = batch.currentOwner._id.toString() === currentUser._id.toString();
    const isDistributorWorkflowTransfer =
      requesterRole === 'distributor' && (currentRole === 'farmer' || currentRole === 'distributor');
    const isRetailerWorkflowTransfer =
      requesterRole === 'retailer' &&
      (
        currentRole === 'transport' ||
        currentRole === 'distributor' ||
        currentRole === 'farmer' ||
        String(batch.status || '').toLowerCase().includes('picked') ||
        String(batch.status || '').toLowerCase().includes('transit')
      );

    // Prevent transfers once delivery is already completed.
    if (['delivered', 'completed', 'final delivery'].includes(String(batch.status || '').toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'This batch is already delivered/completed and cannot be transferred',
      });
    }

    // Verify ownership/authorization for transfer
    if (!isActualOwner && !isDistributorWorkflowTransfer && !isRetailerWorkflowTransfer) {
      return res.status(403).json({
        success: false,
        message: 'You are not the current owner of this batch',
      });
    }

    // Find recipient
    const recipient = await User.findOne({ 
      walletAddress: toAddress.toLowerCase() 
    });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
      });
    }

    // Transfer on blockchain (optional for development)
    let blockchainTx = { transactionHash: 'dev-mock-transfer-' + Date.now() };
    try {
      if (process.env.USER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        blockchainTx = await blockchainService.transferBatch(
          batchId,
          toAddress,
          message,
          process.env.USER_PRIVATE_KEY
        );
      } else {
        console.log('⚠️  Blockchain not configured - using mock transaction');
      }
    } catch (error) {
      console.log('⚠️  Blockchain error (using mock):', error.message);
    }

    // Update database
    batch.currentOwner = recipient._id;
    batch.currentOwnerRole = recipient.role;

    if (recipient.role === 'Retailer') {
      batch.status = 'Accepted by Retailer';
    } else {
      batch.status = 'In Transit';
    }

    if (deliveryAddress) {
      batch.deliveryAddress = deliveryAddress;
    }

    if (transportDetails && typeof transportDetails === 'object') {
      batch.transportDetails = {
        vehicleNumber: transportDetails.vehicleNumber || batch.transportDetails?.vehicleNumber || '',
        driverName: transportDetails.driverName || batch.transportDetails?.driverName || '',
        transportCompany: transportDetails.transportCompany || batch.transportDetails?.transportCompany || '',
        contactNumber: transportDetails.contactNumber || batch.transportDetails?.contactNumber || '',
      };
    }

    const statusLabel = recipient.role === 'Retailer' ? 'Accepted by Retailer' : 'In Transit';
    batch.statusHistory.push({
      status: statusLabel,
      message,
      blockchainHash: blockchainTx.transactionHash,
      updatedBy: currentUser._id,
    });
    await batch.save();

    console.log(`✅ Batch ${batchId} transferred from ${currentUser.role} to ${recipient.role}`);
    console.log(`   Previous owner: ${currentUser.name}`);
    console.log(`   New owner: ${recipient.name}`);
    console.log(`   Current role: ${batch.currentOwnerRole}`);

    res.status(200).json({
      success: true,
      message: 'Batch transferred successfully',
      data: {
        batch,
        blockchainTx: blockchainTx.transactionHash,
      },
    });
  } catch (error) {
    console.error('Transfer batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer batch',
      error: error.message,
    });
  }
};

/**
 * @desc    Record quality inspection
 * @route   POST /api/batch/quality
 * @access  Private (Authorized roles)
 */
exports.recordQuality = async (req, res) => {
  try {
    const { batchId, qualityData } = req.body;
    const inspector = req.user;

    // Find batch
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Upload quality data to IPFS
    const qualityHash = await ipfsService.uploadJSON({
      batchId,
      inspector: {
        name: inspector.name,
        walletAddress: inspector.walletAddress,
      },
      ...qualityData,
      timestamp: new Date().toISOString(),
    });

    // Record on blockchain (optional for development)
    let blockchainTx = { transactionHash: 'dev-mock-quality-' + Date.now() };
    try {
      if (process.env.USER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        blockchainTx = await blockchainService.recordQuality(
          batchId,
          qualityHash,
          process.env.USER_PRIVATE_KEY
        );
      } else {
        console.log('⚠️  Blockchain not configured - using mock transaction');
      }
    } catch (error) {
      console.log('⚠️  Blockchain error (using mock):', error.message);
    }

    // Update database
    batch.qualityRecords.push({
      ipfsHash: qualityHash,
      recordedBy: inspector._id,
    });
    batch.statusHistory.push({
      status: batch.status,
      message: 'Quality inspection recorded',
      updatedBy: inspector._id,
    });
    await batch.save();

    res.status(200).json({
      success: true,
      message: 'Quality inspection recorded successfully',
      data: {
        qualityHash,
        ipfsUrl: ipfsService.getGatewayUrl(qualityHash),
        blockchainTx: blockchainTx.transactionHash,
      },
    });
  } catch (error) {
    console.error('Record quality error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record quality inspection',
      error: error.message,
    });
  }
};

/**
 * @desc    Get batch by ID
 * @route   GET /api/batch/:id
 * @access  Public
 */
exports.getBatch = async (req, res) => {
  try {
    const { id } = req.params;

    // Get from database
    const batch = await Batch.findOne({ batchId: id })
      .populate('farmer', 'name email walletAddress organization phoneNumber farmerProfile')
      .populate('currentOwner', 'name email walletAddress role organization phoneNumber')
      .populate('statusHistory.updatedBy', 'name role organization phoneNumber walletAddress')
      .populate('qualityRecords.recordedBy', 'name role');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Get blockchain data (optional)
    let blockchainData = null;
    try {
      if (process.env.CONTRACT_ADDRESS) {
        const blockchainBatch = await blockchainService.getBatch(id);
        const batchHistory = await blockchainService.getBatchHistory(id);
        const qualityRecords = await blockchainService.getQualityRecords(id);
        blockchainData = {
          ...blockchainBatch,
          history: batchHistory,
          qualityRecords,
        };
      }
    } catch (error) {
      console.log('⚠️  Could not fetch blockchain data:', error.message);
    }

    res.status(200).json({
      success: true,
      data: {
        batch,
        blockchain: blockchainData,
        ipfsUrl: ipfsService.getGatewayUrl(batch.ipfsHash),
      },
    });
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batch',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all batches (filtered by role)
 * @route   GET /api/batch/all
 * @access  Private
 */
exports.getAllBatches = async (req, res) => {
  try {
    const userRole = req.user.role;
    let query = {};

    // Role-based filtering
    if (userRole === 'Farmer') {
      // Farmers see their own batches
      query = { farmer: req.user._id };
    } else if (userRole === 'Distributor') {
      // Distributors see batches from Farmers and Transport (for live tracking)
      query = { 
        $or: [
          { currentOwnerRole: 'Farmer' },
          { currentOwnerRole: 'Transport' },
          { currentOwner: req.user._id }
        ]
      };
    } else if (userRole === 'Transport') {
      // Transport sees ALL batches (comprehensive dashboard view)
      query = {};  // Show all batches for transport dashboard
    } else if (userRole === 'Retailer') {
      // Retailers see batches from Transport
      query = { 
        $or: [
          { currentOwnerRole: 'Distributor' },
          { currentOwnerRole: 'Transport' },
          { currentOwner: req.user._id }
        ]
      };
    }

    const batches = await Batch.find(query)
      .populate('farmer', 'name organization walletAddress phoneNumber email farmerProfile')
      .populate('currentOwner', 'name role walletAddress phoneNumber email organization')
      .populate('statusHistory.updatedBy', 'name role phoneNumber email organization walletAddress')
      .sort({ createdAt: -1 });

    console.log(`📦 Fetching batches for ${userRole}: ${batches.length} found`);
    console.log(`   Query:`, JSON.stringify(query));

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error('Get all batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batches',
      error: error.message,
    });
  }
};

/**
 * @desc    Update quantity sold for a batch
 * @route   PATCH /api/batch/sales
 * @access  Private (Distributor only)
 */
exports.updateQuantitySold = async (req, res) => {
  try {
    const { batchId, quantitySold } = req.body;
    const distributor = req.user;

    if (distributor.role !== 'Distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only Distributor users can update quantity sold',
      });
    }

    if (!batchId || quantitySold === undefined || quantitySold === null) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and quantity sold are required',
      });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const numericQuantitySold = Number(quantitySold);
    if (!Number.isFinite(numericQuantitySold) || numericQuantitySold < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity sold must be a valid non-negative number',
      });
    }

    if (numericQuantitySold > batch.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Quantity sold cannot exceed total quantity',
      });
    }

    batch.quantitySold = numericQuantitySold;
    batch.statusHistory.push({
      status: batch.status,
      location: batch.location,
      message: `Distributor updated sold quantity to ${numericQuantitySold} ${batch.unit}`,
      updatedBy: distributor._id,
    });

    await batch.save();

    return res.status(200).json({
      success: true,
      message: 'Quantity sold updated successfully',
      data: {
        batchId: batch.batchId,
        quantity: batch.quantity,
        quantitySold: batch.quantitySold,
        quantityRemaining: Math.max(batch.quantity - batch.quantitySold, 0),
      },
    });
  } catch (error) {
    console.error('Update quantity sold error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update quantity sold',
      error: error.message,
    });
  }
};

/**
 * @desc    Update live transport location for a batch
 * @route   POST /api/batch/transport/location
 * @access  Private (Transport only)
 */
exports.updateTransportLocation = async (req, res) => {
  try {
    const { batchId, coordinates, location } = req.body;
    const transport = req.user;

    if (!batchId || !coordinates || coordinates.latitude === undefined || coordinates.longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and coordinates are required',
      });
    }

    if (transport.role !== 'Transport') {
      return res.status(403).json({
        success: false,
        message: 'Only Transport users can update live location',
      });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    batch.location = location || batch.location || 'In Transit';
    batch.gpsTracking = batch.gpsTracking || [];
    batch.gpsTracking.push({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      location: location || batch.location || 'In Transit',
      timestamp: new Date(),
    });

    await batch.save();

    return res.status(200).json({
      success: true,
      message: 'Live location updated',
      data: {
        batchId: batch.batchId,
        lastLocation: batch.location,
        gpsPoint: batch.gpsTracking[batch.gpsTracking.length - 1],
      },
    });
  } catch (error) {
    console.error('Update transport location error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update live location',
      error: error.message,
    });
  }
};

/**
 * @desc    Get user's batches
 * @route   GET /api/batch/my
 * @access  Private
 */
exports.getMyBatches = async (req, res) => {
  try {
    const userId = req.user._id;

    const batches = await Batch.find({
      $or: [{ farmer: userId }, { currentOwner: userId }],
    })
      .populate('farmer', 'name organization')
      .populate('currentOwner', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error('Get my batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batches',
      error: error.message,
    });
  }
};

/**
 * @desc    Retailer decision on incoming batch
 * @route   POST /api/batch/retailer/decision
 * @access  Private (Retailer)
 */
exports.retailerDecision = async (req, res) => {
  try {
    const { batchId, action, notes } = req.body;
    const retailer = req.user;

    if (!batchId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and action are required',
      });
    }

    const normalizedAction = String(action).toLowerCase();
    if (!['accept', 'reject'].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be accept or reject',
      });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const currentRole = String(batch.currentOwnerRole || '').toLowerCase();
    if (!['transport', 'distributor', 'retailer'].includes(currentRole)) {
      return res.status(400).json({
        success: false,
        message: 'Batch is not in a retailer decision stage',
      });
    }

    if (normalizedAction === 'accept') {
      batch.currentOwner = retailer._id;
      batch.currentOwnerRole = 'Retailer';
      batch.status = 'Accepted by Retailer';
    } else {
      batch.status = 'Rejected by Retailer';
    }

    batch.statusHistory.push({
      status: batch.status,
      message: notes || `Batch ${normalizedAction}ed by retailer`,
      updatedBy: retailer._id,
    });

    await batch.save();

    return res.status(200).json({
      success: true,
      message: `Batch ${normalizedAction}ed successfully`,
      data: batch,
    });
  } catch (error) {
    console.error('Retailer decision error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update retailer decision',
      error: error.message,
    });
  }
};

/**
 * @desc    Update transport status
 * @route   POST /api/batch/transport/status
 * @access  Private (Transport only)
 */
exports.updateTransportStatus = async (req, res) => {
  try {
    const { batchId, status, location, notes, coordinates, dispatchTime, expectedDelivery } = req.body;
    const transport = req.user;

    console.log('📦 Update Transport Status Request:', {
      batchId,
      status,
      location,
      dispatchTime,
      expectedDelivery,
      notes,
      coordinates,
    });

    // Validate required fields
    if (!batchId || !status || !location) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID, status, and location are required',
      });
    }

    // Find batch
    const batch = await Batch.findOne({ batchId })
      .populate('farmer', 'name organization')
      .populate('currentOwner', 'name role walletAddress');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Verify user has Transport role (Transport can update any batch)
    if (transport.role !== 'Transport') {
      return res.status(403).json({
        success: false,
        message: 'Only Transport users can update transport status',
      });
    }

    // Record on blockchain
    let blockchainTx = { transactionHash: 'dev-mock-tx-' + Date.now() };
    try {
      if (process.env.USER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        blockchainTx = await blockchainService.updateBatchStatus(
          batchId,
          status,
          process.env.USER_PRIVATE_KEY
        );
      } else {
        console.log('⚠️  Blockchain not configured - using mock transaction');
      }
    } catch (error) {
      console.log('⚠️  Blockchain error (using mock):', error.message);
    }

    // Update batch
    batch.status = status;
    batch.location = location;
    
    // Update dispatch and delivery times if provided
    if (dispatchTime) {
      batch.dispatchTime = new Date(dispatchTime);
      console.log('✅ Dispatch time set:', batch.dispatchTime);
    }
    if (expectedDelivery) {
      batch.expectedDelivery = new Date(expectedDelivery);
      console.log('✅ Expected delivery time set:', batch.expectedDelivery);
    }
    
    // Add GPS coordinates if provided
    if (
      coordinates &&
      coordinates.latitude !== undefined &&
      coordinates.longitude !== undefined
    ) {
      batch.gpsTracking = batch.gpsTracking || [];
      batch.gpsTracking.push({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location: location,
        timestamp: new Date(),
      });
      console.log('📍 GPS tracking point added for batch:', batchId);
    }

    // Add to status history
    batch.statusHistory.push({
      status,
      location,
      message: notes || `Status updated to ${status}`,
      updatedBy: transport._id,
      blockchainHash: blockchainTx.transactionHash,
    });

    await batch.save();

    console.log('✅ Batch updated successfully:', {
      batchId: batch.batchId,
      status: batch.status,
      dispatchTime: batch.dispatchTime,
      expectedDelivery: batch.expectedDelivery,
    });

    res.status(200).json({
      success: true,
      message: 'Transport status updated successfully',
      data: {
        batch,
        blockchainHash: blockchainTx.transactionHash,
      },
    });
  } catch (error) {
    console.error('❌ Update transport status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transport status',
      error: error.message,
    });
  }
};

/**
 * @desc    Confirm delivery
 * @route   POST /api/batch/transport/deliver
 * @access  Private (Transport only)
 */
exports.confirmDelivery = async (req, res) => {
  try {
    const {
      batchId,
      recipientName,
      signature,
      notes,
      location,
      coordinates,
      proofImage,
    } = req.body;
    const transport = req.user;

    // Validate required fields
    if (!batchId || !recipientName || !location) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID, recipient name, and location are required',
      });
    }

    // Find batch
    const batch = await Batch.findOne({ batchId })
      .populate('farmer', 'name organization')
      .populate('currentOwner', 'name role walletAddress');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Verify transport authorization
    if (transport.role !== 'Transport') {
      return res.status(403).json({
        success: false,
        message: 'Only transport partners can confirm delivery',
      });
    }

    // Upload proof image to IPFS if provided
    let proofIpfsHash = null;
    if (proofImage) {
      try {
        proofIpfsHash = await ipfsService.uploadJSON({
          type: 'delivery-proof',
          batchId,
          recipientName,
          signature,
          notes,
          timestamp: new Date().toISOString(),
          imageData: proofImage,
        });
      } catch (error) {
        console.log('⚠️  IPFS upload error:', error.message);
      }
    }

    // Record on blockchain
    let blockchainTx = { transactionHash: 'dev-mock-tx-' + Date.now() };
    try {
      if (process.env.USER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
        blockchainTx = await blockchainService.updateBatchStatus(
          batchId,
          'Delivered',
          process.env.USER_PRIVATE_KEY
        );
      } else {
        console.log('⚠️  Blockchain not configured - using mock transaction');
      }
    } catch (error) {
      console.log('⚠️  Blockchain error (using mock):', error.message);
    }

    // Update batch
    batch.status = 'Delivered';
    batch.location = location;
    batch.deliveredAt = new Date();
    batch.deliveryProof = {
      recipientName,
      signature,
      notes,
      proofIpfsHash,
      deliveredBy: transport._id,
      deliveredAt: new Date(),
    };

    if (
      coordinates &&
      coordinates.latitude !== undefined &&
      coordinates.longitude !== undefined
    ) {
      batch.gpsTracking = batch.gpsTracking || [];
      batch.gpsTracking.push({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location,
        timestamp: new Date(),
      });
    }

    // Add to status history
    batch.statusHistory.push({
      status: 'Delivered',
      location,
      message: `Delivered to ${recipientName}${notes ? ': ' + notes : ''}`,
      updatedBy: transport._id,
      blockchainHash: blockchainTx.transactionHash,
    });

    await batch.save();

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed successfully',
      data: {
        batch,
        blockchainHash: blockchainTx.transactionHash,
        proofIpfsHash,
      },
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery',
      error: error.message,
    });
  }
};

/**
 * @desc    Get batch GPS tracking history
 * @route   GET /api/batch/:id/tracking
 * @access  Public
 */
exports.getBatchTracking = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findOne({ batchId: id })
      .select('batchId productName gpsTracking statusHistory location status')
      .populate('statusHistory.updatedBy', 'name role');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        batchId: batch.batchId,
        productName: batch.productName,
        currentLocation: batch.location,
        currentStatus: batch.status,
        gpsTracking: batch.gpsTracking || [],
        statusHistory: batch.statusHistory,
      },
    });
  } catch (error) {
    console.error('Get batch tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batch tracking',
      error: error.message,
    });
  }
};

/**
 * @desc    Create payment order for stage payment
 * @route   POST /api/batch/payment/order
 * @access  Private (Distributor, Retailer)
 */
exports.createPaymentOrder = async (req, res) => {
  try {
    const { batchId, stage, amount } = req.body;
    const payer = req.user;

    if (!batchId || !stage) {
      return res.status(400).json({ success: false, message: 'Batch ID and stage are required' });
    }

    const normalizedStage = String(stage).toLowerCase();
    const config = PAYMENT_STAGE_CONFIG[normalizedStage];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid payment stage' });
    }

    if (!config.payerRoles.includes(payer.role)) {
      return res.status(403).json({ success: false, message: `${payer.role} cannot initiate ${normalizedStage} payment` });
    }

    const batch = await Batch.findOne({ batchId })
      .populate('statusHistory.updatedBy', 'name role walletAddress')
      .populate('farmer', 'name role walletAddress')
      .populate('currentOwner', 'name role walletAddress');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const recipient = await resolveStageRecipient(batch, normalizedStage);
    if (!recipient) {
      return res.status(400).json({ success: false, message: `No ${config.payeeRole} found for this batch` });
    }

    const sequenceError = validatePaymentSequence(batch, normalizedStage);
    if (sequenceError) {
      return res.status(400).json({ success: false, message: sequenceError });
    }

    const existingStagePayment = batch.payments?.[normalizedStage] || {};
    if (existingStagePayment.status === 'Paid') {
      return res.status(400).json({ success: false, message: `${config.payeeRole} payment already completed` });
    }

    const defaultAmount = Number(existingStagePayment.amount || batch.price || (batch.quantity || 0) * 10 || 0);
    const payableAmount = Number(amount || defaultAmount);
    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
    }

    const razorpay = getRazorpayClient();
    const isMockOrder = !razorpay;
    let order;
    if (razorpay) {
      order = await razorpay.orders.create({
        amount: Math.round(payableAmount * 100),
        currency: 'INR',
        receipt: `${batchId}-${normalizedStage}-${Date.now()}`,
        notes: {
          batchId,
          stage: normalizedStage,
          payerRole: payer.role,
          payeeRole: config.payeeRole,
        },
      });
    } else {
      order = {
        id: `order_mock_${Date.now()}`,
        amount: Math.round(payableAmount * 100),
        currency: 'INR',
      };
    }

    batch.payments = batch.payments || {};
    batch.payments[normalizedStage] = {
      ...existingStagePayment,
      status: 'Order Created',
      amount: payableAmount,
      orderId: order.id,
      paidBy: payer._id,
      paidTo: recipient._id,
    };
    batch.markModified('payments');
    await batch.save();

    return res.status(200).json({
      success: true,
      message: 'Payment order created',
      data: {
        order,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
        isMockOrder,
        paymentMode: isMockOrder ? 'Mock Payment' : 'Razorpay',
        batchId,
        stage: normalizedStage,
        amount: payableAmount,
        payee: {
          name: recipient.name,
          role: recipient.role,
          walletAddress: recipient.walletAddress,
        },
      },
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create payment order', error: error.message });
  }
};

/**
 * @desc    Verify and capture payment status
 * @route   POST /api/batch/payment/verify
 * @access  Private (Distributor, Retailer)
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { batchId, stage, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const payer = req.user;

    if (!batchId || !stage || !razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'batchId, stage and razorpay_order_id are required' });
    }

    const normalizedStage = String(stage).toLowerCase();
    const config = PAYMENT_STAGE_CONFIG[normalizedStage];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid payment stage' });
    }

    if (!config.payerRoles.includes(payer.role)) {
      return res.status(403).json({ success: false, message: `${payer.role} cannot verify ${normalizedStage} payment` });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const stagePayment = batch.payments?.[normalizedStage];
    if (!stagePayment || stagePayment.orderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Invalid or expired payment order' });
    }

    if (stagePayment.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Payment already verified' });
    }

    const hasLiveRazorpay = Boolean(process.env.RAZORPAY_KEY_SECRET && razorpay_signature && razorpay_payment_id);
    const paymentMethod = hasLiveRazorpay ? 'Razorpay' : 'Mock Payment';
    if (hasLiveRazorpay) {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
      }
    }

    const paidAt = new Date();
    batch.payments[normalizedStage] = {
      ...stagePayment,
      status: 'Paid',
      paymentId: razorpay_payment_id || `pay_mock_${Date.now()}`,
      signature: razorpay_signature || 'mock_signature',
      paidBy: payer._id,
      paidAt,
      paymentMethod,
    };

    batch.paymentHistory = batch.paymentHistory || [];
    batch.paymentHistory.push({
      stage: normalizedStage,
      amount: Number(stagePayment.amount || 0),
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id || `pay_mock_${Date.now()}`,
      signature: razorpay_signature || 'mock_signature',
      paidBy: payer._id,
      paidByRole: payer.role,
      paidTo: stagePayment.paidTo,
      paidToRole: config.payeeRole,
      paymentMethod,
      paidAt,
    });

    const statusMessageMap = {
      farmer: 'Payment completed from Distributor to Farmer',
      transport: 'Payment completed from Distributor to Transporter',
      distributor: 'Payment completed from Retailer to Distributor',
    };

    if (normalizedStage === 'distributor') {
      batch.status = 'Completed';
    }

    batch.statusHistory.push({
      status: batch.status,
      message: statusMessageMap[normalizedStage],
      updatedBy: payer._id,
    });

    batch.markModified('payments');
    await batch.save();

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        batchId,
        stage: normalizedStage,
        payment: batch.payments[normalizedStage],
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify payment', error: error.message });
  }
};

/**
 * @desc    Get payment history for current user
 * @route   GET /api/batch/payment/history
 * @access  Private
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const batches = await Batch.find({
      $or: [{ 'paymentHistory.paidBy': userId }, { 'paymentHistory.paidTo': userId }, { farmer: userId }],
    })
      .select('batchId productName paymentHistory payments price quantity unit')
      .populate('paymentHistory.paidBy', 'name role')
      .populate('paymentHistory.paidTo', 'name role')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get payment history', error: error.message });
  }
};
