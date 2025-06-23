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
    oauthId: { type: String, default: null }, // OAuth provider's user ID
});
module.exports = mongoose.model('User', userSchema);