// Temporarily disabled IPFS due to package compatibility issues
// const { create } = require('ipfs-http-client');

class IPFSService {
  constructor() {
    this.client = null;
  }

  /**
   * Initialize IPFS client
   */
  initialize() {
    try {
      console.log('⚠️  IPFS service disabled - using mock data');
      // IPFS integration can be added later with compatible package
    } catch (error) {
      console.error('❌ IPFS initialization error:', error.message);
    }
  }

  /**
   * Upload file to IPFS
   * @param {Buffer} file - File buffer
   * @returns {string} IPFS hash
   */
  async uploadFile(file) {
    try {
      // Mock hash for development without IPFS
      const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15);
      console.log('📦 Mock IPFS upload:', mockHash);
      return mockHash;
    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Upload JSON data to IPFS
   * @param {object} data - JSON data
   * @returns {string} IPFS hash
   */
  async uploadJSON(data) {
    try {
      // Mock hash for development without IPFS
      const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15);
      console.log('📦 Mock IPFS JSON upload:', mockHash);
      return mockHash;
    } catch (error) {
      console.error('IPFS JSON upload error:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve file from IPFS
   * @param {string} hash - IPFS hash
   * @returns {Buffer} File buffer
   */
  async getFile(hash) {
    try {
      // Mock retrieval for development
      console.log('📥 Mock IPFS retrieval:', hash);
      return Buffer.from(JSON.stringify({ mock: 'data' }));
    } catch (error) {
      console.error('IPFS retrieve error:', error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve JSON data from IPFS
   * @param {string} hash - IPFS hash
   * @returns {object} JSON data
   */
  async getJSON(hash) {
    try {
      const buffer = await this.getFile(hash);
      return JSON.parse(buffer.toString());
    } catch (error) {
      console.error('IPFS JSON retrieve error:', error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get IPFS gateway URL
   * @param {string} hash - IPFS hash
   * @returns {string} Gateway URL
   */
  getGatewayUrl(hash) {
    const gateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs';
    return `${gateway}/${hash}`;
  }
}

module.exports = new IPFSService();
