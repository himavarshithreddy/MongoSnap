const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');
const { updateTokenUsage } = require('../utils/tokengeneration');
const crypto = require('crypto');
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'mongosnap';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mongosnap-client';

function verifyToken(req, res, next) {
    let token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Remove Bearer prefix if present
    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
    }
    jwt.verify(
        token,
        JWT_SECRET,
        {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        },
        (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            req.userId = decoded.id;
            
            // Track refresh token usage if available (async, don't wait)
            const refreshToken = req.cookies.refreshToken;
            if (refreshToken) {
                updateTokenUsage(refreshToken, req).catch(err => {
                    console.error('Failed to update token usage:', err);
                });
            }
            
            next();
        }
    );
}

// CSRF Protection Middleware
async function generateCSRFToken(req, res, next) {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Clear expired token first
        user.clearExpiredCSRFToken();
        
        // Generate new CSRF token
        const csrfToken = user.generateCSRFToken();
        await user.save();

        // Add CSRF token to response headers and request object
        res.setHeader('X-CSRF-Token', csrfToken);
        req.csrfToken = csrfToken;
        next();
    } catch (error) {
        console.error('CSRF token generation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

// CSRF Validation Middleware
async function validateCSRFToken(req, res, next) {
    try {
        // Skip CSRF validation for GET, HEAD, OPTIONS requests
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }

        const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
        
        if (!csrfToken) {
            return res.status(403).json({ 
                message: 'CSRF token missing',
                code: 'CSRF_TOKEN_MISSING'
            });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Clear expired token first
        const wasExpired = user.clearExpiredCSRFToken();
        if (wasExpired) {
            await user.save();
        }

        // Validate CSRF token
        if (!user.validateCSRFToken(csrfToken)) {
            return res.status(403).json({ 
                message: 'Invalid or expired CSRF token',
                code: 'CSRF_TOKEN_INVALID'
            });
        }

        next();
    } catch (error) {
        console.error('CSRF validation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

// Combined middleware: verify token + generate CSRF
function verifyTokenAndGenerateCSRF(req, res, next) {
    verifyToken(req, res, (err) => {
        if (err) return;
        generateCSRFToken(req, res, next);
    });
}

// Combined middleware: verify token + validate CSRF
function verifyTokenAndValidateCSRF(req, res, next) {
    verifyToken(req, res, (err) => {
        if (err) return;
        validateCSRFToken(req, res, next);
    });
}

// Middleware to check user subscription and update usage limits
const checkUserSubscription = async (req, res, next) => {
    try {
        const userId = req.userId;
        const User = require('../models/User');
        const UserUsage = require('../models/UserUsage');
        
        // Get user with subscription info
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Get or create usage record
        const userUsage = await UserUsage.getOrCreateUsage(userId);
        
        // Update limits based on user's subscription plan
        const currentPlan = user.isSnapXUser() ? 'snapx' : 'snap';
        userUsage.updateLimitsForPlan(currentPlan);
        
        // Save if limits were updated
        await userUsage.save();
        
        // Add user and usage info to request
        req.user = user;
        req.userUsage = userUsage;
        req.userPlan = currentPlan;
        
        next();
    } catch (error) {
        console.error('Error checking user subscription:', error);
        res.status(500).json({ message: 'Error checking subscription status' });
    }
};

/**
 * Middleware to capture raw body for webhook signature verification
 */
const captureRawBody = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', chunk => {
        data += chunk;
    });
    
    req.on('end', () => {
        req.rawBody = data;
        next();
    });
};

module.exports = { 
    verifyToken, 
    generateCSRFToken, 
    validateCSRFToken,
    verifyTokenAndGenerateCSRF,
    verifyTokenAndValidateCSRF,
    checkUserSubscription,
    captureRawBody
};