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
        required: true,
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
});

connectionSchema.index({ userId: 1, nickname: 1 }, { unique: true });
const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;