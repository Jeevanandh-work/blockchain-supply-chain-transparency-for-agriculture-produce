const User = require('../models/User');

const FARMER_REQUIRED_FIELDS = [
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
  'licenseDocument',
];

const DISTRIBUTOR_REQUIRED_FIELDS = [
  'name',
  'email',
  'phoneNumber',
  'walletAddress',
  'organizationName',
  'licenseNumber',
  'issuingAuthority',
  'profilePhoto',
  'licenseDocument',
];

const calculateCompletion = (profile = {}) => {
  const completed = FARMER_REQUIRED_FIELDS.filter((field) => {
    if (field === 'licenseDocument') {
      return Boolean(profile.licenseDocument && profile.licenseDocument.fileData);
    }
    return Boolean(profile[field]);
  }).length;

  return Math.round((completed / FARMER_REQUIRED_FIELDS.length) * 100);
};

const calculateDistributorCompletion = (profile = {}) => {
  const completed = DISTRIBUTOR_REQUIRED_FIELDS.filter((field) => {
    if (field === 'profilePhoto') {
      return Boolean(profile.profilePhoto && profile.profilePhoto.fileData);
    }
    if (field === 'licenseDocument') {
      return Boolean(profile.licenseDocument && profile.licenseDocument.fileData);
    }
    return Boolean(profile[field]);
  }).length;

  return Math.round((completed / DISTRIBUTOR_REQUIRED_FIELDS.length) * 100);
};

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  walletAddress: user.walletAddress,
  role: user.role,
  phoneNumber: user.phoneNumber,
  organization: user.organization,
  farmerProfile: user.farmerProfile,
  distributorProfile: user.distributorProfile,
});

/**
 * @desc    Get all users
 * @route   GET /api/user
 * @access  Private
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message,
    });
  }
};

/**
 * @desc    Get users by role
 * @route   GET /api/user/role/:role
 * @access  Private
 */
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    // Capitalize first letter to match database format
    const formattedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

    const users = await User.find({ 
      role: formattedRole,
      isActive: true 
    }).select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users by role',
      error: error.message,
    });
  }
};

/**
 * @desc    Get user by wallet address
 * @route   GET /api/user/wallet/:address
 * @access  Private
 */
exports.getUserByWallet = async (req, res) => {
  try {
    const { address } = req.params;

    const user = await User.findOne({ 
      walletAddress: address.toLowerCase() 
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user by wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error.message,
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/user/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      phoneNumber,
      organization,
      farmerProfile,
      distributorProfile,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields
    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (organization) user.organization = organization;

    // Farmer profile update flow
    if (user.role === 'Farmer' && farmerProfile) {
      const profileUpdate = {
        ...user.farmerProfile?.toObject?.(),
        ...farmerProfile,
      };

      // Validation rules
      if (profileUpdate.aadhaarNumber && !/^\d{12}$/.test(profileUpdate.aadhaarNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number must be exactly 12 digits',
        });
      }

      if (!profileUpdate.licenseNumber || !String(profileUpdate.licenseNumber).trim()) {
        return res.status(400).json({
          success: false,
          message: 'License number is required',
        });
      }

      if (profileUpdate.expiryDate && new Date(profileUpdate.expiryDate) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'License expiry date must be greater than current date',
        });
      }

      profileUpdate.completionPercentage = calculateCompletion(profileUpdate);
      profileUpdate.profileCompleted = profileUpdate.completionPercentage === 100;
      profileUpdate.licenseStatus = profileUpdate.licenseStatus || 'Pending';

      user.farmerProfile = profileUpdate;
    }

    if (user.role === 'Distributor' && distributorProfile) {
      const profileUpdate = {
        ...user.distributorProfile?.toObject?.(),
        ...distributorProfile,
      };

      if (profileUpdate.email && !/^\S+@\S+\.\S+$/.test(profileUpdate.email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address',
        });
      }

      if (profileUpdate.phoneNumber) {
        const normalizedPhone = String(profileUpdate.phoneNumber).replace(/[\s-]/g, '');
        if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid phone number',
          });
        }
      }

      if (!profileUpdate.licenseNumber || !String(profileUpdate.licenseNumber).trim()) {
        return res.status(400).json({
          success: false,
          message: 'License number is required',
        });
      }

      profileUpdate.role = 'Distributor';
      profileUpdate.completionPercentage = calculateDistributorCompletion(profileUpdate);
      profileUpdate.profileCompleted = profileUpdate.completionPercentage === 100;
      user.distributorProfile = profileUpdate;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: buildUserPayload(user),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Get current user's profile details
 * @route   GET /api/user/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Ensure computed fields are always up to date for farmers
    if (user.role === 'Farmer') {
      const currentProfile = user.farmerProfile || {};
      const completionPercentage = calculateCompletion(currentProfile);
      const profileCompleted = completionPercentage === 100;

      if (
        currentProfile.completionPercentage !== completionPercentage ||
        currentProfile.profileCompleted !== profileCompleted
      ) {
        user.farmerProfile = {
          ...currentProfile.toObject?.(),
          ...currentProfile,
          completionPercentage,
          profileCompleted,
          licenseStatus: currentProfile.licenseStatus || 'Pending',
        };
        await user.save();
      }
    }

    if (user.role === 'Distributor') {
      const currentProfile = user.distributorProfile || {};
      const completionPercentage = calculateDistributorCompletion({
        ...currentProfile.toObject?.(),
        ...currentProfile,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        walletAddress: user.walletAddress,
      });
      const profileCompleted = completionPercentage === 100;

      if (
        currentProfile.completionPercentage !== completionPercentage ||
        currentProfile.profileCompleted !== profileCompleted
      ) {
        user.distributorProfile = {
          ...currentProfile.toObject?.(),
          ...currentProfile,
          role: 'Distributor',
          completionPercentage,
          profileCompleted,
        };
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: buildUserPayload(user),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message,
    });
  }
};
