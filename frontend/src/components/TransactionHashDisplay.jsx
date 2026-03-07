import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Transaction Hash Display Component
 * Shows transaction hash with copy functionality and explorer link
 */
const TransactionHashDisplay = ({ 
  txHash, 
  explorerUrl = null,
  label = 'Transaction Hash',
  shortened = true,
  size = 'md' 
}) => {
  const [copied, setCopied] = useState(false);

  const sizes = {
    sm: {
      text: 'text-xs',
      icon: 'h-3 w-3',
      padding: 'p-1',
    },
    md: {
      text: 'text-sm',
      icon: 'h-4 w-4',
      padding: 'p-1.5',
    },
    lg: {
      text: 'text-base',
      icon: 'h-5 w-5',
      padding: 'p-2',
    },
  };

  const sizeClasses = sizes[size] || sizes.md;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatHash = (hash) => {
    if (!hash) return '';
    if (!shortened) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  const getExplorerUrl = () => {
    if (explorerUrl) return explorerUrl;
    // Default to Sepolia testnet
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className={`block font-medium text-gray-700 ${sizeClasses.text}`}>
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <code className={`flex-1 font-mono text-gray-800 ${sizeClasses.text} break-all`}>
          {formatHash(txHash)}
        </code>
        
        <div className="flex items-center gap-1">
          {/* Copy button */}
          <motion.button
            onClick={handleCopy}
            className={`${sizeClasses.padding} rounded-md hover:bg-gray-200 transition-colors`}
            whileTap={{ scale: 0.95 }}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className={`${sizeClasses.icon} text-green-600`} />
            ) : (
              <Copy className={`${sizeClasses.icon} text-gray-600`} />
            )}
          </motion.button>

          {/* Explorer link */}
          <motion.a
            href={getExplorerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${sizeClasses.padding} rounded-md hover:bg-gray-200 transition-colors`}
            whileTap={{ scale: 0.95 }}
            title="View on Explorer"
          >
            <ExternalLink className={`${sizeClasses.icon} text-blue-600`} />
          </motion.a>
        </div>
      </div>

      {copied && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`text-green-600 ${sizeClasses.text}`}
        >
          Copied to clipboard!
        </motion.p>
      )}
    </div>
  );
};

export default TransactionHashDisplay;
