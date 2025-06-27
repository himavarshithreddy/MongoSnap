const mongoose = require('mongoose');

const savedQuerySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    connectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Connection',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    query: {
        type: String,
        required: true,
    },
    naturalLanguage: {
        type: String,
        default: null, // Store the original natural language if AI-generated
    },
    generatedQuery: {
        type: String,
        default: null, // Store the AI-generated MongoDB query
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        default: null, // Store the query result when saved
    },
    tags: [{
        type: String,
        trim: true,
    }],
    collection: {
        type: String,
        default: null,
    },
    operation: {
        type: String,
        default: null, // find, insert, update, delete, aggregate, etc.
    },
    isPublic: {
        type: Boolean,
        default: false, // For future feature: sharing queries
    },
    usageCount: {
        type: Number,
        default: 0, // Track how many times this saved query has been used
    },
    lastUsed: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for efficient querying
savedQuerySchema.index({ userId: 1, createdAt: -1 });
savedQuerySchema.index({ userId: 1, connectionId: 1 });
savedQuerySchema.index({ userId: 1, name: 1 }, { unique: true });
savedQuerySchema.index({ userId: 1, tags: 1 });
savedQuerySchema.index({ userId: 1, collection: 1 });

// Update the updatedAt field before saving
savedQuerySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const SavedQuery = mongoose.model('SavedQuery', savedQuerySchema);

module.exports = SavedQuery; 