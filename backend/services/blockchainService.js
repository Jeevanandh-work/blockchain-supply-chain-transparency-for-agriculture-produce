const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Blockchain Service - Comprehensive Ethereum Integration
 * Handles all smart contract interactions with error handling and logging
 */
class BlockchainService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
    this.contractAddress = null;
    this.initialized = false;
  }

  /**
   * Initialize blockchain connection
   * Connects to Ethereum network and loads smart contract
   */
  async initialize() {
    try {
      // Connect to blockchain network (testnet or local)
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 
                     process.env.RPC_URL || 
                     'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`);

      // Load contract deployment info
      const deploymentPath = path.join(
        __dirname,
        '../../blockchain/deployment.json'
      );
      
      if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        this.contractAddress = deployment.address;

        // Load contract ABI
        const artifactPath = path.join(
          __dirname,
          '../../blockchain/artifacts/contracts/SupplyChain.sol/SupplyChain.json'
        );
        
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          const abi = artifact.abi;

          // Initialize contract with read-only provider
          this.contract = new ethers.Contract(this.contractAddress, abi, this.provider);
          
          console.log(`✅ Smart contract loaded at: ${this.contractAddress}`);
          this.initialized = true;
        } else {
          console.warn('⚠️  Contract artifact not found. Compile the contract first.');
        }
      } else {
        console.warn('⚠️  Deployment file not found. Deploy the contract first.');
      }
    } catch (error) {
      console.error('❌ Blockchain initialization error:', error.message);
      // Don't throw - allow app to run with mock transactions
    }
  }

  /**
   * Check if blockchain is initialized and ready
   */
  isReady() {
    return this.initialized && this.contract !== null;
  }

  /**
   * Get contract instance with signer
   * @param {string} privateKey - Private key for signing transactions
   * @returns {Contract} Contract instance with signer
   */
  getContractWithSigner(privateKey) {
    if (!this.isReady()) {
      throw new Error('Blockchain service not initialized');
    }
    
    const wallet = new ethers.Wallet(privateKey, this.provider);
    return this.contract.connect(wallet);
  }

  /**
   * Create a new batch on blockchain
   * @param {string} batchId - Unique batch identifier
   * @param {string} ipfsHash - IPFS hash of batch metadata
   * @param {string} privateKey - Farmer's private key
   * @returns {object} Transaction details
   */
  async createBatch(batchId, ipfsHash, privateKey) {
    try {
      if (!this.isReady()) {
        return this.mockTransaction('createBatch');
      }

      const contractWithSigner = this.getContractWithSigner(privateKey);

      console.log(`📝 Creating batch ${batchId} on blockchain...`);
      const tx = await contractWithSigner.createBatch(batchId, ipfsHash);
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Batch created on block ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Blockchain createBatch error:', error);
      throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
  }

  /**
   * Transfer batch ownership on blockchain
   * @param {string} batchId - Batch identifier
   * @param {string} toAddress - Recipient wallet address
   * @param {string} updateMsg - Status update message
   * @param {string} privateKey - Current owner's private key
   * @returns {object} Transaction details
   */
  async transferBatch(batchId, toAddress, updateMsg, privateKey) {
    try {
      if (!this.isReady()) {
        return this.mockTransaction('transferBatch');
      }

      const contractWithSigner = this.getContractWithSigner(privateKey);

      console.log(`📝 Transferring batch ${batchId} to ${toAddress}...`);
      const tx = await contractWithSigner.transferBatch(batchId, toAddress, updateMsg);
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Batch transferred on block ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Blockchain transferBatch error:', error);
      throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
  }

  /**
   * Update batch status on blockchain
   * @param {string} batchId - Batch identifier
   * @param {string} status - New status
   * @param {string} location - Current location
   * @param {string} privateKey - Updater's private key
   * @returns {object} Transaction details
   */
  async updateBatchStatus(batchId, status, location, privateKey) {
    try {
      if (!this.isReady()) {
        return this.mockTransaction('updateStatus');
      }

      const contractWithSigner = this.getContractWithSigner(privateKey);

      console.log(`📝 Updating status for batch ${batchId}: ${status}...`);
      const tx = await contractWithSigner.updateStatus(batchId, status, location);
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Status updated on block ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Blockchain updateStatus error:', error);
      throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
  }

  /**
   * Confirm delivery on blockchain
   * @param {string} batchId - Batch identifier
   * @param {string} recipientName - Name of recipient
   * @param {string} privateKey - Transport's private key
   * @returns {object} Transaction details
   */
  async confirmDelivery(batchId, recipientName, privateKey) {
    try {
      if (!this.isReady()) {
        return this.mockTransaction('confirmDelivery');
      }

      const contractWithSigner = this.getContractWithSigner(privateKey);

      console.log(`📝 Confirming delivery for batch ${batchId}...`);
      const tx = await contractWithSigner.confirmDelivery(batchId, recipientName);
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Delivery confirmed on block ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Blockchain confirmDelivery error:', error);
      throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
  }

  /**
   * Record quality inspection on blockchain
   * @param {string} batchId - Batch identifier
   * @param {string} qualityHash - IPFS hash of quality document
   * @param {string} privateKey - Inspector's private key
   * @returns {object} Transaction details
   */
  async recordQuality(batchId, qualityHash, privateKey) {
    try {
      if (!this.isReady()) {
        return this.mockTransaction('recordQuality');
      }

      const contractWithSigner = this.getContractWithSigner(privateKey);

      console.log(`📝 Recording quality for batch ${batchId}...`);
      const tx = await contractWithSigner.recordQuality(batchId, qualityHash);
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Quality recorded on block ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Blockchain recordQuality error:', error);
      throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
  }

  /**
   * Get batch details from blockchain
   * @param {string} batchId - Batch identifier
   * @returns {object} Batch details with verification
   */
  async getBatch(batchId) {
    try {
      if (!this.isReady()) {
        return null;
      }

      const batch = await this.contract.getBatch(batchId);

      return {
        batchId: batch[0],
        farmer: batch[1],
        currentOwner: batch[2],
        ipfsHash: batch[3],
        statusUpdates: batch[4],
        createdAt: Number(batch[5]),
        updatedAt: Number(batch[6]),
        verified: true,
      };
    } catch (error) {
      console.error('❌ Blockchain getBatch error:', error);
      return null;
    }
  }

  /**
   * Get batch ownership history from blockchain
   * @param {string} batchId - Batch identifier
   * @returns {array} Array of owner addresses
   */
  async getBatchHistory(batchId) {
    try {
      if (!this.isReady()) {
        return [];
      }

      const history = await this.contract.getBatchHistory(batchId);
      return history;
    } catch (error) {
      console.error('❌ Blockchain getBatchHistory error:', error);
      return [];
    }
  }

  /**
   * Get quality inspection records from blockchain
   * @param {string} batchId - Batch identifier
   * @returns {array} Quality records
   */
  async getQualityRecords(batchId) {
    try {
      if (!this.isReady()) {
        return [];
      }

      const records = await this.contract.getQualityRecords(batchId);
      return records.map((record) => ({
        qualityHash: record.qualityHash,
        recordedBy: record.recordedBy,
        timestamp: Number(record.timestamp),
      }));
    } catch (error) {
      console.error('❌ Blockchain getQualityRecords error:', error);
      return [];
    }
  }

  /**
   * Verify batch exists on blockchain
   * @param {string} batchId - Batch identifier
   * @returns {boolean} True if batch exists
   */
  async verifyBatch(batchId) {
    try {
      if (!this.isReady()) {
        return false;
      }

      return await this.contract.batchExistsCheck(batchId);
    } catch (error) {
      console.error('❌ Blockchain verifyBatch error:', error);
      return false;
    }
  }

  /**
   * Get transaction details from blockchain
   * @param {string} txHash - Transaction hash
   * @returns {object} Transaction details
   */
  async getTransaction(txHash) {
    try {
      if (!this.isReady()) {
        return null;
      }

      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        return null;
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        timestamp: (await this.provider.getBlock(receipt.blockNumber)).timestamp,
      };
    } catch (error) {
      console.error('❌ Get transaction error:', error);
      return null;
    }
  }

  /**
   * Mock transaction for development without blockchain
   * @param {string} operation - Operation name
   * @returns {object} Mock transaction details
   */
  mockTransaction(operation) {
    console.log(`⚠️  Using mock transaction for ${operation} (blockchain not configured)`);
    
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000),
      blockHash: '0x' + Math.random().toString(16).substring(2, 66),
      gasUsed: Math.floor(Math.random() * 100000).toString(),
      timestamp: Date.now(),
      mock: true,
    };
  }

  /**
   * Get contract address
   * @returns {string} Contract address
   */
  getContractAddress() {
    return this.contractAddress;
  }

  /**
   * Get network information
   * @returns {object} Network details
   */
  async getNetworkInfo() {
    try {
      if (!this.provider) {
        return null;
      }

      const network = await this.provider.getNetwork();
      return {
        name: network.name,
        chainId: network.chainId.toString(),
        contractAddress: this.contractAddress,
        initialized: this.initialized,
      };
    } catch (error) {
      console.error('❌ Get network info error:', error);
      return null;
    }
  }
}

module.exports = new BlockchainService();
