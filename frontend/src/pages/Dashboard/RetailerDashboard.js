import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import QRCode from 'react-qr-code';
import {
  Store,
  Package,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  MapPin,
  Truck,
  ExternalLink,
  Phone,
  Eye,
  Download,
  Route,
  User,
  Building2,
  Clock,
  QrCode,
  CreditCard,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { batchAPI, transportAPI, userAPI } from '../../services/api';
import SupplyChainABI from '../../contracts/SupplyChain.json';

const RetailerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('batches');
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState('');
  const [paymentBatchId, setPaymentBatchId] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');
  const [retailerWalletAddress, setRetailerWalletAddress] = useState('');

  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const showNotification = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 3500);
  };

  const getReadOnlyContract = async () => {
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || SupplyChainABI.address;
    if (!contractAddress) return null;

    const provider = window.ethereum
      ? new ethers.BrowserProvider(window.ethereum)
      : new ethers.JsonRpcProvider(process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545');

    return new ethers.Contract(contractAddress, SupplyChainABI.abi, provider);
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await batchAPI.getAllBatches();
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to fetch batches');
      }

      const contract = await getReadOnlyContract();
      const batchData = response.data || [];

      const enriched = await Promise.all(
        batchData.map(async (batch) => {
          let chainData = null;
          try {
            if (contract && typeof contract.getBatch === 'function') {
              const chainBatch = await contract.getBatch(batch.batchId);
              chainData = {
                onChainCurrentOwner: chainBatch.currentOwner || '',
                onChainDelivered: Boolean(chainBatch.delivered),
                onChainCreatedAt: Number(chainBatch.createdAt || 0),
              };
            }
          } catch (error) {
            chainData = null;
          }

          let trackingData = null;
          try {
            const trackingResponse = await transportAPI.getTracking(batch.batchId);
            if (trackingResponse?.success) {
              trackingData = trackingResponse.data || null;
            }
          } catch (error) {
            trackingData = null;
          }

          return {
            ...batch,
            ...chainData,
            gpsTracking: trackingData?.gpsTracking?.length ? trackingData.gpsTracking : (batch.gpsTracking || []),
            location: trackingData?.currentLocation || batch.location || '',
            statusHistory: trackingData?.statusHistory?.length ? trackingData.statusHistory : (batch.statusHistory || []),
          };
        })
      );

      setBatches(enriched);
    } catch (error) {
      console.error('Retailer fetch error:', error);
      showNotification('error', error?.message || 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    const resolveRetailerWallet = async () => {
      try {
        if (user?.walletAddress) {
          setRetailerWalletAddress(user.walletAddress);
          return;
        }

        const response = await userAPI.getProfile();
        if (response?.success && response?.data?.walletAddress) {
          setRetailerWalletAddress(response.data.walletAddress);
        }
      } catch (error) {
        console.error('Retailer wallet lookup failed:', error);
      }
    };

    resolveRetailerWallet();
  }, [user?.walletAddress]);

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'N/A';
    return new Date(dateValue).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    return new Date(dateValue).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  };

  const getStagePaymentStatus = (batch, stage) => String(batch?.payments?.[stage]?.status || 'Pending');

  const getDistributorPaymentBlockReason = (batch) => {
    const farmerStatus = getStagePaymentStatus(batch, 'farmer');
    const transportStatus = getStagePaymentStatus(batch, 'transport');

    const missingStages = [];
    if (farmerStatus !== 'Paid') missingStages.push(`Farmer (${farmerStatus})`);
    if (transportStatus !== 'Paid') missingStages.push(`Transport (${transportStatus})`);
    return missingStages.length ? `Missing prerequisites: ${missingStages.join(', ')}` : '';
  };

  const getLatestGpsPoint = (batch) => {
    const points = batch?.gpsTracking || [];
    return points.length ? points[points.length - 1] : null;
  };

  const getDistributorEvent = (batch) => {
    const events = [...(batch?.statusHistory || [])].reverse();
    return events.find((entry) => entry?.updatedBy?.role === 'Distributor') || null;
  };

  const getDistributorDetails = (batch) => {
    const distributorEvent = getDistributorEvent(batch);

    if (distributorEvent?.updatedBy) {
      return {
        name: distributorEvent.updatedBy.name || 'Distributor Partner',
        phone: distributorEvent.updatedBy.phoneNumber || batch?.transportDetails?.contactNumber || 'Not shared',
        organization: distributorEvent.updatedBy.organization || batch?.transportDetails?.transportCompany || 'AgriChain Network',
      };
    }

    const latestDistributorLikeEvent = [...(batch?.statusHistory || [])]
      .reverse()
      .find((entry) => {
        const role = String(entry?.updatedBy?.role || '').toLowerCase();
        const message = String(entry?.message || '').toLowerCase();
        return role === 'distributor' || message.includes('distributor');
      });

    if (latestDistributorLikeEvent?.updatedBy) {
      return {
        name: latestDistributorLikeEvent.updatedBy.name || 'Distributor Partner',
        phone: latestDistributorLikeEvent.updatedBy.phoneNumber || batch?.transportDetails?.contactNumber || 'Not shared',
        organization: latestDistributorLikeEvent.updatedBy.organization || batch?.transportDetails?.transportCompany || 'AgriChain Network',
      };
    }

    const owner = batch?.currentOwner;
    if (owner?.role === 'Distributor') {
      return {
        name: owner.name || 'Distributor Partner',
        phone: owner.phoneNumber || batch?.transportDetails?.contactNumber || 'Not shared',
        organization: owner.organization || batch?.transportDetails?.transportCompany || 'AgriChain Network',
      };
    }

    return {
      name: 'Distributor Partner',
      phone: batch?.transportDetails?.contactNumber || '',
      organization: batch?.transportDetails?.transportCompany || 'AgriChain Network',
    };
  };

  const getOrderDate = (batch) => {
    const event = [...(batch?.statusHistory || [])]
      .reverse()
      .find((entry) => entry?.updatedBy?.role === 'Distributor');
    return event?.timestamp || batch?.createdAt || '';
  };

  const getDeliveryDate = (batch) => {
    return (
      batch?.deliveryProof?.deliveredAt ||
      batch?.deliveredAt ||
      batch?.expectedDelivery ||
      [...(batch?.statusHistory || [])]
        .reverse()
        .find((entry) => String(entry?.status || '').toLowerCase().includes('delivered'))?.timestamp ||
      ''
    );
  };

  const getJourneyTimeline = (batch) => {
    const history = batch?.statusHistory || [];
    const significant = history.filter((entry) => {
      const status = String(entry?.status || '').toLowerCase();
      return status.includes('picked') || status.includes('transit') || status.includes('delivered') || status.includes('accepted by retailer');
    });

    return significant.slice(-5);
  };

  const getTransportDetails = (batch) => {
    const details = batch?.transportDetails || {};

    const transportEvent = [...(batch?.statusHistory || [])]
      .reverse()
      .find((entry) => entry?.updatedBy?.role === 'Transport');

    return {
      vehicleNumber: details.vehicleNumber || 'Assigned Vehicle',
      driverName: details.driverName || transportEvent?.updatedBy?.name || batch?.currentOwner?.name || 'Assigned Driver',
      transportCompany: details.transportCompany || transportEvent?.updatedBy?.organization || batch?.currentOwner?.organization || 'Assigned Transport Partner',
      deliveryDate: getDeliveryDate(batch),
    };
  };

  const getStatusGroup = (batch) => {
    const status = String(batch?.status || '').toLowerCase();
    const ownerRole = String(batch?.currentOwnerRole || batch?.currentOwner?.role || '').toLowerCase();

    if (status.includes('delivered') || status.includes('completed') || status === 'final delivery') {
      return 'completed';
    }

    if (status.includes('accepted by retailer') || ownerRole === 'retailer') {
      return 'active';
    }

    if (ownerRole === 'transport' || ownerRole === 'distributor' || status.includes('transit')) {
      return 'pending';
    }

    return 'active';
  };

  const searchedBatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return batches.filter((batch) => {
      const distributor = getDistributorDetails(batch);
      const matchesSearch =
        !term ||
        batch.batchId?.toLowerCase().includes(term) ||
        batch.productName?.toLowerCase().includes(term) ||
        distributor.name?.toLowerCase().includes(term);

      const group = getStatusGroup(batch);
      const matchesFilter = statusFilter === 'all' || group === statusFilter;

      return matchesSearch && matchesFilter;
    });
  }, [batches, searchTerm, statusFilter]);

  const availableBatches = searchedBatches.filter((batch) => getStatusGroup(batch) === 'pending');
  const acceptedBatches = searchedBatches.filter((batch) => getStatusGroup(batch) === 'active');
  const completedBatches = searchedBatches.filter((batch) => getStatusGroup(batch) === 'completed');

  const stats = useMemo(() => {
    const totalRevenue = completedBatches.reduce((sum, batch) => {
      const price = Number(batch?.price || batch?.quantity * 10 || 0);
      return sum + price;
    }, 0);

    return {
      available: availableBatches.length,
      active: acceptedBatches.length,
      completed: completedBatches.length,
      revenue: totalRevenue,
    };
  }, [availableBatches, acceptedBatches, completedBatches]);

  const retailerPaymentHistory = useMemo(() => {
    return batches
      .flatMap((batch) =>
        (batch.paymentHistory || [])
          .filter((entry) => {
            const paidBy = String(entry?.paidByRole || '').toLowerCase();
            const paidTo = String(entry?.paidToRole || '').toLowerCase();
            return paidBy === 'retailer' || paidTo === 'retailer';
          })
          .map((entry) => ({
            ...entry,
            batchId: batch.batchId,
            productName: batch.productName,
          }))
      )
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  }, [batches]);

  const filteredRetailerPayments = retailerPaymentHistory.filter((entry) => {
    const status = String(entry?.status || 'Paid').toLowerCase();
    const paidTime = new Date(entry?.paidAt || 0).getTime();
    const fromTime = paymentFromDate ? new Date(`${paymentFromDate}T00:00:00`).getTime() : null;
    const toTime = paymentToDate ? new Date(`${paymentToDate}T23:59:59`).getTime() : null;

    const matchesStatus = paymentStatusFilter === 'all' || status === paymentStatusFilter;
    const matchesFrom = !fromTime || paidTime >= fromTime;
    const matchesTo = !toTime || paidTime <= toTime;

    return matchesStatus && matchesFrom && matchesTo;
  });

  const exportRetailerPaymentsCsv = () => {
    const rows = [
      ['Batch ID', 'Amount', 'Paid To / Received From', 'Payment ID', 'Date', 'Status'],
      ...filteredRetailerPayments.map((entry) => [
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
    link.download = `retailer-payments-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRetailerDecision = async (batch, action) => {
    try {
      setProcessingBatchId(batch.batchId);

      if (action === 'accept') {
        const recipientWallet = retailerWalletAddress || user?.walletAddress || '';
        if (!recipientWallet) {
          throw new Error('Retailer wallet address not found. Please re-login and try again.');
        }

        await batchAPI.transferBatch(
          batch.batchId,
          recipientWallet,
          'Accepted by retailer',
          batch?.deliveryAddress || '',
          batch?.transportDetails || {}
        );
      } else {
        await batchAPI.retailerDecision(batch.batchId, 'reject', 'Rejected by retailer');
      }

      showNotification('success', `Batch ${action === 'accept' ? 'accepted' : 'rejected'} successfully`);
      fetchBatches();
    } catch (error) {
      console.error('Retailer decision error:', error);
      showNotification('error', error?.message || `Failed to ${action} batch`);
    } finally {
      setProcessingBatchId('');
    }
  };

  const buildQrPayload = (batch) => {
    const baseUrl = window?.location?.origin || 'http://localhost:3000';
    return `${baseUrl}/batch/${batch.batchId}`;
  };

  const downloadQr = (batchId) => {
    const container = document.getElementById(`retailer-qr-${batchId}`);
    const svg = container?.querySelector('svg');
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${batchId}-traceability-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openBatchDetails = (batch) => {
    setSelectedBatch(batch);
    setShowDetailsModal(true);
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleDistributorPayment = async (batch) => {
    try {
      setPaymentBatchId(batch.batchId);
      const orderResponse = await batchAPI.createPaymentOrder(batch.batchId, 'distributor', batch?.price || batch?.quantity * 10);
      if (!orderResponse?.success) {
        throw new Error(orderResponse?.message || 'Unable to create payment order');
      }

      const orderData = orderResponse.data;
      const useMockPayment = Boolean(orderData?.isMockOrder || orderData?.key === 'rzp_test_mock' || String(orderData?.order?.id || '').startsWith('order_mock_'));

      if (useMockPayment) {
        await batchAPI.verifyPayment({
          batchId: batch.batchId,
          stage: 'distributor',
          razorpay_order_id: orderData.order.id,
        });

        showNotification('success', `${orderData?.paymentMode || 'Mock Payment'} completed successfully`);
        fetchBatches();
        return;
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        await batchAPI.verifyPayment({
          batchId: batch.batchId,
          stage: 'distributor',
          razorpay_order_id: orderData.order.id,
        });
      } else {
        await new Promise((resolve, reject) => {
          const rz = new window.Razorpay({
            key: orderData.key,
            amount: orderData.order.amount,
            currency: orderData.order.currency,
            name: 'AgriChain Payments',
            description: 'Retailer payment to Distributor',
            order_id: orderData.order.id,
            handler: async (response) => {
              try {
                await batchAPI.verifyPayment({
                  batchId: batch.batchId,
                  stage: 'distributor',
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          });

          rz.on('payment.failed', (event) => reject(new Error(event?.error?.description || 'Payment failed')));
          rz.open();
        });
      }

      showNotification('success', 'Distributor payment completed successfully');
      fetchBatches();
    } catch (error) {
      showNotification('error', error?.message || 'Failed to complete distributor payment');
    } finally {
      setPaymentBatchId('');
    }
  };

  const sectionCard = (title, subtitle, list, mode) => (
    <motion.div className="mt-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
            {list.length}
          </span>
        </div>

        {list.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No batches found in this section.
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((batch) => {
              const distributor = getDistributorDetails(batch);
              const transport = getTransportDetails(batch);
              const latestGps = getLatestGpsPoint(batch);
              const distributorPaymentBlockReason = getDistributorPaymentBlockReason(batch);

              return (
                <div key={batch._id || batch.batchId} className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                      <p className="text-xs font-semibold text-gray-500">Batch ID</p>
                      <p className="font-mono text-sm text-gray-900">{batch.batchId}</p>

                      <p className="text-xs font-semibold text-gray-500 mt-3">Crop Name</p>
                      <p className="font-semibold text-gray-900">{batch.productName}</p>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="font-medium text-gray-900">{batch.quantity} {batch.unit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Price</p>
                          <p className="font-medium text-gray-900">{formatCurrency(batch.price || batch.quantity * 10)}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500">Distributor Name</p>
                      <p className="font-semibold text-gray-900">{distributor.name}</p>

                      <p className="text-xs text-gray-500 mt-3">Phone</p>
                      {distributor.phone && distributor.phone !== 'Not shared' ? (
                        <a href={`tel:${distributor.phone}`} className="text-sm text-blue-700 hover:underline">
                          {distributor.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-700">Not shared</p>
                      )}

                      <p className="text-xs text-gray-500 mt-3">Organization</p>
                      <p className="text-sm text-gray-900">{distributor.organization || 'AgriChain Network'}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Order Date</p>
                      <p className="text-sm text-gray-900">{formatDate(getOrderDate(batch))}</p>

                      <p className="text-xs text-gray-500 mt-3">Delivery Date</p>
                      <p className="text-sm text-gray-900">{formatDate(getDeliveryDate(batch))}</p>

                      <p className="text-xs text-gray-500 mt-3">Distributor Payment</p>
                      <p className="text-sm font-semibold text-indigo-700">{batch?.payments?.distributor?.status || 'Pending'}</p>
                      {mode !== 'pending' && (
                        <div className={`mt-2 rounded-lg border p-3 text-xs font-medium ${distributorPaymentBlockReason ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                          {distributorPaymentBlockReason || 'All prerequisites completed. Distributor payment can be processed.'}
                        </div>
                      )}

                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
                        onClick={() => {
                          if (distributor.phone && distributor.phone !== 'Not shared') {
                            window.location.href = `tel:${distributor.phone}`;
                          }
                        }}
                      >
                        <Phone className="w-4 h-4" />
                        Call Distributor
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Current Status</p>
                      <span className="inline-flex mt-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {batch.status}
                      </span>

                      {mode === 'pending' ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openBatchDetails(batch)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetailerDecision(batch, 'reject')}
                            disabled={processingBatchId === batch.batchId}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setShowDetailsModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setShowQrModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold hover:bg-emerald-200"
                          >
                            <QrCode className="w-4 h-4" />
                            View QR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDistributorPayment(batch)}
                            disabled={paymentBatchId === batch.batchId || batch?.payments?.distributor?.status === 'Paid'}
                            title={distributorPaymentBlockReason || 'Pay distributor'}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
                          >
                            <CreditCard className="w-4 h-4" />
                            {paymentBatchId === batch.batchId
                              ? 'Paying...'
                              : (batch?.payments?.distributor?.status === 'Paid'
                                ? 'Paid Successfully'
                                : 'Pay Distributor')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {mode !== 'pending' && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Route className="w-4 h-4" />
                        Transport Tracking
                      </h4>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Vehicle Number</p>
                          <p className="font-medium text-gray-900">{transport.vehicleNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Driver Name</p>
                          <p className="font-medium text-gray-900">{transport.driverName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Transport Company</p>
                          <p className="font-medium text-gray-900">{transport.transportCompany}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Delivery Date</p>
                          <p className="font-medium text-gray-900">{formatDate(transport.deliveryDate)}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Tracking Timeline</p>
                        <div className="space-y-2">
                          {getJourneyTimeline(batch).map((entry, idx) => (
                            <div key={`${batch.batchId}-${idx}`} className="flex items-center gap-2 text-sm">
                              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                              <span className="font-medium text-gray-800">Day {idx + 1}</span>
                              <span className="text-gray-700">{entry.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Latitude</p>
                          <p className="font-medium text-gray-900">{latestGps?.latitude ? Number(latestGps.latitude).toFixed(5) : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Longitude</p>
                          <p className="font-medium text-gray-900">{latestGps?.longitude ? Number(latestGps.longitude).toFixed(5) : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Updated</p>
                          <p className="font-medium text-gray-900">{formatDateTime(latestGps?.timestamp || batch?.updatedAt)}</p>
                        </div>
                      </div>

                      {latestGps?.latitude && latestGps?.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${latestGps.latitude},${latestGps.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View on Map
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}! 🏪</h1>
            <p className="text-gray-600 mt-2">Manage acceptance, distributor coordination, transport tracking, and traceability.</p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/scan')}
            icon={QrCode}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Scan QR
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2 rounded-lg font-semibold border transition-colors ${
              activeTab === 'batches'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Batches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg font-semibold border transition-colors ${
              activeTab === 'payments'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Payments
          </button>
        </div>

        {activeTab === 'batches' && (
          <>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Batches</p>
                <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
              </div>
              <div className="bg-amber-500 p-3 rounded-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Accepted Batches</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <Truck className="w-8 h-8 text-white" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue (Est.)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.revenue)}</p>
              </div>
              <div className="bg-purple-500 p-3 rounded-lg">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by batch ID, crop, or distributor..."
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
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="active">Accepted / Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <Button variant="outline" onClick={fetchBatches} icon={RefreshCw}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-indigo-900">Retailer Payment History</h3>
            <span className="text-xs font-semibold text-indigo-700">Latest settlements</span>
          </div>
          {retailerPaymentHistory.length === 0 ? (
            <p className="text-sm text-indigo-800">No retailer payment records yet.</p>
          ) : (
            <div className="space-y-2">
              {retailerPaymentHistory.slice(0, 6).map((entry, idx) => (
                <div key={`${entry.batchId}-${entry.paymentId || idx}`} className="rounded-md border border-indigo-100 bg-white px-3 py-2 text-sm">
                  <p className="font-medium text-gray-900">{entry.batchId} - {entry.productName}</p>
                  <p className="text-xs text-gray-600">{entry.paidByRole} to {entry.paidToRole}</p>
                  <p className="text-xs text-gray-500">{new Date(entry.paidAt).toLocaleString('en-IN')}</p>
                  <p className="font-semibold text-indigo-700">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {sectionCard(
          'Available Batches',
          'Batches received from distributor/transport waiting for your decision.',
          availableBatches,
          'pending'
        )}

        {sectionCard(
          'Accepted Batches',
          'Actively tracked batches accepted by retailer.',
          acceptedBatches,
          'active'
        )}

        {sectionCard(
          'Completed Batches',
          'Delivered and completed orders with traceability QR.',
          completedBatches,
          'completed'
        )}
          </>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Payments</h3>
              <button
                type="button"
                onClick={exportRetailerPaymentsCsv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

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

            {filteredRetailerPayments.length === 0 ? (
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
                    {filteredRetailerPayments.map((entry, idx) => (
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
        )}
      </main>

      <AnimatePresence>
        {showDetailsModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Batch Details</h3>
                <p className="font-mono text-sm text-gray-600 mt-1">{selectedBatch.batchId}</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Crop Name</p>
                    <p className="font-semibold text-gray-900">{selectedBatch.productName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-semibold text-gray-900">{selectedBatch.quantity} {selectedBatch.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-semibold text-gray-900">{selectedBatch.status}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Delivery Address</p>
                    <p className="font-semibold text-gray-900">{selectedBatch.deliveryAddress || 'N/A'}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Distributor Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-blue-700">Name</p>
                      <p className="font-semibold text-gray-900">{getDistributorDetails(selectedBatch).name}</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Phone</p>
                      <p className="font-semibold text-gray-900">{getDistributorDetails(selectedBatch).phone || 'Not shared'}</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Organization</p>
                      <p className="font-semibold text-gray-900">{getDistributorDetails(selectedBatch).organization || 'AgriChain Network'}</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Order Date</p>
                      <p className="font-semibold text-gray-900">{formatDate(getOrderDate(selectedBatch))}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900 mb-2">Transport Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-emerald-700">Vehicle Number</p>
                      <p className="font-semibold text-gray-900">{getTransportDetails(selectedBatch).vehicleNumber}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Driver Name</p>
                      <p className="font-semibold text-gray-900">{getTransportDetails(selectedBatch).driverName}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Transport Company</p>
                      <p className="font-semibold text-gray-900">{getTransportDetails(selectedBatch).transportCompany}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Delivery Date</p>
                      <p className="font-semibold text-gray-900">{formatDate(getTransportDetails(selectedBatch).deliveryDate)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Product Journey</p>
                  <div className="space-y-2">
                    {(selectedBatch.statusHistory || []).slice(-8).reverse().map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                        <div>
                          <p className="font-medium text-gray-900">{entry.status}</p>
                          <p className="text-gray-600">{entry.message || 'Status updated'}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(entry.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)} className="w-full">
                  Close
                </Button>
                {getStatusGroup(selectedBatch) === 'pending' && (
                  <Button
                    variant="success"
                    onClick={async () => {
                      await handleRetailerDecision(selectedBatch, 'accept');
                      setShowDetailsModal(false);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={processingBatchId === selectedBatch.batchId}
                  >
                    {processingBatchId === selectedBatch.batchId ? 'Accepting...' : 'Accept Batch'}
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQrModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Traceability QR</h3>
                <p className="font-mono text-sm text-gray-600 mt-1">{selectedBatch.batchId}</p>
              </div>

              <div className="p-6">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col items-center gap-4">
                  <div id={`retailer-qr-${selectedBatch.batchId}`} className="bg-white p-3 rounded-lg border border-gray-200">
                    <QRCode value={buildQrPayload(selectedBatch)} size={200} />
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    Scan to view complete product journey from farmer to retailer with transport and delivery details.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                  onClick={() => downloadQr(selectedBatch.batchId)}
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-800 font-semibold hover:bg-gray-200"
                  onClick={() => setShowQrModal(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50"
          >
            <div className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {toast.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              <span className="font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetailerDashboard;
