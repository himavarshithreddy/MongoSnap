const crypto = require('crypto');

/**
 * Generate PayU hash for payment request
 * @param {Object} params - Payment parameters
 * @param {string} salt - PayU salt key
 * @returns {string} Generated hash
 */
const generatePaymentHash = (params, salt) => {
    const { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 } = params;
    
    // PayU hash formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1 || ''}|${udf2 || ''}|${udf3 || ''}|${udf4 || ''}|${udf5 || ''}||||||${salt}`;
    
    console.log('Hash string for payment:', hashString);
    
    return crypto.createHash('sha512').update(hashString).digest('hex');
};

/**
 * Verify PayU response hash
 * @param {Object} response - PayU response parameters
 * @param {string} salt - PayU salt key
 * @returns {boolean} Hash verification result
 */
const verifyResponseHash = (response, salt) => {
    try {
        const { 
            key, txnid, amount, productinfo, firstname, email, 
            udf1, udf2, udf3, udf4, udf5, status, hash 
        } = response;
        
        // Reverse hash formula: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
        const hashString = `${salt}|${status}||||||${udf5 || ''}|${udf4 || ''}|${udf3 || ''}|${udf2 || ''}|${udf1 || ''}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        
        console.log('Hash string for verification:', hashString);
        
        const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
        
        console.log('Generated hash:', generatedHash);
        console.log('Received hash:', hash);
        
        return generatedHash === hash;
    } catch (error) {
        console.error('Error verifying hash:', error);
        return false;
    }
};

/**
 * Generate unique transaction ID
 * @param {string} prefix - Optional prefix for transaction ID
 * @returns {string} Unique transaction ID
 */
const generateTransactionId = (prefix = 'TXN') => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}_${timestamp}_${random}`;
};

/**
 * Validate PayU payment parameters
 * @param {Object} params - Payment parameters to validate
 * @returns {Object} Validation result
 */
const validatePaymentParams = (params) => {
    const required = ['key', 'txnid', 'amount', 'productinfo', 'firstname', 'email'];
    const missing = [];
    
    for (const field of required) {
        if (!params[field] || params[field].toString().trim() === '') {
            missing.push(field);
        }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (params.email && !emailRegex.test(params.email)) {
        missing.push('email (invalid format)');
    }
    
    // Validate amount
    if (params.amount && (isNaN(params.amount) || parseFloat(params.amount) <= 0)) {
        missing.push('amount (must be a positive number)');
    }
    
    return {
        isValid: missing.length === 0,
        missing: missing
    };
};

/**
 * Format amount for PayU (ensure 2 decimal places)
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted amount
 */
const formatAmount = (amount) => {
    return parseFloat(amount).toFixed(2);
};

/**
 * Get PayU test card details for testing
 * @returns {Object} Test card information
 */
const getTestCardDetails = () => {
    return {
        success: {
            cardNumber: '5123456789012346',
            expiryMonth: '05',
            expiryYear: '2026',
            cvv: '123',
            name: 'Test User'
        },
        failure: {
            cardNumber: '4000000000000002',
            expiryMonth: '05',
            expiryYear: '2026',
            cvv: '123',
            name: 'Test User'
        }
    };
};

/**
 * Get PayU environment URLs
 * @param {boolean} isProduction - Whether to use production URLs
 * @returns {Object} PayU URLs
 */
const getPayUUrls = (isProduction = false) => {
    if (isProduction) {
        return {
            paymentUrl: 'https://secure.payu.in/_payment',
            verifyUrl: 'https://info.payu.in/merchant/postservice.php?form=2'
        };
    } else {
        return {
            paymentUrl: 'https://test.payu.in/_payment',
            verifyUrl: 'https://test.payu.in/merchant/postservice.php?form=2'
        };
    }
};

/**
 * Sanitize PayU response data for logging
 * @param {Object} response - PayU response
 * @returns {Object} Sanitized response (removes sensitive data)
 */
const sanitizeResponse = (response) => {
    const sensitiveFields = ['hash', 'cardnum', 'cardhash', 'bank_ref_num'];
    const sanitized = { ...response };
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***HIDDEN***';
        }
    });
    
    return sanitized;
};

module.exports = {
    generatePaymentHash,
    verifyResponseHash,
    generateTransactionId,
    validatePaymentParams,
    formatAmount,
    getTestCardDetails,
    getPayUUrls,
    sanitizeResponse
}; 