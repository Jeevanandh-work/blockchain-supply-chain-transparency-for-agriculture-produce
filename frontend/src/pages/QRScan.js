import React from 'react';
import { motion } from 'framer-motion';
import { QrCode, Camera } from 'lucide-react';
import Button from '../components/Button';

const QRScan = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center">
          <QrCode className="w-20 h-20 text-primary-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Scan QR Code
          </h1>
          <p className="text-gray-600 mb-8">
            Scan the QR code on your product to view its complete supply chain history
          </p>

          <div className="bg-gray-100 rounded-lg p-12 mb-6">
            <Camera className="w-16 h-16 text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-4">Camera access required</p>
          </div>

          <Button variant="primary" size="lg" className="w-full">
            Enable Camera
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default QRScan;
