const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    // Contact information
    name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    
    email: {
        type: String,
        required: true,
        maxlength: 255,
        trim: true,
        lowercase: true
    },
    
    // Message details
    subject: {
        type: String,
        required: true,
        maxlength: 200,
        trim: true
    },
    
    message: {
        type: String,
        required: true,
        maxlength: 2000,
        trim: true
    },
    
    category: {
        type: String,
        required: true,
        enum: [
            'general',
            'technical',
            'billing',
            'partnership',
            'feedback',
            'bug'
        ],
        default: 'general'
    },
    
    // Status tracking
    status: {
        type: String,
        default: 'new',
        enum: ['new', 'in_progress', 'responded', 'closed', 'spam']
    },
    
    priority: {
        type: String,
        default: 'medium',
        enum: ['low', 'medium', 'high', 'urgent']
    },
    
    // Admin fields
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
    
    response: {
        type: String,
        maxlength: 2000
    },
    
    respondedAt: Date,
    respondedBy: {
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
    
    // IP address for spam prevention
    ipAddress: String,
    
    // User context (if logged in)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Update the updatedAt field before saving
contactSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Indexes for efficient querying
contactSchema.index({ status: 1, priority: -1, createdAt: -1 });
contactSchema.index({ category: 1, createdAt: -1 });
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ userId: 1, createdAt: -1 });

// Static method to get predefined categories with descriptions
contactSchema.statics.getCategories = function() {
    return [
        {
            value: 'general',
            label: 'General Inquiry',
            description: 'General questions about MongoSnap'
        },
        {
            value: 'technical',
            label: 'Technical Support',
            description: 'Technical issues or questions'
        },
        {
            value: 'billing',
            label: 'Billing & Pricing',
            description: 'Questions about pricing or billing'
        },
        {
            value: 'partnership',
            label: 'Partnership',
            description: 'Partnership or collaboration inquiries'
        },
        {
            value: 'feedback',
            label: 'Feature Request',
            description: 'Feature suggestions or feedback'
        },
        {
            value: 'bug',
            label: 'Bug Report',
            description: 'Report a bug or issue'
        }
    ];
};

// Method to check if email has submitted too many messages recently (spam prevention)
contactSchema.statics.checkSpam = async function(email, hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMessages = await this.countDocuments({
        email: email.toLowerCase(),
        createdAt: { $gte: cutoffTime }
    });
    return recentMessages >= 5; // Allow max 5 messages per 24 hours
};

module.exports = mongoose.model('Contact', contactSchema); 