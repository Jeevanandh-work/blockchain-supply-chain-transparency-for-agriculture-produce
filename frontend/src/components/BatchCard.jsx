/**
 * BatchCard Component
 * Displays individual batch information with hover animations
 * Used in Distributor Dashboard to show available batches from farmers
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Package, User, MapPin, Weight, Calendar, Hash, TrendingUp, ExternalLink, Navigation } from 'lucide-react';

const BatchCard = ({ batch, onViewDetails, index = 0 }) => {
  /**
   * Format date to readable string
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * Get status badge color based on current owner role
   */
  const getStatusColor = (role) => {
    const colors = {
      farmer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      distributor: 'bg-amber-100 text-amber-800 border-amber-200',
      transport: 'bg-blue-100 text-blue-800 border-blue-200',
      retailer: 'bg-purple-100 text-purple-800 border-purple-200',
      consumer: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const latestGpsPoint = batch?.gpsTracking?.length
    ? batch.gpsTracking[batch.gpsTracking.length - 1]
    : null;

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Animation variants for staggered card entrance
   */
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.6, -0.05, 0.01, 0.99]
      }
    },
    hover: {
      y: -8,
      scale: 1.02,
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="relative bg-white rounded-xl border-2 border-gray-200 overflow-hidden cursor-pointer group"
      onClick={() => onViewDetails(batch)}
    >
      {/* Gradient Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-amber-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative p-6 space-y-4">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <motion.h3 
              className="text-xl font-bold text-gray-900 mb-1 group-hover:text-emerald-700 transition-colors"
              whileHover={{ x: 5 }}
            >
              {batch.productName}
            </motion.h3>
            <div className="flex items-center text-sm text-gray-500">
              <Hash className="w-3 h-3 mr-1" />
              <span className="font-mono">{batch.batchId}</span>
            </div>
          </div>

          {/* Status Badge */}
          <motion.span 
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${getStatusColor(batch.currentOwner?.role)}`}
            whileHover={{ scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {batch.currentOwner?.role?.toUpperCase() || 'UNKNOWN'}
          </motion.span>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-emerald-200 via-amber-200 to-emerald-200" />

        {/* Batch Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Quantity */}
          <div className="flex items-center space-x-2 text-gray-700">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Weight className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Quantity</p>
              <p className="text-sm font-bold text-gray-900">
                {batch.quantity} {batch.unit}
              </p>
            </div>
          </div>

          {/* Price (if available) */}
          <div className="flex items-center space-x-2 text-gray-700">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Value</p>
              <p className="text-sm font-bold text-gray-900">
                ${batch.price || (batch.quantity * 10).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Farmer Information */}
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <div className="flex items-start space-x-2">
            <div className="p-1.5 bg-emerald-200 rounded-lg">
              <User className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-900 mb-1">
                Farmer Details
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">
                {batch.farmer?.name || batch.currentOwner?.name || 'Unknown Farmer'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {batch.farmer?.email || batch.currentOwner?.email || 'No email'}
              </p>
              {batch.farmer?.walletAddress && (
                <p className="text-xs text-gray-500 font-mono truncate mt-1">
                  {batch.farmer.walletAddress.substring(0, 15)}...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location & Date */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="font-medium">{batch.origin || 'Origin Farm'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>{formatDate(batch.timestamp)}</span>
          </div>
        </div>

        {/* Live Transport GPS Tracking */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-900 flex items-center">
              <Navigation className="w-3 h-3 mr-1" />
              Transport Status: {batch.status || 'In Transit'}
            </p>
          </div>

          {latestGpsPoint ? (
            <>
              <p className="text-xs text-blue-800">
                Current Location:
              </p>
              <p className="text-xs text-gray-700">
                Latitude: {Number(latestGpsPoint.latitude).toFixed(5)}
              </p>
              <p className="text-xs text-gray-700">
                Longitude: {Number(latestGpsPoint.longitude).toFixed(5)}
              </p>
              <p className="text-xs text-gray-500">
                Last Updated: {formatDateTime(latestGpsPoint.timestamp)}
              </p>

              <a
                href={`https://www.google.com/maps?q=${latestGpsPoint.latitude},${latestGpsPoint.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900"
                onClick={(e) => e.stopPropagation()}
              >
                View on Map 🌍
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>

              <iframe
                title={`live-map-${batch.batchId}`}
                src={`https://maps.google.com/maps?q=${latestGpsPoint.latitude},${latestGpsPoint.longitude}&z=15&output=embed`}
                width="100%"
                height="200"
                className="rounded-lg border border-blue-100"
                loading="lazy"
                onClick={(e) => e.stopPropagation()}
              />
            </>
          ) : (
            <p className="text-xs text-gray-500">Live GPS not available yet.</p>
          )}
        </div>

        {/* Action Indicator */}
        <motion.div 
          className="flex items-center justify-center pt-2 text-emerald-600 font-semibold text-sm"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <span className="group-hover:underline">Click to view details →</span>
        </motion.div>
      </div>

      {/* Package Icon Decoration */}
      <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Package className="w-32 h-32 text-emerald-600" />
      </div>
    </motion.div>
  );
};

export default BatchCard;
