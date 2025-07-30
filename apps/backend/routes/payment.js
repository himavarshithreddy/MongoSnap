const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken, verifyTokenAndValidateCSRF } = require('./middleware');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const {
    createOrder,
    getOrder,
    getOrderPayments,
    verifyWebhookAuthenticity,
    generateOrderId,
    generateCustomerId,
    validateOrderParams,
    formatAmount,
    getCheckoutUrl,
    sanitizeResponse
} = require('../utils/cashfreeHelper');
const { sendPaymentConfirmationEmail, sendPlanUpgradeEmail } = require('../utils/mailer');

// Rate limiters for payment operations
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 payment attempts per 15 minutes per IP
    message: { message: 'Too many payment attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Payment rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many payment attempts, please try again later' });
    }
});

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 webhook calls per minute per IP
    message: { message: 'Webhook rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * POST /api/payment/create-order
 * Create CashFree payment order
 */
router.post('/create-order', paymentLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
    try {
        const userId = req.userId;
        const { subscriptionPlan, phone } = req.body;

        console.log('Creating CashFree payment order:', { userId, subscriptionPlan, phone });

        // Validate subscription plan
        if (!subscriptionPlan || !['snapx'].includes(subscriptionPlan)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription plan. Only "snapx" is available for payment.'
            });
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already has an active SnapX subscription
        if (user.isSnapXUser()) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active SnapX subscription'
            });
        }

        // Validate phone number (accepts 10 digits, +91XXXXXXXXXX, or 91XXXXXXXXXX)
        let normalized = (phone || '').toString().replace(/[^\d+]/g, '');
        let valid = false;
        if (normalized.startsWith('+91') && /^\+91\d{10}$/.test(normalized)) {
            valid = true;
        } else {
            if (normalized.startsWith('+91')) normalized = normalized.slice(3);
            else if (normalized.startsWith('91')) normalized = normalized.slice(2);
            if (/^\d{10}$/.test(normalized)) valid = true;
        }
        if (!valid) {
            return res.status(400).json({
                success: false,
                message: 'Valid 10-digit phone number is required'
            });
        }

        // Check CashFree configuration
        const isProduction = process.env.NODE_ENV === 'production';
        const clientId = isProduction 
            ? process.env.CASHFREE_CLIENT_ID_PROD 
            : process.env.CASHFREE_CLIENT_ID_TEST;
        const clientSecret = isProduction 
            ? process.env.CASHFREE_CLIENT_SECRET_PROD 
            : process.env.CASHFREE_CLIENT_SECRET_TEST;

        if (!clientId || !clientSecret) {
            console.error('CashFree configuration missing');
            console.error('CashFree Client ID present:', !!clientId);
            console.error('CashFree Client Secret present:', !!clientSecret);
            console.error('Environment:', process.env.NODE_ENV);
            return res.status(500).json({
                success: false,
                message: 'Payment configuration error'
            });
        }

        console.log('CashFree Configuration:');
        console.log('Environment:', isProduction ? 'production' : 'test');
        console.log('CashFree Client ID (first 6 chars):', clientId ? clientId.substring(0, 6) + '...' : 'MISSING');

        // Generate order ID and customer ID
        const orderId = generateOrderId('MONGOSNAP');
        const customerId = generateCustomerId(userId);
        
        // Set amount based on subscription plan
        const amount = formatAmount(1); // SnapX price: ₹1

        // Prepare order data
        const orderData = {
            order_id: orderId,
            order_amount: parseFloat(amount),
            order_currency: 'INR',
            customer_details: {
                customer_id: customerId,
                customer_phone: phone,
                customer_name: user.name,
                customer_email: user.email
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/payment/success`,
                notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`,
                payment_methods: 'cc,dc,nb,upi,paylater,emi,cardlessemi'
            },
            order_tags: {
                subscription_plan: subscriptionPlan,
                subscription_duration: 30,
                user_id: userId.toString()
            }
        };

        // Validate order parameters
        const validation = validateOrderParams(orderData);
        if (!validation.isValid) {
            console.error('Order parameter validation failed:', validation.missing);
            return res.status(400).json({
                success: false,
                message: 'Order parameter validation failed',
                missing: validation.missing
            });
        }

        // Create order in CashFree
        const cashfreeResponse = await createOrder(orderData, isProduction);
        
        if (!cashfreeResponse.success) {
            console.error('CashFree order creation failed:', cashfreeResponse.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment order'
            });
        }

        const { cf_order_id, payment_session_id, order_status } = cashfreeResponse.data;

        // Save transaction to database
        const transaction = new PaymentTransaction({
            userId: userId,
            cf_order_id: cf_order_id,
            payment_session_id: payment_session_id,
            order_amount: parseFloat(amount),
            order_currency: 'INR',
            order_status: order_status,
            customer_details: {
                customer_id: customerId,
                customer_phone: phone,
                customer_name: user.name,
                customer_email: user.email
            },
            payment_status: 'PENDING',
            order_meta: {
                return_url: orderData.order_meta.return_url,
                notify_url: orderData.order_meta.notify_url,
                payment_methods: orderData.order_meta.payment_methods
            },
            order_tags: {
                subscription_plan: subscriptionPlan,
                subscription_duration: 30,
                user_id: userId.toString()
            }
        });

        await transaction.save();

        // Get checkout URL
        const checkoutUrl = getCheckoutUrl(payment_session_id, isProduction);

        console.log('CashFree order created successfully:', { 
            cf_order_id, 
            payment_session_id, 
            order_status,
            checkout_url: checkoutUrl 
        });

        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                cf_order_id: cf_order_id,
                payment_session_id: payment_session_id,
                checkout_url: checkoutUrl,
                order_status: order_status
            }
        });

    } catch (error) {
        console.error('Error creating payment order:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating payment order'
        });
    }
});

/**
 * POST /api/payment/verify
 * Verify CashFree payment response
 */
router.post('/verify', async (req, res) => {
    try {
        console.log('CashFree payment verification request received');
        console.log('Request body:', sanitizeResponse(req.body));

        const { cf_order_id, cf_payment_id, payment_status } = req.body;

        if (!cf_order_id) {
            console.error('Missing cf_order_id in verification request');
            return res.status(400).json({
                success: false,
                message: 'Invalid payment response'
            });
        }

        // Find transaction in database
        const transaction = await PaymentTransaction.findOne({ cf_order_id });
        if (!transaction) {
            console.error('Transaction not found:', cf_order_id);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Get order details from CashFree
        const isProduction = process.env.NODE_ENV === 'production';
        const orderResponse = await getOrder(cf_order_id, isProduction);
        
        if (!orderResponse.success) {
            console.error('Failed to fetch order from CashFree:', orderResponse.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify payment with payment gateway'
            });
        }

        const orderData = orderResponse.data;
        
        // Get payments for the order
        const paymentsResponse = await getOrderPayments(cf_order_id, isProduction);
        let paymentData = null;
        
        if (paymentsResponse.success && paymentsResponse.data.length > 0) {
            paymentData = paymentsResponse.data[0]; // Get the latest payment
        }

        // Update transaction with latest data
        transaction.order_status = orderData.order_status;
        transaction.payment_status = paymentData ? paymentData.payment_status : 'PENDING';
        transaction.cf_payment_id = paymentData ? paymentData.cf_payment_id : null;
        transaction.payment_method = paymentData ? paymentData.payment_method : null;
        transaction.payment_channel = paymentData ? paymentData.payment_channel : null;
        
        if (paymentData) {
            transaction.payment_gateway_details = {
                gateway_order_id: paymentData.payment_gateway_details?.gateway_order_id,
                gateway_payment_id: paymentData.payment_gateway_details?.gateway_payment_id,
                gateway_status: paymentData.payment_gateway_details?.gateway_status,
                gateway_time: paymentData.payment_gateway_details?.gateway_time,
                bank_reference: paymentData.payment_gateway_details?.bank_reference,
                auth_id: paymentData.payment_gateway_details?.auth_id,
                authorization: paymentData.payment_gateway_details?.authorization
            };
            
            if (paymentData.error_details) {
                transaction.error_details = {
                    error_code: paymentData.error_details.error_code,
                    error_description: paymentData.error_details.error_description,
                    error_reason: paymentData.error_details.error_reason,
                    error_source: paymentData.error_details.error_source,
                    error_type: paymentData.error_details.error_type
                };
            }
        }

        await transaction.save();

        // Handle successful payment
        if (transaction.payment_status === 'SUCCESS') {
            // Update user subscription
            const user = await User.findById(transaction.userId);
            if (user) {
                const subscriptionPlan = transaction.order_tags.subscription_plan;
                const duration = transaction.order_tags.subscription_duration;
                
                if (subscriptionPlan === 'snapx') {
                    user.snapXSubscription = {
                        isActive: true,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
                        plan: subscriptionPlan,
                        duration: duration
                    };
                    await user.save();
                    
                    // Send confirmation emails
                    try {
                        await sendPaymentConfirmationEmail(user.email, {
                            amount: transaction.order_amount,
                            transactionId: transaction.cf_order_id,
                            subscriptionPlan: subscriptionPlan
                        });
                        
                        await sendPlanUpgradeEmail(user.email, {
                            plan: subscriptionPlan,
                            features: ['Unlimited queries', 'Advanced analytics', 'Priority support']
                        });
                    } catch (emailError) {
                        console.error('Error sending confirmation emails:', emailError);
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Payment verification completed',
            data: {
                cf_order_id: transaction.cf_order_id,
                cf_payment_id: transaction.cf_payment_id,
                payment_status: transaction.payment_status,
                order_status: transaction.order_status,
                subscription_plan: transaction.order_tags.subscription_plan
            }
        });

    } catch (error) {
        console.error('Error during payment verification:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during payment verification'
        });
    }
});

/**
 * POST /api/payment/webhook
 * Handle CashFree webhook notifications
 */
router.post('/webhook', webhookLimiter, async (req, res) => {
    try {
        console.log('CashFree webhook received');
        console.log('Webhook body:', sanitizeResponse(req.body));

        const isProduction = process.env.NODE_ENV === 'production';
        
        // Verify webhook authenticity by checking with CashFree API
        const isAuthentic = await verifyWebhookAuthenticity(req.body, isProduction);
        if (!isAuthentic) {
            console.error('Webhook authenticity verification failed');
            return res.status(400).send('Invalid webhook');
        }

        const { type, data } = req.body;
        
        if (!type || !data) {
            console.error('Invalid webhook payload structure');
            return res.status(400).send('Invalid payload');
        }

        const { order, payment } = data;
        
        if (!order?.order_id) {
            console.error('Missing order_id in webhook');
            return res.status(400).send('Missing order_id');
        }

        // Find and update transaction
        const transaction = await PaymentTransaction.findOne({ cf_order_id: order.order_id });
        if (!transaction) {
            console.error('Transaction not found in webhook:', order.order_id);
            return res.status(404).send('Transaction not found');
        }

        // Mark webhook as verified
        transaction.webhook_verified = true;
        
        // Update order status
        if (order.order_status) {
            transaction.order_status = order.order_status;
        }

        // Update payment details if available
        if (payment) {
            transaction.cf_payment_id = payment.cf_payment_id;
            transaction.payment_status = payment.payment_status;
            transaction.payment_method = payment.payment_method;
            transaction.payment_channel = payment.payment_channel;
            
            if (payment.payment_gateway_details) {
                transaction.payment_gateway_details = {
                    gateway_order_id: payment.payment_gateway_details.gateway_order_id,
                    gateway_payment_id: payment.payment_gateway_details.gateway_payment_id,
                    gateway_status: payment.payment_gateway_details.gateway_status,
                    gateway_time: payment.payment_gateway_details.gateway_time,
                    bank_reference: payment.payment_gateway_details.bank_reference,
                    auth_id: payment.payment_gateway_details.auth_id,
                    authorization: payment.payment_gateway_details.authorization
                };
            }
            
            if (payment.error_details) {
                transaction.error_details = {
                    error_code: payment.error_details.error_code,
                    error_description: payment.error_details.error_description,
                    error_reason: payment.error_details.error_reason,
                    error_source: payment.error_details.error_source,
                    error_type: payment.error_details.error_type
                };
            }
        }

        await transaction.save();

        // Handle successful payment
        if (type === 'PAYMENT_SUCCESS_WEBHOOK' && transaction.payment_status === 'SUCCESS') {
            // Update user subscription
            const user = await User.findById(transaction.userId);
            if (user) {
                const subscriptionPlan = transaction.order_tags.subscription_plan;
                const duration = transaction.order_tags.subscription_duration;
                
                if (subscriptionPlan === 'snapx') {
                    user.snapXSubscription = {
                        isActive: true,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
                        plan: subscriptionPlan,
                        duration: duration
                    };
                    await user.save();
                    
                    // Send confirmation emails
                    try {
                        await sendPaymentConfirmationEmail(user.email, {
                            amount: transaction.order_amount,
                            transactionId: transaction.cf_order_id,
                            subscriptionPlan: subscriptionPlan
                        });
                        
                        await sendPlanUpgradeEmail(user.email, {
                            plan: subscriptionPlan,
                            features: ['Unlimited queries', 'Advanced analytics', 'Priority support']
                        });
                    } catch (emailError) {
                        console.error('Error sending confirmation emails:', emailError);
                    }
                }
            }
        }

        console.log('Webhook processed successfully:', {
            type,
            order_id: order.order_id,
            payment_status: transaction.payment_status
        });

        res.status(200).send('OK');

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * GET /api/payment/order-status/{orderId}
 * Get order status from CashFree
 */
router.get('/order-status/:orderId', verifyToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const isProduction = process.env.NODE_ENV === 'production';

        const orderResponse = await getOrder(orderId, isProduction);
        
        if (!orderResponse.success) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: orderResponse.data
        });

    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/payment/test-config
 * Test CashFree configuration (for debugging)
 */
router.get('/test-config', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const clientId = isProduction 
        ? process.env.CASHFREE_CLIENT_ID_PROD 
        : process.env.CASHFREE_CLIENT_ID_TEST;
    const clientSecret = isProduction 
        ? process.env.CASHFREE_CLIENT_SECRET_PROD 
        : process.env.CASHFREE_CLIENT_SECRET_TEST;

    res.status(200).json({
        success: true,
        data: {
            environment: isProduction ? 'production' : 'test',
            client_id_configured: !!clientId,
            client_secret_configured: !!clientSecret,
                    webhook_configured: true
        }
    });
});

module.exports = router; 