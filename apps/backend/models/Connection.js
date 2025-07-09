const mongoose = require('mongoose');
const connectionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    nickname: {
        type: String,
        required: true,
        trim: true,
    },
    uri: {
        type: String,
        required: function() {
            // URI is required only for non-temporary connections
            return !this.isTemporary;
        },
        encrypted: true,
    },
    lastUsed: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    isConnected: {
        type: Boolean,
        default: false,
    },
    isAlive: {
        type: Boolean,
        default: false,
    },
    disconnectedAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    isSample: {
        type: Boolean,
        default: false,
    },
    isTemporary: {
        type: Boolean,
        default: false,
    },
    tempExpiresAt: {
        type: Date,
        default: null,
    },
    originalFileName: {
        type: String,
        default: null,
    },
    tempDatabaseName: {
        type: String,
        default: null,
    },
});

connectionSchema.index({ userId: 1, nickname: 1 }, { unique: true });
connectionSchema.index({ tempExpiresAt: 1 }, { sparse: true }); // For cleanup queries
const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;