const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    walletAddress: {
      type: String,
      required: [true, 'Wallet address is required'],
      unique: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['Farmer', 'Distributor', 'Transport', 'Retailer', 'Consumer'],
      required: [true, 'Role is required'],
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
    farmerProfile: {
      fullName: {
        type: String,
        trim: true,
      },
      mobileNumber: {
        type: String,
        trim: true,
      },
      aadhaarNumber: {
        type: String,
        trim: true,
      },
      licenseNumber: {
        type: String,
        trim: true,
      },
      issuingAuthority: {
        type: String,
        trim: true,
      },
      issueDate: {
        type: Date,
      },
      expiryDate: {
        type: Date,
      },
      farmLocation: {
        type: String,
        trim: true,
      },
      landArea: {
        type: String,
        trim: true,
      },
      cropType: {
        type: String,
        trim: true,
      },
      licenseDocument: {
        fileName: String,
        fileType: String,
        fileData: String,
      },
      idProofDocument: {
        fileName: String,
        fileType: String,
        fileData: String,
      },
      licenseStatus: {
        type: String,
        enum: ['Pending', 'Verified', 'Rejected'],
        default: 'Pending',
      },
      profileCompleted: {
        type: Boolean,
        default: false,
      },
      completionPercentage: {
        type: Number,
        default: 0,
      },
    },
    distributorProfile: {
      role: {
        type: String,
        default: 'Distributor',
      },
      organizationName: {
        type: String,
        trim: true,
      },
      licenseNumber: {
        type: String,
        trim: true,
      },
      issuingAuthority: {
        type: String,
        trim: true,
      },
      profilePhoto: {
        fileName: String,
        fileType: String,
        fileData: String,
      },
      licenseDocument: {
        fileName: String,
        fileType: String,
        fileData: String,
      },
      profileCompleted: {
        type: Boolean,
        default: false,
      },
      completionPercentage: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
