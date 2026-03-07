const User = require('../models/User');

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
    const { name, phoneNumber, organization } = req.body;

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

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        phoneNumber: user.phoneNumber,
        organization: user.organization,
      },
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
