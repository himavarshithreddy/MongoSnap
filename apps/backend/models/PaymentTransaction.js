const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // CashFree Order details
    order_id: {
        type: String,
        required: true,
        unique: true
    },
    
    // Order information
    amount: {
        type: Number,
        required: true
    },
    
    productinfo: {
        type: String,
        required: true
    },
    
    firstname: {
        type: String,
        required: true
    },
    
    email: {
        type: String,
        required: true
    },
    
    phone: {
        type: String,
        required: true
    },
    
    // CashFree response fields
    cf_payment_id: {
        type: String,
        default: null
    },
    
    payment_session_id: {
        type: String,
        default: null
    },
    
    order_status: {
        type: String,
        enum: ['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'],
        default: 'ACTIVE'
    },
    
    payment_status: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED'],
        default: 'PENDING'
    },
    
    // Legacy PayU fields (for backward compatibility)
    txnid: {
        type: String,
        default: null,
        sparse: true // Allow multiple null values
    },
    
    mihpayid: {
        type: String,
        default: null
    },
    
    mode: {
        type: String,
        default: null
    },
    
    status: {
        type: String,
        enum: ['pending', 'success', 'failure', 'cancelled', 'refunded'],
        default: 'pending'
    },
    
    unmappedstatus: {
        type: String,
        default: null
    },
    
    key: {
        type: String,
        default: null
    },
    
    keyid: {
        type: String,
        default: null
    },
    
    hash: {
        type: String,
        default: null
    },
    
    // CashFree specific fields
    payment_method: {
        type: String,
        default: null
    },
    
    payment_gateway_details: {
        type: Object,
        default: null
    },
    
    bank_reference: {
        type: String,
        default: null
    },
    
    upi_id: {
        type: String,
        default: null
    },
    
    card_number: {
        type: String,
        default: null
    },
    
    card_network: {
        type: String,
        default: null
    },
    
    card_type: {
        type: String,
        default: null
    },
    
    card_country: {
        type: String,
        default: null
    },
    
    card_bank_name: {
        type: String,
        default: null
    },
    
    // Legacy PayU fields (for backward compatibility)
    field1: {
        type: String,
        default: null
    },
    
    field2: {
        type: String,
        default: null
    },
    
    field3: {
        type: String,
        default: null
    },
    
    field4: {
        type: String,
        default: null
    },
    
    field5: {
        type: String,
        default: null
    },
    
    field6: {
        type: String,
        default: null
    },
    
    field7: {
        type: String,
        default: null
    },
    
    field8: {
        type: String,
        default: null
    },
    
    field9: {
        type: String,
        default: null
    },
    
    PG_TYPE: {
        type: String,
        default: null
    },
    
    bank_ref_num: {
        type: String,
        default: null
    },
    
    bankcode: {
        type: String,
        default: null
    },
    
    error: {
        type: String,
        default: null
    },
    
    error_Message: {
        type: String,
        default: null
    },
    
    name_on_card: {
        type: String,
        default: null
    },
    
    cardnum: {
        type: String,
        default: null
    },
    
    cardhash: {
        type: String,
        default: null
    },
    
    payment_source: {
        type: String,
        default: null
    },
    
    // Additional tracking fields
    subscriptionPlan: {
        type: String,
        enum: ['snap', 'snapx'],
        required: true
    },
    
    // Subscription duration for SnapX plans
    subscriptionDuration: {
        type: Number, // Duration in days
        default: 30
    },
    
    // Webhook verification
    webhookVerified: {
        type: Boolean,
        default: false
    },
    
    // CashFree webhook event type
    webhookEventType: {
        type: String,
        enum: ['PAYMENT_SUCCESS_WEBHOOK', 'PAYMENT_FAILED_WEBHOOK', 'PAYMENT_USER_DROPPED_WEBHOOK'],
        default: null
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    paymentDate: {
        type: Date,
        default: null
    }
});

// Update the updatedAt field before saving
paymentTransactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for efficient queries
paymentTransactionSchema.index({ userId: 1, payment_status: 1 });
paymentTransactionSchema.index({ order_id: 1 });
paymentTransactionSchema.index({ cf_payment_id: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

// Sparse index for txnid to handle null values properly
paymentTransactionSchema.index({ txnid: 1 }, { sparse: true });

// Note: txnid field is maintained for backward compatibility
// No virtual needed as txnid is a real field in the schema

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema); 