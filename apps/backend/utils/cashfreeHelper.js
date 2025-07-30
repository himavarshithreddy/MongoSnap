const crypto = require('crypto');
const axios = require('axios');

/**
 * Get CashFree configuration (production only)
 * @returns {Object} CashFree configuration
 */
const getCashFreeConfig = () => {
    const baseUrl = 
        'https://api.cashfree.com/pg';
      
    
    const clientId = process.env.CASHFREE_CLIENT_ID_PROD;
    
    const clientSecret =process.env.CASHFREE_CLIENT_SECRET_PROD;
    
    return {
        baseUrl,
        clientId,
        clientSecret,
        apiVersion: '2023-08-01'
    };
};

/**
 * Generate CashFree headers for API requests
 * @param {Object} config - CashFree configuration
 * @param {string} idempotencyKey - Optional idempotency key
 * @returns {Object} Headers object
 */
const generateHeaders = (config, idempotencyKey = null) => {
    const headers = {
        'Content-Type': 'application/json',
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-api-version': config.apiVersion,
        'x-request-id': generateRequestId()
    };
    
    if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
    }
    
    return headers;
};

/**
 * Generate unique request ID
 * @returns {string} Unique request ID
 */
const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique order ID
 * @param {string} prefix - Optional prefix for order ID
 * @returns {string} Unique order ID
 */
const generateOrderId = (prefix = 'MONGOSNAP') => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}_${timestamp}_${random}`;
};

/**
 * Create CashFree order
 * @param {Object} orderData - Order data
 * @returns {Promise<Object>} Order creation response
 */
const createOrder = async (orderData) => {
    try {
        const config = getCashFreeConfig();
        const headers = generateHeaders(config, orderData.order_id);
        
        const orderPayload = {
            order_id: orderData.order_id,
            order_amount: orderData.order_amount,
            order_currency: orderData.order_currency || 'INR',
            customer_details: {
                customer_id: orderData.customer_id,
                customer_phone: orderData.customer_phone,
                customer_email: orderData.customer_email,
                customer_name: orderData.customer_name
            },
            order_meta: {
                return_url: orderData.return_url,
                notify_url: orderData.notify_url
            },
            order_tags: {
                subscription_plan: orderData.subscription_plan,
                subscription_duration: orderData.subscription_duration.toString()
            }
        };
        
        console.log('Creating CashFree order:', {
            order_id: orderData.order_id,
            amount: orderData.order_amount,
            customer_id: orderData.customer_id
        });
        
        const response = await axios.post(
            `${config.baseUrl}/orders`,
            orderPayload,
            { headers }
        );
        
        console.log('CashFree order created successfully:', {
            order_id: response.data.order_id,
            payment_session_id: response.data.payment_session_id
        });
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('Error creating CashFree order:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Get order details from CashFree
 * @param {string} orderId - CashFree order ID
 * @returns {Promise<Object>} Order details
 */
const getOrder = async (orderId) => {
    try {
        const config = getCashFreeConfig();
        const headers = generateHeaders(config);
        
        const response = await axios.get(
            `${config.baseUrl}/orders/${orderId}`,
            { headers }
        );
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('Error fetching CashFree order:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Get payments for an order
 * @param {string} orderId - CashFree order ID
 * @returns {Promise<Object>} Payments list
 */
const getOrderPayments = async (orderId) => {
    try {
        const config = getCashFreeConfig();
        const headers = generateHeaders(config);
        
        const response = await axios.get(
            `${config.baseUrl}/orders/${orderId}/payments`,
            { headers }
        );
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('Error fetching CashFree payments:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Verify webhook signature
 * @param {string} timestamp - Webhook timestamp
 * @param {string} signature - Webhook signature
 * @param {string} rawBody - Raw request body
 * @returns {boolean} Signature verification result
 */
const verifyWebhookSignature = (timestamp, signature, rawBody) => {
    try {
        const config = getCashFreeConfig();
        const expectedSignature = crypto
            .createHmac('sha256', config.clientSecret)
            .update(timestamp + rawBody)
            .digest('base64');
        
        console.log('Webhook signature verification:', {
            received: signature,
            expected: expectedSignature,
            match: signature === expectedSignature
        });
        
        return signature === expectedSignature;
        
    } catch (error) {
        console.error('Error verifying webhook signature:', error);
        return false;
    }
};

/**
 * Validate order data
 * @param {Object} orderData - Order data to validate
 * @returns {Object} Validation result
 */
const validateOrderData = (orderData) => {
    const required = ['order_id', 'order_amount', 'customer_id', 'customer_phone', 'customer_email', 'customer_name'];
    const missing = [];
    
    for (const field of required) {
        if (!orderData[field] || orderData[field].toString().trim() === '') {
            missing.push(field);
        }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (orderData.customer_email && !emailRegex.test(orderData.customer_email)) {
        missing.push('customer_email (invalid format)');
    }
    
    // Validate amount
    if (orderData.order_amount && (isNaN(orderData.order_amount) || parseFloat(orderData.order_amount) <= 0)) {
        missing.push('order_amount (must be a positive number)');
    }
    
    // Validate phone number (Indian format)
    const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    if (orderData.customer_phone && !phoneRegex.test(orderData.customer_phone.replace(/\s/g, ''))) {
        missing.push('customer_phone (invalid Indian phone number)');
    }
    
    return {
        isValid: missing.length === 0,
        missing: missing
    };
};

/**
 * Format amount for CashFree (ensure 2 decimal places)
 * @param {number|string} amount - Amount to format
 * @returns {number} Formatted amount
 */
const formatAmount = (amount) => {
    return parseFloat(amount).toFixed(2);
};

/**
 * Sanitize CashFree response data for logging
 * @param {Object} response - CashFree response
 * @returns {Object} Sanitized response (removes sensitive data)
 */
const sanitizeResponse = (response) => {
    const sensitiveFields = ['payment_session_id', 'cf_payment_id', 'bank_reference', 'card_number'];
    const sanitized = { ...response };
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***HIDDEN***';
        }
    });
    
    return sanitized;
};

/**
 * Get CashFree test credentials for testing
 * @returns {Object} Test credentials information
 */
const getTestCredentials = () => {
    return {
        clientId: 'TEST_CLIENT_ID',
        clientSecret: 'TEST_CLIENT_SECRET',
        baseUrl: 'https://sandbox.cashfree.com/pg'
    };
};

module.exports = {
    getCashFreeConfig,
    generateHeaders,
    generateRequestId,
    generateOrderId,
    createOrder,
    getOrder,
    getOrderPayments,
    verifyWebhookSignature,
    validateOrderData,
    formatAmount,
    sanitizeResponse,
    getTestCredentials
}; 