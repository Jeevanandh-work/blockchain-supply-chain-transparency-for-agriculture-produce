import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { Package, User, Clock, MapPin, FileText, Shield, TrendingUp, ExternalLink } from 'lucide-react';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressTracker from '../components/ProgressTracker';
import StatusTimeline from '../components/StatusTimeline';

const BatchDetails = () => {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [blockchainData, setBlockchainData] = useState(null);
  const [ipfsUrl, setIpfsUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchBatchDetails();
  }, [id]);

  const fetchBatchDetails = async () => {
    try {
      console.log('Fetching batch details for ID:', id);
      const response = await axios.get(`${API_URL}/batch/${id}`);
      console.log('Batch response:', response.data);
      
      if (response.data.success) {
        const { batch, blockchain, ipfsUrl } = response.data.data;
        setBatchData(batch);
        setBlockchainData(blockchain);
        setIpfsUrl(ipfsUrl);
        setBatch(batch); // Keep for backward compatibility
      } else {
        setError('Failed to load batch details');
      }
    } catch (error) {
      console.error('Fetch batch error:', error);
      setError(error.response?.data?.message || 'Failed to load batch details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !batchData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Batch Not Found</h2>
          <p className="text-gray-600">{error || 'The requested batch could not be found.'}</p>
        </div>
      </div>
    );
  }

  // Parse QR code data
  let qrCodeUrl = `${window.location.origin}/batch/${batchData.batchId}`;
  try {
    if (batchData.qrCode) {
      const qrData = JSON.parse(atob(batchData.qrCode.split(',')[1]));
      qrCodeUrl = qrData.url || qrCodeUrl;
    }
  } catch (e) {
    // Use default URL if parsing fails
  }

  const steps = [
    { 
      label: 'Farmer', 
      sublabel: batchData.farmer?.name || '',
      completed: true 
    },
    { 
      label: 'Distributor', 
      sublabel: batchData.currentOwnerRole === 'Distributor' ? batchData.currentOwner?.name : '',
      completed: ['Distributor', 'Transport', 'Retailer'].includes(batchData.currentOwnerRole)
    },
    { 
      label: 'Transport', 
      sublabel: batchData.currentOwnerRole === 'Transport' ? batchData.currentOwner?.name : '',
      completed: ['Transport', 'Retailer'].includes(batchData.currentOwnerRole)
    },
    { 
      label: 'Retailer', 
      sublabel: batchData.currentOwnerRole === 'Retailer' ? batchData.currentOwner?.name : '',
      completed: batchData.currentOwnerRole === 'Retailer'
    },
    { 
      label: 'Consumer', 
      sublabel: '',
      completed: batchData.status === 'Completed'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Batch Details
            </h1>
            <p className="text-gray-600">Complete transparency via blockchain</p>
          </div>

          {/* QR Code */}
          <Card className="mb-8">
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg shadow-inner">
                <QRCode value={qrCodeUrl} size={200} />
              </div>
            </div>
          </Card>

          {/* Progress Tracker */}
          <Card className="mb-8">
            <ProgressTracker steps={steps} currentStep={steps.findIndex(s => !s.completed)} />
          </Card>

          {/* Batch Information */}
          <Card className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Product Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <Package className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Product Name</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {batchData.productName}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <User className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Farmer</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {batchData.farmer?.name || 'Unknown'}
                  </p>
                  {batchData.farmer?.organization && (
                    <p className="text-sm text-gray-600">{batchData.farmer.organization}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <TrendingUp className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {batchData.quantity} {batchData.unit}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(batchData.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Shield className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Current Status</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {batchData.status}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Current Owner</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {batchData.currentOwner?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">{batchData.currentOwnerRole}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Blockchain Information */}
          <Card className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-primary-600" />
              Blockchain Verification
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Transaction Hash</p>
                    <p className="font-mono text-sm text-gray-900 break-all">
                      {batchData.blockchainTxHash || 'Not recorded'}
                    </p>
                  </div>
                  {batchData.blockchainTxHash && (
                    <ExternalLink className="w-5 h-5 text-gray-400 cursor-pointer hover:text-primary-600" />
                  )}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">IPFS Document</p>
                    <p className="font-mono text-sm text-gray-900 break-all">
                      {batchData.ipfsHash || 'Not uploaded'}
                    </p>
                  </div>
                  {ipfsUrl && (
                    <a href={ipfsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-5 h-5 text-gray-400 hover:text-primary-600" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Status History */}
          {batchData.statusHistory && batchData.statusHistory.length > 0 && (
            <Card className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Supply Chain Journey
              </h2>
              <StatusTimeline batch={batchData} />
            </Card>
          )}

          {/* Quality Records */}
          {batchData.qualityRecords && batchData.qualityRecords.length > 0 && (
            <Card>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-primary-600" />
                Quality Inspections
              </h2>
              <div className="space-y-4">
                {batchData.qualityRecords.map((record, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Inspected by: {record.recordedBy?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">Role: {record.recordedBy?.role || 'N/A'}</p>
                        <p className="font-mono text-xs text-gray-500 mt-2">IPFS: {record.ipfsHash}</p>
                      </div>
                      <a 
                        href={`https://ipfs.io/ipfs/${record.ipfsHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default BatchDetails;
