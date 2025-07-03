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
});
module.exports = mongoose.model('User', userSchema);