import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Package,
  Plus,
  Clock,
  CheckCircle,
  Download,
  QrCode,
  User,
  AlertCircle,
  FileText,
  Edit,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { batchAPI, userAPI } from '../../services/api';

const FarmerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('batches');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    delivered: 0,
  });

  const [profile, setProfile] = useState({
    farmerProfile: {
      fullName: '',
      mobileNumber: '',
      aadhaarNumber: '',
      licenseNumber: '',
      issuingAuthority: '',
      issueDate: '',
      expiryDate: '',
      farmLocation: '',
      landArea: '',
      cropType: '',
      licenseDocument: null,
      idProofDocument: null,
      licenseStatus: 'Pending',
      profileCompleted: false,
      completionPercentage: 0,
    },
  });

  const [profileForm, setProfileForm] = useState({
    fullName: '',
    mobileNumber: '',
    aadhaarNumber: '',
    licenseNumber: '',
    issuingAuthority: '',
    issueDate: '',
    expiryDate: '',
    farmLocation: '',
    landArea: '',
    cropType: '',
    licenseDocument: null,
    idProofDocument: null,
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    await Promise.all([fetchBatches(), fetchProfile(), fetchPaymentHistory()]);
    setLoading(false);
  };

  const fetchBatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/batch/my/batches`);
      if (response.data.success) {
        const batchesData = response.data.data;
        setBatches(batchesData);

        setStats({
          total: batchesData.length,
          active: batchesData.filter((b) => ['Created', 'In Transit'].includes(b.status)).length,
          delivered: batchesData.filter((b) => b.status === 'Delivered').length,
        });
      }
    } catch (error) {
      console.error('Fetch batches error:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await userAPI.getProfile();
      if (response.success) {
        const profileData = response.data || {};
        const farmerProfile = profileData.farmerProfile || {};

        setProfile({ farmerProfile });
        setProfileForm({
          fullName: farmerProfile.fullName || profileData.name || '',
          mobileNumber: farmerProfile.mobileNumber || profileData.phoneNumber || '',
          aadhaarNumber: farmerProfile.aadhaarNumber || '',
          licenseNumber: farmerProfile.licenseNumber || '',
          issuingAuthority: farmerProfile.issuingAuthority || '',
          issueDate: farmerProfile.issueDate ? String(farmerProfile.issueDate).slice(0, 10) : '',
          expiryDate: farmerProfile.expiryDate ? String(farmerProfile.expiryDate).slice(0, 10) : '',
          farmLocation: farmerProfile.farmLocation || '',
          landArea: farmerProfile.landArea || '',
          cropType: farmerProfile.cropType || '',
          licenseDocument: farmerProfile.licenseDocument || null,
          idProofDocument: farmerProfile.idProofDocument || null,
        });

        const completed = Boolean(farmerProfile.profileCompleted);
        if (!completed) {
          setProfileNotice('Please complete your profile to continue');
          setActiveTab('profile');
          setIsEditingProfile(true);
        } else {
          setProfileNotice('');
        }
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      setProfileError('Failed to load profile. Please refresh.');
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await batchAPI.getPaymentHistory();
      if (!response?.success) {
        return;
      }

      const paymentRows = (response.data || []).flatMap((batch) =>
        (batch.paymentHistory || [])
          .filter((entry) => {
            const paidToRole = String(entry?.paidToRole || '').toLowerCase();
            const paidByRole = String(entry?.paidByRole || '').toLowerCase();
            return paidToRole === 'farmer' || paidByRole === 'farmer';
          })
          .map((entry) => ({
            ...entry,
            batchId: batch.batchId,
            productName: batch.productName,
            batchPrice: batch.price,
            batchQuantity: batch.quantity,
            batchUnit: batch.unit,
          }))
      ).sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));

      setPaymentRecords(paymentRows);
    } catch (error) {
      console.error('Fetch payment history error:', error);
    }
  };

  const validateProfile = () => {
    const required = [
      'fullName',
      'mobileNumber',
      'aadhaarNumber',
      'licenseNumber',
      'issuingAuthority',
      'issueDate',
      'expiryDate',
      'farmLocation',
      'landArea',
      'cropType',
    ];

    for (const field of required) {
      if (!profileForm[field] || !String(profileForm[field]).trim()) {
        return `${field.replace(/([A-Z])/g, ' $1')} is required`;
      }
    }

    if (!/^\d{12}$/.test(profileForm.aadhaarNumber)) {
      return 'Aadhaar must be 12 digits';
    }

    if (!profileForm.licenseNumber.trim()) {
      return 'License number should not be empty';
    }

    if (new Date(profileForm.expiryDate) <= new Date()) {
      return 'Expiry date must be greater than current date';
    }

    if (!profileForm.licenseDocument?.fileData) {
      return 'Upload Agriculture License document is required';
    }

    return '';
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const handleDocUpload = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileData = await toBase64(file);
      setProfileForm((prev) => ({
        ...prev,
        [fieldName]: {
          fileName: file.name,
          fileType: file.type,
          fileData,
        },
      }));
    } catch (error) {
      console.error('Document upload error:', error);
      setProfileError('Failed to process uploaded document');
    }
  };

  const handleProfileChange = (e) => {
    setProfileError('');
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');

    const validationError = validateProfile();
    if (validationError) {
      setProfileError(validationError);
      return;
    }

    try {
      setProfileSaving(true);
      const response = await userAPI.updateProfile({
        farmerProfile: {
          ...profileForm,
          licenseStatus: profile?.farmerProfile?.licenseStatus || 'Pending',
        },
      });

      if (response.success) {
        const farmerProfile = response.data.farmerProfile || {};
        setProfile({ farmerProfile });
        setIsEditingProfile(false);
        setProfileNotice('');
      }
    } catch (error) {
      setProfileError(error.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateBatchClick = () => {
    if (!profile?.farmerProfile?.profileCompleted) {
      setProfileNotice('Complete your profile before adding products');
      setActiveTab('profile');
      setIsEditingProfile(true);
      return;
    }

    setShowCreateModal(true);
  };

  const statCards = [
    {
      title: 'Total Batches',
      value: stats.total,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Batches',
      value: stats.active,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      title: 'Delivered',
      value: stats.delivered,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
  ];

  if (loading || profileLoading) {
    return <LoadingSpinner />;
  }

  const farmerProfile = profile.farmerProfile || {};
  const farmerPaymentHistory = paymentRecords.length > 0
    ? paymentRecords
    : batches
        .flatMap((batch) =>
          (batch.paymentHistory || [])
            .filter((entry) => {
              const paidToRole = String(entry?.paidToRole || '').toLowerCase();
              const paidByRole = String(entry?.paidByRole || '').toLowerCase();
              return paidToRole === 'farmer' || paidByRole === 'farmer';
            })
            .map((entry) => ({
              ...entry,
              batchId: batch.batchId,
              productName: batch.productName,
            }))
        )
        .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));

  const filteredFarmerPayments = farmerPaymentHistory.filter((entry) => {
    const status = String(entry?.status || 'Paid').toLowerCase();
    const paidTime = new Date(entry?.paidAt || 0).getTime();
    const fromTime = paymentFromDate ? new Date(`${paymentFromDate}T00:00:00`).getTime() : null;
    const toTime = paymentToDate ? new Date(`${paymentToDate}T23:59:59`).getTime() : null;

    const matchesStatus = paymentStatusFilter === 'all' || status === paymentStatusFilter;
    const matchesFrom = !fromTime || paidTime >= fromTime;
    const matchesTo = !toTime || paidTime <= toTime;

    return matchesStatus && matchesFrom && matchesTo;
  });

  const paymentSummary = {
    count: filteredFarmerPayments.length,
    totalAmount: filteredFarmerPayments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    latestPayment: filteredFarmerPayments[0] || null,
  };

  const exportPaymentsCsv = () => {
    const rows = [
      ['Batch ID', 'Product Name', 'Amount', 'Paid To / Received From', 'Payment Method', 'Payment ID', 'Date', 'Status'],
      ...filteredFarmerPayments.map((entry) => [
        entry.batchId,
        entry.productName || 'N/A',
        Number(entry.amount || 0),
        `${entry.paidByRole || 'N/A'} -> ${entry.paidToRole || 'N/A'}`,
        entry.paymentMethod || 'N/A',
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
    link.download = `farmer-payments-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}! 🌾</h1>
          <p className="text-gray-600 mt-2">Manage your agricultural batches and farmer profile</p>
        </motion.div>

        {(profileNotice || profileError) && (
          <div className="mb-6 space-y-3">
            {profileNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {profileNotice}
              </div>
            )}
            {profileError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {profileError}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card hover={false}>
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <Card hover={false}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Profile Completion Status</p>
                <div className="w-full md:w-96 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${farmerProfile.completionPercentage || 0}%` }}
                  />
                </div>
                <p className="text-sm font-semibold text-gray-700 mt-2">
                  {farmerProfile.completionPercentage || 0}% complete
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant={activeTab === 'batches' ? 'primary' : 'outline'}
                  icon={Package}
                  onClick={() => setActiveTab('batches')}
                >
                  Batches
                </Button>
                <Button
                  variant={activeTab === 'profile' ? 'primary' : 'outline'}
                  icon={User}
                  onClick={() => setActiveTab('profile')}
                >
                  Profile
                </Button>
                <Button
                  variant={activeTab === 'payments' ? 'primary' : 'outline'}
                  icon={Download}
                  onClick={() => setActiveTab('payments')}
                >
                  Payments
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {activeTab === 'batches' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <Button
                variant="primary"
                size="lg"
                icon={Plus}
                onClick={handleCreateBatchClick}
              >
                Create New Batch
              </Button>
              {!farmerProfile.profileCompleted && (
                <p className="text-sm text-red-600 mt-2">Complete your profile before adding products</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Payment History (Farmer)</h3>
                {farmerPaymentHistory.length === 0 ? (
                  <p className="text-sm text-green-800">No payments received yet.</p>
                ) : (
                  <div className="space-y-2">
                    {farmerPaymentHistory.slice(0, 6).map((entry, idx) => (
                      <div key={`${entry.batchId}-${entry.paymentId || idx}`} className="flex items-center justify-between rounded-md border border-green-100 bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{entry.batchId} - {entry.productName}</p>
                          <p className="text-xs text-gray-600">{new Date(entry.paidAt).toLocaleString('en-IN')}</p>
                        </div>
                        <p className="font-semibold text-green-700">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Batches</h2>

              {batches.length === 0 ? (
                <Card>
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No batches yet</p>
                    <p className="text-gray-500 text-sm mt-2">Create your first batch to get started</p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {batches.map((batch, index) => (
                    <motion.div
                      key={batch.batchId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card hover>
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Batch ID</p>
                              <p className="font-mono font-semibold text-gray-900">{batch.batchId}</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                batch.status === 'Created'
                                  ? 'bg-blue-100 text-blue-800'
                                  : batch.status === 'In Transit'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {batch.status}
                            </span>
                          </div>

                          <div>
                            <p className="text-lg font-semibold text-gray-900">{batch.productName}</p>
                            <p className="text-sm text-gray-600">{batch.quantity} {batch.unit}</p>
                            <p className="text-sm text-gray-700 mt-1">Price: Rs. {Number(batch.price || 0).toLocaleString('en-IN')}</p>
                            <p className="text-xs mt-1 font-medium text-blue-700">
                              Farmer Payment: {batch?.payments?.farmer?.status || 'Pending'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 mb-1">Current Owner</p>
                            <p className="text-sm font-medium text-gray-700">{batch.currentOwner?.name || 'You'}</p>
                          </div>

                          <div className="flex space-x-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={QrCode}
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/batch/${batch.batchId}`);
                              }}
                            >
                              View QR
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/batch/${batch.batchId}`);
                              }}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}

        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card hover={false}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Farmer Profile & License Registration</h2>
                {!isEditingProfile && (
                  <Button variant="outline" icon={Edit} onClick={() => setIsEditingProfile(true)}>
                    Edit Profile
                  </Button>
                )}
              </div>

              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ProfileItem label="Name" value={farmerProfile.fullName || 'N/A'} />
                    <ProfileItem label="Mobile Number" value={farmerProfile.mobileNumber || 'N/A'} />
                    <ProfileItem label="Aadhaar Number" value={farmerProfile.aadhaarNumber || 'N/A'} />
                    <ProfileItem label="License Number" value={farmerProfile.licenseNumber || 'N/A'} />
                    <ProfileItem label="Issuing Authority" value={farmerProfile.issuingAuthority || 'N/A'} />
                    <ProfileItem label="Farm Location" value={farmerProfile.farmLocation || 'N/A'} />
                    <ProfileItem label="Land Area" value={farmerProfile.landArea || 'N/A'} />
                    <ProfileItem label="Crop Type" value={farmerProfile.cropType || 'N/A'} />
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">License Status</p>
                      <p className="font-semibold text-gray-900">{farmerProfile.licenseStatus || 'Pending'}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        farmerProfile.licenseStatus === 'Verified'
                          ? 'bg-green-100 text-green-700'
                          : farmerProfile.licenseStatus === 'Rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {farmerProfile.licenseStatus || 'Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DocumentLinkCard label="Agriculture License" document={farmerProfile.licenseDocument} />
                    <DocumentLinkCard label="ID Proof" document={farmerProfile.idProofDocument} optional />
                  </div>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSaveProfile}>
                  <SectionTitle title="Basic Details" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField label="Full Name *" name="fullName" value={profileForm.fullName} onChange={handleProfileChange} />
                    <InputField label="Mobile Number *" name="mobileNumber" value={profileForm.mobileNumber} onChange={handleProfileChange} />
                    <InputField label="Aadhaar Number *" name="aadhaarNumber" value={profileForm.aadhaarNumber} onChange={handleProfileChange} />
                  </div>

                  <SectionTitle title="Agriculture License Details" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="License Number *" name="licenseNumber" value={profileForm.licenseNumber} onChange={handleProfileChange} />
                    <InputField label="Issuing Authority *" name="issuingAuthority" value={profileForm.issuingAuthority} onChange={handleProfileChange} />
                    <InputField label="Issue Date *" type="date" name="issueDate" value={profileForm.issueDate} onChange={handleProfileChange} />
                    <InputField label="Expiry Date *" type="date" name="expiryDate" value={profileForm.expiryDate} onChange={handleProfileChange} />
                  </div>

                  <SectionTitle title="Farm Details" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField label="Farm Location *" name="farmLocation" value={profileForm.farmLocation} onChange={handleProfileChange} />
                    <InputField label="Land Area (acres/hectares) *" name="landArea" value={profileForm.landArea} onChange={handleProfileChange} />
                    <InputField label="Crop Type *" name="cropType" value={profileForm.cropType} onChange={handleProfileChange} />
                  </div>

                  <SectionTitle title="Document Upload" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UploadField
                      label="Upload Agriculture License (PDF/Image) *"
                      fileName={profileForm.licenseDocument?.fileName}
                      onChange={(e) => handleDocUpload(e, 'licenseDocument')}
                      required
                    />
                    <UploadField
                      label="Upload ID Proof (optional)"
                      fileName={profileForm.idProofDocument?.fileName}
                      onChange={(e) => handleDocUpload(e, 'idProofDocument')}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" variant="primary" loading={profileSaving} icon={CheckCircle}>
                      Save Profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileError('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
                <Button variant="outline" icon={Download} onClick={exportPaymentsCsv}>Export CSV</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Payment Records</p>
                  <p className="text-2xl font-bold text-gray-900">{paymentSummary.count}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Received</p>
                  <p className="text-2xl font-bold text-green-700">Rs. {paymentSummary.totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Latest Payment</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {paymentSummary.latestPayment ? paymentSummary.latestPayment.batchId : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {paymentSummary.latestPayment?.paidAt ? new Date(paymentSummary.latestPayment.paidAt).toLocaleString('en-IN') : 'No payment yet'}
                  </p>
                </div>
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

              {filteredFarmerPayments.length === 0 ? (
                <p className="text-sm text-gray-600">No payment records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-3">Batch ID</th>
                          <th className="py-2 pr-3">Product</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Paid To / Received From</th>
                          <th className="py-2 pr-3">Method</th>
                        <th className="py-2 pr-3">Payment ID</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFarmerPayments.map((entry, idx) => (
                        <tr key={`${entry.batchId}-${entry.paymentId || idx}`} className="border-b border-gray-100">
                          <td className="py-2 pr-3 font-mono">{entry.batchId}</td>
                            <td className="py-2 pr-3">{entry.productName || 'N/A'}</td>
                          <td className="py-2 pr-3">Rs. {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 pr-3">{entry.paidByRole || 'N/A'} to {entry.paidToRole || 'N/A'}</td>
                            <td className="py-2 pr-3">{entry.paymentMethod || 'N/A'}</td>
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
            </Card>
          </motion.div>
        )}
      </div>

      <CreateBatchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchBatches();
        }}
      />
    </div>
  );
};

const SectionTitle = ({ title }) => (
  <h3 className="text-lg font-semibold text-gray-900 mt-2">{title}</h3>
);

const InputField = ({ label, name, value, onChange, type = 'text' }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    />
  </div>
);

const UploadField = ({ label, fileName, onChange, required = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <div className="border border-dashed border-gray-300 rounded-lg p-4">
      <input
        type="file"
        accept=".pdf,image/*"
        onChange={onChange}
        required={required}
        className="w-full text-sm"
      />
      {fileName && <p className="text-xs text-gray-600 mt-2">Selected: {fileName}</p>}
    </div>
  </div>
);

const ProfileItem = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

const DocumentLinkCard = ({ label, document, optional = false }) => (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between">
    <div className="flex items-center">
      <FileText className="w-4 h-4 text-gray-500 mr-2" />
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{document?.fileName || (optional ? 'Not uploaded' : 'Missing')}</p>
      </div>
    </div>
    {document?.fileData && (
      <a
        href={document.fileData}
        download={document.fileName || `${label.replace(/\s+/g, '-')}.file`}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        Download
      </a>
    )}
  </div>
);

const CreateBatchModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    batchId: '',
    productName: '',
    quantity: '',
    price: '',
    unit: 'kg',
    metadata: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/batch/create`, formData);
      if (response.data.success) {
        onSuccess();
        setFormData({
          batchId: '',
          productName: '',
          quantity: '',
          price: '',
          unit: 'kg',
          metadata: {},
        });
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Batch">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Batch ID *</label>
          <input
            type="text"
            name="batchId"
            value={formData.batchId}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., BATCH-2024-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
          <input
            type="text"
            name="productName"
            value={formData.productName}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., Organic Tomatoes"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (INR) *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="1"
              step="0.01"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="5000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="tons">Tons</option>
              <option value="pieces">Pieces</option>
              <option value="liters">Liters</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={loading} icon={Plus} className="w-full">
          Create Batch
        </Button>
      </form>
    </Modal>
  );
};

export default FarmerDashboard;
