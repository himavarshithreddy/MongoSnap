const crypto = require('crypto');
const axios = require('axios');

/**
 * Get CashFree configuration based on environment
 * @param {boolean} isProduction - Whether to use production URLs
 * @returns {Object} CashFree configuration
 */
const getCashFreeConfig = (isProduction = false) => {
    const baseUrl = isProduction 
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
    
    const clientId = isProduction 
        ? process.env.CASHFREE_CLIENT_ID_PROD 
        : process.env.CASHFREE_CLIENT_ID_TEST;
    
    const clientSecret = isProduction 
        ? process.env.CASHFREE_CLIENT_SECRET_PROD 
        : process.env.CASHFREE_CLIENT_SECRET_TEST;
    
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
        'x-request-id': crypto.randomUUID()
    };
    
    if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
    }
    
    return headers;
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
 * Generate unique customer ID
 * @param {string} userId - User ID
 * @returns {string} Unique customer ID
 */
const generateCustomerId = (userId) => {
    return `CUST_${userId}_${Date.now()}`;
};

/**
 * Create CashFree order
 * @param {Object} orderData - Order data
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {Promise<Object>} Order creation response
 */
const createOrder = async (orderData, isProduction = false) => {
    try {
        const config = getCashFreeConfig(isProduction);
        const headers = generateHeaders(config, crypto.randomUUID());
        
        const orderPayload = {
            order_id: orderData.order_id,
            order_amount: orderData.order_amount,
            order_currency: orderData.order_currency || 'INR',
            customer_details: {
                customer_id: orderData.customer_details.customer_id,
                customer_phone: orderData.customer_details.customer_phone,
                customer_name: orderData.customer_details.customer_name,
                customer_email: orderData.customer_details.customer_email
            },
            order_meta: {
                return_url: orderData.order_meta.return_url,
                notify_url: orderData.order_meta.notify_url,
                payment_methods: orderData.order_meta.payment_methods || 'cc,dc,nb,upi,paylater,emi,cardlessemi'
            },
            order_tags: orderData.order_tags || {}
        };
        
        console.log('Creating CashFree order:', {
            order_id: orderPayload.order_id,
            amount: orderPayload.order_amount,
            customer_id: orderPayload.customer_details.customer_id
        });
        
        const response = await axios.post(
            `${config.baseUrl}/orders`,
            orderPayload,
            { headers }
        );
        
        console.log('CashFree order created successfully:', {
            cf_order_id: response.data.cf_order_id,
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
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {Promise<Object>} Order details
 */
const getOrder = async (orderId, isProduction = false) => {
    try {
        const config = getCashFreeConfig(isProduction);
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
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {Promise<Object>} Payments list
 */
const getOrderPayments = async (orderId, isProduction = false) => {
    try {
        const config = getCashFreeConfig(isProduction);
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
 * Verify webhook authenticity
 * Note: CashFree doesn't use webhook secrets like other payment gateways
 * Instead, we verify the webhook by checking the order status with CashFree API
 * @param {Object} webhookData - Webhook payload
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {Promise<boolean>} Verification result
 */
const verifyWebhookAuthenticity = async (webhookData, isProduction = false) => {
    try {
        const { data } = webhookData;
        if (!data || !data.order || !data.order.order_id) {
            console.error('Invalid webhook data structure');
            return false;
        }

        const orderId = data.order.order_id;
        
        // Verify webhook by fetching order details from CashFree
        const orderResponse = await getOrder(orderId, isProduction);
        
        if (!orderResponse.success) {
            console.error('Failed to verify webhook with CashFree API:', orderResponse.error);
            return false;
        }

        const orderData = orderResponse.data;
        
        // Compare critical fields to ensure webhook authenticity
        const webhookOrder = data.order;
        const apiOrder = orderData;
        
        const isAuthentic = (
            webhookOrder.order_id === apiOrder.order_id &&
            webhookOrder.order_amount === apiOrder.order_amount &&
            webhookOrder.order_currency === apiOrder.order_currency
        );

        console.log('Webhook authenticity verification:', {
            orderId,
            isAuthentic,
            webhookAmount: webhookOrder.order_amount,
            apiAmount: apiOrder.order_amount
        });

        return isAuthentic;

    } catch (error) {
        console.error('Error verifying webhook authenticity:', error);
        return false;
    }
};

/**
 * Process payment using CashFree session
 * @param {string} paymentSessionId - Payment session ID
 * @param {Object} paymentMethod - Payment method details
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {Promise<Object>} Payment processing result
 */
const processPayment = async (paymentSessionId, paymentMethod, isProduction = false) => {
    try {
        const config = getCashFreeConfig(isProduction);
        const headers = {
            'Content-Type': 'application/json',
            'x-api-version': config.apiVersion
        };
        
        const paymentPayload = {
            payment_session_id: paymentSessionId,
            payment_method: paymentMethod
        };
        
        console.log('Processing CashFree payment:', {
            payment_session_id: paymentSessionId,
            payment_method: Object.keys(paymentMethod)[0]
        });
        
        const response = await axios.post(
            `${config.baseUrl}/orders/sessions`,
            paymentPayload,
            { headers }
        );
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('Error processing CashFree payment:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Validate order parameters
 * @param {Object} params - Order parameters to validate
 * @returns {Object} Validation result
 */
const validateOrderParams = (params) => {
    const required = ['order_id', 'order_amount', 'customer_details'];
    const missing = [];
    
    for (const field of required) {
        if (!params[field]) {
            missing.push(field);
        }
    }
    
    // Validate customer details
    if (params.customer_details) {
        const customerRequired = ['customer_id', 'customer_phone', 'customer_name', 'customer_email'];
        for (const field of customerRequired) {
            if (!params.customer_details[field]) {
                missing.push(`customer_details.${field}`);
            }
        }
    }
    
    // Validate amount
    if (params.order_amount && (isNaN(params.order_amount) || parseFloat(params.order_amount) <= 0)) {
        missing.push('order_amount (must be a positive number)');
    }
    
    // Validate email format
    if (params.customer_details?.customer_email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(params.customer_details.customer_email)) {
            missing.push('customer_details.customer_email (invalid format)');
        }
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
 * Get CashFree checkout URL
 * @param {string} paymentSessionId - Payment session ID
 * @param {boolean} isProduction - Whether to use production environment
 * @returns {string} Checkout URL
 */
const getCheckoutUrl = (paymentSessionId, isProduction = false) => {
    const baseUrl = isProduction 
        ? 'https://pay.cashfree.com'
        : 'https://sandbox.cashfree.com/pg/view';
    
    return `${baseUrl}/${paymentSessionId}`;
};

/**
 * Sanitize CashFree response data for logging
 * @param {Object} response - CashFree response
 * @returns {Object} Sanitized response (removes sensitive data)
 */
const sanitizeResponse = (response) => {
    const sensitiveFields = ['payment_session_id', 'cf_payment_id', 'bank_reference', 'auth_id'];
    const sanitized = { ...response };
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***HIDDEN***';
        }
    });
    
    return sanitized;
};

module.exports = {
    getCashFreeConfig,
    generateHeaders,
    generateOrderId,
    generateCustomerId,
    createOrder,
    getOrder,
    getOrderPayments,
    verifyWebhookAuthenticity,
    processPayment,
    validateOrderParams,
    formatAmount,
    getCheckoutUrl,
    sanitizeResponse
}; 