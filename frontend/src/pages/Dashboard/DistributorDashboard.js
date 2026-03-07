/**
 * Professional Distributor Dashboard Component
 * Senior Frontend Developer Implementation
 * 
 * Blockchain-Based Supply Chain Transparency for Agricultural Produce
 * 
 * ROLE: Distributor
 * PERMISSIONS: View batches, Accept batches, Transfer to Transport (NO batch creation)
 */

import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, TrendingUp, Truck, LogOut, RefreshCw, Search, Filter,
  ArrowRight, X, CheckCircle, AlertCircle, User as UserIcon, Calendar,
  MapPin, Weight, Hash
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { batchAPI, userAPI } from '../../services/api';
import BatchCard from '../../components/BatchCard';
import StatusTimeline from '../../components/StatusTimeline';
import LoadingSpinner from '../../components/LoadingSpinner';

const DistributorDashboard = () => {
  const { user, logout } = useContext(AuthContext);

  // State Management
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Stats State
  const [stats, setStats] = useState({
    available: 0,
    inProgress: 0,
    completed: 0,
    totalValue: 0
  });

  // Modal States
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  
  // Transfer Form State
  const [transportUsers, setTransportUsers] = useState([]);
  const [transferForm, setTransferForm] = useState({
    toAddress: '',
    location: '',
    statusMessage: 'Picked up from farmer and ready for transport'
  });
  const [submitting, setSubmitting] = useState(false);

  // Notification State
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchBatches();
    fetchTransportUsers();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await batchAPI.getAvailableBatches();
      
      if (response.success) {
        const batchData = response.data;
        setBatches(batchData);
        
        const available = batchData.filter(b => b.currentOwnerRole === 'Farmer').length;
        const inProgress = batchData.filter(b => b.currentOwnerRole === 'Distributor').length;
        const completed = batchData.filter(b => 
          b.currentOwnerRole !== 'Farmer' && b.currentOwnerRole !== 'Distributor'
        ).length;
        const totalValue = batchData.reduce((sum, b) => sum + (b.price || b.quantity * 10), 0);
        
        setStats({ available, inProgress, completed, totalValue });
      }
    } catch (error) {
      showNotification('error', 'Failed to fetch batches');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTransportUsers = async () => {
    try {
      const response = await userAPI.getUsersByRole('transport');
      if (response.success) {
        setTransportUsers(response.data);
      }
    } catch (error) {
      console.error('Error fetching transport users:', error);
    }
  };

  const handleViewDetails = (batch) => {
    setSelectedBatch(batch);
    setShowDetailsModal(true);
  };

  const handleAcceptBatch = () => {
    setShowDetailsModal(false);
    setShowTransferModal(true);
    setTransferForm({
      toAddress: '',
      location: '',
      statusMessage: 'Picked up from farmer and ready for transport'
    });
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    
    if (!transferForm.toAddress || !transferForm.location) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await batchAPI.transferBatch(
        selectedBatch.batchId,
        transferForm.toAddress,
        transferForm.location,
        transferForm.statusMessage
      );

      if (response.success) {
        showNotification('success', `Batch ${selectedBatch.batchId} transferred successfully!`);
        setShowTransferModal(false);
        setSelectedBatch(null);
        fetchBatches();
      }
    } catch (error) {
      showNotification('error', error.message || 'Transfer failed');
      console.error('Transfer error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTransport = (transportUser) => {
    setTransferForm({ ...transferForm, toAddress: transportUser.walletAddress });
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 4000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBatches();
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.farmer?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'all' || batch.currentOwner?.role === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.6, when: 'beforeChildren', staggerChildren: 0.1 }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: [0.6, -0.05, 0.01, 0.99] } },
    exit: { opacity: 0, scale: 0.8, y: 50, transition: { duration: 0.3 } }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <motion.div 
      className="min-h-screen bg-gray-50"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header 
        className="bg-white border-b border-gray-200 shadow-sm"
        variants={headerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                className="bg-green-600 p-3 rounded-lg"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Package className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  AgriChain
                </h1>
                <p className="text-sm text-gray-600">Supply Chain Transparency</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  DISTRIBUTOR
                </span>
              </div>
              <motion.button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Distributor Dashboard 📦
          </h2>
          <p className="text-gray-600 mt-2">
            Accept and manage batches from farmers, transfer to transport partners
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Available Batches</p>
                <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
              <div className="bg-yellow-500 p-3 rounded-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Value</p>
                <p className="text-3xl font-bold text-gray-900">${stats.totalValue.toFixed(0)}</p>
              </div>
              <div className="bg-purple-500 p-3 rounded-lg">
                <Truck className="w-8 h-8 text-white" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Search and Filter Bar */}
        <motion.div
          className="bg-white rounded-lg p-4 mb-6 shadow-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by batch ID, product, or farmer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 font-medium"
              >
                <option value="all">All Batches</option>
                <option value="farmer">From Farmers</option>
                <option value="distributor">In Distribution</option>
                <option value="transport">In Transport</option>
              </select>
            </div>
            <motion.button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Batches Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Available Batches ({filteredBatches.length})
          </h3>

          {filteredBatches.length === 0 ? (
            <motion.div
              className="bg-white rounded-lg shadow-md p-12 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-900 mb-2">No Batches Found</h4>
              <p className="text-gray-600">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No batches available from farmers at the moment'}
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBatches.map((batch, index) => (
                <BatchCard
                  key={batch._id}
                  batch={batch}
                  onViewDetails={handleViewDetails}
                  index={index}
                />
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50"
          >
            <div className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
              notification.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
              <span className="font-semibold">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedBatch && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-green-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedBatch.productName}</h3>
                    <p className="text-green-100 font-mono text-sm">{selectedBatch.batchId}</p>
                  </div>
                  <motion.button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6 text-white" />
                  </motion.button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Batch Information</h4>
                      <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Quantity:</span>
                          <span className="font-bold text-gray-900">
                            {selectedBatch.quantity} {selectedBatch.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Value:</span>
                          <span className="font-bold text-gray-900">
                            ${selectedBatch.price || (selectedBatch.quantity * 10).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Origin:</span>
                          <span className="font-bold text-gray-900">{selectedBatch.origin || 'Farm'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Status:</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            {selectedBatch.currentOwner?.role?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Farmer Details</h4>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="font-bold text-gray-900 text-lg">
                          {selectedBatch.farmer?.name || selectedBatch.currentOwner?.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedBatch.farmer?.email || selectedBatch.currentOwner?.email}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-2">
                          {selectedBatch.farmer?.walletAddress || selectedBatch.currentOwner?.walletAddress}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Status Timeline</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <StatusTimeline batch={selectedBatch} />
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t-2 border-gray-200 flex space-x-4">
                  <motion.button
                    onClick={() => setShowDetailsModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                  {selectedBatch.currentOwner?.role === 'farmer' && (
                    <motion.button
                      onClick={handleAcceptBatch}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-md flex items-center justify-center space-x-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Accept & Transfer Batch</span>
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && selectedBatch && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTransferModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-green-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Transfer Batch</h3>
                      <p className="text-white/80 text-sm">Transfer to transport partner</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setShowTransferModal(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6 text-white" />
                  </motion.button>
                </div>
              </div>

              <form onSubmit={handleTransferSubmit} className="p-6 space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Transferring Batch:</p>
                  <p className="text-xl font-bold text-gray-900">{selectedBatch.productName}</p>
                  <p className="text-sm text-gray-600 font-mono">{selectedBatch.batchId}</p>
                  <p className="text-sm font-semibold text-green-700 mt-2">
                    {selectedBatch.quantity} {selectedBatch.unit}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Select Transport Partner *
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border-2 border-gray-300 rounded-lg p-3">
                    {transportUsers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No transport partners available
                      </p>
                    ) : (
                      transportUsers.map((transport) => (
                        <motion.div
                          key={transport._id}
                          onClick={() => handleSelectTransport(transport)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            transferForm.toAddress === transport.walletAddress
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <p className="font-bold text-gray-900">{transport.name}</p>
                          <p className="text-sm text-gray-600">{transport.email}</p>
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            {transport.walletAddress?.substring(0, 20)}...
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Or enter wallet address manually below
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Recipient Wallet Address *
                  </label>
                  <input
                    type="text"
                    value={transferForm.toAddress}
                    onChange={(e) => setTransferForm({ ...transferForm, toAddress: e.target.value })}
                    placeholder="0x..."
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Current Location *
                  </label>
                  <input
                    type="text"
                    value={transferForm.location}
                    onChange={(e) => setTransferForm({ ...transferForm, location: e.target.value })}
                    placeholder="e.g., Distribution Center, Mumbai"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Status Update Message
                  </label>
                  <textarea
                    value={transferForm.statusMessage}
                    onChange={(e) => setTransferForm({ ...transferForm, statusMessage: e.target.value })}
                    placeholder="Add a status update message..."
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <motion.button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 disabled:opacity-50"
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-md disabled:opacity-50 flex items-center justify-center space-x-2"
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Transferring...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Confirm Transfer</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DistributorDashboard;
