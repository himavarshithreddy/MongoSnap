const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    
    // Bug report details
    category: {
        type: String,
        required: true,
        enum: [
            'query_not_executing',
            'query_generation_failed',
            'connection_issues',
            'ui_bug',
            'performance_issue',
            'feature_request',
            'data_display_error',
            'authentication_problem',
            'export_functionality',
            'schema_explorer_issue',
            'other'
        ]
    },
    customCategory: {
        type: String,
        required: function() {
            return this.category === 'other';
        }
    },
    
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    
    // Technical context
    page: {
        type: String,
        required: true,
        enum: ['connect', 'playground', 'settings', 'pricing', 'home', 'other']
    },
    
    // Optional query/code that caused the issue
    problematicQuery: {
        type: String,
        maxlength: 5000
    },
    
    // Browser and system information
    browserInfo: {
        userAgent: String,
        browserName: String,
        browserVersion: String,
        osName: String,
        osVersion: String,
        screenResolution: String
    },
    
    // Database context (if applicable)
    connectionContext: {
        connectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Connection'
        },
        databaseName: String,
        collectionName: String,
        isTemporary: Boolean,
        isSample: Boolean
    },
    
    // Status and priority
    status: {
        type: String,
        default: 'open',
        enum: ['open', 'in_progress', 'resolved', 'closed', 'duplicate']
    },
    
    priority: {
        type: String,
        default: 'medium',
        enum: ['low', 'medium', 'high', 'urgent']
    },
    
    // Admin fields
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    adminNotes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    resolution: {
        type: String,
        maxlength: 1000
    },
    
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Tracking
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    // IP address for potential spam prevention
    ipAddress: String,
    
    // Duplicate tracking
    duplicateOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BugReport'
    }
});

// Update the updatedAt field before saving
bugReportSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Indexes for efficient querying
bugReportSchema.index({ userId: 1, createdAt: -1 });
bugReportSchema.index({ status: 1, priority: -1 });
bugReportSchema.index({ category: 1, createdAt: -1 });
bugReportSchema.index({ page: 1, createdAt: -1 });

// Static method to get predefined categories with descriptions
bugReportSchema.statics.getCategories = function() {
    return [
        {
            value: 'query_not_executing',
            label: 'Query Not Executing',
            description: 'MongoDB queries are failing to run or returning errors'
        },
        {
            value: 'query_generation_failed',
            label: 'AI Query Generation Failed',
            description: 'Natural language to MongoDB query conversion is not working properly'
        },
        {
            value: 'connection_issues',
            label: 'Database Connection Issues',
            description: 'Problems connecting to MongoDB database or connection timeouts'
        },
        {
            value: 'ui_bug',
            label: 'User Interface Bug',
            description: 'Visual glitches, layout issues, or buttons not working'
        },
        {
            value: 'performance_issue',
            label: 'Performance Issue',
            description: 'App is slow, freezing, or consuming too much memory'
        },
        {
            value: 'feature_request',
            label: 'Feature Request',
            description: 'Suggestion for a new feature or improvement'
        },
        {
            value: 'data_display_error',
            label: 'Data Display Error',
            description: 'Query results not displaying correctly or missing data'
        },
        {
            value: 'authentication_problem',
            label: 'Login/Authentication Problem',
            description: 'Issues with signing in, signing up, or session management'
        },
        {
            value: 'export_functionality',
            label: 'Export Functionality',
            description: 'Problems with database export or download features'
        },
        {
            value: 'schema_explorer_issue',
            label: 'Schema Explorer Issue',
            description: 'Schema not loading, incorrect structure display, or navigation problems'
        },
        {
            value: 'other',
            label: 'Other',
            description: 'Issue not covered by the above categories'
        }
    ];
};

// Instance method to get category description
bugReportSchema.methods.getCategoryDescription = function() {
    const categories = this.constructor.getCategories();
    const category = categories.find(cat => cat.value === this.category);
    return category ? category.description : 'No description available';
};

// Instance method to auto-assign priority based on category
bugReportSchema.methods.autoAssignPriority = function() {
    const highPriorityCategories = ['connection_issues', 'authentication_problem', 'query_not_executing'];
    const mediumPriorityCategories = ['query_generation_failed', 'data_display_error', 'export_functionality'];
    
    if (highPriorityCategories.includes(this.category)) {
        this.priority = 'high';
    } else if (mediumPriorityCategories.includes(this.category)) {
        this.priority = 'medium';
    } else {
        this.priority = 'low';
    }
};

module.exports = mongoose.model('BugReport', bugReportSchema); 