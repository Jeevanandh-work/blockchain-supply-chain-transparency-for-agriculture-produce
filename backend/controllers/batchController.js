const Batch = require('../models/Batch');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');
const ipfsService = require('../services/ipfsService');
const qrService = require('../services/qrService');

/**
 * @desc    Create new batch
 * @route   POST /api/batch/create
 * @access  Private (Farmer only)
 */
exports.createBatch = async (req, res) => {
  try {
    const { batchId, productName, quantity, unit, metadata } = req.body;
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
      unit,
      farmer: farmer._id,
      currentOwner: farmer._id,
      currentOwnerRole: 'Farmer',
      ipfsHash,
      qrCode,
      qrCodeUrl,
      blockchainTxHash: blockchainTx.transactionHash,
      status: 'Created',
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
    const { batchId, toAddress, message } = req.body;
    const currentUser = req.user;

    // Find batch
    const batch = await Batch.findOne({ batchId }).populate('currentOwner');
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Verify current owner
    if (batch.currentOwner._id.toString() !== currentUser._id.toString()) {
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
    batch.status = 'In Transit';
    batch.statusHistory.push({
      status: 'In Transit',
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
      .populate('farmer', 'name email walletAddress organization')
      .populate('currentOwner', 'name email walletAddress role')
      .populate('statusHistory.updatedBy', 'name role')
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
      // Distributors see batches from Farmers (available to pick up)
      query = { 
        $or: [
          { currentOwnerRole: 'Farmer' },
          { currentOwner: req.user._id }
        ]
      };
    } else if (userRole === 'Transport') {
      // Transport sees batches from Distributors
      query = { 
        $or: [
          { currentOwnerRole: 'Distributor' },
          { currentOwner: req.user._id }
        ]
      };
    } else if (userRole === 'Retailer') {
      // Retailers see batches from Transport
      query = { 
        $or: [
          { currentOwnerRole: 'Transport' },
          { currentOwner: req.user._id }
        ]
      };
    }

    const batches = await Batch.find(query)
      .populate('farmer', 'name organization walletAddress')
      .populate('currentOwner', 'name role walletAddress')
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
 * @desc    Update transport status
 * @route   POST /api/batch/transport/status
 * @access  Private (Transport only)
 */
exports.updateTransportStatus = async (req, res) => {
  try {
    const { batchId, status, location, notes, coordinates } = req.body;
    const transport = req.user;

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

    // Verify transport is current owner or authorized
    if (
      batch.currentOwner._id.toString() !== transport._id.toString() &&
      transport.role !== 'Transport'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this batch',
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
    
    // Add GPS coordinates if provided
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      batch.gpsTracking = batch.gpsTracking || [];
      batch.gpsTracking.push({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location: location,
        timestamp: new Date(),
      });
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

    res.status(200).json({
      success: true,
      message: 'Transport status updated successfully',
      data: {
        batch,
        blockchainHash: blockchainTx.transactionHash,
      },
    });
  } catch (error) {
    console.error('Update transport status error:', error);
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
