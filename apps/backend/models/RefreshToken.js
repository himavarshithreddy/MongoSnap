const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    family: {
        type: String,
        required: true,
        index: true
    },
    isUsed: {
        type: Boolean,
        default: false,
        index: true
    },
    isRevoked: {
        type: Boolean,
        default: false,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastUsedAt: {
        type: Date,
        default: null
    },
    // Device and security metadata
    deviceInfo: {
        userAgent: String,
        ipAddress: String,
        deviceFingerprint: String
    },
    // Security tracking
    revokedBy: {
        type: String, // 'user', 'admin', 'security_breach', 'family_breach'
        default: null
    },
    revokedAt: {
        type: Date,
        default: null
    },
    successorToken: {
        type: String,
        default: null
    }
});

// Index for efficient cleanup and queries
refreshTokenSchema.index({ userId: 1, family: 1 });
refreshTokenSchema.index({ userId: 1, createdAt: -1 });
refreshTokenSchema.index({ expiresAt: 1 });

// Additional indexes for optimized analytics and security monitoring
refreshTokenSchema.index({ userId: 1, lastUsedAt: -1 });     // Usage tracking
refreshTokenSchema.index({ 'deviceInfo.deviceFingerprint': 1 }); // Device analysis
refreshTokenSchema.index({ revokedBy: 1, revokedAt: -1 });   // Revocation analysis
refreshTokenSchema.index({ userId: 1, isRevoked: 1, isUsed: 1 }); // Session filtering

// Static method to create a new token family
refreshTokenSchema.statics.createTokenFamily = function() {
    return require('crypto').randomBytes(16).toString('hex');
};

// Instance method to revoke token
refreshTokenSchema.methods.revoke = function(reason = 'user', successorToken = null) {
    this.isRevoked = true;
    this.revokedBy = reason;
    this.revokedAt = new Date();
    if (successorToken) {
        this.successorToken = successorToken;
    }
    return this.save();
};

// Static method to revoke entire token family (for security breaches)
refreshTokenSchema.statics.revokeFamily = async function(family, reason = 'family_breach') {
    return await this.updateMany(
        { family: family, isRevoked: false },
        {
            $set: {
                isRevoked: true,
                revokedBy: reason,
                revokedAt: new Date()
            }
        }
    );
};

// Static method to cleanup expired tokens
refreshTokenSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
    return result.deletedCount;
};

// Static method to get active tokens for a user
refreshTokenSchema.statics.getActiveTokensForUser = function(userId) {
    return this.find({
        userId: userId,
        isRevoked: false,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllForUser = async function(userId, reason = 'user') {
    return await this.updateMany(
        { userId: userId, isRevoked: false },
        {
            $set: {
                isRevoked: true,
                revokedBy: reason,
                revokedAt: new Date()
            }
        }
    );
};

// Static method to get token chain (successor tracking)
refreshTokenSchema.statics.getTokenChain = async function(startToken) {
    const chain = [];
    let currentToken = await this.findOne({ token: startToken });
    
    while (currentToken) {
        chain.push({
            token: currentToken.token.substring(0, 10) + '...', // Partial token for security
            family: currentToken.family,
            createdAt: currentToken.createdAt,
            isUsed: currentToken.isUsed,
            isRevoked: currentToken.isRevoked,
            revokedBy: currentToken.revokedBy
        });
        
        if (currentToken.successorToken) {
            currentToken = await this.findOne({ token: currentToken.successorToken });
        } else {
            break;
        }
    }
    
    return chain;
};

// Static method to get security analytics for a user
refreshTokenSchema.statics.getSecurityAnalytics = async function(userId, days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const tokens = await this.find({
        userId: userId,
        createdAt: { $gte: cutoffDate }
    });
    
    // Analyze device fingerprint changes
    const deviceChanges = [];
    const deviceMap = new Map();
    
    tokens.forEach(token => {
        const fingerprint = token.deviceInfo.deviceFingerprint;
        const ip = token.deviceInfo.ipAddress;
        
        if (deviceMap.has(fingerprint)) {
            const existing = deviceMap.get(fingerprint);
            if (existing.ip !== ip) {
                deviceChanges.push({
                    fingerprint: fingerprint.substring(0, 8) + '...',
                    oldIp: existing.ip,
                    newIp: ip,
                    changedAt: token.createdAt
                });
            }
        }
        
        deviceMap.set(fingerprint, { ip, lastSeen: token.createdAt });
    });
    
    // Count security events
    const securityEvents = {
        tokenReuse: tokens.filter(t => t.revokedBy === 'token_reuse').length,
        familyBreaches: tokens.filter(t => t.revokedBy === 'family_breach').length,
        deviceChanges: deviceChanges.length,
        suspiciousActivity: deviceChanges.length > 3 // More than 3 device changes in period
    };
    
    return {
        periodDays: days,
        totalTokens: tokens.length,
        uniqueDevices: deviceMap.size,
        deviceChanges: deviceChanges,
        securityEvents: securityEvents
    };
};

// Static method to find suspicious sessions
refreshTokenSchema.statics.findSuspiciousSessions = async function(userId) {
    const recentTokens = await this.find({
        userId: userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).sort({ createdAt: -1 });
    
    const suspicious = [];
    
    // Check for rapid token creation (potential brute force)
    const tokensByHour = new Map();
    recentTokens.forEach(token => {
        const hour = new Date(token.createdAt).setMinutes(0, 0, 0);
        tokensByHour.set(hour, (tokensByHour.get(hour) || 0) + 1);
    });
    
    tokensByHour.forEach((count, hour) => {
        if (count > 5) { // More than 5 tokens in one hour
            suspicious.push({
                type: 'rapid_token_creation',
                hour: new Date(hour),
                count: count,
                severity: 'high'
            });
        }
    });
    
    // Check for unusual IP patterns
    const ipCounts = new Map();
    recentTokens.forEach(token => {
        const ip = token.deviceInfo.ipAddress;
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    });
    
    if (ipCounts.size > 10) { // More than 10 different IPs in 7 days
        suspicious.push({
            type: 'multiple_ip_addresses',
            uniqueIps: ipCounts.size,
            severity: 'medium'
        });
    }
    
    return suspicious;
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema); 