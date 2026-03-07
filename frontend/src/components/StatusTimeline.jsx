/**
 * StatusTimeline Component
 * Displays vertical animated timeline of batch status history
 * Shows the journey from farmer to current owner
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle, Truck, Package, Store, User as UserIcon } from 'lucide-react';

const StatusTimeline = ({ batch, currentStatus = '' }) => {
  /**
   * Safety check for batch data
   */
  if (!batch) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No timeline data available</p>
      </div>
    );
  }

  /**
   * Format timestamp to readable format
   */
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Get icon based on role
   */
  const getRoleIcon = (role) => {
    const icons = {
      farmer: Package,
      distributor: Truck,
      transport: Truck,
      retailer: Store,
      consumer: UserIcon
    };
    const Icon = icons[role] || Circle;
    return <Icon className="w-5 h-5" />;
  };

  /**
   * Get color scheme based on role
   */
  const getRoleColor = (role) => {
    const colors = {
      farmer: 'emerald',
      distributor: 'amber',
      transport: 'blue',
      retailer: 'purple',
      consumer: 'gray'
    };
    return colors[role] || 'gray';
  };

  /**
   * Build timeline events from batch data
   */
  const buildTimeline = () => {
    const events = [];

    // Initial creation by farmer
    events.push({
      id: 1,
      role: 'farmer',
      action: 'Batch Created',
      user: batch.farmer?.name || batch.currentOwner?.name || 'Farmer',
      location: batch.origin || 'Farm Location',
      timestamp: batch.timestamp,
      status: 'completed'
    });

    // Add transfer history
    if (batch.history && batch.history.length > 0) {
      batch.history.forEach((transfer, index) => {
        events.push({
          id: events.length + 1,
          role: transfer.toRole || 'unknown',
          action: `Transferred to ${transfer.toRole || 'Next Party'}`,
          user: transfer.toName || transfer.to || 'Unknown',
          location: transfer.location || 'Not specified',
          timestamp: transfer.timestamp,
          status: 'completed'
        });
      });
    }

    // Add current status if provided
    if (currentStatus) {
      events.push({
        id: events.length + 1,
        role: batch.currentOwner?.role || 'distributor',
        action: currentStatus,
        user: batch.currentOwner?.name || 'Current Owner',
        location: 'Current Location',
        timestamp: new Date().toISOString(),
        status: 'current'
      });
    }

    return events;
  };

  const timeline = buildTimeline();

  /**
   * Animation variants for timeline items
   */
  const itemVariants = {
    hidden: { 
      opacity: 0, 
      x: -50 
    },
    visible: (index) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 0.15,
        duration: 0.5,
        ease: 'easeOut'
      }
    })
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: (index) => ({
      scale: 1,
      rotate: 0,
      transition: {
        delay: index * 0.15 + 0.2,
        type: 'spring',
        stiffness: 200,
        damping: 15
      }
    })
  };

  return (
    <div className="relative py-4">
      {timeline.map((event, index) => {
        const color = getRoleColor(event.role);
        const isLast = index === timeline.length - 1;
        const isCurrent = event.status === 'current';
        const isCompleted = event.status === 'completed';

        return (
          <motion.div
            key={event.id}
            custom={index}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="relative flex items-start mb-8 last:mb-0"
          >
            {/* Vertical Line */}
            {!isLast && (
              <motion.div
                className={`absolute left-[23px] top-12 w-0.5 h-full bg-${color}-200`}
                initial={{ height: 0 }}
                animate={{ height: '100%' }}
                transition={{ delay: index * 0.15 + 0.3, duration: 0.5 }}
              />
            )}

            {/* Icon Circle */}
            <motion.div
              custom={index}
              variants={iconVariants}
              className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 ${
                isCurrent
                  ? `bg-${color}-500 border-${color}-300 shadow-lg shadow-${color}-200`
                  : isCompleted
                  ? `bg-${color}-100 border-${color}-300`
                  : `bg-white border-gray-300`
              }`}
            >
              <div className={`${isCurrent || isCompleted ? `text-${color}-700` : 'text-gray-400'}`}>
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  getRoleIcon(event.role)
                )}
              </div>

              {/* Pulse Animation for Current Status */}
              {isCurrent && (
                <motion.div
                  className={`absolute inset-0 rounded-full bg-${color}-400`}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              )}
            </motion.div>

            {/* Content Card */}
            <motion.div
              className={`ml-6 flex-1 p-4 rounded-lg border-2 ${
                isCurrent
                  ? `bg-${color}-50 border-${color}-300 shadow-md`
                  : `bg-white border-gray-200`
              }`}
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
            >
              {/* Action & Role Badge */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className={`font-bold text-lg ${
                    isCurrent ? `text-${color}-900` : 'text-gray-900'
                  }`}>
                    {event.action}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    by <span className="font-semibold">{event.user}</span>
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${color}-100 text-${color}-800 border border-${color}-200`}>
                  {event.role.toUpperCase()}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">{event.location}</span>
              </div>

              {/* Timestamp */}
              <div className="flex items-center text-xs text-gray-500">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatTime(event.timestamp)}</span>
              </div>

              {/* Current Status Indicator */}
              {isCurrent && (
                <motion.div
                  className="mt-3 pt-3 border-t border-amber-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <span className="inline-flex items-center text-xs font-bold text-amber-700">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse" />
                    Current Status
                  </span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StatusTimeline;
