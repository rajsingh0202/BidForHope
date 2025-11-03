const User = require('../models/User');

// @desc    Register new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, ngoName, placeAddress, workingYears, domains } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    // Prepare user payload
    let userPayload = {
      name,
      email,
      password,
      role: role || 'user'
    }

    // Add NGO fields if role is ngo
    if (role === 'ngo') {
      userPayload.ngoName = ngoName;
      userPayload.placeAddress = placeAddress;
      userPayload.workingYears = workingYears;
      userPayload.domains = domains;
      userPayload.status = 'pending';
    }

    // Create user
    const user = await User.create(userPayload);

    // This example just informs pending status for NGOs
    if(role === 'ngo') {
      return res.status(201).json({
        success: true,
        message: 'Registration submitted, pending admin approval.'
      });
    }
    sendTokenResponse(user, 201, res);
    return;
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // If role is ngo, enforce approval
    if (user.role === 'ngo' && user.status !== 'approved') {
      let msg = user.status === 'pending' 
        ? 'Your NGO account is pending admin approval.' 
        : 'Your NGO registration was rejected. Contact support for help.';
      return res.status(403).json({
        success: false,
        message: msg
      });
    }

    // Only after approval, send token:
    sendTokenResponse(user, 200, res);
    return;
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    return res.status(200).json({ 
      success: true, 
      data: user 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
  return;
};
