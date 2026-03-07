/**
 * Consumer Dashboard Component - AgriChain
 * Public-facing dashboard for consumers to track product authenticity
 * 
 * Features:
 * - Scan QR codes to view product journey
 * - Complete supply chain transparency
 * - Farmer information
 * - Quality certifications
 * - Blockchain verification
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Search,
  QrCode,
  CheckCircle,
  MapPin,
  Calendar,
  User,
  Truck,
  Store,
  Package,
  Award,
  Shield,
  ExternalLink,
  Info,
  ArrowRight,
  Leaf,
  Sun,
  Droplets,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { batchAPI } from '../../services/api';

const ConsumerDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);

  /**
   * Search for product by batch ID
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a batch ID');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await batchAPI.getBatchById(searchQuery.trim());
      
      if (response.success) {
        setBatch(response.data);
        setShowTimeline(true);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Product not found. Please check the batch ID.');
      setBatch(null);
      setShowTimeline(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get role icon
   */
  const getRoleIcon = (role) => {
    const icons = {
      Farmer: Leaf,
      Distributor: Package,
      Transport: Truck,
      Retailer: Store,
      Consumer: ShoppingBag,
    };
    return icons[role] || User;
  };

  /**
   * Get role color
   */
  const getRoleColor = (role) => {
    const colors = {
      Farmer: 'bg-green-100 text-green-700',
      Distributor: 'bg-blue-100 text-blue-700',
      Transport: 'bg-purple-100 text-purple-700',
      Retailer: 'bg-orange-100 text-orange-700',
      Consumer: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <Navbar />

      <motion.div
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
            <Shield className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Track Your Product Journey 🌱
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Scan the QR code or enter the batch ID to view complete transparency from farm to your table
          </p>
        </motion.div>

        {/* Search Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="max-w-2xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter Batch ID (e.g., BATCH-2026-001)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-6 py-4 bg-green-600 hover:bg-green-700"
                  icon={Search}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>

              <div className="text-center">
                <button className="inline-flex items-center space-x-2 text-green-600 hover:text-green-700 font-medium">
                  <QrCode className="w-5 h-5" />
                  <span>Or scan QR code</span>
                </button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3"
                >
                  <Info className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Product Details */}
        <AnimatePresence>
          {batch && showTimeline && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Product Overview */}
              <Card>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {batch.productName}
                    </h2>
                    <p className="text-sm text-gray-600 font-mono bg-gray-100 inline-block px-3 py-1 rounded-full">
                      {batch.batchId}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <span className="font-semibold text-green-600">Verified</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Quantity</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {batch.quantity} {batch.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <MapPin className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Origin</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {batch.origin || 'Farm Location'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Harvested</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatDate(batch.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Farmer Information */}
              {batch.farmer && (
                <Card>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Leaf className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Farmer Information</h3>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Farmer Name</p>
                        <p className="text-lg font-semibold text-gray-900">{batch.farmer.name}</p>
                      </div>
                      {batch.farmer.organization && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Organization</p>
                          <p className="text-lg font-semibold text-gray-900">{batch.farmer.organization}</p>
                        </div>
                      )}
                      {batch.farmer.location && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Farm Location</p>
                          <p className="text-lg font-semibold text-gray-900">{batch.farmer.location}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <Sun className="w-4 h-4 mr-1" />
                        Organic Certified
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        <Droplets className="w-4 h-4 mr-1" />
                        Sustainable Practices
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        <Award className="w-4 h-4 mr-1" />
                        Quality Assured
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Supply Chain Journey */}
              <Card>
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ArrowRight className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Supply Chain Journey</h3>
                </div>

                {batch.statusHistory && batch.statusHistory.length > 0 ? (
                  <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-200 via-blue-200 to-purple-200"></div>

                    {/* Timeline Events */}
                    <div className="space-y-6">
                      {batch.statusHistory.map((event, index) => {
                        const RoleIcon = getRoleIcon(event.updatedBy?.role);
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative flex items-start space-x-4"
                          >
                            {/* Timeline Dot */}
                            <div className="relative z-10 flex-shrink-0">
                              <div className={`p-3 rounded-full ${
                                index === 0 ? 'bg-green-500' : 
                                index === batch.statusHistory.length - 1 ? 'bg-purple-500' : 
                                'bg-blue-500'
                              } shadow-lg`}>
                                <RoleIcon className="w-5 h-5 text-white" />
                              </div>
                              {index === 0 && (
                                <motion.div
                                  className="absolute inset-0 bg-green-500 rounded-full"
                                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                />
                              )}
                            </div>

                            {/* Event Content */}
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-gray-900">{event.status}</h4>
                                  {event.updatedBy && (
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(event.updatedBy.role)}`}>
                                      {event.updatedBy.role}: {event.updatedBy.name}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">{formatDate(event.timestamp)}</span>
                              </div>
                              {event.message && (
                                <p className="text-sm text-gray-600 mb-2">{event.message}</p>
                              )}
                              {event.location && (
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.blockchainHash && (
                                <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
                                  <Shield className="w-3 h-3" />
                                  <span className="font-mono">{event.blockchainHash.substring(0, 20)}...</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No journey information available yet</p>
                  </div>
                )}
              </Card>

              {/* Blockchain Verification */}
              {batch.blockchainTxHash && (
                <Card>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Blockchain Verification</h3>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                    <div className="flex items-start space-x-4">
                      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-2">
                          This product is verified on the blockchain
                        </p>
                        <p className="text-sm text-gray-600 mb-4">
                          Every transaction in this product's journey has been recorded on an immutable blockchain ledger, ensuring complete transparency and authenticity.
                        </p>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Transaction Hash</p>
                          <div className="flex items-center justify-between">
                            <code className="text-sm font-mono text-gray-900">
                              {batch.blockchainTxHash}
                            </code>
                            <button className="ml-2 p-2 hover:bg-gray-100 rounded transition-colors">
                              <ExternalLink className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!batch && !loading && !error && (
          <motion.div variants={itemVariants} className="text-center py-12">
            <div className="inline-block p-6 bg-white rounded-full shadow-lg mb-6">
              <QrCode className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Ready to track your product?
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Enter a batch ID or scan the QR code on your product packaging to view its complete journey from farm to table
            </p>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Tracking your product...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ConsumerDashboard;
