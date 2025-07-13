const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function() {
            return !this.oauthProvider; // Password only required for non-OAuth users
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    oauthProvider: { type: String, default: null }, // 'google', 'github', etc.
    oauthId: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactormethod: { type: String, default: null },
    twoFactorToken: { type: String, default: null },
    twoFactorExpiresAt: { type: Date, default: null },
    twoFactorSecret: { type: String, default: null },
    twoFactorSetupPending: { type: Boolean, default: false },
    backupCodes: [{ 
        code: { type: String, required: true },
        used: { type: Boolean, default: false },
        usedAt: { type: Date, default: null }
    }],
    loginNotificationsEnabled: { type: Boolean, default: true },
    // Admin privileges
    isAdmin: { type: Boolean, default: false },
    // Subscription plan
    subscriptionPlan: { 
        type: String, 
        enum: ['snap', 'snapx'], 
        default: 'snap' 
    },
    subscriptionStatus: { 
        type: String, 
        enum: ['active', 'inactive', 'cancelled', 'trial'], 
        default: 'active' 
    },
    subscriptionExpiresAt: { type: Date, default: null },
    // CSRF Protection
    csrfToken: { type: String, default: null },
    csrfTokenExpiresAt: { type: Date, default: null },
    // Refresh token tracking
    refreshTokenFamily: { type: String, default: null },
    lastActiveTokenFamily: { type: String, default: null }
});

// Method to generate new CSRF token
userSchema.methods.generateCSRFToken = function() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.csrfToken = token;
    this.csrfTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
};

// Method to validate CSRF token
userSchema.methods.validateCSRFToken = function(token) {
    if (!this.csrfToken || !this.csrfTokenExpiresAt) {
        return false;
    }
    if (new Date() > this.csrfTokenExpiresAt) {
        return false;
    }
    return this.csrfToken === token;
};

// Method to clear expired CSRF token
userSchema.methods.clearExpiredCSRFToken = function() {
    if (this.csrfTokenExpiresAt && new Date() > this.csrfTokenExpiresAt) {
        this.csrfToken = null;
        this.csrfTokenExpiresAt = null;
        return true;
    }
    return false;
};

// Method to check if user has active subscription
userSchema.methods.hasActiveSubscription = function() {
    if (this.subscriptionStatus === 'inactive') {
        return false;
    }
    
    // If subscription has expiration date, check if it's expired
    if (this.subscriptionExpiresAt && new Date() > this.subscriptionExpiresAt) {
        return false;
    }
    
    // Active, cancelled, or trial subscriptions are considered active until expiration
    return this.subscriptionStatus === 'active' || this.subscriptionStatus === 'cancelled' || this.subscriptionStatus === 'trial';
};

// Method to check if user is on SnapX plan
userSchema.methods.isSnapXUser = function() {
    return this.subscriptionPlan === 'snapx' && this.hasActiveSubscription();
};

// Method to check if user is on free Snap plan
userSchema.methods.isSnapUser = function() {
    return this.subscriptionPlan === 'snap' || !this.hasActiveSubscription();
};

module.exports = mongoose.model('User', userSchema);