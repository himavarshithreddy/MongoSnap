const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
dotenv.config();
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

function generateAccessToken(user) {
    return jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
    return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d', // Extended to 7 days for better UX
    });
}

// Enhanced function to create and store refresh token in database
async function createAndStoreRefreshToken(user, req, family = null) {
    try {
        // Generate new family if not provided
        if (!family) {
            family = RefreshToken.createTokenFamily();
        }

        // Generate refresh token
        const refreshToken = generateRefreshToken(user);
        
        // Calculate expiration date (7 days from now)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Extract device info from request
        const deviceInfo = extractDeviceInfo(req);

        // Store token in database
        const refreshTokenDoc = new RefreshToken({
            token: refreshToken,
            userId: user._id,
            family: family,
            expiresAt: expiresAt,
            deviceInfo: deviceInfo
        });

        await refreshTokenDoc.save();

        // Update user's token family tracking
        user.refreshTokenFamily = family;
        user.lastActiveTokenFamily = family;
        await user.save();

        return {
            token: refreshToken,
            family: family,
            expiresAt: expiresAt
        };
    } catch (error) {
        console.error('Error creating refresh token:', error);
        throw new Error('Failed to create refresh token');
    }
}

// Function to validate and rotate refresh token
async function validateAndRotateRefreshToken(token, req) {
    try {
        // Verify JWT token first
        const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        
        // Find token in database
        const refreshTokenDoc = await RefreshToken.findOne({ 
            token: token,
            userId: payload.id 
        });

        if (!refreshTokenDoc) {
            throw new Error('Token not found in database');
        }

        // Check if token is expired, used, or revoked
        if (refreshTokenDoc.expiresAt < new Date()) {
            throw new Error('Token expired');
        }

        if (refreshTokenDoc.isUsed) {
            // Token reuse detected - revoke entire family
            await RefreshToken.revokeFamily(refreshTokenDoc.family, 'token_reuse');
            throw new Error('Token reuse detected - security breach');
        }

        if (refreshTokenDoc.isRevoked) {
            throw new Error('Token revoked');
        }

        // Get user
        const user = await User.findById(payload.id);
        if (!user) {
            throw new Error('User not found');
        }

        // Mark current token as used
        refreshTokenDoc.isUsed = true;
        refreshTokenDoc.lastUsedAt = new Date();
        await refreshTokenDoc.save();

        // Create new refresh token in same family
        const newTokenData = await createAndStoreRefreshToken(user, req, refreshTokenDoc.family);

        // Mark the successor token
        refreshTokenDoc.successorToken = newTokenData.token;
        await refreshTokenDoc.save();

        return {
            user: user,
            accessToken: generateAccessToken(user),
            refreshToken: newTokenData.token,
            family: newTokenData.family
        };
    } catch (error) {
        console.error('Refresh token validation error:', error);
        throw error;
    }
}

// Function to revoke refresh token
async function revokeRefreshToken(token, reason = 'user') {
    try {
        const refreshTokenDoc = await RefreshToken.findOne({ token: token });
        if (refreshTokenDoc) {
            await refreshTokenDoc.revoke(reason);
        }
    } catch (error) {
        console.error('Error revoking refresh token:', error);
    }
}

// Function to update token usage (track every API request)
async function updateTokenUsage(token, req) {
    try {
        const refreshTokenDoc = await RefreshToken.findOne({ token: token });
        if (refreshTokenDoc) {
            refreshTokenDoc.lastUsedAt = new Date();
            
            // Update device info if it has changed (security check)
            const currentDeviceInfo = extractDeviceInfo(req);
            if (refreshTokenDoc.deviceInfo.deviceFingerprint !== currentDeviceInfo.deviceFingerprint) {
                console.warn(`⚠️ Device fingerprint mismatch for token ${token.substring(0, 10)}...`);
                console.warn(`Expected: ${refreshTokenDoc.deviceInfo.deviceFingerprint}`);
                console.warn(`Actual: ${currentDeviceInfo.deviceFingerprint}`);
                
                // Track device changes for security analytics
                refreshTokenDoc.deviceChanges = refreshTokenDoc.deviceChanges || [];
                refreshTokenDoc.deviceChanges.push({
                    timestamp: new Date(),
                    oldFingerprint: refreshTokenDoc.deviceInfo.deviceFingerprint,
                    newFingerprint: currentDeviceInfo.deviceFingerprint,
                    ipAddress: currentDeviceInfo.ipAddress
                });
                
                // Update device info to the new fingerprint
                refreshTokenDoc.deviceInfo = currentDeviceInfo;
                
                // Consider revoking if too many device changes
                if (refreshTokenDoc.deviceChanges.length > 5) {
                    await refreshTokenDoc.revoke('suspicious_device_changes');
                    throw new Error('Token revoked due to suspicious device changes');
                }
            }
            
            await refreshTokenDoc.save();
        }
    } catch (error) {
        console.error('Error updating token usage:', error);
        // Re-throw security-related errors
        if (error.message && error.message.includes('suspicious')) {
            throw error;
        }
    }
}
// Function to revoke all tokens for a user
async function revokeAllUserTokens(userId, reason = 'user') {
    try {
        await RefreshToken.revokeAllForUser(userId, reason);
    } catch (error) {
        console.error('Error revoking all user tokens:', error);
    }
}

// Function to extract device information from request
function extractDeviceInfo(req) {
    const userAgent = req.get('User-Agent') || 'Unknown Device';
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
        (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'Unknown IP';
    
    // Create device fingerprint
    const deviceFingerprint = crypto.createHash('sha256')
        .update(userAgent + ipAddress)
        .digest('hex');

    return {
        userAgent: userAgent,
        ipAddress: ipAddress,
        deviceFingerprint: deviceFingerprint
    };
}

// Enhanced function to send refresh token as HTTP-only cookie
function sendRefreshToken(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}

// Function to clear refresh token cookie
function clearRefreshToken(res) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

// Periodic cleanup function for expired tokens
async function cleanupExpiredTokens() {
    try {
        const deletedCount = await RefreshToken.cleanupExpired();
        console.log(`Cleaned up ${deletedCount} expired refresh tokens`);
        return deletedCount;
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    createAndStoreRefreshToken,
    validateAndRotateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    updateTokenUsage,
    sendRefreshToken,
    clearRefreshToken,
    cleanupExpiredTokens,
    extractDeviceInfo
};