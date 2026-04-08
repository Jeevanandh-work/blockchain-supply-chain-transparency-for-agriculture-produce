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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
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
  Download,
  ExternalLink,
  Image as ImageIcon,
  User,
  DollarSign,
  Hash,
  Edit3,
  Zap,
} from 'lucide-react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { batchAPI, transportAPI } from '../../services/api';
import SupplyChainABI from '../../contracts/SupplyChain.json';

const TransportDashboard = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [showTransportDetailsModal, setShowTransportDetailsModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // GPS Tracking
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [trackingBatch, setTrackingBatch] = useState(false);
  const gpsIntervalRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const lastLocationSyncRef = useRef(0);
  const batchesRef = useRef([]);
  
  // Blockchain
  const [blockchainBatches, setBlockchainBatches] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [contract, setContract] = useState(null);

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
    dispatchTime: '',
    expectedDelivery: '',
  });

  // Delivery form
  const [deliveryData, setDeliveryData] = useState({
    proofImage: null,
    signature: '',
    notes: '',
    recipientName: '',
  });
  
  // Transport Details Form
  const [transportDetails, setTransportDetails] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('transportDetails');
    return saved ? JSON.parse(saved) : {
      vehicleNumber: '',
      driverName: '',
      transportCompany: '',
      contactNumber: '',
    };
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    initializeBlockchain();
    fetchBatches();
    loadNotifications();

    const stopTracking = startGPSTracking();
    return () => {
      if (typeof stopTracking === 'function') {
        stopTracking();
      }
    };
  }, []);

  useEffect(() => {
    filterBatches();
  }, [searchTerm, statusFilter, batches]);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  /**
   * Initialize Blockchain Connection
   */
  const initializeBlockchain = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
        const contractInstance = new ethers.Contract(contractAddress, SupplyChainABI.abi, provider);
        setContract(contractInstance);
        
        // Fetch batches from blockchain
        await fetchBlockchainBatches(contractInstance);
      }
    } catch (error) {
      console.error('Blockchain initialization error:', error);
    }
  };

  /**
   * Fetch all batches from blockchain smart contract
   */
  const fetchBlockchainBatches = async (contractInstance) => {
    try {
      // Listen for batch creation events
      const filter = contractInstance.filters.BatchCreated();
      const events = await contractInstance.queryFilter(filter);
      
      const blockchainBatchesData = await Promise.all(
        events.map(async (event) => {
          const batchId = event.args.batchId;
          try {
            const batch = await contractInstance.getBatch(batchId);
            return {
              batchId,
              farmer: batch.farmer,
              currentOwner: batch.currentOwner,
              ipfsHash: batch.ipfsHash,
              timestamp: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
              isDelivered: batch.isDelivered,
            };
          } catch (err) {
            console.error(`Error fetching batch ${batchId}:`, err);
            return null;
          }
        })
      );
      
      setBlockchainBatches(blockchainBatchesData.filter(b => b !== null));
    } catch (error) {
      console.error('Error fetching blockchain batches:', error);
    }
  };

  /**
   * Start GPS Tracking
   */
  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('GPS is not supported in this browser.');
      return undefined;
    }

    const syncLiveLocation = async (position) => {
      const now = Date.now();
      // Throttle API sync to around every 8 seconds
      if (now - lastLocationSyncRef.current < 8000) {
        return;
      }

      const activeTransportBatches = (batchesRef.current || []).filter(
        (b) => b.currentOwnerRole === 'Transport' && b.status !== 'Delivered'
      );

      if (activeTransportBatches.length === 0) {
        return;
      }

      lastLocationSyncRef.current = now;
      const payload = {
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      };

      await Promise.all(
        activeTransportBatches.map((batch) =>
          transportAPI.updateLocation({
            batchId: batch.batchId,
            ...payload,
            location: batch.location || 'In Transit',
          })
        )
      );
    };

    const handleLocationUpdate = (position) => {
      setGpsLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toLocaleString(),
      });
      setGpsError('');
      setGpsLoading(false);

      // Fire and forget; UI should not block if sync fails
      syncLiveLocation(position).catch((error) => {
        console.error('Live GPS sync error:', error);
      });
    };

    setGpsLoading(true);

    // Clear existing watch before creating a new one
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      (error) => {
        const message =
          error.code === 1
            ? 'Location permission denied. Please allow location access in browser settings.'
            : error.code === 2
              ? 'Location unavailable. Please check device GPS.'
              : 'GPS request timed out. Try again.';
        setGpsError(message);
        setGpsLoading(false);
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  };

  /**
   * Fetch assigned batches - SHOW ALL BATCHES
   */
  const fetchBatches = async () => {
    try {
      setLoading(true);
      console.log('🚚 [Transport Dashboard] Fetching batches...');
      const response = await batchAPI.getAllBatches();
      
      console.log('📦 [Transport Dashboard] Response:', response);
      console.log('📊 [Transport Dashboard] Batches count:', response.data?.length || 0);
      
      if (response.success) {
        let nextBatches = response.data || [];

        // Merge live batch metadata from smart contract when available.
        if (contract && typeof contract.getBatch === 'function') {
          const chainRows = await Promise.all(
            nextBatches.map(async (batch) => {
              try {
                const chainBatch = await contract.getBatch(batch.batchId);
                return [batch.batchId, {
                  onChainCurrentOwner: chainBatch.currentOwner,
                  onChainCreatedAt: Number(chainBatch.timestamp) * 1000,
                  onChainDelivered: Boolean(chainBatch.isDelivered),
                }];
              } catch (error) {
                return null;
              }
            })
          );

          const chainMap = chainRows.reduce((accumulator, row) => {
            if (!row) return accumulator;
            accumulator[row[0]] = row[1];
            return accumulator;
          }, {});

          nextBatches = nextBatches.map((batch) => ({
            ...batch,
            ...(chainMap[batch.batchId] || {}),
          }));
        }

        // Show ALL batches (not filtered by role)
        setBatches(nextBatches);
        calculateStats(nextBatches);
        console.log('✅ [Transport Dashboard] Batches set successfully:', nextBatches.length);
      } else {
        console.error('❌ [Transport Dashboard] Failed to fetch batches:', response);
        showNotification('error', 'Failed to fetch batches');
      }
    } catch (error) {
      console.error('❌ [Transport Dashboard] Error fetching batches:', error);
      console.error('Error details:', error.response?.data || error.message);
      showNotification('error', 'Failed to fetch batches: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate dashboard statistics and populate blockchain history from database
   */
  const calculateStats = (batchData) => {
    const assigned = batchData.length;
    const inTransit = batchData.filter(b => b.status === 'In Transit').length;
    const delivered = batchData.filter(b => b.status === 'Delivered').length;
    const pending = batchData.filter(b => 
      b.status !== 'In Transit' && b.status !== 'Delivered'
    ).length;

    setStats({ assigned, inTransit, delivered, pending });
    
    // Populate blockchain transaction history from database batches
    const transactions = batchData.map(batch => ({
      batchId: batch.batchId,
      farmer: batch.farmer?.walletAddress || batch.farmer?.name || 'N/A',
      currentOwner: batch.currentOwner?.walletAddress || batch.currentOwner?.name || 'N/A',
      timestamp: new Date(batch.createdAt).toLocaleString(),
      isDelivered: batch.status === 'Delivered',
      ipfsHash: batch.ipfsHash,
      status: batch.status,
      productName: batch.productName,
    }));
    
    setBlockchainBatches(transactions);
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
        b.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getDeliveryAddress(b).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPickupAddress(b).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getDistributorDetails(b).name.toLowerCase().includes(searchTerm.toLowerCase())
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
      
      console.log('🚀 Sending status update:', {
        batchId: selectedBatch.batchId,
        status: statusUpdate.status,
        location: statusUpdate.location,
        notes: statusUpdate.notes,
        dispatchTime: statusUpdate.dispatchTime,
        expectedDelivery: statusUpdate.expectedDelivery,
        coordinates: gpsLocation
          ? {
              latitude: gpsLocation.latitude,
              longitude: gpsLocation.longitude,
            }
          : null,
      });
      
      // Call real API endpoint with all fields including dispatch/delivery times
      const response = await transportAPI.updateStatus({
        batchId: selectedBatch.batchId,
        status: statusUpdate.status,
        location: statusUpdate.location,
        notes: statusUpdate.notes,
        dispatchTime: statusUpdate.dispatchTime,
        expectedDelivery: statusUpdate.expectedDelivery,
        coordinates: gpsLocation
          ? {
              latitude: gpsLocation.latitude,
              longitude: gpsLocation.longitude,
            }
          : null,
      });

      console.log('✅ Status update response:', response);

      if (response.success) {
        // Update local state
        const updatedBatches = batches.map(b =>
          b._id === selectedBatch._id
            ? { 
                ...b, 
                status: statusUpdate.status, 
                location: statusUpdate.location,
                dispatchTime: statusUpdate.dispatchTime,
                expectedDelivery: statusUpdate.expectedDelivery,
              }
            : b
        );
        setBatches(updatedBatches);
        calculateStats(updatedBatches);

        showNotification('success', `Status updated to "${statusUpdate.status}"`);
        setShowStatusModal(false);
        setStatusUpdate({ 
          status: '', 
          location: '', 
          notes: '',
          dispatchTime: '',
          expectedDelivery: '',
        });
        
        // Add to notifications
        addNotification({
          type: 'success',
          message: `Batch ${selectedBatch.batchId} status updated to ${statusUpdate.status}`,
          timestamp: new Date().toISOString(),
        });
        
        // Refresh batches from server
        fetchBatches();
      } else {
        console.error('❌ Update failed:', response);
        showNotification('error', response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('❌ Status update error:', error);
      console.error('Error details:', error.response?.data || error.message);
      showNotification('error', error.response?.data?.message || error.message || 'Failed to update status');
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
        coordinates: gpsLocation
          ? {
              latitude: gpsLocation.latitude,
              longitude: gpsLocation.longitude,
            }
          : null,
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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeliveryAddress = (batch) => {
    return batch?.deliveryAddress || 'Not provided by distributor yet';
  };

  const getPickupAddress = (batch) => {
    return (
      batch?.farmer?.farmerProfile?.farmLocation ||
      batch?.farmer?.organization ||
      batch?.origin ||
      'Farmer pickup location not available'
    );
  };

  const getDistributorDetails = (batch) => {
    const distributorEvent = [...(batch?.statusHistory || [])]
      .reverse()
      .find((entry) => entry?.updatedBy?.role === 'Distributor');

    if (distributorEvent?.updatedBy) {
      return {
        name: distributorEvent.updatedBy.name || 'Distributor',
        phoneNumber: distributorEvent.updatedBy.phoneNumber || 'N/A',
      };
    }

    if (batch?.currentOwnerRole === 'Distributor' && batch?.currentOwner) {
      return {
        name: batch.currentOwner.name || 'Distributor',
        phoneNumber: batch.currentOwner.phoneNumber || 'N/A',
      };
    }

    return {
      name: 'Distributor details unavailable',
      phoneNumber: 'N/A',
    };
  };

  const getDeliveredTo = (batch) => {
    if (batch?.currentOwnerRole === 'Retailer') return 'Retailer';
    const deliveryToRetailer = (batch?.statusHistory || []).some((entry) =>
      String(entry?.status || '').toLowerCase().includes('retailer')
    );
    return deliveryToRetailer ? 'Retailer' : 'Distributor';
  };

  const completedDeliveries = useMemo(() => {
    return batches
      .filter((batch) => batch.status === 'Delivered')
      .map((batch) => {
        const deliveredHistory = [...(batch.statusHistory || [])]
          .reverse()
          .find((entry) => String(entry.status || '').toLowerCase().includes('delivered'));

        return {
          ...batch,
          deliveredOn: batch.deliveredAt || deliveredHistory?.timestamp || batch.updatedAt,
          deliveredTo: getDeliveredTo(batch),
        };
      });
  }, [batches]);

  const transportPaymentHistory = useMemo(() => {
    return batches
      .flatMap((batch) =>
        (batch.paymentHistory || [])
          .filter((entry) => {
            const paidBy = String(entry?.paidByRole || '').toLowerCase();
            const paidTo = String(entry?.paidToRole || '').toLowerCase();
            return paidBy === 'transport' || paidTo === 'transport';
          })
          .map((entry) => ({
            ...entry,
            batchId: batch.batchId,
            productName: batch.productName,
          }))
      )
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  }, [batches]);

  const filteredTransportPayments = transportPaymentHistory.filter((entry) => {
    const status = String(entry?.status || 'Paid').toLowerCase();
    const paidTime = new Date(entry?.paidAt || 0).getTime();
    const fromTime = paymentFromDate ? new Date(`${paymentFromDate}T00:00:00`).getTime() : null;
    const toTime = paymentToDate ? new Date(`${paymentToDate}T23:59:59`).getTime() : null;

    const matchesStatus = paymentStatusFilter === 'all' || status === paymentStatusFilter;
    const matchesFrom = !fromTime || paidTime >= fromTime;
    const matchesTo = !toTime || paidTime <= toTime;

    return matchesStatus && matchesFrom && matchesTo;
  });

  const exportTransportPaymentsCsv = () => {
    const rows = [
      ['Batch ID', 'Amount', 'Paid To / Received From', 'Payment ID', 'Date', 'Status'],
      ...filteredTransportPayments.map((entry) => [
        entry.batchId,
        Number(entry.amount || 0),
        `${entry.paidByRole || 'N/A'} -> ${entry.paidToRole || 'N/A'}`,
        entry.paymentId || 'N/A',
        entry.paidAt ? new Date(entry.paidAt).toISOString() : 'N/A',
        entry.status || 'Paid',
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transport-payments-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Get latest GPS point saved for a batch
   */
  const getLastGpsPoint = (batch) => {
    if (!batch?.gpsTracking || batch.gpsTracking.length === 0) {
      return null;
    }

    return batch.gpsTracking[batch.gpsTracking.length - 1];
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
   * Transport status options - Enhanced with more detailed statuses
   */
  const statusOptions = [
    { value: 'Picked from Farmer', label: 'Picked from Farmer', icon: Package },
    { value: 'In Transit', label: 'In Transit', icon: Truck },
    { value: 'Delivered to Processor', label: 'Delivered to Processor', icon: MapPin },
    { value: 'Delivered to Retailer', label: 'Delivered to Retailer', icon: CheckCircle },
    { value: 'Delivered', label: 'Final Delivery', icon: CheckCircle },
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

  if (activeTab === 'payments') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Transport Payments</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
              <button
                type="button"
                onClick={exportTransportPaymentsCsv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
              <input
                type="date"
                value={paymentFromDate}
                onChange={(e) => setPaymentFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="date"
                value={paymentToDate}
                onChange={(e) => setPaymentToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {filteredTransportPayments.length === 0 ? (
              <p className="text-sm text-gray-600">No payment records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 pr-3">Batch ID</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Paid To / Received From</th>
                      <th className="py-2 pr-3">Payment ID</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransportPayments.map((entry, idx) => (
                      <tr key={`${entry.batchId}-${entry.paymentId || idx}`} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-mono">{entry.batchId}</td>
                        <td className="py-2 pr-3">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 pr-3">{entry.paidByRole || 'N/A'} to {entry.paidToRole || 'N/A'}</td>
                        <td className="py-2 pr-3">{entry.paymentId || 'N/A'}</td>
                        <td className="py-2 pr-3">{entry.paidAt ? new Date(entry.paidAt).toLocaleString('en-IN') : 'N/A'}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            {entry.status || 'Paid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-green-600 text-white text-sm font-semibold"
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Payments
                </button>
              </div>
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Crop Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Farmer Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivery Address</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Pickup Address</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Distributor Details</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Harvest Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Current Owner</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
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
                          <div className="flex items-center space-x-2">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {batch.batchId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-gray-900">{batch.productName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-700">
                            {batch.quantity} {batch.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-900">{batch.farmer?.name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1 text-sm text-gray-700">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span>{batch.origin || batch.location || 'N/A'}</span>
                            </div>
                            {getLastGpsPoint(batch) ? (
                              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block">
                                Last GPS: {Number(getLastGpsPoint(batch).latitude).toFixed(5)}, {Number(getLastGpsPoint(batch).longitude).toFixed(5)}
                                {getLastGpsPoint(batch).timestamp ? ` (${formatDate(getLastGpsPoint(batch).timestamp)})` : ''}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">Last GPS: Not captured</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-700 max-w-xs">
                            {getDeliveryAddress(batch)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-700 max-w-xs">
                            {getPickupAddress(batch)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">{getDistributorDetails(batch).name}</div>
                            <div className="text-xs text-gray-600">Phone: {getDistributorDetails(batch).phoneNumber}</div>
                            <div className="text-xs text-gray-600">Delivery: {getDeliveryAddress(batch)}</div>
                            <div className="text-xs text-gray-600">Pickup: {getPickupAddress(batch)}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatDate(batch.timestamp || batch.createdAt || batch.onChainCreatedAt)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              batch.currentOwnerRole === 'Farmer' ? 'bg-emerald-500' :
                              batch.currentOwnerRole === 'Distributor' ? 'bg-amber-500' :
                              batch.currentOwnerRole === 'Transport' ? 'bg-blue-500' :
                              batch.currentOwnerRole === 'Retailer' ? 'bg-purple-500' :
                              'bg-gray-500'
                            }`}></div>
                            <span className="text-sm text-gray-900">{batch.currentOwner?.name || 'N/A'}</span>
                            <span className="text-xs text-gray-500">({batch.currentOwnerRole || 'Unknown'})</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-700">
                              {batch.price || (batch.quantity * 10).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(batch.status || 'Pending')}`}>
                            {batch.status || 'Created'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <motion.button
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowStatusModal(true);
                              }}
                              title="Update Location & Delivery Time"
                              className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 shadow-md transition-all"
                            >
                              <MapPin className="w-4 h-4" />
                              <span>Location</span>
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowTransportDetailsModal(true);
                              }}
                              title="Add/Update Vehicle Information"
                              className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-md transition-all"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Vehicle</span>
                            </motion.button>
                            {batch.blockchainHash && (
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setShowBlockchainModal(true);
                                }}
                                className="p-2 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
                                title="View Blockchain Details"
                              >
                                <Zap className="w-4 h-4 text-purple-700" />
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

        {/* Completed Deliveries */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Completed Deliveries
                </h2>
                <p className="text-sm text-gray-600">History of successfully delivered batches</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
                Total Completed: {completedDeliveries.length}
              </span>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="font-semibold">No completed deliveries yet</p>
                <p className="text-sm mt-1">Delivered batches will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Batch ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Crop Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivered On</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivered To</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivery Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedDeliveries.map((batch) => (
                      <tr key={`completed-${batch._id || batch.batchId}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-gray-900">{batch.batchId}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{batch.productName || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{formatDate(batch.deliveredOn)}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{batch.deliveredTo}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{getDeliveryAddress(batch)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Batch Summary by Role */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2 text-emerald-600" />
                Batch Summary by Source
              </h2>
              <p className="text-sm text-gray-600">Overview of batches from different sources</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 mb-1">From Farmers</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {batches.filter(b => b.currentOwnerRole === 'Farmer').length}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Ready for pickup</p>
                  </div>
                  <User className="w-8 h-8 text-emerald-600" />
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">From Distributors</p>
                    <p className="text-3xl font-bold text-amber-700">
                      {batches.filter(b => b.currentOwnerRole === 'Distributor').length}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Available to transport</p>
                  </div>
                  <Package className="w-8 h-8 text-amber-600" />
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">In My Possession</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {batches.filter(b => b.currentOwnerRole === 'Transport').length}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Currently transporting</p>
                  </div>
                  <Truck className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-purple-900 mb-1">Total Value</p>
                    <p className="text-3xl font-bold text-purple-700">
                      ${batches.reduce((sum, b) => sum + (b.price || (b.quantity * 10)), 0).toFixed(0)}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">Estimated worth</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Vehicle Information */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Truck className="w-5 h-5 mr-2 text-blue-600" />
                Vehicle Information
              </h2>
              <p className="text-sm text-gray-600">Current transport vehicle details</p>
            </div>

            {transportDetails.vehicleNumber ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">Vehicle Number</p>
                      <p className="text-lg font-bold text-blue-900">{transportDetails.vehicleNumber}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-600 p-2 rounded-lg">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-semibold">Driver Name</p>
                      <p className="text-lg font-bold text-green-900">{transportDetails.driverName}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-600 p-2 rounded-lg">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 font-semibold">Company</p>
                      <p className="text-lg font-bold text-purple-900">{transportDetails.transportCompany}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-600 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 font-semibold">Contact</p>
                      <p className="text-lg font-bold text-orange-900">{transportDetails.contactNumber}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No vehicle information set</p>
                <Button
                  onClick={() => setShowTransportDetailsModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Add Vehicle Details
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* GPS Location Tracker */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Navigation className="w-5 h-5 mr-2 text-blue-600" />
                  GPS Vehicle Tracking
                </h2>
                <p className="text-sm text-gray-600">Real-time location of transport vehicle</p>
              </div>
              <Button
                variant="outline"
                onClick={startGPSTracking}
                icon={RefreshCw}
              >
                {gpsLoading ? 'Detecting...' : 'Enable GPS'}
              </Button>
            </div>

            {gpsError && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {gpsError}
              </div>
            )}

            {gpsLocation ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-2">Current Latitude</p>
                      <p className="text-2xl font-bold text-blue-700">{gpsLocation.latitude.toFixed(6)}°</p>
                    </div>
                    <MapPin className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-900 mb-2">Current Longitude</p>
                      <p className="text-2xl font-bold text-green-700">{gpsLocation.longitude.toFixed(6)}°</p>
                    </div>
                    <Navigation className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Last Updated</p>
                      <p className="text-sm text-gray-600">{gpsLocation.timestamp}</p>
                      <p className="text-xs text-gray-500 mt-1">Accuracy: ±{gpsLocation.accuracy?.toFixed(0)}m</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View on Google Maps</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                <Navigation className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-700">GPS not available yet.</p>
                <p className="text-xs text-gray-500 mt-1">Click Enable GPS and allow browser permission.</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Blockchain Transaction History */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-600" />
                Blockchain Transaction History
              </h2>
              <p className="text-sm text-gray-600">Transport actions recorded on blockchain</p>
            </div>

            {blockchainBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="font-semibold">No batch records found</p>
                <p className="text-sm mt-1">Batches will appear here once created</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Batch ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Farmer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Current Owner</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created On</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockchainBatches.map((txn, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-900">
                            {txn.batchId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-gray-900">{txn.productName || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-gray-700">{txn.farmer || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-gray-700">{txn.currentOwner || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {txn.timestamp}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                            txn.status === 'Delivered' ? 'bg-green-100 text-green-800' : 
                            txn.status === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                            txn.status === 'Created' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {txn.status || 'Created'}
                          </span>
                        </td>
                      </tr>
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
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <MapPin className="w-6 h-6 mr-2" />
                  Update Location & Delivery Status
                </h3>
                <p className="text-green-100 text-sm mt-1">
                  Batch: {selectedBatch.batchId} | Update your current location and expected delivery time
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

                {/* Dispatch and Expected Delivery Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Dispatch Time
                    </label>
                    <input
                      type="datetime-local"
                      value={statusUpdate.dispatchTime}
                      onChange={(e) => setStatusUpdate({ ...statusUpdate, dispatchTime: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Expected Delivery Time
                    </label>
                    <input
                      type="datetime-local"
                      value={statusUpdate.expectedDelivery}
                      onChange={(e) => setStatusUpdate({ ...statusUpdate, expectedDelivery: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
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

      {/* Transport Details Modal */}
      <AnimatePresence>
        {showTransportDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowTransportDetailsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-blue-600 p-6 rounded-t-2xl">
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Truck className="w-6 h-6 mr-2" />
                  Vehicle & Driver Information
                </h3>
                <p className="text-blue-100 text-sm mt-1">
                  {selectedBatch 
                    ? `Add/Update vehicle details for batch ${selectedBatch.batchId}`
                    : 'Enter your vehicle number, driver name, company, and contact'
                  }
                </p>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Vehicle Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <Truck className="w-4 h-4 inline mr-1" />
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    value={transportDetails.vehicleNumber}
                    onChange={(e) => setTransportDetails({ ...transportDetails, vehicleNumber: e.target.value })}
                    placeholder="e.g., MH-12-AB-1234"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Driver Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Driver Name *
                  </label>
                  <input
                    type="text"
                    value={transportDetails.driverName}
                    onChange={(e) => setTransportDetails({ ...transportDetails, driverName: e.target.value })}
                    placeholder="Enter driver's full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Transport Company */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <Package className="w-4 h-4 inline mr-1" />
                    Transport Company *
                  </label>
                  <input
                    type="text"
                    value={transportDetails.transportCompany}
                    onChange={(e) => setTransportDetails({ ...transportDetails, transportCompany: e.target.value })}
                    placeholder="Enter company name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    value={transportDetails.contactNumber}
                    onChange={(e) => setTransportDetails({ ...transportDetails, contactNumber: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Important</p>
                      <p className="text-xs text-blue-700 mt-1">
                        These details will be stored and linked to the batch for tracking and accountability purposes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-4 p-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTransportDetailsModal(false);
                    // Don't reset transport details on cancel - keep existing data
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    // Save transport details to localStorage (persists across sessions)
                    localStorage.setItem('transportDetails', JSON.stringify(transportDetails));
                    console.log('✅ Transport Details Saved:', transportDetails);
                    showNotification('success', 'Transport details saved successfully!');
                    setShowTransportDetailsModal(false);
                    // Keep transportDetails in state - don't reset!
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!transportDetails.vehicleNumber || !transportDetails.driverName || !transportDetails.transportCompany || !transportDetails.contactNumber}
                  icon={CheckCircle}
                >
                  Save Details
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
