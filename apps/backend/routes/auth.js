const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const RefreshToken = require('../models/RefreshToken');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sendVerificationEmail, sendResetPasswordEmail, sendTwoFactorEmailOTP, sendLoginNotificationEmail } = require('../utils/mailer');
const databaseManager = require('../utils/databaseManager');
const { 
  verifyToken, 
  verifyTokenAndGenerateCSRF, 
  verifyTokenAndValidateCSRF 
} = require('./middleware');
dotenv.config();
const {
  generateAccessToken,
  createAndStoreRefreshToken,
  validateAndRotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  sendRefreshToken,
  clearRefreshToken
} = require('../utils/tokengeneration');

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
    const refreshTokenData = await createAndStoreRefreshToken(user, req);
    sendRefreshToken(res, refreshTokenData.token);

    // Generate and set CSRF token
    const csrfToken = user.generateCSRFToken();
    await user.save();

    // Send login notification email
    await sendLoginNotification(user, req);

    res.status(200).json({ 
      message: 'Login successful', 
      token: accessToken, 
      csrfToken: csrfToken,
      user: {id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});
router.post('/refresh', generalAuthLimiter, async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: 'Refresh token not provided' });
  }

  try {
    // Validate and rotate refresh token
    const tokenData = await validateAndRotateRefreshToken(token, req);
    
    // Send new refresh token as cookie
    sendRefreshToken(res, tokenData.refreshToken);

    // Generate and set new CSRF token
    const csrfToken = tokenData.user.generateCSRFToken();
    await tokenData.user.save();

    res.status(200).json({ 
      token: tokenData.accessToken,
      csrfToken: csrfToken,
      message: 'Tokens refreshed successfully'
    });
  } catch (err) {
    console.error('Refresh error:', err.message);
    
    // Clear the invalid refresh token cookie
    clearRefreshToken(res);
    
    if (err.message === 'Token reuse detected - security breach') {
      return res.status(403).json({ 
        message: 'Security breach detected. Please log in again.',
        code: 'TOKEN_REUSE_DETECTED'
      });
    }
    
    return res.status(403).json({ 
      message: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});
router.post('/logout', async (req, res) => {
  try {
    // Get refresh token from cookie
    const token = req.cookies.refreshToken;
    let userId = null;

    if (token) {
      try {
        // Revoke the specific refresh token with logout reason
        await revokeRefreshToken(token, 'logout');
        
        // Get user ID for database disconnection
        const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        userId = payload.id;
        
        if (userId) {
          // Disconnect all database connections for this user
          await databaseManager.disconnectAll(userId.toString());
          console.log(`Disconnected all database connections for user: ${userId}`);
        }
      } catch (tokenError) {
        console.log('Token verification failed during logout, continuing with logout');
      }
    }

    // Clear refresh token cookie
    clearRefreshToken(res);
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    // Still clear the cookie even if there's an error
    clearRefreshToken(res);
    res.status(200).json({ message: 'Logged out successfully' });
  }
});

// POST /request-password-change - Send password change link to authenticated user
router.post('/request-password-change', passwordResetLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
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
router.put('/update-login-notifications', generalAuthLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
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

// GET /me - Get current user data
router.get('/me', generalAuthLimiter, verifyTokenAndGenerateCSRF, async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId).select('-password -resetPasswordToken -twoFactorToken -verificationToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ 
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        oauthProvider: user.oauthProvider,
        createdAt: user.createdAt,
        loginNotificationsEnabled: user.loginNotificationsEnabled !== false, // Default to true if undefined
        twoFactorEnabled: user.twoFactorEnabled || false,
        twoFactormethod: user.twoFactormethod || null
      }
    });

  } catch (err) {
    console.error('Get user data error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching user data' 
    });
  }
});

// GET /active-sessions - Get user's active refresh token sessions
router.get('/active-sessions', generalAuthLimiter, verifyTokenAndGenerateCSRF, async (req, res) => {
  const userId = req.userId;

  try {
    const activeSessions = await RefreshToken.getActiveTokensForUser(userId);
    const currentRefreshToken = req.cookies.refreshToken;
    
    // Transform data for frontend (don't expose actual tokens)
    const sessionData = activeSessions.map(session => {
      const isCurrent = currentRefreshToken && session.token === currentRefreshToken;
      
      return {
        id: session._id,
        family: session.family,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt || session.createdAt, // Fallback to creation time
        expiresAt: session.expiresAt,
        deviceInfo: {
          userAgent: session.deviceInfo.userAgent,
          ipAddress: session.deviceInfo.ipAddress,
          deviceFingerprint: session.deviceInfo.deviceFingerprint ? 
            session.deviceInfo.deviceFingerprint.substring(0, 8) + '...' : null // Partial fingerprint for display
        },
        isCurrent: isCurrent,
        isUsed: session.isUsed,
        // Add security metadata
        securityInfo: {
          hasSuccessor: !!session.successorToken,
          revokedBy: session.revokedBy,
          revokedAt: session.revokedAt
        }
      };
    });

    res.status(200).json({
      success: true,
      sessions: sessionData,
      total: sessionData.length,
      currentSessionId: sessionData.find(s => s.isCurrent)?._id || null
    });

  } catch (err) {
    console.error('Get active sessions error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active sessions'
    });
  }
});

// POST /revoke-session - Revoke a specific refresh token session
router.post('/revoke-session', generalAuthLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }

  try {
    // Find the session and verify it belongs to the user
    const session = await RefreshToken.findOne({
      _id: sessionId,
      userId: userId,
      isRevoked: false
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already revoked'
      });
    }

    // Revoke the session with specific reason
    await session.revoke('user_revocation');

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while revoking session'
    });
  }
});

// POST /revoke-all-sessions - Revoke all refresh token sessions for user
router.post('/revoke-all-sessions', generalAuthLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
  const userId = req.userId;

  try {
    // Revoke all tokens for the user
    await revokeAllUserTokens(userId, 'logout_all_devices');

    // Clear the current refresh token cookie as well
    clearRefreshToken(res);

    res.status(200).json({
      success: true,
      message: 'All sessions revoked successfully. Please log in again.'
    });

  } catch (err) {
    console.error('Revoke all sessions error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while revoking all sessions'
    });
  }
});

// GET /csrf-token - Generate and return a new CSRF token
router.get('/csrf-token', generalAuthLimiter, verifyTokenAndGenerateCSRF, async (req, res) => {
  try {
    // The CSRF token is already generated by the middleware and available in req.csrfToken
    res.status(200).json({
      success: true,
      csrfToken: req.csrfToken,
      message: 'CSRF token generated successfully'
    });
  } catch (err) {
    console.error('CSRF token generation error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while generating CSRF token'
    });
  }
});

// GET /session-analytics - Get detailed session analytics for current user
router.get('/session-analytics', generalAuthLimiter, verifyTokenAndGenerateCSRF, async (req, res) => {
  const userId = req.userId;

  try {
    // Get all tokens for user (including revoked ones for analytics)
    const allTokens = await RefreshToken.find({ userId: userId })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 tokens

    // Get active tokens
    const activeTokens = await RefreshToken.getActiveTokensForUser(userId);

    // Calculate analytics
    const analytics = {
      totalSessions: allTokens.length,
      activeSessions: activeTokens.length,
      revokedSessions: allTokens.filter(t => t.isRevoked).length,
      usedSessions: allTokens.filter(t => t.isUsed).length,
      
      // Token families (unique login sessions)
      uniqueFamilies: [...new Set(allTokens.map(t => t.family))].length,
      
      // Device analytics
      uniqueDevices: [...new Set(allTokens.map(t => t.deviceInfo.deviceFingerprint))].length,
      
      // Usage patterns
      lastActivity: allTokens.reduce((latest, token) => {
        const tokenLastUsed = token.lastUsedAt || token.createdAt;
        return tokenLastUsed > latest ? tokenLastUsed : latest;
      }, new Date(0)),
      
      // Revocation reasons
      revocationReasons: allTokens
        .filter(t => t.revokedBy)
        .reduce((acc, token) => {
          acc[token.revokedBy] = (acc[token.revokedBy] || 0) + 1;
          return acc;
        }, {}),
      
      // Recent session history (last 10 sessions)
      recentSessions: allTokens.slice(0, 10).map(session => ({
        id: session._id,
        family: session.family,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        isActive: !session.isRevoked && !session.isUsed && session.expiresAt > new Date(),
        revokedBy: session.revokedBy,
        deviceFingerprint: session.deviceInfo.deviceFingerprint ? 
          session.deviceInfo.deviceFingerprint.substring(0, 8) + '...' : null,
        userAgent: session.deviceInfo.userAgent
      }))
    };

    res.status(200).json({
      success: true,
      analytics: analytics
    });

  } catch (err) {
    console.error('Get session analytics error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session analytics'
    });
  }
});

// GET /security-monitor - Get security monitoring data for current user
router.get('/security-monitor', generalAuthLimiter, verifyTokenAndGenerateCSRF, async (req, res) => {
  const userId = req.userId;

  try {
    // Get security analytics
    const securityAnalytics = await RefreshToken.getSecurityAnalytics(userId, 30);
    
    // Find suspicious sessions
    const suspiciousSessions = await RefreshToken.findSuspiciousSessions(userId);
    
    // Get current token chain (if available)
    const currentRefreshToken = req.cookies.refreshToken;
    let tokenChain = [];
    if (currentRefreshToken) {
      tokenChain = await RefreshToken.getTokenChain(currentRefreshToken);
    }

    res.status(200).json({
      success: true,
      securityData: {
        analytics: securityAnalytics,
        suspiciousActivity: suspiciousSessions,
        currentTokenChain: tokenChain,
        riskLevel: calculateRiskLevel(securityAnalytics, suspiciousSessions)
      }
    });

  } catch (err) {
    console.error('Get security monitor error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching security data'
    });
  }
});

// Helper function to calculate risk level
function calculateRiskLevel(analytics, suspicious) {
  let riskScore = 0;
  
  // Device changes contribute to risk
  riskScore += analytics.deviceChanges.length * 2;
  
  // Security events
  riskScore += analytics.securityEvents.tokenReuse * 10;
  riskScore += analytics.securityEvents.familyBreaches * 15;
  
  // Suspicious activity
  suspicious.forEach(event => {
    if (event.severity === 'high') riskScore += 20;
    if (event.severity === 'medium') riskScore += 10;
  });
  
  // Determine risk level
  if (riskScore === 0) return 'low';
  if (riskScore < 10) return 'low';
  if (riskScore < 30) return 'medium';
  return 'high';
}

module.exports = router;  
