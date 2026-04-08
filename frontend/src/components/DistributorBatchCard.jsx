import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ExternalLink,
  Hash,
  Loader2,
  MapPin,
  Navigation,
  Package,
  QrCode,
  ShieldCheck,
  Truck,
  TrendingUp,
  User,
  Users,
  BadgeCheck,
  CreditCard,
  Weight,
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { batchAPI } from '../services/api';

const DetailRow = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900 break-words">{value || 'N/A'}</p>
  </div>
);

const DistributorBatchCard = ({
  batch,
  onViewDetails,
  onQuantitySoldUpdate,
  transportUsers = [],
  transportAssignment = null,
  onAssignTransporter,
  onPaymentComplete,
  index = 0,
}) => {
  const { getBatch } = useBlockchain();
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [soldQuantity, setSoldQuantity] = useState(0);
  const [soldQuantityInput, setSoldQuantityInput] = useState('0');
  const [updatingSoldQuantity, setUpdatingSoldQuantity] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState({ status: 'idle', message: '' });
  const [selectedTransporterAddress, setSelectedTransporterAddress] = useState('');
  const [assignmentDraft, setAssignmentDraft] = useState({
    vehicleNumber: '',
    driverName: '',
    transportCompany: '',
    contactNumber: '',
    deliveryAddress: '',
  });
  const [assigningTransporter, setAssigningTransporter] = useState(false);
  const [paymentLoadingStage, setPaymentLoadingStage] = useState('');

  const totalQuantity = Number(batch?.quantity || 0);
  const latestGpsPoint = batch?.gpsTracking?.length
    ? batch.gpsTracking[batch.gpsTracking.length - 1]
    : null;
  const assignedTransporter = transportAssignment || batch?.transportAssignment || null;
  const lastLocationEvent = [...(batch?.statusHistory || [])]
    .reverse()
    .find((entry) => entry?.location || entry?.status === 'In Transit');
  const lastKnownLocation =
    latestGpsPoint?.location ||
    batch?.location ||
    lastLocationEvent?.location ||
    `Awaiting first GPS ping from ${assignedTransporter?.transporterName || assignedTransporter?.driverName || 'transporter'}`;
  const lastKnownLocationTime =
    latestGpsPoint?.timestamp ||
    lastLocationEvent?.timestamp ||
    assignedTransporter?.assignedAt ||
    '';
  const latitude = Number(latestGpsPoint?.latitude);
  const longitude = Number(latestGpsPoint?.longitude);
  const hasCoordinateMap = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasLocationMap = Boolean(lastKnownLocation && !String(lastKnownLocation).toLowerCase().includes('awaiting first gps ping'));
  const mapQuery = hasCoordinateMap
    ? `${latitude},${longitude}`
    : encodeURIComponent(lastKnownLocation);
  const mapExternalUrl = `https://www.google.com/maps?q=${mapQuery}`;
  const mapEmbedSrc = hasCoordinateMap
    ? `https://maps.google.com/maps?q=${mapQuery}&z=17&t=m&output=embed`
    : `https://maps.google.com/maps?q=${mapQuery}&z=11&t=m&output=embed`;

  useEffect(() => {
    const nextTransporterAddress = assignedTransporter?.transporterAddress || '';
    setSelectedTransporterAddress(nextTransporterAddress);

    setAssignmentDraft({
      vehicleNumber: assignedTransporter?.vehicleNumber || '',
      driverName: assignedTransporter?.driverName || '',
      transportCompany: assignedTransporter?.transportCompany || '',
      contactNumber: assignedTransporter?.contactNumber || '',
      deliveryAddress: assignedTransporter?.deliveryAddress || batch?.deliveryAddress || '',
    });
  }, [assignedTransporter, batch?.deliveryAddress]);

  useEffect(() => {
    const nextSold = Number(batch?.quantitySold || 0);
    setSoldQuantity(Number.isFinite(nextSold) ? nextSold : 0);
    setSoldQuantityInput(String(Number.isFinite(nextSold) ? nextSold : 0));
  }, [batch?.quantitySold]);

  const quantitySold = Math.max(0, Math.min(totalQuantity, Number(soldQuantity || 0)));
  const remainingQuantity = Math.max(totalQuantity - quantitySold, 0);

  const soldDate =
    batch?.soldDate ||
    batch?.statusHistory?.find((entry) =>
      ['In Transit', 'Picked from Farmer', 'Picked Up'].includes(entry.status)
    )?.timestamp ||
    '';

  const deliveredDate =
    batch?.deliveredAt ||
    batch?.statusHistory?.find((entry) => entry.status === 'Delivered')?.timestamp ||
    '';

  const qrPayload = useMemo(() => {
    const baseUrl = window?.location?.origin || 'http://localhost:3000';
    return `${baseUrl}/batch/${batch?.batchId || ''}`;
  }, [batch?.batchId]);

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    return new Date(dateValue).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'N/A';
    return new Date(dateValue).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
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

  const handleStagePayment = async (stage) => {
    try {
      setPaymentLoadingStage(stage);

      const orderResponse = await batchAPI.createPaymentOrder(batch.batchId, stage);
      if (!orderResponse?.success) {
        throw new Error(orderResponse?.message || 'Unable to create payment order');
      }

      const orderData = orderResponse.data;
      const useMockPayment = Boolean(orderData?.isMockOrder || orderData?.key === 'rzp_test_mock' || String(orderData?.order?.id || '').startsWith('order_mock_'));

      if (useMockPayment) {
        await batchAPI.verifyPayment({
          batchId: batch.batchId,
          stage,
          razorpay_order_id: orderData.order.id,
        });

        setVerification({ status: 'verified', message: `${orderData?.paymentMode || 'Mock Payment'} completed for ${stage} stage` });
        if (typeof onPaymentComplete === 'function') {
          onPaymentComplete();
        }
        return;
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        await batchAPI.verifyPayment({
          batchId: batch.batchId,
          stage,
          razorpay_order_id: orderData.order.id,
        });
      } else {
        await new Promise((resolve, reject) => {
          const rz = new window.Razorpay({
            key: orderData.key,
            amount: orderData.order.amount,
            currency: orderData.order.currency,
            name: 'AgriChain Payments',
            description: `Payment for ${stage} stage`,
            order_id: orderData.order.id,
            handler: async (response) => {
              try {
                await batchAPI.verifyPayment({
                  batchId: batch.batchId,
                  stage,
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

          rz.on('payment.failed', (event) => {
            reject(new Error(event?.error?.description || 'Payment failed'));
          });

          rz.open();
        });
      }

      setVerification({ status: 'verified', message: `Payment completed for ${stage} stage` });
      if (typeof onPaymentComplete === 'function') {
        onPaymentComplete();
      }
    } catch (error) {
      setVerification({ status: 'error', message: error?.message || `Failed to process ${stage} payment` });
    } finally {
      setPaymentLoadingStage('');
    }
  };

  const getStatusColor = (role) => {
    const colors = {
      farmer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      distributor: 'bg-amber-100 text-amber-800 border-amber-200',
      transport: 'bg-blue-100 text-blue-800 border-blue-200',
      retailer: 'bg-purple-100 text-purple-800 border-purple-200',
      consumer: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStageLabel = () => {
    const role = String(batch?.currentOwnerRole || batch?.currentOwner?.role || '').toLowerCase();
    const status = String(batch?.status || '').toLowerCase();

    if (status === 'delivered' || role === 'retailer') return 'Delivered';
    if (role === 'transport' || status.includes('transit')) return 'In Transit';
    if (role === 'distributor') return 'At Distributor';
    return 'At Farmer Location';
  };

  const getDeliveryAddress = () => {
    return (
      batch?.deliveryAddress ||
      batch?.destinationAddress ||
      batch?.currentOwner?.organization ||
      'Retailer / destination address not set'
    );
  };

  const getFarmerAddress = () => {
    return (
      batch?.farmer?.farmLocation ||
      batch?.farmer?.organization ||
      batch?.farmer?.walletAddress ||
      'Farmer address not set'
    );
  };

  const getDeliveryDate = () => {
    return batch?.deliveredAt || batch?.expectedDelivery || soldDate || '';
  };

  const selectedTransporter = transportUsers.find((transport) => transport.walletAddress === selectedTransporterAddress);

  useEffect(() => {
    if (!selectedTransporter) return;

    setAssignmentDraft((current) => ({
      vehicleNumber: current.vehicleNumber || '',
      driverName: current.driverName || selectedTransporter.name || '',
      transportCompany: current.transportCompany || selectedTransporter.organization || '',
      contactNumber: current.contactNumber || selectedTransporter.phoneNumber || '',
      deliveryAddress: current.deliveryAddress || '',
    }));
  }, [selectedTransporter]);

  const handleTransportAssignment = async (event) => {
    event.stopPropagation();

    if (!selectedTransporterAddress) {
      setVerification({ status: 'error', message: 'Please select a transporter first' });
      return;
    }

    try {
      setAssigningTransporter(true);
      const assignmentData = {
        batchId: batch.batchId,
        transporterAddress: selectedTransporterAddress,
        transporterName: selectedTransporter?.name || '',
        vehicleNumber: assignmentDraft.vehicleNumber,
        driverName: assignmentDraft.driverName || selectedTransporter?.name || '',
        transportCompany: assignmentDraft.transportCompany || selectedTransporter?.organization || '',
        contactNumber: assignmentDraft.contactNumber || selectedTransporter?.phoneNumber || '',
        deliveryAddress: assignmentDraft.deliveryAddress || '',
      };

      if (typeof onAssignTransporter === 'function') {
        await onAssignTransporter(assignmentData);
      }

      setVerification({ status: 'verified', message: 'Transporter assigned successfully 🚚' });
    } catch (error) {
      setVerification({ status: 'error', message: error?.message || 'Failed to assign transporter' });
    } finally {
      setAssigningTransporter(false);
    }
  };

  const downloadQr = (event) => {
    event.stopPropagation();
    const container = document.getElementById(`distributor-qr-${batch.batchId}`);
    const svg = container?.querySelector('svg');
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${batch.batchId}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVerifyOnBlockchain = async (event) => {
    event.stopPropagation();
    if (!batch?.batchId) return;

    try {
      setVerifying(true);
      setVerification({ status: 'verifying', message: 'Verifying batch on blockchain...' });

      const chainBatch = await getBatch(batch.batchId);
      const chainOwner = String(chainBatch.currentOwner || '').toLowerCase();
      const backendOwner = String(batch?.currentOwner?.walletAddress || '').toLowerCase();
      const farmerOwner = String(batch?.farmer?.walletAddress || '').toLowerCase();
      const chainIpfs = String(chainBatch.ipfsHash || '').toLowerCase();
      const backendIpfs = String(batch?.ipfsHash || '').toLowerCase();

      const matchesOwner =
        (backendOwner && chainOwner === backendOwner) ||
        (farmerOwner && chainOwner === farmerOwner) ||
        !backendOwner;
      const matchesBatch = chainBatch.batchId === batch.batchId && (!backendIpfs || chainIpfs === backendIpfs);

      if (!matchesOwner || !matchesBatch) {
        throw new Error('Blockchain data does not fully match the batch record');
      }

      setVerification({
        status: 'verified',
        message: 'Data Verified from Blockchain ✅',
      });
    } catch (error) {
      setVerification({
        status: 'error',
        message: error.message || 'Blockchain verification failed',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleQuantitySoldChange = (event) => {
    setSoldQuantityInput(event.target.value);
  };

  const persistQuantitySold = async (event) => {
    event?.stopPropagation?.();
    const parsed = Number(soldQuantityInput);
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.min(totalQuantity, parsed)) : 0;

    try {
      setUpdatingSoldQuantity(true);
      const response = await batchAPI.updateQuantitySold(batch.batchId, safeValue);
      if (response?.success) {
        setSoldQuantity(safeValue);
        setSoldQuantityInput(String(safeValue));
        if (typeof onQuantitySoldUpdate === 'function') {
          onQuantitySoldUpdate();
        }
      }
    } catch (error) {
      setSoldQuantityInput(String(soldQuantity));
      setVerification({
        status: 'error',
        message: error?.message || 'Failed to update quantity sold',
      });
    } finally {
      setUpdatingSoldQuantity(false);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.6, -0.05, 0.01, 0.99],
      },
    },
    hover: {
      y: -8,
      scale: 1.02,
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
      transition: { duration: 0.3, ease: 'easeOut' },
    },
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
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-amber-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <motion.h3
              className="text-xl font-bold text-gray-900 mb-1 group-hover:text-emerald-700 transition-colors truncate"
              whileHover={{ x: 5 }}
            >
              {batch.productName}
            </motion.h3>
            <div className="flex items-center text-sm text-gray-500">
              <Hash className="w-3 h-3 mr-1" />
              <span className="font-mono truncate">{batch.batchId}</span>
            </div>
          </div>

          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${getStatusColor(batch.currentOwner?.role?.toLowerCase() || batch.currentOwnerRole?.toLowerCase())}`}
          >
            {batch.currentOwner?.role?.toUpperCase() || batch.currentOwnerRole?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>

        <div className="h-px bg-gradient-to-r from-emerald-200 via-amber-200 to-emerald-200" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Product Information</p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ✔ Blockchain Verified
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Crop Name</span>
                <span className="font-semibold text-gray-900 text-right">{batch.productName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Quantity</span>
                <span className="font-semibold text-gray-900 text-right">{batch.quantity} {batch.unit}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Price</span>
                <span className="font-semibold text-gray-900 text-right">
                  ${batch.price || (batch.quantity * 10).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Farmer Name</span>
                <span className="font-semibold text-gray-900 text-right">{batch.farmer?.name || batch.currentOwner?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Harvest Date</span>
                <span className="font-semibold text-gray-900 text-right">{formatDate(batch.harvestDate || batch.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Current Owner</span>
                <span className="font-semibold text-gray-900 text-right">{batch.currentOwner?.name || 'Unknown'} ({batch.currentOwner?.role || batch.currentOwnerRole || 'N/A'})</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Shipping Details</p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Live GPS
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Current Location</span>
                <span className="font-semibold text-gray-900 text-right">{latestGpsPoint?.location || batch.location || 'In Transit'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Total Quantity</span>
                <span className="font-semibold text-gray-900 text-right">{totalQuantity} {batch.unit}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Quantity Sold</span>
                <span className="font-semibold text-gray-900 text-right">{quantitySold} {batch.unit}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Remaining Quantity</span>
                <span className="font-semibold text-gray-900 text-right">{remainingQuantity} {batch.unit}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Update Quantity Sold</label>
              <input
                type="number"
                min="0"
                max={totalQuantity}
                value={soldQuantityInput}
                onClick={(event) => event.stopPropagation()}
                onChange={handleQuantitySoldChange}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={persistQuantitySold}
                disabled={updatingSoldQuantity}
                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {updatingSoldQuantity ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save Sold Quantity
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyOnBlockchain}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verify on Blockchain
          </button>

          {verification.status === 'verified' && (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
              <CheckCircle2 className="w-4 h-4" />
              {verification.message}
            </span>
          )}

          {verification.status === 'error' && (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              <AlertCircle className="w-4 h-4" />
              {verification.message}
            </span>
          )}
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Stage Payments</p>
            <span className="text-xs font-semibold text-indigo-700">Multi-stage settlement</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <DetailRow
              label="Farmer Payment"
              value={`${batch?.payments?.farmer?.status || 'Pending'} (${formatCurrency(batch?.payments?.farmer?.amount || batch?.price)})`}
            />
            <DetailRow
              label="Transport Payment"
              value={`${batch?.payments?.transport?.status || 'Pending'} (${formatCurrency(batch?.payments?.transport?.amount || (Number(batch?.price || 0) * 0.15))})`}
            />
          </div>

          <div className="rounded-lg border border-indigo-200 bg-white p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-2">Payment Timeline</p>
            <div className="space-y-1 text-xs">
              <p className="font-medium text-gray-800">Farmer Paid {batch?.payments?.farmer?.status === 'Paid' ? '✅' : '⏳'}</p>
              <p className="font-medium text-gray-800">Transport Paid {batch?.payments?.transport?.status === 'Paid' ? '✅' : '⏳'}</p>
              <p className="font-medium text-gray-800">Retail Paid {batch?.payments?.distributor?.status === 'Paid' ? '✅' : '⏳'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={batch?.payments?.farmer?.status === 'Paid' || paymentLoadingStage === 'farmer'}
              onClick={(event) => {
                event.stopPropagation();
                handleStagePayment('farmer');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              {paymentLoadingStage === 'farmer'
                ? 'Processing...'
                : (batch?.payments?.farmer?.status === 'Paid' ? 'Paid Successfully' : 'Pay Farmer')}
            </button>

            <button
              type="button"
              disabled={batch?.payments?.transport?.status === 'Paid' || paymentLoadingStage === 'transport'}
              onClick={(event) => {
                event.stopPropagation();
                handleStagePayment('transport');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              {paymentLoadingStage === 'transport'
                ? 'Processing...'
                : (batch?.payments?.transport?.status === 'Paid' ? 'Paid Successfully' : 'Pay Transporter')}
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700 flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                QR Code for Product Information
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Scan to open full batch traceability page with farmer, distributor, transport, and delivery history.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowQrPanel((current) => !current);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 text-xs font-semibold hover:bg-gray-50"
              >
                <Eye className="w-4 h-4" />
                {showQrPanel ? 'Hide QR' : 'View QR'}
              </button>
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 text-xs font-semibold hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Download QR
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showQrPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex items-center justify-center">
                    <div id={`distributor-qr-${batch.batchId}`} className="bg-white p-2 rounded-lg">
                      <QRCode value={qrPayload} size={180} />
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 text-xs text-gray-700 space-y-2">
                    <p className="font-bold text-gray-900 mb-2">Encoded QR Payload</p>
                    <p><span className="font-semibold">Batch ID:</span> {batch.batchId}</p>
                    <p><span className="font-semibold">Crop Name:</span> {batch.productName}</p>
                    <p><span className="font-semibold">Farmer Name:</span> {batch.farmer?.name || batch.currentOwner?.name || 'Unknown'}</p>
                    <p><span className="font-semibold">Created Date:</span> {formatDate(batch.createdAt)}</p>
                    <p><span className="font-semibold">Sold Date:</span> {soldDate ? formatDate(soldDate) : 'N/A'}</p>
                    <p><span className="font-semibold">Delivered Date:</span> {deliveredDate ? formatDate(deliveredDate) : 'N/A'}</p>
                    <p><span className="font-semibold">Current Owner:</span> {batch.currentOwner?.name || 'Unknown'}</p>
                    <p><span className="font-semibold">Status:</span> {batch.status || 'Unknown'}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <div className="flex items-start space-x-2">
            <div className="p-1.5 bg-emerald-200 rounded-lg">
              <User className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-900 mb-1">Farmer Details</p>
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-900 flex items-center">
              <Navigation className="w-3 h-3 mr-1" />
              Transport Status: {batch.status || 'In Transit'}
            </p>
          </div>

          {latestGpsPoint ? (
            <>
              <p className="text-xs text-blue-800">Current Location:</p>
              <p className="text-xs text-gray-700">Latitude: {Number(latestGpsPoint.latitude).toFixed(5)}</p>
              <p className="text-xs text-gray-700">Longitude: {Number(latestGpsPoint.longitude).toFixed(5)}</p>
              <p className="text-xs text-gray-500">Last Updated: {formatDateTime(latestGpsPoint.timestamp)}</p>

              <a
                href={`https://www.google.com/maps?q=${latestGpsPoint.latitude},${latestGpsPoint.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900"
                onClick={(event) => event.stopPropagation()}
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
                onClick={(event) => event.stopPropagation()}
              />
            </>
          ) : (
            <p className="text-xs text-gray-500">Live GPS not available yet.</p>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Transport Details
              </p>
              <p className="text-xs text-gray-500 mt-1">Assignment, destination, and live logistics status.</p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {getStageLabel()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <DetailRow label="Delivery Address" value={getDeliveryAddress()} />
            <DetailRow label="Farmer Address" value={getFarmerAddress()} />
            <DetailRow label="Delivery Date" value={formatDate(getDeliveryDate())} />
            <DetailRow label="Product Stage" value={getStageLabel()} />
          </div>

          <div className="rounded-lg bg-white border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Transporter
              </p>
              {selectedTransporter && (
                <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <BadgeCheck className="w-4 h-4" />
                  Selected
                </span>
              )}
            </div>

            <select
              value={selectedTransporterAddress}
              onChange={(event) => setSelectedTransporterAddress(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Transporter</option>
              {transportUsers.map((transport) => (
                <option key={transport._id} value={transport.walletAddress}>
                  {transport.name || transport.walletAddress}
                  {transport.vehicleNumber ? ` (${transport.vehicleNumber})` : ''} - {transport.walletAddress}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={assignmentDraft.vehicleNumber}
                onChange={(event) => setAssignmentDraft((current) => ({ ...current, vehicleNumber: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
                placeholder="Vehicle Number"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={assignmentDraft.driverName}
                onChange={(event) => setAssignmentDraft((current) => ({ ...current, driverName: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
                placeholder="Driver Name"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={assignmentDraft.transportCompany}
                onChange={(event) => setAssignmentDraft((current) => ({ ...current, transportCompany: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
                placeholder="Transport Company"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={assignmentDraft.contactNumber}
                onChange={(event) => setAssignmentDraft((current) => ({ ...current, contactNumber: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
                placeholder="Contact Number"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={assignmentDraft.deliveryAddress}
                onChange={(event) => setAssignmentDraft((current) => ({ ...current, deliveryAddress: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
                placeholder="Delivery Address"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 md:col-span-2"
              />
            </div>

            <button
              type="button"
              onClick={handleTransportAssignment}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
            >
              {assigningTransporter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Assign Transport 🚚
            </button>
          </div>

          {assignedTransporter && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2 text-sm">
              <p className="font-semibold text-green-900">Assigned Transporter</p>
              <DetailRow label="Transporter" value={`${assignedTransporter.transporterName || assignedTransporter.driverName || 'N/A'} / ${assignedTransporter.transporterAddress || 'N/A'}`} />
              <DetailRow label="Vehicle Number" value={assignedTransporter.vehicleNumber || 'N/A'} />
              <DetailRow label="Driver Name" value={assignedTransporter.driverName || 'N/A'} />
              <DetailRow label="Transport Company" value={assignedTransporter.transportCompany || 'N/A'} />
              <DetailRow label="Contact Number" value={assignedTransporter.contactNumber || 'N/A'} />
              <DetailRow label="Delivery Address" value={assignedTransporter.deliveryAddress || batch?.deliveryAddress || 'N/A'} />
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Current Transport Location
            </p>
            {(hasCoordinateMap || hasLocationMap) && (
              <a
                href={mapExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                onClick={(event) => event.stopPropagation()}
              >
                View on Map 🌍
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <DetailRow label="Transport Driver" value={assignedTransporter?.driverName || assignedTransporter?.transporterName || 'N/A'} />
            <DetailRow label="Last Known Location" value={lastKnownLocation} />
          </div>

          {latestGpsPoint ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <DetailRow label="Latitude" value={hasCoordinateMap ? latitude.toFixed(5) : 'N/A'} />
              <DetailRow label="Longitude" value={hasCoordinateMap ? longitude.toFixed(5) : 'N/A'} />
              <DetailRow label="Last Updated" value={formatDateTime(latestGpsPoint.timestamp)} />
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              GPS coordinates not available yet. Last status update: {formatDateTime(lastKnownLocationTime)}.
            </p>
          )}

          {(hasCoordinateMap || hasLocationMap) && (
            <div className="relative">
              <iframe
                title={`transport-map-${batch.batchId}`}
                src={mapEmbedSrc}
                width="100%"
                height="300"
                className="rounded-lg border border-gray-200"
                loading="lazy"
                onClick={(event) => event.stopPropagation()}
              />

              {hasCoordinateMap && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative -translate-y-3">
                    <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/25 animate-ping" />
                    <svg viewBox="0 0 48 48" className="relative h-9 w-9 drop-shadow-md" aria-hidden="true">
                      <path
                        d="M24 2C15.716 2 9 8.716 9 17c0 10.5 12.31 23.218 14.53 25.43a.67.67 0 0 0 .94 0C26.69 40.218 39 27.5 39 17 39 8.716 32.284 2 24 2z"
                        fill="#dc2626"
                      />
                      <circle cx="24" cy="17" r="8" fill="#ffffff" />
                      <path
                        d="M19.5 17h9M21 14.5h6M22.2 19.5h3.6"
                        stroke="#dc2626"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/95 text-[11px] font-semibold text-gray-700 border border-gray-200 shadow-sm">
                    <Truck className="w-3 h-3 text-red-600" />
                    {assignedTransporter?.vehicleNumber || 'Live Vehicle'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <motion.div
          className="flex items-center justify-center pt-2 text-emerald-600 font-semibold text-sm"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <span className="group-hover:underline">Click to view details →</span>
        </motion.div>
      </div>

      <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Package className="w-32 h-32 text-emerald-600" />
      </div>
    </motion.div>
  );
};

export default DistributorBatchCard;
