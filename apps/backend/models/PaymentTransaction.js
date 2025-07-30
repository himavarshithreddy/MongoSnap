const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // CashFree Order details
    cf_order_id: {
        type: String,
        required: true,
        unique: true
    },
    
    payment_session_id: {
        type: String,
        required: true
    },
    
    // Order information
    order_amount: {
        type: Number,
        required: true
    },
    
    order_currency: {
        type: String,
        default: 'INR'
    },
    
    order_status: {
        type: String,
        enum: ['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATION_REQUESTED', 'TERMINATED'],
        default: 'ACTIVE'
    },
    
    // Customer details
    customer_details: {
        customer_id: {
            type: String,
            required: true
        },
        customer_phone: {
            type: String,
            required: true
        },
        customer_name: {
            type: String,
            required: true
        },
        customer_email: {
            type: String,
            required: true
        }
    },
    
    // CashFree Payment details
    cf_payment_id: {
        type: String,
        default: null
    },
    
    payment_status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
        default: 'PENDING'
    },
    
    payment_method: {
        type: String,
        default: null
    },
    
    payment_channel: {
        type: String,
        default: null
    },
    
    // Payment gateway details
    payment_gateway_details: {
        gateway_order_id: {
            type: String,
            default: null
        },
        gateway_payment_id: {
            type: String,
            default: null
        },
        gateway_status: {
            type: String,
            default: null
        },
        gateway_time: {
            type: Date,
            default: null
        },
        bank_reference: {
            type: String,
            default: null
        },
        auth_id: {
            type: String,
            default: null
        },
        authorization: {
            type: Object,
            default: null
        }
    },
    
    // Error details (for failed payments)
    error_details: {
        error_code: {
            type: String,
            default: null
        },
        error_description: {
            type: String,
            default: null
        },
        error_reason: {
            type: String,
            default: null
        },
        error_source: {
            type: String,
            default: null
        },
        error_type: {
            type: String,
            default: null
        }
    },
    
    // Order metadata
    order_meta: {
        return_url: {
            type: String,
            default: null
        },
        notify_url: {
            type: String,
            default: null
        },
        payment_methods: {
            type: String,
            default: null
        }
    },
    
    // Order tags for additional data
    order_tags: {
        subscription_plan: {
            type: String,
            enum: ['snap', 'snapx'],
            required: true
        },
        subscription_duration: {
            type: Number, // Duration in days
            default: 30
        },
        user_id: {
            type: String,
            required: true
        }
    },
    
    // Webhook verification
    webhook_verified: {
        type: Boolean,
        default: false
    },
    
    // Timestamps
    created_at: {
        type: Date,
        default: Date.now
    },
    
    updated_at: {
        type: Date,
        default: Date.now
    },
    
    payment_date: {
        type: Date,
        default: null
    },
    
    order_expiry_time: {
        type: Date,
        default: null
    }
});

// Update the updated_at field before saving
paymentTransactionSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

// Index for efficient queries
paymentTransactionSchema.index({ userId: 1, payment_status: 1 });
paymentTransactionSchema.index({ cf_order_id: 1 });
paymentTransactionSchema.index({ cf_payment_id: 1 });
paymentTransactionSchema.index({ created_at: -1 });
paymentTransactionSchema.index({ 'customer_details.customer_id': 1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema); 