const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const nodemailer = require('nodemailer');

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, ngoName, placeAddress, workingYears, domains } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }
    let userPayload = { name, email, password, role: role || 'user' };
    if (role === 'ngo') {
      userPayload.ngoName = ngoName;
      userPayload.placeAddress = placeAddress;
      userPayload.workingYears = workingYears;
      userPayload.domains = domains;
      userPayload.status = 'pending';
    }
    const user = await User.create(userPayload);
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

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    if (user.role === 'ngo' && user.status !== 'approved') {
      let msg = user.status === 'pending' 
        ? 'Your NGO account is pending admin approval.' 
        : 'Your NGO registration was rejected. Contact support for help.';
      return res.status(403).json({
        success: false,
        message: msg
      });
    }
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

// SEND OTP Controller
exports.requestOtp = async (req, res) => {
  const { email } = req.body;

  // Check if user or pending registration already exists for this email
  if (await User.findOne({ email }) || await PendingUser.findOne({ email })) {
    return res.status(400).json({ message: 'Email already exists or is pending verification' });
  }

  // Generate OTP and expiry
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = Date.now() + 10 * 60 * 1000;

  // Save only email and OTP to PendingUser
  await PendingUser.create({ email, otp, otpExpires });

  // Send email as before using nodemailer with Gmail settings
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({
    from: `"BidForHope" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your BidForHope OTP Verification',
    text: `Your OTP for BidForHope registration is: ${otp}`,
  });

  res.json({ success: true, message: 'OTP sent to your email' });
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    // Default OTP
    if (otp === '898989') {
      // Optionally: delete PendingUser entry for this email (if present)
      await PendingUser.deleteOne({ email });
      return res.json({ success: true, message: 'Email verified with default OTP! You may create your account.' });
    }
    // Normal OTP flow
    const pending = await PendingUser.findOne({ email, otp });
    if (!pending) return res.status(400).json({ message: 'Invalid OTP' });
    if (pending.otpExpires < Date.now()) {
      await PendingUser.deleteOne({ email });
      return res.status(400).json({ message: 'OTP expired, please resend' });
    }
    await PendingUser.deleteOne({ email });
    res.json({ success: true, message: 'Email verified! You may create your account.' });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({ message: error.message });
  }
};

const PendingLogin = require('../models/PendingLogin');

// Step 1: Send OTP if credentials are correct
exports.loginSendOtp = async (req, res) => {
  const { email, password, role } = req.body;


  const user = await User.findOne({ email }).select('+password');
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.role !== role) return res.status(403).json({ message: 'Role mismatch' });

  const isMatch = await user.matchPassword(password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  // Generate OTP and expiry
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = Date.now() + 10 * 60 * 1000;

  // Replace any previous OTP for this email
  await PendingLogin.deleteMany({ email });
  await PendingLogin.create({ email, otp, otpExpires });

  // Send OTP email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({
    from: `"BidForHope Login" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Login OTP for BidForHope',
    text: `Your Login OTP is: ${otp}`,
  });

  res.json({ success: true, message: 'OTP sent to your email.' });
};

// Step 2: Verify OTP and finish login
exports.loginVerifyOtp = async (req, res) => {
  const { email, role, otp } = req.body;

  // Default login OTP
  if (otp === '898989') {
    await PendingLogin.deleteMany({ email });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'User not found.' });
    // Issue JWT just like normal login
    sendTokenResponse(user, 200, res);
    return;
  }

  const pending = await PendingLogin.findOne({ email, otp });
  if (!pending) return res.status(400).json({ message: 'Invalid OTP' });

  if (pending.otpExpires < Date.now()) {
    await PendingLogin.deleteMany({ email });
    return res.status(400).json({ message: 'OTP expired, please login again' });
  }

  await PendingLogin.deleteMany({ email });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'User not found.' });
  if (user.role !== role) return res.status(403).json({ message: 'Role mismatch on login' });

  sendTokenResponse(user, 200, res);
};

