import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Shield } from 'lucide-react';

/**
 * Blockchain Verification Badge Component
 * Displays a verified badge when batch is recorded on blockchain
 */
const BlockchainBadge = ({ 
  verified = true, 
  size = 'md', 
  showText = true,
  animate = true 
}) => {
  const sizes = {
    sm: {
      icon: 'h-4 w-4',
      text: 'text-xs',
      padding: 'px-2 py-1',
    },
    md: {
      icon: 'h-5 w-5',
      text: 'text-sm',
      padding: 'px-3 py-1.5',
    },
    lg: {
      icon: 'h-6 w-6',
      text: 'text-base',
      padding: 'px-4 py-2',
    },
  };

  const sizeClasses = sizes[size] || sizes.md;

  const badgeContent = (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses.padding} ${
        verified
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-gray-50 text-gray-500 border border-gray-200'
      }`}
    >
      {verified ? (
        <CheckCircle2 className={sizeClasses.icon} />
      ) : (
        <Shield className={sizeClasses.icon} />
      )}
      {showText && (
        <span className={`font-medium ${sizeClasses.text}`}>
          {verified ? 'Verified on Blockchain' : 'Not Verified'}
        </span>
      )}
    </div>
  );

  if (animate && verified) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
        }}
      >
        {badgeContent}
      </motion.div>
    );
  }

  return badgeContent;
};

export default BlockchainBadge;
