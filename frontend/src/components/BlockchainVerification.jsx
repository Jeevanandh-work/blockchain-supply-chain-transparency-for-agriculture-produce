import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle2,
  ExternalLink,
  Clock,
  Database,
  Link,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { blockchainAPI } from '../services/api';
import TransactionHashDisplay from './TransactionHashDisplay';
import BlockchainBadge from './BlockchainBadge';

/**
 * Comprehensive Blockchain Verification Component
 * Displays complete blockchain verification details for a batch
 */
const BlockchainVerification = ({ batchId, inline = false }) => {
  const [loading, setLoading] = useState(true);
  const [verificationData, setVerificationData] = useState(null);
  const [error, setError] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    loadVerificationData();
    loadNetworkInfo();
  }, [batchId]);

  const loadVerificationData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await blockchainAPI.verifyBatch(batchId);
      setVerificationData(response);
    } catch (err) {
      setError(err.message || 'Failed to verify batch');
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNetworkInfo = async () => {
    try {
      const response = await blockchainAPI.getNetworkInfo();
      if (response.success) {
        setNetworkInfo(response.network);
      }
    } catch (err) {
      console.error('Network info error:', err);
    }
  };

  const getNetworkName = () => {
    if (!networkInfo) return 'Ethereum';
    const chainId = networkInfo.chainId;
    if (chainId === '11155111') return 'Sepolia Testnet';
    if (chainId === '1') return 'Ethereum Mainnet';
    return networkInfo.name || 'Ethereum';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-gray-600">Verifying on blockchain...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 border border-red-200 rounded-lg p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Verification Failed</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Not verified state
  if (!verificationData?.verified) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-6"
      >
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-800">Not Yet Verified</h3>
            <p className="text-sm text-yellow-700 mt-1">
              {verificationData?.message || 'This batch has not been recorded on the blockchain yet.'}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Verified - Inline view
  if (inline) {
    return (
      <div className="flex items-center gap-3">
        <BlockchainBadge verified={true} size="sm" />
        <span className="text-xs text-gray-500">
          {verificationData.blockchain?.transactionHashes?.length || 0} transactions
        </span>
      </div>
    );
  }

  // Verified - Full view
  const { blockchain } = verificationData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-white rounded-full p-3 shadow-md">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Blockchain Verification</h2>
              <p className="text-sm text-gray-600 mt-1">
                Verified on {getNetworkName()}
              </p>
            </div>
          </div>
          <BlockchainBadge verified={true} size="lg" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Network Information */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Network Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Network:</span>
              <p className="font-medium text-gray-900 mt-1">{getNetworkName()}</p>
            </div>
            <div>
              <span className="text-gray-600">Chain ID:</span>
              <p className="font-medium text-gray-900 mt-1">{blockchain.network?.chainId || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Contract Address:</span>
              <p className="font-mono text-xs text-gray-900 mt-1 break-all">
                {blockchain.contractAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Blockchain Data */}
        {blockchain.data && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Link className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Blockchain Data</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Batch ID:</span>
                <p className="font-medium text-gray-900 mt-1">{blockchain.data.batchId}</p>
              </div>
              <div>
                <span className="text-gray-600">Current Owner:</span>
                <p className="font-mono text-xs text-gray-900 mt-1 break-all">
                  {blockchain.data.currentOwner?.substring(0, 20)}...
                </p>
              </div>
              <div>
                <span className="text-gray-600">Created At:</span>
                <p className="font-medium text-gray-900 mt-1">
                  {formatTimestamp(blockchain.data.createdAt)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <p className="font-medium text-gray-900 mt-1">
                  {formatTimestamp(blockchain.data.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        {blockchain.transactionHashes && blockchain.transactionHashes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Transaction History</h3>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                {blockchain.transactionHashes.length} transactions
              </span>
            </div>
            <div className="space-y-3">
              {blockchain.transactionHashes.map((tx, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{tx.status}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <TransactionHashDisplay
                    txHash={tx.transactionHash}
                    label=""
                    size="sm"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Ownership History */}
        {blockchain.ownershipHistory && blockchain.ownershipHistory.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Ownership History</h3>
            </div>
            <div className="space-y-2">
              {blockchain.ownershipHistory.map((owner, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="bg-green-100 rounded-full p-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <code className="text-xs font-mono text-gray-800 flex-1 break-all">
                    {owner}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quality Records */}
        {blockchain.qualityRecords && blockchain.qualityRecords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Quality Inspections</h3>
            </div>
            <div className="space-y-3">
              {blockchain.qualityRecords.map((record, index) => (
                <div
                  key={index}
                  className="bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Inspector:</span>
                    <code className="text-xs font-mono text-gray-800">
                      {record.recordedBy.substring(0, 20)}...
                    </code>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">Time:</span>
                    <span className="text-xs text-gray-800">
                      {formatTimestamp(record.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Last verified: {new Date().toLocaleString()}
          </span>
          <motion.button
            onClick={loadVerificationData}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
          >
            <ExternalLink className="h-4 w-4" />
            Refresh Verification
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default BlockchainVerification;
