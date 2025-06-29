const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { sendVerificationEmail, sendResetPasswordEmail } = require('../utils/mailer');
const databaseManager = require('../utils/databaseManager');
const { verifyToken } = require('./middleware');
dotenv.config();
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET ;

// Helper to generate tokens
function generateAccessToken(user) {
  return jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}
function generateRefreshToken(user) {
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '1d',
  });
}

function sendRefreshToken(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',  // strict is best for refresh
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
  });
}

// POST /signup
router.post('/signup', async (req, res) => {
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
router.post('/login', async (req, res) => {
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
   
    const accessToken = generateAccessToken(user);
const refreshToken = generateRefreshToken(user);
sendRefreshToken(res, refreshToken);

    res.status(200).json({ message: 'Login successful', token: accessToken, user: {id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});
router.post('/refresh', async (req, res) => {
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
router.post('/request-password-change', verifyToken, async (req, res) => {
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

module.exports = router;
