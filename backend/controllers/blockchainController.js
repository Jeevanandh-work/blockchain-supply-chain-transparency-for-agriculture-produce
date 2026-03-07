const blockchainService = require('../services/blockchainService');
const Batch = require('../models/Batch');

/**
 * Verify a batch on blockchain
 * @route GET /api/blockchain/verify/:batchId
 */
exports.verifyBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    // Get batch from database
    const batch = await Batch.findOne({ batchId }).populate('farmer', 'name walletAddress');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Verify on blockchain
    const blockchainData = await blockchainService.getBatch(batchId);
    const exists = await blockchainService.verifyBatch(batchId);

    if (!blockchainData && !exists) {
      return res.status(200).json({
        success: true,
        verified: false,
        message: 'Batch not yet recorded on blockchain',
        batch: {
          batchId: batch.batchId,
          productName: batch.productName,
          farmer: batch.farmer,
          status: batch.status,
        },
      });
    }

    // Get ownership history
    const history = await blockchainService.getBatchHistory(batchId);

    // Get quality records
    const qualityRecords = await blockchainService.getQualityRecords(batchId);

    // Get network info
    const network = await blockchainService.getNetworkInfo();

    res.json({
      success: true,
      verified: true,
      batch: {
        batchId: batch.batchId,
        productName: batch.productName,
        quantity: batch.quantity,
        farmer: batch.farmer,
        status: batch.status,
        location: batch.location,
        createdAt: batch.createdAt,
      },
      blockchain: {
        verified: true,
        contractAddress: blockchainService.getContractAddress(),
        network: network,
        data: blockchainData,
        ownershipHistory: history,
        qualityRecords: qualityRecords,
        transactionHashes: batch.statusHistory
          .filter(h => h.blockchainHash)
          .map(h => ({
            status: h.status,
            transactionHash: h.blockchainHash,
            timestamp: h.timestamp,
          })),
      },
    });
  } catch (error) {
    console.error('Verify batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify batch',
      error: error.message,
    });
  }
};

/**
 * Get transaction details
 * @route GET /api/blockchain/transaction/:txHash
 */
exports.getTransaction = async (req, res) => {
  try {
    const { txHash } = req.params;

    const transaction = await blockchainService.getTransaction(txHash);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const network = await blockchainService.getNetworkInfo();

    // Generate explorer URL based on network
    let explorerUrl = '';
    if (network && network.chainId === '11155111') {
      // Sepolia testnet
      explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
    } else if (network && network.chainId === '1') {
      // Ethereum mainnet
      explorerUrl = `https://etherscan.io/tx/${txHash}`;
    }

    res.json({
      success: true,
      transaction: {
        ...transaction,
        explorerUrl,
        network: network,
      },
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction',
      error: error.message,
    });
  }
};

/**
 * Get batch blockchain data
 * @route GET /api/blockchain/batch/:batchId
 */
exports.getBlockchainBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const blockchainData = await blockchainService.getBatch(batchId);

    if (!blockchainData) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found on blockchain',
      });
    }

    const history = await blockchainService.getBatchHistory(batchId);
    const qualityRecords = await blockchainService.getQualityRecords(batchId);

    res.json({
      success: true,
      batch: blockchainData,
      history: history,
      qualityRecords: qualityRecords,
    });
  } catch (error) {
    console.error('Get blockchain batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain batch',
      error: error.message,
    });
  }
};

/**
 * Get network information
 * @route GET /api/blockchain/network
 */
exports.getNetworkInfo = async (req, res) => {
  try {
    const network = await blockchainService.getNetworkInfo();

    if (!network) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain service not available',
      });
    }

    res.json({
      success: true,
      network: network,
      contractAddress: blockchainService.getContractAddress(),
    });
  } catch (error) {
    console.error('Get network info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get network info',
      error: error.message,
    });
  }
};

/**
 * Get all batches from blockchain
 * @route GET /api/blockchain/batches
 */
exports.getAllBatches = async (req, res) => {
  try {
    // Get all batches from database that have blockchain hashes
    const batches = await Batch.find({
      'statusHistory.blockchainHash': { $exists: true, $ne: null },
    })
      .populate('farmer', 'name walletAddress')
      .select('batchId productName status location createdAt statusHistory')
      .sort({ createdAt: -1 });

    const batchesWithVerification = batches.map((batch) => ({
      batchId: batch.batchId,
      productName: batch.productName,
      status: batch.status,
      location: batch.location,
      farmer: batch.farmer,
      createdAt: batch.createdAt,
      verified: true,
      transactionCount: batch.statusHistory.filter(h => h.blockchainHash).length,
      latestTransaction: batch.statusHistory
        .filter(h => h.blockchainHash)
        .sort((a, b) => b.timestamp - a.timestamp)[0],
    }));

    res.json({
      success: true,
      count: batchesWithVerification.length,
      batches: batchesWithVerification,
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
 * Verify multiple batches at once
 * @route POST /api/blockchain/verify-multiple
 */
exports.verifyMultipleBatches = async (req, res) => {
  try {
    const { batchIds } = req.body;

    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of batch IDs',
      });
    }

    const results = await Promise.all(
      batchIds.map(async (batchId) => {
        try {
          const exists = await blockchainService.verifyBatch(batchId);
          const batch = await Batch.findOne({ batchId }).select('batchId productName status');

          return {
            batchId,
            verified: exists,
            batch: batch,
          };
        } catch (error) {
          return {
            batchId,
            verified: false,
            error: error.message,
          };
        }
      })
    );

    const verifiedCount = results.filter(r => r.verified).length;

    res.json({
      success: true,
      total: batchIds.length,
      verified: verifiedCount,
      unverified: batchIds.length - verifiedCount,
      results: results,
    });
  } catch (error) {
    console.error('Verify multiple batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify batches',
      error: error.message,
    });
  }
};
