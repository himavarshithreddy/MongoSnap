const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken, verifyTokenAndValidateCSRF, captureRawBody } = require('./middleware');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const {
    createOrder,
    getOrder,
    getOrderPayments,
    verifyWebhookSignature,
    validateOrderData,
    formatAmount,
    generateOrderId,
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
        const clientId = process.env.CASHFREE_CLIENT_ID_PROD;
        const clientSecret =process.env.CASHFREE_CLIENT_SECRET_PROD;

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
        console.log('CashFree Client Secret (first 6 chars):', clientSecret ? clientSecret.substring(0, 6) + '...' : 'MISSING');

        // Generate order ID
        const orderId = generateOrderId('MONGOSNAP');
        
        // Set amount based on subscription plan
        const amount = formatAmount(1); // SnapX price: ₹1

        // Prepare order data
        const orderData = {
            order_id: orderId,
            order_amount: parseFloat(amount),
            order_currency: 'INR',
            customer_id: userId.toString(),
            customer_phone: phone,
            customer_email: user.email,
            customer_name: user.name,
            return_url: `${process.env.FRONTEND_URL}/payment/success`,
            notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`,
            subscription_plan: subscriptionPlan,
            subscription_duration: 30
        };

        // Validate order data
        const validation = validateOrderData(orderData);
        if (!validation.isValid) {
            console.error('Order data validation failed:', validation.missing);
            return res.status(400).json({
                success: false,
                message: 'Order data validation failed',
                missing: validation.missing
            });
        }

        // Create order in CashFree
        const orderResponse = await createOrder(orderData, isProduction);
        
        if (!orderResponse.success) {
            console.error('CashFree order creation failed:', orderResponse.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment order'
            });
        }

        const cashfreeOrder = orderResponse.data;

        // Save transaction to database
        const transaction = new PaymentTransaction({
            userId: userId,
            order_id: orderId,
            amount: parseFloat(amount),
            productinfo: `MongoSnap ${subscriptionPlan.toUpperCase()} Subscription`,
            firstname: user.name,
            email: user.email,
            phone: phone,
            payment_session_id: cashfreeOrder.payment_session_id,
            order_status: cashfreeOrder.order_status,
            payment_status: 'PENDING',
            subscriptionPlan: subscriptionPlan,
            subscriptionDuration: 30,
            field1: subscriptionPlan,
            field2: userId.toString(),
            field3: '30'
        });

        await transaction.save();

        console.log('CashFree order created successfully:', { 
            orderId, 
            amount, 
            subscriptionPlan,
            payment_session_id: cashfreeOrder.payment_session_id 
        });

        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                order_id: orderId,
                payment_session_id: cashfreeOrder.payment_session_id,
                order_status: cashfreeOrder.order_status,
                amount: amount,
                currency: 'INR'
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

        const { order_id, payment_session_id } = req.body;

        if (!order_id) {
            console.error('Missing order_id in verification request');
            return res.status(400).json({
                success: false,
                message: 'Missing order ID'
            });
        }

        // Find transaction in database
        const transaction = await PaymentTransaction.findOne({ order_id });
        if (!transaction) {
            console.error('Transaction not found:', order_id);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Get order details from CashFree
        const isProduction = process.env.NODE_ENV === 'production';
        const orderResponse = await getOrder(order_id, isProduction);
        
        if (!orderResponse.success) {
            console.error('Failed to fetch order from CashFree:', orderResponse.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify payment with payment gateway'
            });
        }

        const cashfreeOrder = orderResponse.data;
        
        // Get payments for the order
        const paymentsResponse = await getOrderPayments(order_id, isProduction);
        let paymentDetails = null;
        
        if (paymentsResponse.success && paymentsResponse.data.length > 0) {
            paymentDetails = paymentsResponse.data[0]; // Get the latest payment
        }

        // Update transaction with CashFree response
        transaction.order_status = cashfreeOrder.order_status;
        transaction.payment_session_id = cashfreeOrder.payment_session_id;
        
        if (paymentDetails) {
            transaction.cf_payment_id = paymentDetails.cf_payment_id;
            transaction.payment_status = paymentDetails.payment_status;
            transaction.payment_method = paymentDetails.payment_method?.payment_method;
            transaction.payment_gateway_details = paymentDetails.payment_gateway_details;
            transaction.bank_reference = paymentDetails.payment_gateway_details?.bank_reference;
            
            // Extract card details if available
            if (paymentDetails.payment_method?.card) {
                const card = paymentDetails.payment_method.card;
                transaction.card_number = card.card_number ? card.card_number.slice(-4) : null;
                transaction.card_network = card.card_network;
                transaction.card_type = card.card_type;
                transaction.card_country = card.card_country;
                transaction.card_bank_name = card.card_bank_name;
            }
            
            // Extract UPI details if available
            if (paymentDetails.payment_method?.upi) {
                transaction.upi_id = paymentDetails.payment_method.upi.upi_id;
            }
        }

        await transaction.save();

        // Process successful payment
        if (cashfreeOrder.order_status === 'PAID' && paymentDetails?.payment_status === 'SUCCESS') {
            // Update user subscription
            const user = await User.findById(transaction.userId);
            if (user) {
                user.subscriptionPlan = transaction.subscriptionPlan;
                user.subscriptionStartDate = new Date();
                user.subscriptionEndDate = new Date(Date.now() + (transaction.subscriptionDuration * 24 * 60 * 60 * 1000));
                user.isSnapXUser = true;
                await user.save();

                // Send confirmation emails
                try {
                    await sendPaymentConfirmationEmail(user.email, user.name, {
                        orderId: transaction.order_id,
                        amount: transaction.amount,
                        subscriptionPlan: transaction.subscriptionPlan
                    });
                    
                    await sendPlanUpgradeEmail(user.email, user.name, transaction.subscriptionPlan);
                } catch (emailError) {
                    console.error('Error sending confirmation emails:', emailError);
                }
            }

            console.log('Payment processed successfully:', {
                orderId: transaction.order_id,
                userId: transaction.userId,
                subscriptionPlan: transaction.subscriptionPlan
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment verification completed',
            data: {
                order_id: transaction.order_id,
                order_status: transaction.order_status,
                payment_status: transaction.payment_status,
                cf_payment_id: transaction.cf_payment_id,
                subscriptionPlan: transaction.subscriptionPlan,
                amount: transaction.amount
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
router.post('/webhook', webhookLimiter, captureRawBody, async (req, res) => {
    try {
        console.log('CashFree webhook received');
        console.log('Webhook body:', sanitizeResponse(req.body));

        const timestamp = req.headers['x-webhook-timestamp'];
        const signature = req.headers['x-webhook-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body);

        if (!timestamp || !signature) {
            console.error('Missing webhook headers');
            return res.status(400).send('Missing webhook headers');
        }

        // Verify webhook signature
        const isProduction = process.env.NODE_ENV === 'production';
        const isSignatureValid = verifyWebhookSignature(timestamp, signature, rawBody, isProduction);
        
        if (!isSignatureValid) {
            console.error('Webhook signature verification failed');
            return res.status(400).send('Invalid webhook signature');
        }

        const webhookData = req.body;
        const { type, data } = webhookData;

        if (!type || !data) {
            console.error('Invalid webhook payload structure');
            return res.status(400).send('Invalid webhook payload');
        }

        const { order, payment } = data;
        
        if (!order?.order_id) {
            console.error('Missing order_id in webhook payload');
            return res.status(400).send('Missing order ID');
        }

        // Find and update transaction
        const transaction = await PaymentTransaction.findOne({ order_id: order.order_id });
        if (!transaction) {
            console.error('Transaction not found in webhook:', order.order_id);
            return res.status(404).send('Transaction not found');
        }

        // Mark webhook as verified
        transaction.webhookVerified = true;
        transaction.webhookEventType = type;
        
        // Update payment details
        if (payment) {
            transaction.cf_payment_id = payment.cf_payment_id;
            transaction.payment_status = payment.payment_status;
            transaction.payment_method = payment.payment_method?.payment_method;
            transaction.payment_gateway_details = payment.payment_gateway_details;
            transaction.bank_reference = payment.payment_gateway_details?.bank_reference;
            
            // Extract card details if available
            if (payment.payment_method?.card) {
                const card = payment.payment_method.card;
                transaction.card_number = card.card_number ? card.card_number.slice(-4) : null;
                transaction.card_network = card.card_network;
                transaction.card_type = card.card_type;
                transaction.card_country = card.card_country;
                transaction.card_bank_name = card.card_bank_name;
            }
            
            // Extract UPI details if available
            if (payment.payment_method?.upi) {
                transaction.upi_id = payment.payment_method.upi.upi_id;
            }
        }

        // Update order status
        if (order.order_status) {
            transaction.order_status = order.order_status;
        }

        await transaction.save();

        // Process successful payment
        if (type === 'PAYMENT_SUCCESS_WEBHOOK' && payment?.payment_status === 'SUCCESS') {
            // Update user subscription
            const user = await User.findById(transaction.userId);
            if (user) {
                user.subscriptionPlan = transaction.subscriptionPlan;
                user.subscriptionStartDate = new Date();
                user.subscriptionEndDate = new Date(Date.now() + (transaction.subscriptionDuration * 24 * 60 * 60 * 1000));
                user.isSnapXUser = true;
                await user.save();

                // Send confirmation emails
                try {
                    await sendPaymentConfirmationEmail(user.email, user.name, {
                        orderId: transaction.order_id,
                        amount: transaction.amount,
                        subscriptionPlan: transaction.subscriptionPlan
                    });
                    
                    await sendPlanUpgradeEmail(user.email, user.name, transaction.subscriptionPlan);
                } catch (emailError) {
                    console.error('Error sending confirmation emails:', emailError);
                }
            }

            console.log('Webhook payment processed successfully:', {
                orderId: transaction.order_id,
                userId: transaction.userId,
                subscriptionPlan: transaction.subscriptionPlan
            });
        }

        res.status(200).send('Webhook processed successfully');

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * GET /api/payment/order-status/:orderId
 * Get order status from CashFree
 */
router.get('/order-status/:orderId', async (req, res) => {
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
router.get('/test-config', async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const clientId = process.env.CASHFREE_CLIENT_ID_PROD;
        const clientSecret =process.env.CASHFREE_CLIENT_SECRET_PROD;

        res.status(200).json({
            success: true,
            data: {
                environment: isProduction ? 'production' : 'test',
                clientIdPresent: !!clientId,
                clientSecretPresent: !!clientSecret,
                baseUrl: isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'
            }
        });

    } catch (error) {
        console.error('Error testing configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Add CashFree callback endpoints
router.post('/success', async (req, res) => {
    try {
        console.log('CashFree /success callback received. Raw body:', req.body);
        const params = req.body;
        const query = new URLSearchParams(params).toString();
        console.log('Redirecting to frontend with query:', query);
        // Redirect to frontend success page with query params
        res.redirect(302, `${process.env.FRONTEND_URL}/payment/success?${query}`);
    } catch (error) {
        console.error('Error in /api/payment/success callback:', error);
        res.redirect(302, `${process.env.FRONTEND_URL}/payment/success?error=callback_error`);
    }
});

router.post('/failure', async (req, res) => {
    try {
        console.log('CashFree /failure callback received. Raw body:', req.body);
        const params = req.body;
        const query = new URLSearchParams(params).toString();
        console.log('Redirecting to frontend with query:', query);
        res.redirect(302, `${process.env.FRONTEND_URL}/payment/failure?${query}`);
    } catch (error) {
        console.error('Error in /api/payment/failure callback:', error);
        res.redirect(302, `${process.env.FRONTEND_URL}/payment/failure?error=callback_error`);
    }
});

module.exports = router; 