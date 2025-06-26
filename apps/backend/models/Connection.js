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
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

connectionSchema.index({ userId: 1, nickname: 1 }, { unique: true });
const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;