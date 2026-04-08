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
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantitySold: {
      type: Number,
      default: 0,
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
      enum: [
        'Created', 
        'Picked Up', 
        'Picked from Farmer',
        'In Transit', 
        'Reached Destination',
        'Delivered to Processor',
        'Delivered to Retailer',
        'Accepted by Retailer',
        'Rejected by Retailer',
        'Delivered',
        'Final Delivery',
        'Completed'
      ],
      default: 'Created',
    },
    location: {
      type: String,
      default: '',
    },
    deliveryAddress: {
      type: String,
      default: '',
    },
    transportDetails: {
      vehicleNumber: {
        type: String,
        default: '',
      },
      driverName: {
        type: String,
        default: '',
      },
      transportCompany: {
        type: String,
        default: '',
      },
      contactNumber: {
        type: String,
        default: '',
      },
    },
    payments: {
      farmer: {
        status: {
          type: String,
          enum: ['Pending', 'Order Created', 'Paid'],
          default: 'Pending',
        },
        amount: {
          type: Number,
          default: 0,
        },
        orderId: {
          type: String,
          default: '',
        },
        paymentId: {
          type: String,
          default: '',
        },
        signature: {
          type: String,
          default: '',
        },
        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidAt: {
          type: Date,
        },
        paymentMethod: {
          type: String,
          default: '',
        },
      },
      transport: {
        status: {
          type: String,
          enum: ['Pending', 'Order Created', 'Paid'],
          default: 'Pending',
        },
        amount: {
          type: Number,
          default: 0,
        },
        orderId: {
          type: String,
          default: '',
        },
        paymentId: {
          type: String,
          default: '',
        },
        signature: {
          type: String,
          default: '',
        },
        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidAt: {
          type: Date,
        },
        paymentMethod: {
          type: String,
          default: '',
        },
      },
      distributor: {
        status: {
          type: String,
          enum: ['Pending', 'Order Created', 'Paid'],
          default: 'Pending',
        },
        amount: {
          type: Number,
          default: 0,
        },
        orderId: {
          type: String,
          default: '',
        },
        paymentId: {
          type: String,
          default: '',
        },
        signature: {
          type: String,
          default: '',
        },
        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidAt: {
          type: Date,
        },
        paymentMethod: {
          type: String,
          default: '',
        },
      },
    },
    paymentHistory: [
      {
        stage: {
          type: String,
          enum: ['farmer', 'transport', 'distributor'],
        },
        amount: Number,
        orderId: String,
        paymentId: String,
        signature: String,
        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidByRole: String,
        paidTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        paidToRole: String,
        paymentMethod: {
          type: String,
          default: '',
        },
        paidAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    dispatchTime: {
      type: Date,
    },
    expectedDelivery: {
      type: Date,
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
