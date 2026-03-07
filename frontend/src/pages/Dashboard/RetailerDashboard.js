/**
 * Retailer Dashboard Component - AgriChain
 * Professional dashboard for retailers to manage inventory and sales
 * 
 * Features:
 * - Receive batches from transport
 * - Inventory management
 * - Quality inspection
 * - Sales tracking
 * - Consumer distribution
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Package,
  CheckCircle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  Calendar,
  MapPin,
  ClipboardCheck,
  FileText,
  Award,
  Star,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { batchAPI } from '../../services/api';

const RetailerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    inStock: 0,
    totalSales: 0,
    totalRevenue: 0,
    consumers: 0,
  });

  // Quality inspection form
  const [qualityData, setQualityData] = useState({
    grade: '',
    condition: '',
    freshness: '',
    notes: '',
  });

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    filterBatches();
  }, [searchTerm, statusFilter, batches]);

  /**
   * Fetch retailer batches
   */
  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await batchAPI.getAllBatches();
      
      if (response.success) {
        // Filter batches for retailer
        const retailerBatches = response.data.filter(
          b => b.currentOwner?.role === 'Retailer' || b.status === 'Delivered'
        );
        
        setBatches(retailerBatches);
        calculateStats(retailerBatches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      showNotification('error', 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate statistics
   */
  const calculateStats = (batchData) => {
    const inStock = batchData.filter(b => b.status === 'Delivered').length;
    const totalSales = batchData.filter(b => b.status === 'Completed').length;
    const totalRevenue = batchData.reduce((sum, b) => {
      const price = b.quantity * (b.pricePerUnit || 50); // Mock pricing
      return sum + price;
    }, 0);
    const consumers = totalSales * 5; // Mock consumer count

    setStats({ inStock, totalSales, totalRevenue, consumers });
  };

  /**
   * Filter batches
   */
  const filterBatches = () => {
    let filtered = [...batches];

    if (searchTerm) {
      filtered = filtered.filter(b =>
        b.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => {
        if (statusFilter === 'in-stock') return b.status === 'Delivered';
        if (statusFilter === 'sold') return b.status === 'Completed';
        return true;
      });
    }

    setFilteredBatches(filtered);
  };

  /**
   * Handle quality inspection
   */
  const handleQualityInspection = async () => {
    if (!qualityData.grade || !qualityData.condition) {
      showNotification('error', 'Please complete the quality inspection');
      return;
    }

    try {
      // Call quality API
      const response = await batchAPI.recordQuality({
        batchId: selectedBatch.batchId,
        qualityData: {
          ...qualityData,
          inspectedBy: user.name,
          inspectedAt: new Date().toISOString(),
        },
      });

      if (response.success) {
        showNotification('success', 'Quality inspection recorded');
        setShowQualityModal(false);
        setQualityData({ grade: '', condition: '', freshness: '', notes: '' });
        fetchBatches();
      }
    } catch (error) {
      console.error('Quality inspection error:', error);
      showNotification('error', 'Failed to record quality inspection');
    }
  };

  /**
   * Toast notification
   */
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  
  const showNotification = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 4000);
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    const colors = {
      'Delivered': 'bg-green-100 text-green-700',
      'Completed': 'bg-blue-100 text-blue-700',
      'In Transit': 'bg-purple-100 text-purple-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}! 🏪
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your inventory and track sales
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: 'In Stock', value: stats.inStock, icon: Package, color: 'bg-blue-500' },
            { title: 'Total Sales', value: stats.totalSales, icon: ShoppingCart, color: 'bg-green-500' },
            { title: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'bg-purple-500' },
            { title: 'Consumers', value: stats.consumers, icon: Users, color: 'bg-orange-500' },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="w-8 h-8 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Search and Filter */}
        <motion.div variants={itemVariants} className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by batch ID or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 font-medium"
              >
                <option value="all">All Products</option>
                <option value="in-stock">In Stock</option>
                <option value="sold">Sold Out</option>
              </select>
            </div>

            <Button variant="outline" onClick={fetchBatches} icon={RefreshCw}>
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Inventory Grid */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Inventory Management</h2>
              <p className="text-sm text-gray-600">Track and manage your product inventory</p>
            </div>

            {filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'No products in your inventory yet'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBatches.map((batch, index) => (
                  <motion.div
                    key={batch._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedBatch(batch);
                      setShowDetailsModal(true);
                    }}
                  >
                    {/* Product Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {batch.productName}
                        </h3>
                        <p className="text-sm text-gray-600 font-mono">{batch.batchId}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Quantity</span>
                        <span className="font-semibold text-gray-900">
                          {batch.quantity} {batch.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Origin</span>
                        <span className="font-medium text-gray-900">{batch.origin || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Received</span>
                        <span className="font-medium text-gray-900">{formatDate(batch.timestamp)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatch(batch);
                          setShowQualityModal(true);
                        }}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        <span>Inspect</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatch(batch);
                          setShowDetailsModal(true);
                        }}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-t-2xl sticky top-0 z-10">
                <h3 className="text-2xl font-bold text-white">Product Details</h3>
                <p className="text-orange-100 text-sm mt-1">{selectedBatch.batchId}</p>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Product Name</p>
                      <p className="font-medium text-gray-900">{selectedBatch.productName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Quantity</p>
                      <p className="font-medium text-gray-900">{selectedBatch.quantity} {selectedBatch.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedBatch.status)}`}>
                        {selectedBatch.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-600">Origin</p>
                      <p className="font-medium text-gray-900">{selectedBatch.origin || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Farmer Info */}
                {selectedBatch.farmer && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span>Farmer Information</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{selectedBatch.farmer.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Organization</p>
                        <p className="font-medium text-gray-900">{selectedBatch.farmer.organization || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status History */}
                {selectedBatch.statusHistory && selectedBatch.statusHistory.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Journey Timeline</h4>
                    <div className="space-y-3">
                      {selectedBatch.statusHistory.slice(-5).reverse().map((history, index) => (
                        <div key={index} className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-0">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{history.status}</p>
                            <p className="text-sm text-gray-600">{history.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(history.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quality Inspection Modal */}
      <AnimatePresence>
        {showQualityModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQualityModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-t-2xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ClipboardCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Quality Inspection</h3>
                    <p className="text-green-100 text-sm mt-1">{selectedBatch.batchId}</p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Grade */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Quality Grade *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['A+', 'A', 'B'].map((grade) => (
                      <button
                        key={grade}
                        onClick={() => setQualityData({ ...qualityData, grade })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          qualityData.grade === grade
                            ? 'border-green-500 bg-green-50 text-green-900'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <Award className={`w-5 h-5 mx-auto mb-1 ${
                          qualityData.grade === grade ? 'text-green-600' : 'text-gray-600'
                        }`} />
                        <p className="text-sm font-medium">{grade}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Condition *
                  </label>
                  <select
                    value={qualityData.condition}
                    onChange={(e) => setQualityData({ ...qualityData, condition: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select condition</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>

                {/* Freshness */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Freshness Level
                  </label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setQualityData({ ...qualityData, freshness: rating.toString() })}
                        className="p-2"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            parseInt(qualityData.freshness) >= rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Inspection Notes
                  </label>
                  <textarea
                    value={qualityData.notes}
                    onChange={(e) => setQualityData({ ...qualityData, notes: e.target.value })}
                    placeholder="Any observations or comments..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-4 p-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowQualityModal(false);
                    setQualityData({ grade: '', condition: '', freshness: '', notes: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={handleQualityInspection}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!qualityData.grade || !qualityData.condition}
                  icon={CheckCircle}
                >
                  Submit Inspection
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50"
          >
            <div className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetailerDashboard;
