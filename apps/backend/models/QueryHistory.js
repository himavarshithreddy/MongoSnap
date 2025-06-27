const mongoose = require('mongoose');

const queryHistorySchema = new mongoose.Schema({
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
        default: null,
    },
    status: {
        type: String,
        enum: ['success', 'error'],
        required: true,
    },
    errorMessage: {
        type: String,
        default: null,
    },
    executionTime: {
        type: Number, // in milliseconds
        default: null,
    },
    documentsAffected: {
        type: Number,
        default: null,
    },
    collection: {
        type: String,
        default: null,
    },
    operation: {
        type: String,
        default: null, // find, insert, update, delete, aggregate, etc.
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for efficient querying
queryHistorySchema.index({ userId: 1, createdAt: -1 });
queryHistorySchema.index({ userId: 1, connectionId: 1, createdAt: -1 });
queryHistorySchema.index({ userId: 1, status: 1 });
queryHistorySchema.index({ userId: 1, collection: 1 });

const QueryHistory = mongoose.model('QueryHistory', queryHistorySchema);

module.exports = QueryHistory; 