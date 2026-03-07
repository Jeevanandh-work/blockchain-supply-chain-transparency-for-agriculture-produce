import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = true, onClick }) => {
  const hoverClass = hover ? 'card-hover' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-6 ${hoverClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default Card;
