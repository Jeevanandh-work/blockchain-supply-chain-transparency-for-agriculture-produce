const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'tons', 'pieces', 'liters'],
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currentOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    currentOwnerRole: {
      type: String,
      enum: ['Farmer', 'Distributor', 'Transport', 'Retailer', 'Consumer'],
      default: 'Farmer',
    },
    ipfsHash: {
      type: String,
      required: true,
    },
    qrCode: {
      type: String, // Base64 or URL
    },
    qrCodeUrl: {
      type: String, // Public URL for scanning
    },
    blockchainTxHash: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Created', 'Picked Up', 'In Transit', 'Reached Destination', 'Delivered', 'Completed'],
      default: 'Created',
    },
    location: {
      type: String,
      default: '',
    },
    gpsTracking: [
      {
        latitude: Number,
        longitude: Number,
        location: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deliveredAt: {
      type: Date,
    },
    deliveryProof: {
      recipientName: String,
      signature: String,
      notes: String,
      proofIpfsHash: String,
      deliveredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      deliveredAt: Date,
    },
    statusHistory: [
      {
        status: String,
        location: String,
        message: String,
        blockchainHash: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    qualityRecords: [
      {
        ipfsHash: String,
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Batch', batchSchema);
