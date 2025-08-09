const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Gateway Transaction details
    txnid: {
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
    
    // Gateway response fields (PayU / Cashfree)
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
        required: true
    },
    
    keyid: {
        type: String,
        default: null
    },
    
    hash: {
        type: String,
        required: true
    },
    
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
    
    PG_TYPE: {
        type: String,
        default: null
    },
    
    bank_ref_num: {
        type: String,
        default: null
    },
    
    // Cashfree identifiers
    cf_order_id: { type: String, default: null },
    cf_payment_session_id: { type: String, default: null },
    cf_order_status: { type: String, default: null },

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

// Track if upgrade email sent (idempotency across webhooks)
paymentTransactionSchema.add({
    upgradeEmailSent: { type: Boolean, default: false }
});

// Update the updatedAt field before saving
paymentTransactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for efficient queries
paymentTransactionSchema.index({ userId: 1, status: 1 });
paymentTransactionSchema.index({ mihpayid: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema); 