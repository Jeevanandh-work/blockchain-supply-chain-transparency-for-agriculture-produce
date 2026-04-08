import React, { useContext, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Package,
  TrendingUp,
  Truck,
  LogOut,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  X,
  CheckCircle,
  AlertCircle,
  User as UserIcon,
  Calendar,
  MapPin,
  Weight,
  Hash,
  QrCode,
  Download,
  FileText,
  Upload,
  Edit,
  ShieldCheck,
  Save,
  Wallet,
  Phone,
  Mail,
  Building2,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { batchAPI, userAPI, transportAPI } from '../../services/api';
import DistributorBatchCard from '../../components/DistributorBatchCard';
import StatusTimeline from '../../components/StatusTimeline';
import LoadingSpinner from '../../components/LoadingSpinner';
import SupplyChainABI from '../../contracts/SupplyChain.json';

const emptyProfile = {
  name: '',
  email: '',
  phoneNumber: '',
  role: 'Distributor',
  walletAddress: '',
  password: '',
  organizationName: '',
  licenseNumber: '',
  issuingAuthority: '',
  profilePhoto: null,
  licenseDocument: null,
  profileCompleted: false,
  completionPercentage: 0,
};

const DistributorDashboard = () => {
  const { user, logout } = useContext(AuthContext);

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('batches');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');

  const [stats, setStats] = useState({
    available: 0,
    inProgress: 0,
    completed: 0,
    totalValue: 0,
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [transportUsers, setTransportUsers] = useState([]);
  const [transportAssignments, setTransportAssignments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('agricchain-transport-assignments') || '{}');
    } catch (error) {
      return {};
    }
  });
  const [transferForm, setTransferForm] = useState({
    toAddress: '',
    location: '',
    statusMessage: 'Picked up from farmer and ready for transport',
    deliveryAddress: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileRecord, setProfileRecord] = useState(emptyProfile);
  const [profileForm, setProfileForm] = useState(emptyProfile);

  const profileStorageKey = useMemo(
    () => `agricchain-distributor-profile-${user?.id || user?.email || 'default'}`,
    [user?.id, user?.email]
  );

  const completedBatches = useMemo(() => {
    return batches.filter((batch) => {
      const stage = String(batch.status || batch.currentOwnerRole || '').toLowerCase();
      return stage === 'delivered' || stage === 'completed' || stage === 'final delivery';
    });
  }, [batches]);

  const liveTransportPoint = useMemo(() => {
    const batchesWithGps = batches
      .filter((batch) => batch.gpsTracking && batch.gpsTracking.length > 0)
      .map((batch) => ({
        batchId: batch.batchId,
        productName: batch.productName,
        point: batch.gpsTracking[batch.gpsTracking.length - 1],
      }))
      .filter((entry) => entry.point && entry.point.latitude !== undefined && entry.point.longitude !== undefined);

    return batchesWithGps[0] || null;
  }, [batches]);

  const distributorPaymentHistory = useMemo(() => {
    return batches
      .flatMap((batch) =>
        (batch.paymentHistory || [])
          .filter((entry) => {
            const paidBy = String(entry?.paidByRole || '').toLowerCase();
            const paidTo = String(entry?.paidToRole || '').toLowerCase();
            return paidBy === 'distributor' || paidTo === 'distributor';
          })
          .map((entry) => ({
            ...entry,
            batchId: batch.batchId,
            productName: batch.productName,
          }))
      )
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  }, [batches]);

  useEffect(() => {
    localStorage.setItem('agricchain-transport-assignments', JSON.stringify(transportAssignments));
  }, [transportAssignments]);

  useEffect(() => {
    fetchBatches({ showLoader: true });
    fetchTransportUsers();
    loadProfile();

    const intervalId = setInterval(() => {
      fetchBatches();
    }, 10000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateProfileCompletion = (profile) => {
    const checks = [
      profile.name,
      profile.email,
      profile.phoneNumber,
      profile.walletAddress,
      profile.password,
      profile.organizationName,
      profile.licenseNumber,
      profile.issuingAuthority,
      profile.profilePhoto?.fileData,
      profile.licenseDocument?.fileData,
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 4000);
  };

  const getReadOnlyContract = async () => {
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || SupplyChainABI.address;
    if (!contractAddress) {
      return null;
    }

    const provider = window.ethereum
      ? new ethers.BrowserProvider(window.ethereum)
      : new ethers.JsonRpcProvider(process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545');

    return new ethers.Contract(contractAddress, SupplyChainABI.abi, provider);
  };

  const readTransportAssignment = async (batchId) => {
    try {
      const contract = await getReadOnlyContract();
      if (!contract || typeof contract.getTransportAssignment !== 'function') {
        return null;
      }

      const assignment = await contract.getTransportAssignment(batchId);
      return {
        transporterAddress: assignment[0],
        assignedBy: assignment[1],
        assignedAt: Number(assignment[2]),
        exists: assignment[3],
      };
    } catch (error) {
      console.warn('Read transport assignment failed:', error.message);
      return null;
    }
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await userAPI.getProfile();
      if (!response?.success) return;

      const backendProfile = response.data || {};
      const savedProfile = JSON.parse(localStorage.getItem(profileStorageKey) || '{}');
      const { password: _ignoredPassword, ...safeSavedProfile } = savedProfile;
      const backendDistributorProfile = backendProfile.distributorProfile || {};

      const mergedProfile = {
        ...emptyProfile,
        name: backendProfile.name || user?.name || '',
        email: backendProfile.email || user?.email || '',
        phoneNumber: backendProfile.phoneNumber || '',
        walletAddress: backendProfile.walletAddress || user?.walletAddress || '',
        organizationName: backendProfile.organization || '',
        ...backendDistributorProfile,
        ...safeSavedProfile,
        role: 'Distributor',
      };

      const completion = calculateProfileCompletion(mergedProfile);
      mergedProfile.completionPercentage = completion;
      mergedProfile.profileCompleted = completion === 100;

      setProfileRecord(mergedProfile);
      setProfileForm(mergedProfile);

      if (completion < 100) {
        setProfileNotice('Please complete your distributor profile to unlock the full dashboard experience.');
        setIsEditingProfile(true);
      }
    } catch (error) {
      console.error('Load profile error:', error);
      setProfileError('Failed to load profile. Please refresh.');
      const fallbackProfile = {
        ...emptyProfile,
        name: user?.name || '',
        email: user?.email || '',
        walletAddress: user?.walletAddress || '',
      };
      setProfileRecord(fallbackProfile);
      setProfileForm(fallbackProfile);
      setIsEditingProfile(true);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchBatches = async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await batchAPI.getAvailableBatches();

      if (response.success) {
        const batchData = response.data || [];

        // Pull freshest GPS/status stream for batches that are in transport flow.
        const trackingTargets = batchData.filter(
          (batch) =>
            batch.currentOwnerRole === 'Transport' ||
            Boolean(transportAssignments[batch.batchId]?.transporterAddress)
        );

        const trackingEntries = await Promise.all(
          trackingTargets.map(async (batch) => {
            try {
              const trackingResponse = await transportAPI.getTracking(batch.batchId);
              if (!trackingResponse?.success) return null;

              return [
                batch.batchId,
                {
                  gpsTracking: trackingResponse.data?.gpsTracking || [],
                  location: trackingResponse.data?.currentLocation || batch.location,
                  statusHistory: trackingResponse.data?.statusHistory || batch.statusHistory,
                },
              ];
            } catch (error) {
              return null;
            }
          })
        );

        const trackingMap = trackingEntries.reduce((accumulator, entry) => {
          if (!entry) return accumulator;
          const [batchId, trackingData] = entry;
          accumulator[batchId] = trackingData;
          return accumulator;
        }, {});

        const enrichedBatches = batchData.map((batch) => {
          const tracking = trackingMap[batch.batchId];
          if (!tracking) return batch;

          const incomingPoints = tracking.gpsTracking || [];
          const existingPoints = batch.gpsTracking || [];
          const useIncoming = incomingPoints.length >= existingPoints.length;

          return {
            ...batch,
            gpsTracking: useIncoming ? incomingPoints : existingPoints,
            location: tracking.location || batch.location,
            statusHistory: tracking.statusHistory || batch.statusHistory,
          };
        });

        const onChainAssignments = await Promise.all(
          batchData.map(async (batch) => {
            const assignment = await readTransportAssignment(batch.batchId);
            if (assignment?.exists) {
              return [batch.batchId, assignment];
            }
            return null;
          })
        );

        const assignmentMap = onChainAssignments.reduce((accumulator, entry) => {
          if (!entry) return accumulator;
          const [batchId, assignment] = entry;
          const batchMatch = batchData.find((item) => item.batchId === batchId);
          accumulator[batchId] = {
            ...(transportAssignments[batchId] || {}),
            transporterAddress: assignment.transporterAddress,
            assignedBy: assignment.assignedBy,
            assignedAt: assignment.assignedAt ? new Date(assignment.assignedAt * 1000).toISOString() : '',
            exists: assignment.exists,
            deliveryAddress:
              transportAssignments[batchId]?.deliveryAddress ||
              batchMatch?.deliveryAddress ||
              '',
          };
          return accumulator;
        }, {});

        const mergedAssignments = {
          ...transportAssignments,
          ...assignmentMap,
        };

        // Build a transport-driver latest GPS index from all visible transport batches.
        const driverLatestGps = enrichedBatches.reduce((accumulator, batch) => {
          const driverWallet = String(batch?.currentOwner?.walletAddress || '').toLowerCase();
          const points = batch?.gpsTracking || [];
          if (batch.currentOwnerRole !== 'Transport' || !driverWallet || points.length === 0) {
            return accumulator;
          }

          const latestPoint = points[points.length - 1];
          if (!latestPoint) return accumulator;

          const existingPoint = accumulator[driverWallet];
          const existingTime = existingPoint?.timestamp ? new Date(existingPoint.timestamp).getTime() : 0;
          const candidateTime = latestPoint?.timestamp ? new Date(latestPoint.timestamp).getTime() : Date.now();

          if (!existingPoint || candidateTime >= existingTime) {
            accumulator[driverWallet] = latestPoint;
          }

          return accumulator;
        }, {});

        // If an assigned batch has no GPS yet, reuse assigned driver's most recent GPS point.
        const driverSyncedBatches = enrichedBatches.map((batch) => {
          const hasGps = Array.isArray(batch?.gpsTracking) && batch.gpsTracking.length > 0;
          if (hasGps) return batch;

          const assignedWallet = String(
            mergedAssignments[batch.batchId]?.transporterAddress || batch?.transportAssignment?.transporterAddress || ''
          ).toLowerCase();

          if (!assignedWallet) return batch;

          const fallbackPoint = driverLatestGps[assignedWallet];
          if (!fallbackPoint) return batch;

          return {
            ...batch,
            gpsTracking: [fallbackPoint],
            location: fallbackPoint.location || batch.location,
          };
        });

        setBatches(driverSyncedBatches);

        if (Object.keys(assignmentMap).length > 0) {
          setTransportAssignments((current) => ({
            ...current,
            ...assignmentMap,
          }));
        }

        const available = driverSyncedBatches.filter((batch) => batch.currentOwnerRole === 'Farmer').length;
        const inProgress = driverSyncedBatches.filter((batch) => batch.currentOwnerRole === 'Distributor').length;
        const completed = driverSyncedBatches.filter(
          (batch) => batch.currentOwnerRole !== 'Farmer' && batch.currentOwnerRole !== 'Distributor'
        ).length;
        const totalValue = driverSyncedBatches.reduce((sum, batch) => sum + (batch.price || batch.quantity * 10), 0);

        setStats({ available, inProgress, completed, totalValue });
      }
    } catch (error) {
      const errorMessage = error?.message || error?.error || 'Failed to fetch batches';
      showNotification('error', errorMessage);
      console.error('Fetch error:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const fetchTransportUsers = async () => {
    try {
      const response = await userAPI.getUsersByRole('transport');
      if (response.success) {
        const roleUsers = response.data || [];

        const inferredUsers = (batches || [])
          .filter((batch) => batch?.currentOwnerRole === 'Transport' && batch?.currentOwner?.walletAddress)
          .map((batch) => ({
            _id: batch.currentOwner._id || batch.currentOwner.walletAddress,
            name: batch.currentOwner.name || 'Transport Partner',
            email: batch.currentOwner.email || '',
            phoneNumber: batch.currentOwner.phoneNumber || '',
            organization: batch.currentOwner.organization || '',
            walletAddress: batch.currentOwner.walletAddress,
            role: 'Transport',
          }));

        const mergedUsers = [...roleUsers, ...inferredUsers].reduce((accumulator, userItem) => {
          const wallet = String(userItem?.walletAddress || '').toLowerCase();
          if (!wallet || accumulator[wallet]) return accumulator;
          accumulator[wallet] = userItem;
          return accumulator;
        }, {});

        const usersWithVehicle = Object.values(mergedUsers).map((transportUser) => {
          const assignment = Object.values(transportAssignments || {}).find(
            (item) => String(item?.transporterAddress || '').toLowerCase() === String(transportUser?.walletAddress || '').toLowerCase()
          );

          return {
            ...transportUser,
            vehicleNumber: assignment?.vehicleNumber || '',
          };
        });

        setTransportUsers(usersWithVehicle);
      }
    } catch (error) {
      console.error('Error fetching transport users:', error);
    }
  };

  const handleAssignTransporter = async ({
    batchId,
    transporterAddress,
    transporterName,
    vehicleNumber,
    driverName,
    transportCompany,
    contactNumber,
    deliveryAddress,
  }) => {
    if (!transporterAddress) {
      throw new Error('Transporter address is required');
    }

    let transactionHash = '';
    let onChainAssignment = null;

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || SupplyChainABI.address;

        if (contractAddress) {
          const contract = new ethers.Contract(contractAddress, SupplyChainABI.abi, signer);

          if (typeof contract.assignTransporter === 'function') {
            const tx = await contract.assignTransporter(batchId, transporterAddress);
            await tx.wait();
            transactionHash = tx.hash || '';
          } else if (typeof contract.transferBatch === 'function') {
            const tx = await contract.transferBatch(
              batchId,
              transporterAddress,
              'Transporter assigned from distributor dashboard'
            );
            await tx.wait();
            transactionHash = tx.hash || '';
          }
        }
      }

      onChainAssignment = await readTransportAssignment(batchId);
    } catch (error) {
      console.warn('Blockchain transport assignment fallback:', error.message);
    }

    const nextAssignments = {
      ...transportAssignments,
      [batchId]: {
        transporterAddress: onChainAssignment?.transporterAddress || transporterAddress,
        transporterName,
        vehicleNumber,
        driverName,
        transportCompany,
        contactNumber,
        deliveryAddress,
        assignedAt: onChainAssignment?.assignedAt ? new Date(onChainAssignment.assignedAt * 1000).toISOString() : new Date().toISOString(),
        transactionHash,
        assignedBy: onChainAssignment?.assignedBy || '',
        exists: onChainAssignment?.exists || false,
      },
    };

    const batchForAssignment = batches.find((item) => item.batchId === batchId);
    const batchStatus = String(batchForAssignment?.status || '').toLowerCase();
    if (['delivered', 'completed', 'final delivery'].includes(batchStatus)) {
      throw new Error('This batch is already delivered/completed and cannot be assigned again');
    }

    if (batchForAssignment?.currentOwnerRole !== 'Transport') {
      // Batch must be owned by Transport for transport-side GPS sync to publish live coordinates.
      const transferResponse = await batchAPI.transferBatch(
        batchId,
        transporterAddress,
        `Assigned to transporter ${transporterName || transporterAddress}`,
        deliveryAddress,
        {
          vehicleNumber,
          driverName,
          transportCompany,
          contactNumber,
        }
      );

      if (!transferResponse?.success) {
        throw new Error('Failed to transfer batch to transporter. Live GPS cannot start yet.');
      }
    }

    setTransportAssignments(nextAssignments);
    localStorage.setItem('agricchain-transport-assignments', JSON.stringify(nextAssignments));
    showNotification('success', 'Transporter assigned. Waiting for live GPS updates from transport dashboard.');
    fetchBatches();
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
      statusMessage: 'Picked up from farmer and ready for transport',
      deliveryAddress: '',
    });
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();

    if (!transferForm.toAddress || !transferForm.deliveryAddress) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const selectedStatus = String(selectedBatch?.status || '').toLowerCase();
      if (['delivered', 'completed', 'final delivery'].includes(selectedStatus)) {
        throw new Error('This batch is already delivered/completed and cannot be transferred');
      }

      const response = await batchAPI.transferBatch(
        selectedBatch.batchId,
        transferForm.toAddress,
        transferForm.statusMessage,
        transferForm.deliveryAddress
      );

      if (response.success) {
        showNotification('success', `Batch ${selectedBatch.batchId} transferred to transporter successfully!`);
        setShowTransferModal(false);
        setSelectedBatch(null);
        setTransferForm({ toAddress: '', location: '', statusMessage: 'Picked up from farmer and ready for transport', deliveryAddress: '' });
        fetchBatches();
      } else {
        throw new Error(response.message || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      showNotification('error', error?.message || 'Transfer failed. Please check all fields and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleSelectTransport = (transportUser) => {
    setTransferForm((current) => ({ ...current, toAddress: transportUser.walletAddress }));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBatches({ showLoader: true });
  };

  const filterText = searchTerm.trim().toLowerCase();
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.batchId?.toLowerCase().includes(filterText) ||
      batch.productName?.toLowerCase().includes(filterText) ||
      batch.farmer?.name?.toLowerCase().includes(filterText);

    const matchesFilter =
      filterStatus === 'all' ||
      (batch.currentOwner?.role || batch.currentOwnerRole || '').toLowerCase() === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const filteredDistributorPayments = distributorPaymentHistory.filter((entry) => {
    const status = String(entry?.status || 'Paid').toLowerCase();
    const paidTime = new Date(entry?.paidAt || 0).getTime();
    const fromTime = paymentFromDate ? new Date(`${paymentFromDate}T00:00:00`).getTime() : null;
    const toTime = paymentToDate ? new Date(`${paymentToDate}T23:59:59`).getTime() : null;

    const matchesStatus = paymentStatusFilter === 'all' || status === paymentStatusFilter;
    const matchesFrom = !fromTime || paidTime >= fromTime;
    const matchesTo = !toTime || paidTime <= toTime;

    return matchesStatus && matchesFrom && matchesTo;
  });

  const exportDistributorPaymentsCsv = () => {
    const rows = [
      ['Batch ID', 'Amount', 'Paid To / Received From', 'Payment ID', 'Date', 'Status'],
      ...filteredDistributorPayments.map((entry) => [
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
    link.download = `distributor-payments-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileError('');
    setProfileForm((current) => ({ ...current, [name]: value }));
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const handleFileUpload = async (event, fieldName) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileData = await toBase64(file);
      setProfileForm((current) => ({
        ...current,
        [fieldName]: {
          fileName: file.name,
          fileType: file.type,
          fileData,
        },
      }));
    } catch (error) {
      console.error('File upload error:', error);
      setProfileError('Failed to process uploaded file');
    }
  };

  const validateProfile = () => {
    const requiredFields = [
      ['name', 'Name'],
      ['email', 'Email'],
      ['phoneNumber', 'Phone Number'],
      ['walletAddress', 'Wallet Address'],
      ['password', 'Password'],
      ['organizationName', 'Organization Name'],
      ['licenseNumber', 'License Number'],
      ['issuingAuthority', 'Issuing Authority'],
    ];

    for (const [field, label] of requiredFields) {
      if (!String(profileForm[field] || '').trim()) {
        return `${label} is required`;
      }
    }

    if (!/^\S+@\S+\.\S+$/.test(profileForm.email)) {
      return 'Please provide a valid email address';
    }

    const normalizedPhone = String(profileForm.phoneNumber).replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
      return 'Please provide a valid phone number';
    }

    if (!profileForm.licenseDocument?.fileData) {
      return 'License document is required';
    }

    if (!profileForm.profilePhoto?.fileData) {
      return 'Profile photo is required';
    }

    return '';
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    const validationError = validateProfile();
    if (validationError) {
      setProfileError(validationError);
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError('');

      await userAPI.updateProfile({
        name: profileForm.name,
        phoneNumber: profileForm.phoneNumber,
        organization: profileForm.organizationName,
        distributorProfile: {
          role: 'Distributor',
          name: profileForm.name,
          email: profileForm.email,
          phoneNumber: profileForm.phoneNumber,
          walletAddress: profileForm.walletAddress,
          organizationName: profileForm.organizationName,
          licenseNumber: profileForm.licenseNumber,
          issuingAuthority: profileForm.issuingAuthority,
          profilePhoto: profileForm.profilePhoto,
          licenseDocument: profileForm.licenseDocument,
        },
      });

      const completionPercentage = calculateProfileCompletion(profileForm);
      const savedProfile = {
        ...profileForm,
        role: 'Distributor',
        profileCompleted: completionPercentage === 100,
        completionPercentage,
      };

      setProfileRecord({ ...savedProfile, password: '' });
      setProfileForm(savedProfile);
      localStorage.setItem(profileStorageKey, JSON.stringify({ ...savedProfile, password: '' }));
      setIsEditingProfile(false);
      setProfileNotice('Distributor profile saved successfully.');
      showNotification('success', 'Profile saved successfully');
    } catch (error) {
      console.error('Save profile error:', error);
      setProfileError(error?.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleStartEditing = () => {
    setProfileError('');
    setIsEditingProfile(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.6, when: 'beforeChildren', staggerChildren: 0.1 },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: [0.6, -0.05, 0.01, 0.99] } },
    exit: { opacity: 0, scale: 0.8, y: 50, transition: { duration: 0.3 } },
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      <motion.header className="bg-white border-b border-gray-200 shadow-sm" variants={headerVariants}>
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
                <h1 className="text-2xl font-bold text-gray-900">AgriChain</h1>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Distributor Dashboard 📦</h2>
          <p className="text-gray-600 mt-2">
            Accept and manage batches from farmers, transfer to transport partners
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 mb-8">
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
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg font-semibold border transition-colors ${
              activeTab === 'profile'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Profile
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

        {activeTab === 'batches' ? (
          <>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Available Batches</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.available}</p>
                  </div>
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">In Progress</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
                  </div>
                  <div className="bg-yellow-500 p-3 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
                  </div>
                  <div className="bg-green-500 p-3 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Value</p>
                    <p className="text-3xl font-bold text-gray-900">${stats.totalValue.toFixed(0)}</p>
                  </div>
                  <div className="bg-purple-500 p-3 rounded-lg">
                    <Truck className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            </motion.div>

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
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <select
                    value={filterStatus}
                    onChange={(event) => setFilterStatus(event.target.value)}
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

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="flex items-center justify-between gap-3 mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Available Batches ({filteredBatches.length})</h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                  {completedBatches.length} completed
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
                <div>
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {filteredBatches.map((batch, index) => (
                        <DistributorBatchCard
                          key={batch._id}
                          batch={batch}
                          onViewDetails={handleViewDetails}
                          onQuantitySoldUpdate={fetchBatches}
                          transportUsers={transportUsers}
                          transportAssignment={transportAssignments[batch.batchId]}
                          onAssignTransporter={handleAssignTransporter}
                          onPaymentComplete={fetchBatches}
                          index={index}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900">Payment History</h4>
                      <span className="text-xs font-semibold text-indigo-700">Distributor Ledger</span>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {distributorPaymentHistory.length === 0 ? (
                        <p className="text-sm text-gray-500">No payment records yet.</p>
                      ) : (
                        distributorPaymentHistory.slice(0, 8).map((entry, idx) => (
                          <div key={`${entry.batchId}-${entry.paymentId || idx}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            <p className="font-medium text-gray-900">{entry.batchId} - {entry.productName}</p>
                            <p className="text-xs text-gray-600 mt-1">{entry.paidByRole} to {entry.paidToRole}</p>
                            <p className="text-xs text-gray-600">Method: {entry.paymentMethod || 'Razorpay / Mock Payment'}</p>
                            <p className="text-xs text-gray-500">{new Date(entry.paidAt).toLocaleString('en-IN')}</p>
                            <p className="font-semibold text-indigo-700">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900">Completed Batches</h4>
                      <span className="text-sm font-semibold text-green-700">Total Completed: {completedBatches.length}</span>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {completedBatches.length === 0 ? (
                        <p className="text-sm text-gray-500">No completed batches yet.</p>
                      ) : (
                        completedBatches.map((batch) => (
                          <div key={batch._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            <span className="font-mono text-gray-800">{batch.batchId}</span>
                            <span className="text-green-700 font-semibold">✔</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900">Live Map View</h4>
                      <span className="text-xs font-semibold text-gray-500">Transport vehicles</span>
                    </div>

                    {liveTransportPoint ? (
                      <div className="space-y-4">
                        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm space-y-1">
                          <p className="font-semibold text-blue-900">{liveTransportPoint.productName}</p>
                          <p className="text-blue-800">Batch: {liveTransportPoint.batchId}</p>
                          <p className="text-blue-800">Latitude: {Number(liveTransportPoint.point.latitude).toFixed(5)}</p>
                          <p className="text-blue-800">Longitude: {Number(liveTransportPoint.point.longitude).toFixed(5)}</p>
                          <p className="text-blue-700 text-xs">Last Updated: {formatDate(liveTransportPoint.point.timestamp)}</p>
                        </div>
                        <iframe
                          title="distributor-live-map"
                          src={`https://maps.google.com/maps?q=${liveTransportPoint.point.latitude},${liveTransportPoint.point.longitude}&z=13&output=embed`}
                          width="100%"
                          height="300"
                          className="rounded-lg border border-gray-200"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                        Live transport location will appear here once a vehicle is assigned and tracked.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : activeTab === 'profile' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Distributor Profile</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">Account & License Details</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Save your distributor profile, upload documents, and keep your account ready for transfers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileError('');
                    setIsEditingProfile(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>

              {profileNotice && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {profileNotice}
                </div>
              )}

              {profileError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Profile Completion Status</span>
                  <span className="text-sm font-bold text-gray-900">{profileRecord.completionPercentage || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all"
                    style={{ width: `${profileRecord.completionPercentage || 0}%` }}
                  />
                </div>
              </div>

              {profileLoading ? (
                <div className="py-20 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ProfileInput label="Name" icon={UserIcon} name="name" value={profileForm.name} onChange={handleProfileChange} />
                  <ProfileInput label="Email" icon={Mail} name="email" value={profileForm.email} onChange={handleProfileChange} type="email" />
                  <ProfileInput label="Phone Number" icon={Phone} name="phoneNumber" value={profileForm.phoneNumber} onChange={handleProfileChange} />
                  <ProfileInput label="Role" icon={ShieldCheck} name="role" value="Distributor" disabled />
                  <ProfileInput label="Wallet Address" icon={Wallet} name="walletAddress" value={profileForm.walletAddress} onChange={handleProfileChange} />
                  <ProfileInput label="Password" icon={LockIcon} name="password" value={profileForm.password} onChange={handleProfileChange} type="password" />
                  <ProfileInput label="Organization Name" icon={Building2} name="organizationName" value={profileForm.organizationName} onChange={handleProfileChange} />
                  <ProfileInput label="License Number" icon={FileText} name="licenseNumber" value={profileForm.licenseNumber} onChange={handleProfileChange} />
                  <ProfileInput label="Issuing Authority" icon={Building2} name="issuingAuthority" value={profileForm.issuingAuthority} onChange={handleProfileChange} />

                  <div className="md:col-span-2 space-y-3">
                    <FileUploadCard
                      label="Upload Profile Photo"
                      description="Upload a clear profile photo"
                      onChange={(event) => handleFileUpload(event, 'profilePhoto')}
                      file={profileForm.profilePhoto}
                      accept="image/*"
                    />
                    <FileUploadCard
                      label="Upload License Document"
                      description="Upload distributor license or registration proof"
                      onChange={(event) => handleFileUpload(event, 'licenseDocument')}
                      file={profileForm.licenseDocument}
                      accept="application/pdf,image/*"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ProfileViewItem icon={UserIcon} label="Name" value={profileRecord.name} />
                  <ProfileViewItem icon={Mail} label="Email" value={profileRecord.email} />
                  <ProfileViewItem icon={Phone} label="Phone Number" value={profileRecord.phoneNumber} />
                  <ProfileViewItem icon={ShieldCheck} label="Role" value={profileRecord.role || 'Distributor'} />
                  <ProfileViewItem icon={Wallet} label="Wallet Address" value={profileRecord.walletAddress} mono />
                  <ProfileViewItem icon={Building2} label="Organization Name" value={profileRecord.organizationName} />
                  <ProfileViewItem icon={FileText} label="License Number" value={profileRecord.licenseNumber} />
                  <ProfileViewItem icon={Building2} label="Issuing Authority" value={profileRecord.issuingAuthority} />
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <PreviewCard title="Profile Photo" file={profileRecord.profilePhoto} emptyText="No profile photo uploaded" />
                    <PreviewCard title="License Document" file={profileRecord.licenseDocument} emptyText="No license document uploaded" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h4 className="text-xl font-bold text-gray-900 mb-4">Profile Summary</h4>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between gap-3">
                    <span>Completion</span>
                    <span className="font-semibold">{profileRecord.completionPercentage || 0}%</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Status</span>
                    <span className="font-semibold">{profileRecord.profileCompleted ? 'Complete' : 'Incomplete'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Wallet</span>
                    <span className="font-mono text-xs break-all text-right">{profileRecord.walletAddress || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>License</span>
                    <span className="font-semibold">{profileRecord.licenseNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-start gap-3">
                  <div className="bg-white/15 p-3 rounded-xl">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">Distributor Ready</h4>
                    <p className="text-green-50 mt-2 text-sm leading-6">
                      Your profile can now be used for transfers, QR generation, blockchain verification, and shipping management.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Payments</h3>
              <button
                type="button"
                onClick={exportDistributorPaymentsCsv}
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

            {filteredDistributorPayments.length === 0 ? (
              <p className="text-sm text-gray-600">No payment records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 pr-3">Batch ID</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Paid To / Received From</th>
                      <th className="py-2 pr-3">Payment Method</th>
                      <th className="py-2 pr-3">Payment ID</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDistributorPayments.map((entry, idx) => (
                      <tr key={`${entry.batchId}-${entry.paymentId || idx}`} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-mono">{entry.batchId}</td>
                        <td className="py-2 pr-3">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 pr-3">{entry.paidByRole || 'N/A'} to {entry.paidToRole || 'N/A'}</td>
                        <td className="py-2 pr-3">{entry.paymentMethod || 'Razorpay / Mock Payment'}</td>
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
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50"
          >
            <div
              className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
                notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              <span className="font-semibold">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={(event) => event.stopPropagation()}
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
                      <div className="space-y-3 bg-gray-50 rounded-lg p-4 text-sm">
                        <DetailRow label="Quantity" value={`${selectedBatch.quantity} ${selectedBatch.unit}`} />
                        <DetailRow label="Value" value={`$${selectedBatch.price || (selectedBatch.quantity * 10).toFixed(2)}`} />
                        <DetailRow label="Origin" value={selectedBatch.origin || 'Farm'} />
                        <DetailRow label="Status" value={selectedBatch.currentOwner?.role?.toUpperCase() || 'UNKNOWN'} />
                        <DetailRow label="Current Location" value={selectedBatch.location || 'In Transit'} />
                        <DetailRow label="Created" value={formatDate(selectedBatch.createdAt)} />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Farmer Details</h4>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="font-bold text-gray-900 text-lg">{selectedBatch.farmer?.name || selectedBatch.currentOwner?.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{selectedBatch.farmer?.email || selectedBatch.currentOwner?.email}</p>
                        <p className="text-xs text-gray-500 font-mono mt-2">{selectedBatch.farmer?.walletAddress || selectedBatch.currentOwner?.walletAddress}</p>
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
                  {selectedBatch.currentOwner?.role === 'Farmer' && (
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
              onClick={(event) => event.stopPropagation()}
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
                  <label className="block text-sm font-bold text-gray-900 mb-2">Select Transport Partner *</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border-2 border-gray-300 rounded-lg p-3">
                    {transportUsers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No transport partners available</p>
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
                          <p className="text-xs text-gray-500 font-mono mt-1">{transport.walletAddress?.substring(0, 20)}...</p>
                        </motion.div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Or enter wallet address manually below</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Recipient Wallet Address *</label>
                  <input
                    type="text"
                    value={transferForm.toAddress}
                    onChange={(event) => setTransferForm((current) => ({ ...current, toAddress: event.target.value }))}
                    placeholder="0x..."
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Delivery Address *</label>
                  <input
                    type="text"
                    value={transferForm.deliveryAddress}
                    onChange={(event) => setTransferForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
                    placeholder="e.g., Retailer Store Address, Final Destination"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Current Location</label>
                  <input
                    type="text"
                    value={transferForm.location}
                    onChange={(event) => setTransferForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="e.g., Distribution Center, Mumbai"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Status Update Message</label>
                  <textarea
                    value={transferForm.statusMessage}
                    onChange={(event) => setTransferForm((current) => ({ ...current, statusMessage: event.target.value }))}
                    placeholder="Add a status update message..."
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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

const ProfileInput = ({ label, icon: Icon, name, value, onChange, type = 'text', disabled = false }) => (
  <label className="block">
    <span className="block text-sm font-semibold text-gray-700 mb-2">{label}</span>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
          disabled ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-900'
        } border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500`}
      />
    </div>
  </label>
);

const ProfileViewItem = ({ icon: Icon, label, value, mono = false }) => (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
    <div className="flex items-start gap-3">
      <div className="bg-green-100 p-2 rounded-lg">
        <Icon className="w-4 h-4 text-green-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
        <p className={`mt-1 text-sm font-semibold text-gray-900 break-all ${mono ? 'font-mono text-xs' : ''}`}>
          {value || 'N/A'}
        </p>
      </div>
    </div>
  </div>
);

const FileUploadCard = ({ label, description, onChange, file, accept }) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
    <div className="flex items-start gap-3">
      <div className="bg-white p-2 rounded-lg border border-gray-200">
        <Upload className="w-4 h-4 text-green-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
        <input type="file" accept={accept} onChange={onChange} className="mt-3 block w-full text-sm text-gray-600" />
        {file?.fileName && (
          <p className="mt-2 text-xs text-green-700 font-semibold">Uploaded: {file.fileName}</p>
        )}
      </div>
    </div>
  </div>
);

const PreviewCard = ({ title, file, emptyText }) => (
  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
    <p className="text-sm font-semibold text-gray-900 mb-3">{title}</p>
    {file?.fileData ? (
      <div className="space-y-3">
        {file.fileType?.startsWith('image/') ? (
          <img src={file.fileData} alt={title} className="w-full max-h-48 object-cover rounded-lg border border-gray-200" />
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FileText className="w-4 h-4 text-green-600" />
            <span className="break-all">{file.fileName || 'Document uploaded'}</span>
          </div>
        )}
      </div>
    ) : (
      <p className="text-sm text-gray-500">{emptyText}</p>
    )}
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between gap-3">
    <span className="text-gray-600 font-medium">{label}:</span>
    <span className="font-bold text-gray-900 text-right">{value}</span>
  </div>
);

const LockIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default DistributorDashboard;
