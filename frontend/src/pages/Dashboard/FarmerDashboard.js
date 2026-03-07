import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Package,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  QrCode,
  Upload,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

const FarmerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    delivered: 0,
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/batch/my/batches`);
      if (response.data.success) {
        const batchesData = response.data.data;
        setBatches(batchesData);
        
        // Calculate stats
        setStats({
          total: batchesData.length,
          active: batchesData.filter(b => ['Created', 'In Transit'].includes(b.status)).length,
          delivered: batchesData.filter(b => b.status === 'Delivered').length,
        });
      }
    } catch (error) {
      console.error('Fetch batches error:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Batches',
      value: stats.total,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    {
      title: 'Active Batches',
      value: stats.active,
      icon: Clock,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
    },
    {
      title: 'Delivered',
      value: stats.delivered,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600',
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}! 🌾
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your agricultural batches and track their journey
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                    <p className="text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="w-8 h-8 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Create Batch Button */}
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
            onClick={() => setShowCreateModal(true)}
          >
            Create New Batch
          </Button>
        </motion.div>

        {/* Batches List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Your Batches
          </h2>

          {batches.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No batches yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Create your first batch to get started
                </p>
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
                      {/* Batch ID & Status */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Batch ID</p>
                          <p className="font-mono font-semibold text-gray-900">
                            {batch.batchId}
                          </p>
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

                      {/* Product Info */}
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {batch.productName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {batch.quantity} {batch.unit}
                        </p>
                      </div>

                      {/* Current Owner */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          Current Owner
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {batch.currentOwner?.name || 'You'}
                        </p>
                      </div>

                      {/* Actions */}
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
      </div>

      {/* Create Batch Modal */}
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

// Create Batch Modal Component
const CreateBatchModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    batchId: '',
    productName: '',
    quantity: '',
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
        // Reset form
        setFormData({
          batchId: '',
          productName: '',
          quantity: '',
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Batch ID *
          </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Name *
          </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit *
            </label>
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          icon={Plus}
          className="w-full"
        >
          Create Batch
        </Button>
      </form>
    </Modal>
  );
};

export default FarmerDashboard;
