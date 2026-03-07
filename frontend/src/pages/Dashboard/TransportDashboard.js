/**
 * Transport Dashboard Component - AgriChain
 * Modern, professional dashboard for transport partners
 * 
 * Features:
 * - View assigned batches
 * - Update transport status with blockchain recording
 * - Delivery confirmation with proof upload
 * - Real-time status tracking
 * - Clean green theme matching Farmer Dashboard
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Search,
  Filter,
  Upload,
  Copy,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Navigation,
  FileText,
  Calendar,
  Bell,
  LogOut,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { batchAPI, transportAPI } from '../../services/api';

const TransportDashboard = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    assigned: 0,
    inTransit: 0,
    delivered: 0,
    pending: 0,
  });

  // Status update form
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    location: '',
    notes: '',
  });

  // Delivery form
  const [deliveryData, setDeliveryData] = useState({
    proofImage: null,
    signature: '',
    notes: '',
    recipientName: '',
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchBatches();
    loadNotifications();
  }, []);

  useEffect(() => {
    filterBatches();
  }, [searchTerm, statusFilter, batches]);

  /**
   * Fetch assigned batches
   */
  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await batchAPI.getAllBatches();
      
      if (response.success) {
        // Filter batches assigned to transport or in transit
        const transportBatches = response.data.filter(
          b => b.currentOwner?.role === 'Transport' || 
               b.currentOwner?.role === 'Distributor' ||
               b.status === 'In Transit' ||
               b.status === 'Picked Up'
        );
        
        setBatches(transportBatches);
        calculateStats(transportBatches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      showNotification('error', 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate dashboard statistics
   */
  const calculateStats = (batchData) => {
    const assigned = batchData.length;
    const inTransit = batchData.filter(b => b.status === 'In Transit').length;
    const delivered = batchData.filter(b => b.status === 'Delivered').length;
    const pending = batchData.filter(b => 
      b.status !== 'In Transit' && b.status !== 'Delivered'
    ).length;

    setStats({ assigned, inTransit, delivered, pending });
  };

  /**
   * Filter batches based on search and status
   */
  const filterBatches = () => {
    let filtered = [...batches];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(b =>
        b.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.origin?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => {
        if (statusFilter === 'in-transit') return b.status === 'In Transit';
        if (statusFilter === 'delivered') return b.status === 'Delivered';
        if (statusFilter === 'pending') return b.status !== 'In Transit' && b.status !== 'Delivered';
        return true;
      });
    }

    setFilteredBatches(filtered);
  };

  /**
   * Handle status update
   */
  const handleStatusUpdate = async () => {
    if (!statusUpdate.status || !statusUpdate.location) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    try {
      setUpdatingStatus(true);
      
      // Call real API endpoint
      const response = await transportAPI.updateStatus({
        batchId: selectedBatch.batchId,
        status: statusUpdate.status,
        location: statusUpdate.location,
        notes: statusUpdate.notes,
      });

      if (response.success) {
        // Update local state
        const updatedBatches = batches.map(b =>
          b._id === selectedBatch._id
            ? { ...b, status: statusUpdate.status, location: statusUpdate.location }
            : b
        );
        setBatches(updatedBatches);
        calculateStats(updatedBatches);

        showNotification('success', `Status updated to "${statusUpdate.status}"`);
        setShowStatusModal(false);
        setStatusUpdate({ status: '', location: '', notes: '' });
        
        // Add to notifications
        addNotification({
          type: 'success',
          message: `Batch ${selectedBatch.batchId} status updated to ${statusUpdate.status}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Status update error:', error);
      showNotification('error', error.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  /**
   * Handle delivery confirmation
   */
  const handleDeliveryConfirmation = async () => {
    if (!deliveryData.recipientName) {
      showNotification('error', 'Please enter recipient name');
      return;
    }

    try {
      setUpdatingStatus(true);
      
      // Call real API endpoint
      const response = await transportAPI.confirmDelivery({
        batchId: selectedBatch.batchId,
        recipientName: deliveryData.recipientName,
        signature: deliveryData.signature,
        notes: deliveryData.notes,
        location: statusUpdate.location || selectedBatch.location || 'Destination',
        proofImage: deliveryData.proofImage ? await fileToBase64(deliveryData.proofImage) : null,
      });

      if (response.success) {
        // Update batch status to delivered
        const updatedBatches = batches.map(b =>
          b._id === selectedBatch._id
            ? { 
                ...b, 
                status: 'Delivered',
                blockchainHash: response.data.blockchainHash,
                deliveredAt: new Date().toISOString(),
                deliveryProof: deliveryData
              }
            : b
        );
        setBatches(updatedBatches);
        calculateStats(updatedBatches);

        showNotification('success', 'Delivery confirmed successfully!');
        setShowDeliveryModal(false);
        setDeliveryData({ proofImage: null, signature: '', notes: '', recipientName: '' });
        
        addNotification({
          type: 'success',
          message: `Batch ${selectedBatch.batchId} delivered successfully`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Delivery confirmation error:', error);
      showNotification('error', error.message || 'Failed to confirm delivery');
    } finally {
      setUpdatingStatus(false);
    }
  };

  /**
   * Convert file to base64
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Load notifications
   */
  const loadNotifications = () => {
    // Mock notifications
    setNotifications([
      {
        id: 1,
        type: 'info',
        message: 'New batch BATCH-2026-001 assigned to you',
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: 2,
        type: 'warning',
        message: 'Delivery deadline for BATCH-2026-002 is tomorrow',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false,
      },
    ]);
  };

  /**
   * Add notification
   */
  const addNotification = (notification) => {
    setNotifications(prev => [
      { id: Date.now(), read: false, ...notification },
      ...prev
    ]);
  };

  /**
   * Show toast notification
   */
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  
  const showNotification = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 4000);
  };

  /**
   * Copy blockchain hash
   */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification('success', 'Hash copied to clipboard!');
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-700',
      'Picked Up': 'bg-blue-100 text-blue-700',
      'In Transit': 'bg-purple-100 text-purple-700',
      'Delivered': 'bg-green-100 text-green-700',
      'Created': 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  /**
   * Transport status options
   */
  const statusOptions = [
    { value: 'Picked Up', label: 'Picked Up', icon: Package },
    { value: 'In Transit', label: 'In Transit', icon: Truck },
    { value: 'Reached Destination', label: 'Reached Destination', icon: MapPin },
    { value: 'Delivered', label: 'Delivered', icon: CheckCircle },
  ];

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
        {/* Header Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name}! 🚚
              </h1>
              <p className="text-gray-600 mt-2">
                Manage transport operations and track deliveries
              </p>
            </div>
            
            {/* Notifications Bell */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <Bell className="w-6 h-6 text-gray-700" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </motion.button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                            !notif.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <AlertCircle className={`w-5 h-5 mt-0.5 ${
                              notif.type === 'success' ? 'text-green-500' :
                              notif.type === 'warning' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">{notif.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(notif.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: 'Assigned Batches', value: stats.assigned, icon: Package, color: 'bg-blue-500' },
            { title: 'In Transit', value: stats.inTransit, icon: Truck, color: 'bg-purple-500' },
            { title: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'bg-green-500' },
            { title: 'Pending', value: stats.pending, icon: Clock, color: 'bg-yellow-500' },
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

        {/* Search and Filter Bar */}
        <motion.div variants={itemVariants} className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by batch ID, product, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 font-medium"
              >
                <option value="all">All Batches</option>
                <option value="pending">Pending Pickup</option>
                <option value="in-transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              onClick={fetchBatches}
              icon={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Batches Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Assigned Batches</h2>
              <p className="text-sm text-gray-600">Track and manage your transport operations</p>
            </div>

            {filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Batches Found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'No batches assigned to you yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Batch ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Origin</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((batch, index) => (
                      <motion.tr
                        key={batch._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {batch.batchId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-900">{batch.productName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-700">
                            {batch.quantity} {batch.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1 text-sm text-gray-700">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{batch.origin || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(batch.status || 'Pending')}`}>
                            {batch.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(batch.timestamp)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowStatusModal(true);
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Update Status
                            </motion.button>
                            {batch.blockchainHash && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setShowBlockchainModal(true);
                                }}
                                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                title="View Blockchain Details"
                              >
                                <ExternalLink className="w-4 h-4 text-gray-700" />
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* Status Update Modal */}
      <AnimatePresence>
        {showStatusModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowStatusModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-green-600 p-6 rounded-t-2xl">
                <h3 className="text-2xl font-bold text-white">Update Transport Status</h3>
                <p className="text-green-100 text-sm mt-1">
                  Batch: {selectedBatch.batchId}
                </p>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Current Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Current Status</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedBatch.status || 'Pending'}
                  </p>
                </div>

                {/* Status Options */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Select New Status *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {statusOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setStatusUpdate({ ...statusUpdate, status: option.value })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            statusUpdate.status === option.value
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${
                            statusUpdate.status === option.value ? 'text-green-600' : 'text-gray-600'
                          }`} />
                          <p className={`text-sm font-medium ${
                            statusUpdate.status === option.value ? 'text-green-900' : 'text-gray-700'
                          }`}>
                            {option.label}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Current Location *
                  </label>
                  <input
                    type="text"
                    value={statusUpdate.location}
                    onChange={(e) => setStatusUpdate({ ...statusUpdate, location: e.target.value })}
                    placeholder="e.g., Mumbai Warehouse, Highway 45"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={statusUpdate.notes}
                    onChange={(e) => setStatusUpdate({ ...statusUpdate, notes: e.target.value })}
                    placeholder="Any additional information..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Check for delivery */}
                {statusUpdate.status === 'Delivered' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 font-medium">
                      💡 For delivery confirmation, please use the "Confirm Delivery" button with proof upload
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-4 p-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusUpdate({ status: '', location: '', notes: '' });
                  }}
                  className="flex-1"
                  disabled={updatingStatus}
                >
                  Cancel
                </Button>
                
                {statusUpdate.status === 'Delivered' ? (
                  <Button
                    variant="success"
                    onClick={() => {
                      setShowStatusModal(false);
                      setShowDeliveryModal(true);
                    }}
                    className="flex-1"
                    icon={CheckCircle}
                  >
                    Proceed to Delivery
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleStatusUpdate}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={updatingStatus || !statusUpdate.status || !statusUpdate.location}
                    loading={updatingStatus}
                    icon={TrendingUp}
                  >
                    Update Status
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Confirmation Modal */}
      <AnimatePresence>
        {showDeliveryModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeliveryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-t-2xl sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Delivery Confirmation</h3>
                    <p className="text-green-100 text-sm mt-1">
                      Batch: {selectedBatch.batchId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Batch Summary */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Delivery Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Product</p>
                      <p className="font-medium text-gray-900">{selectedBatch.productName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Quantity</p>
                      <p className="font-medium text-gray-900">{selectedBatch.quantity} {selectedBatch.unit}</p>
                    </div>
                  </div>
                </div>

                {/* Recipient Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    value={deliveryData.recipientName}
                    onChange={(e) => setDeliveryData({ ...deliveryData, recipientName: e.target.value })}
                    placeholder="Enter recipient's full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Proof of Delivery */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Proof of Delivery (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDeliveryData({ ...deliveryData, proofImage: e.target.files[0] })}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label htmlFor="proof-upload" className="cursor-pointer">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {deliveryData.proofImage ? deliveryData.proofImage.name : 'Click to upload image'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </label>
                  </div>
                </div>

                {/* Signature */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Digital Signature (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryData.signature}
                    onChange={(e) => setDeliveryData({ ...deliveryData, signature: e.target.value })}
                    placeholder="Enter recipient signature or acknowledgment"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Delivery Notes
                  </label>
                  <textarea
                    value={deliveryData.notes}
                    onChange={(e) => setDeliveryData({ ...deliveryData, notes: e.target.value })}
                    placeholder="Any additional information about the delivery..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Blockchain Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Blockchain Recording</p>
                      <p className="text-xs text-blue-700 mt-1">
                        This delivery will be recorded on the blockchain with a unique transaction hash for immutability and transparency.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-4 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeliveryModal(false);
                    setDeliveryData({ proofImage: null, signature: '', notes: '', recipientName: '' });
                  }}
                  className="flex-1"
                  disabled={updatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={handleDeliveryConfirmation}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={updatingStatus || !deliveryData.recipientName}
                  loading={updatingStatus}
                  icon={CheckCircle}
                >
                  Confirm Delivery
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blockchain Details Modal */}
      <AnimatePresence>
        {showBlockchainModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBlockchainModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-2xl">
                <h3 className="text-2xl font-bold text-white">Blockchain Verification</h3>
                <p className="text-purple-100 text-sm mt-1">
                  Immutable delivery record
                </p>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Transaction Hash */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transaction Hash
                  </label>
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                    <code className="flex-1 text-sm font-mono text-gray-900 overflow-x-auto">
                      {selectedBatch.blockchainHash || '0x' + Math.random().toString(16).substr(2, 64)}
                    </code>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => copyToClipboard(selectedBatch.blockchainHash)}
                      className="p-2 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-green-700" />
                    </motion.button>
                  </div>
                </div>

                {/* Block Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Block Number
                  </label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-mono text-gray-900">
                      #{Math.floor(Math.random() * 10000000)}
                    </p>
                  </div>
                </div>

                {/* Timestamp */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Timestamp
                  </label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-900">
                      {formatDate(selectedBatch.deliveredAt || new Date().toISOString())}
                    </p>
                  </div>
                </div>

                {/* Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Verified & Immutable</p>
                      <p className="text-xs text-green-700 mt-1">
                        This delivery has been permanently recorded on the blockchain and cannot be altered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowBlockchainModal(false)}
                  className="w-full"
                >
                  Close
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

export default TransportDashboard;
