const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sendVerificationEmail, sendResetPasswordEmail, sendTwoFactorEmailOTP, sendLoginNotificationEmail } = require('../utils/mailer');
const databaseManager = require('../utils/databaseManager');
const { verifyToken } = require('./middleware');
dotenv.config();
const {generateAccessToken,generateRefreshToken,sendRefreshToken} = require('../utils/tokengeneration');

// Rate limiters for different types of operations
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes per IP
    message: { message: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many authentication attempts, please try again later' });
    }
});

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 signup attempts per hour per IP
    message: { message: 'Too many signup attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Signup rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many signup attempts, please try again later' });
    }
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per hour per IP
    message: { message: 'Too many password reset requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Password reset rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many password reset requests, please try again later' });
    }
});

const generalAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per 15 minutes for general auth operations
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
        console.log(`General auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many requests, please try again later' });
    }
});

// Helper function to get login details from request
const getLoginDetails = (req) => {
  const userAgent = req.get('User-Agent') || 'Unknown Device';
  const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
    (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'Unknown IP';
  
  // Clean up the user agent for better readability
  let deviceInfo = userAgent;
  if (userAgent.includes('Chrome')) {
    const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (chromeMatch && osMatch) {
      deviceInfo = `Chrome ${chromeMatch[1]} on ${osMatch[1]}`;
    }
  } else if (userAgent.includes('Firefox')) {
    const firefoxMatch = userAgent.match(/Firefox\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (firefoxMatch && osMatch) {
      deviceInfo = `Firefox ${firefoxMatch[1]} on ${osMatch[1]}`;
    }
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const safariMatch = userAgent.match(/Safari\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (safariMatch && osMatch) {
      deviceInfo = `Safari ${safariMatch[1]} on ${osMatch[1]}`;
    }
  }

  return {
    timestamp: new Date(),
    ipAddress: ipAddress,
    userAgent: deviceInfo,
    location: null // We could integrate with a geolocation service here
  };
};

// Helper function to send login notification
const sendLoginNotification = async (user, req) => {
  try {
    if (user.loginNotificationsEnabled) {
      const loginDetails = getLoginDetails(req);
      await sendLoginNotificationEmail(user.email, loginDetails);
    }
  } catch (error) {
    console.error('Failed to send login notification:', error);
    // Don't throw error as this shouldn't fail the login process
  }
};

// Helper to generate tokens


// POST /signup
router.post('/signup', signupLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({ name, email, password: hashedPassword });
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    newUser.verificationToken = verificationToken;
    newUser.isVerified = false;
    await newUser.save();

 

    await sendVerificationEmail(newUser.email, verificationToken);

    res.status(201).json({ message: 'Signup successful, please check your email for verification'});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// POST /login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const jwt = require('jsonwebtoken');

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
    
    // Handle 2FA if enabled
    if (user.twoFactorEnabled) {
      if (user.twoFactormethod === 'email') {
        // Generate and send email OTP
        const token = crypto.randomBytes(2).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        user.twoFactorToken = tokenHash;
        user.twoFactorExpiresAt = Date.now() + 10 * 60 * 1000;
        await user.save();
        await sendTwoFactorEmailOTP(user.email, token);
        
        return res.status(200).json({ 
          message: '2FA required', 
          requires2FA: true,
          twoFactorMethod: 'email',
          user: {id: user._id, name: user.name, email: user.email }
        });
      } else if (user.twoFactormethod === 'totp') {
        // Return TOTP verification required
        return res.status(200).json({ 
          message: '2FA required', 
          requires2FA: true,
          twoFactorMethod: 'totp',
          user: {id: user._id, name: user.name, email: user.email }
        });
      }
    }

    // No 2FA or 2FA not enabled - proceed with normal login
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    sendRefreshToken(res, refreshToken);

    // Send login notification email
    await sendLoginNotification(user, req);

    res.status(200).json({ message: 'Login successful', token: accessToken, user: {id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});
router.post('/refresh', generalAuthLimiter, async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.sendStatus(401);

  try {
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.sendStatus(403);

    const newAccessToken = generateAccessToken(user);
    res.status(200).json({ token: newAccessToken });
  } catch (err) {
    console.error('Refresh error:', err.message);
    return res.sendStatus(403);
  }
});
router.post('/logout', async (req, res) => {
  try {
    // Get user ID from token if available
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(payload.id);
        if (user) {
          // Disconnect all database connections for this user
          await databaseManager.disconnectAll(user._id.toString());
          console.log(`Disconnected all database connections for user: ${user._id}`);
        }
      } catch (tokenError) {
        console.log('Token verification failed during logout, continuing with logout');
      }
    }
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    // Still clear the cookie even if there's an error
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({ message: 'Logged out successfully' });
  }
});

// POST /request-password-change - Send password change link to authenticated user
router.post('/request-password-change', passwordResetLimiter, verifyToken, async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has password (OAuth users might not have password)
    if (!user.password) {
      return res.status(400).json({ message: 'Password change not available for OAuth accounts' });
    }

    // Generate password change token
    const changeToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(changeToken).digest('hex');
    
    // Store token hash in user document (reuse resetPasswordToken field)
    user.resetPasswordToken = tokenHash;
    await user.save();

    // Send email with password change link
    const changeLink = `${process.env.FRONTEND_URL || 'https://mongosnap.mp:5173'}/change-password/${changeToken}`;
    await sendResetPasswordEmail(user.email, changeLink);

    console.log(`Password change link sent to user: ${user.email}`);
    
    res.status(200).json({ 
      message: 'Password change link has been sent to your email address' 
    });

  } catch (err) {
    console.error('Request password change error:', err);
    res.status(500).json({ message: 'Server error during password change request' });
  }
});

// PUT /update-login-notifications - Update login notifications preference
router.put('/update-login-notifications', generalAuthLimiter, verifyToken, async (req, res) => {
  const userId = req.userId;
  const { loginNotificationsEnabled } = req.body;

  // Validate input
  if (typeof loginNotificationsEnabled !== 'boolean') {
    return res.status(400).json({ message: 'loginNotificationsEnabled must be a boolean value' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user preference
    user.loginNotificationsEnabled = loginNotificationsEnabled;
    await user.save();

    console.log(`Login notifications ${loginNotificationsEnabled ? 'enabled' : 'disabled'} for user: ${user.email}`);
    
    res.status(200).json({ 
      message: `Login notifications have been ${loginNotificationsEnabled ? 'enabled' : 'disabled'}`,
      loginNotificationsEnabled: user.loginNotificationsEnabled
    });

  } catch (err) {
    console.error('Update login notifications error:', err);
    res.status(500).json({ message: 'Server error during login notifications update' });
  }
});

// GET /usage-stats - Get user's query and AI generation usage statistics
router.get('/usage-stats', generalAuthLimiter, verifyToken, async (req, res) => {
  const userId = req.userId;

  try {
    // Get or create usage record for user
    const userUsage = await UserUsage.getOrCreateUsage(userId);
    
    // Get usage statistics
    const stats = userUsage.getUsageStats();

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (err) {
    console.error('Get usage stats error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching usage statistics' 
    });
  }
});

module.exports = router;  
