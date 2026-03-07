/**
 * API Service for Supply Chain Application
 * Handles all HTTP requests to the backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

/**
 * Set authorization token for authenticated requests
 * @param {string} token - JWT token
 */
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

/**
 * Batch API Services
 */
export const batchAPI = {
  /**
   * Fetch all available batches
   * @returns {Promise} Array of batch objects
   */
  getAllBatches: async () => {
    try {
      const response = await axios.get('/batch/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Fetch batches available for distributor (created by farmers)
   * @returns {Promise} Array of batch objects
   */
  getAvailableBatches: async () => {
    try {
      const response = await axios.get('/batch/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get single batch details by ID
   * @param {string} batchId - Batch identifier
   * @returns {Promise} Batch object with full details
   */
  getBatchById: async (batchId) => {
    try {
      const response = await axios.get(`/batch/${batchId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Accept and transfer batch to next owner
   * @param {string} batchId - Batch identifier
   * @param {string} toAddress - Recipient wallet address
   * @param {string} message - Transfer message/notes
   * @returns {Promise} Transfer confirmation
   */
  transferBatch: async (batchId, toAddress, message = 'Batch transferred') => {
    try {
      const response = await axios.post('/batch/transfer', {
        batchId,
        toAddress,
        message
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Record quality inspection for a batch
   * @param {string} batchId - Batch identifier
   * @param {Object} qualityData - Quality metrics
   * @returns {Promise} Quality record confirmation
   */
  recordQuality: async (batchId, qualityData) => {
    try {
      const response = await axios.post('/batch/quality', {
        batchId,
        ...qualityData
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

/**
 * User API Services
 */
export const userAPI = {
  /**
   * User login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} User data and token
   */
  login: async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * User registration
   * @param {Object} userData - User registration data
   * @returns {Promise} User data and token
   */
  register: async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get all users (for admin/transfer purposes)
   * @returns {Promise} Array of users
   */
  getAllUsers: async () => {
    try {
      const response = await axios.get('/user/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get users by role
   * @param {string} role - User role (farmer, distributor, transport, retailer, consumer)
   * @returns {Promise} Array of users
   */
  getUsersByRole: async (role) => {
    try {
      const response = await axios.get(`/user/role/${role}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

/**
 * Transport API Services
 */
export const transportAPI = {
  /**
   * Update transport status
   * @param {Object} statusData - Status update data
   * @returns {Promise} Updated batch data
   */
  updateStatus: async (statusData) => {
    try {
      const response = await axios.post('/batch/transport/status', statusData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Confirm delivery
   * @param {Object} deliveryData - Delivery confirmation data
   * @returns {Promise} Delivery confirmation response
   */
  confirmDelivery: async (deliveryData) => {
    try {
      const response = await axios.post('/batch/transport/deliver', deliveryData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get batch GPS tracking
   * @param {string} batchId - Batch ID
   * @returns {Promise} GPS tracking data
   */
  getTracking: async (batchId) => {
    try {
      const response = await axios.get(`/batch/${batchId}/tracking`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

/**
 * Blockchain API Services
 */
export const blockchainAPI = {
  /**
   * Verify a batch on blockchain
   * @param {string} batchId - Batch identifier
   * @returns {Promise} Verification result with blockchain data
   */
  verifyBatch: async (batchId) => {
    try {
      const response = await axios.get(`/blockchain/verify/${batchId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get transaction details
   * @param {string} txHash - Transaction hash
   * @returns {Promise} Transaction details
   */
  getTransaction: async (txHash) => {
    try {
      const response = await axios.get(`/blockchain/transaction/${txHash}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get blockchain network information
   * @returns {Promise} Network details
   */
  getNetworkInfo: async () => {
    try {
      const response = await axios.get('/blockchain/network');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get batch from blockchain
   * @param {string} batchId - Batch identifier
   * @returns {Promise} Blockchain batch data
   */
  getBlockchainBatch: async (batchId) => {
    try {
      const response = await axios.get(`/blockchain/batch/${batchId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get all verified batches
   * @returns {Promise} Array of verified batches
   */
  getAllVerifiedBatches: async () => {
    try {
      const response = await axios.get('/blockchain/batches');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  /**
   * Verify multiple batches at once
   * @param {Array} batchIds - Array of batch identifiers
   * @returns {Promise} Verification results
   */
  verifyMultipleBatches: async (batchIds) => {
    try {
      const response = await axios.post('/blockchain/verify-multiple', { batchIds });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

export default {
  batchAPI,
  userAPI,
  transportAPI,
  blockchainAPI,
  setAuthToken
};
