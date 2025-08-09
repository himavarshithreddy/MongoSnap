const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken, verifyTokenAndValidateCSRF } = require('./middleware');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
// Utilities
const { generateTransactionId, formatAmount } = require('../utils/PaymentHelper');
// Cashfree utilities (new)
const { createOrder: cfCreateOrder, getOrder: cfGetOrder, verifyWebhookSignature } = require('../utils/cashfree');
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
 * Create Cashfree payment order
 */
router.post('/create-order', paymentLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
    try {
        const userId = req.userId;
        const { subscriptionPlan, phone } = req.body;

        console.log('Creating Cashfree payment order:', {
            userId,
            subscriptionPlan,
            phone: phone ? `***${String(phone).slice(-2)}` : undefined
        });
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

        // Cashfree configuration check (supports alias env names)
        const cfClientId = process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
        const cfClientSecret = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
        if (!cfClientId || !cfClientSecret) {
            console.error('Cashfree configuration missing');
            console.error('CASHFREE_CLIENT_ID/CASHFREE_APP_ID present:', !!cfClientId);
            console.error('CASHFREE_CLIENT_SECRET/CASHFREE_SECRET_KEY present:', !!cfClientSecret);
            return res.status(500).json({
                success: false,
                message: 'Payment configuration error'
            });
        }

        // Generate transaction ID (internal reference)
        const txnid = generateTransactionId('MONGOSNAP');

        // Set amount based on subscription plan (INR)
        const amount = parseFloat(formatAmount(299));

        // Create Cashfree order
        const cfOrder = await cfCreateOrder({
            amount,
            currency: 'INR',
            customer: {
                id: userId.toString(),
                email: user.email,
                phone: normalized,
                name: user.name,
            },
            returnUrl: `${process.env.FRONTEND_URL}/payment/cf-return?order_id={order_id}`,
        });

        // Save transaction to database (pending)
        const transaction = new PaymentTransaction({
            userId: userId,
            txnid: txnid,
            amount: amount,
            productinfo: `MongoSnap ${subscriptionPlan.toUpperCase()} Subscription`,
            firstname: user.name,
            email: user.email,
            phone: normalized,
            key: 'cashfree',
            hash: 'cf',
            subscriptionPlan: subscriptionPlan,
            subscriptionDuration: 30,
            field1: subscriptionPlan,
            field2: userId.toString(),
            field3: '30',
            status: 'pending'
        });

        transaction.cf_order_id = cfOrder.order_id;
        transaction.cf_payment_session_id = cfOrder.payment_session_id;

        await transaction.save();

        console.log('Cashfree order created successfully:', { txnid, cf_order_id: cfOrder.order_id });

        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                gateway: 'cashfree',
                orderId: cfOrder.order_id,
                paymentSessionId: cfOrder.payment_session_id,
                txnid,
            },
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
 * GET /api/payment/cf/verify
 * Verify Cashfree order status by order_id
 */
router.get('/cf/verify', async (req, res) => {
    try {
        console.log('Cashfree verification request received');
        const { order_id } = req.query;
        if (!order_id) {
            return res.status(400).json({ success: false, message: 'order_id is required' });
        }

        // Find transaction by Cashfree order id
        const transaction = await PaymentTransaction.findOne({ cf_order_id: order_id });
        if (!transaction) {
            console.error('Transaction not found for order_id:', order_id);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        // Query Cashfree for latest order status
        const cfOrder = await cfGetOrder(order_id);
        transaction.cf_order_status = cfOrder.order_status;
        transaction.paymentDate = new Date();

        // Map Cashfree statuses
        const isPaid = cfOrder.order_status === 'PAID';
        transaction.status = isPaid ? 'success' : (cfOrder.order_status === 'FAILED' ? 'failure' : 'pending');
        await transaction.save();

        // If payment successful, update user subscription
        if (isPaid) {
            const user = await User.findById(transaction.userId);
            if (user) {
                const oldPlan = user.subscriptionPlan;
                const oldStatus = user.subscriptionStatus;
                
                user.subscriptionPlan = transaction.subscriptionPlan;
                user.subscriptionStatus = 'active';
                user.subscriptionExpiresAt = new Date(Date.now() + transaction.subscriptionDuration * 24 * 60 * 60 * 1000);
                await user.save();

                // Reset user usage limits for SnapX
                const userUsage = await UserUsage.getOrCreateUsage(transaction.userId);
                userUsage.updateLimitsForPlan('snapx');
                await userUsage.save();

                console.log(`Subscription updated for user ${user.email}: ${transaction.subscriptionPlan}`);

                // Send payment confirmation email
                try {
                    const paymentDetails = {
                        userName: user.name,
                        amount: transaction.amount,
                        transactionId: transaction.cf_order_id || transaction.txnid,
                        subscriptionPlan: transaction.subscriptionPlan,
                        paymentDate: transaction.paymentDate || new Date(),
                        expiryDate: user.subscriptionExpiresAt,
                        paymentMethod: 'Cashfree',
                        cardLast4: transaction.cardnum
                    };

                    await sendPaymentConfirmationEmail(user.email, paymentDetails);
                    console.log(`Payment confirmation email sent to ${user.email}`);

                    // Send plan upgrade email for any successful payment
                    const upgradeDetails = {
                        userName: user.name,
                        oldPlan: oldPlan === 'snap' ? 'Snap (Free)' : 'Previous Plan',
                        newPlan: 'SnapX (Premium)',
                        upgradeDate: new Date(),
                        expiryDate: user.subscriptionExpiresAt,
                        features: [
                            'Unlimited query history',
                            'Save & organize queries',
                            'Unlimited database connections',
                            'Unlimited executions',
                            'Enhanced AI generation',
                            'Export database schemas',
                            'Upload your own databases',
                            'Priority support'
                        ]
                    };

                    await sendPlanUpgradeEmail(user.email, upgradeDetails);
                    console.log(`Plan upgrade email sent to ${user.email}`);
                } catch (emailError) {
                    console.error('Error sending payment confirmation emails:', emailError);
                    // Don't fail the payment process if email fails
                }
            }
        }

        console.log('Cashfree verification completed:', { order_id, status: transaction.status });

        res.status(200).json({
            success: true,
            message: transaction.status === 'success' ? 'Payment successful' : 'Payment pending/failed',
            data: {
                order_id,
                status: transaction.status,
                amount: transaction.amount,
                subscriptionPlan: transaction.subscriptionPlan
            }
        });

    } catch (error) {
        console.error('Error verifying Cashfree payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during payment verification'
        });
    }
});

/**
 * POST /api/payment/cf/webhook
 * Handle Cashfree webhook notifications
 */
router.post('/cf/webhook', webhookLimiter, express.raw({ type: '*/*' }), async (req, res) => {
    try {
        console.log('Cashfree webhook received');
        const signature = req.header('x-webhook-signature');
        const timestamp = req.header('x-webhook-timestamp');
        const raw = req.body; // Buffer
        const verified = verifyWebhookSignature(raw, timestamp, signature);
        if (!verified) {
            console.error('Invalid Cashfree webhook signature');
            return res.status(400).send('Invalid signature');
        }
        const payload = JSON.parse(raw.toString());
        const orderId = payload?.data?.order?.order_id || payload?.data?.order_id;
        if (!orderId) {
            return res.status(400).send('Invalid payload');
        }

        // Find and update transaction by cf_order_id
        const transaction = await PaymentTransaction.findOne({ cf_order_id: orderId });
        if (!transaction) {
            console.error('Transaction not found in Cashfree webhook:', orderId);
            return res.status(404).send('Transaction not found');
        }

        // Mark webhook as verified
        transaction.webhookVerified = true;
        
        // Query latest status from Cashfree
        const cfOrder = await cfGetOrder(orderId);
        transaction.cf_order_status = cfOrder.order_status;
        const status = cfOrder.order_status === 'PAID' ? 'success' : (cfOrder.order_status === 'FAILED' ? 'failure' : 'pending');
        if (transaction.status !== status) {
            console.log(`Updating transaction status from ${transaction.status} to ${status}`);
            transaction.status = status;

            // Update user subscription based on webhook status
            if (status === 'success' && transaction.subscriptionPlan === 'snapx') {
                const user = await User.findById(transaction.userId);
                if (user && !user.isSnapXUser()) {
                    const oldPlan = user.subscriptionPlan;
                    const oldStatus = user.subscriptionStatus;
                    
                    user.subscriptionPlan = 'snapx';
                    user.subscriptionStatus = 'active';
                    user.subscriptionExpiresAt = new Date(Date.now() + transaction.subscriptionDuration * 24 * 60 * 60 * 1000);
                    await user.save();
                    console.log(`Cashfree webhook activated SnapX subscription for user: ${user.email}`);

                    // Send payment confirmation email via webhook
                    try {
                        const paymentDetails = {
                            userName: user.name,
                            amount: transaction.amount,
                            transactionId: transaction.cf_order_id || transaction.txnid,
                            subscriptionPlan: transaction.subscriptionPlan,
                            paymentDate: transaction.paymentDate || new Date(),
                            expiryDate: user.subscriptionExpiresAt,
                            paymentMethod: 'Cashfree',
                            cardLast4: transaction.cardnum
                        };

                        await sendPaymentConfirmationEmail(user.email, paymentDetails);
                        console.log(`Cashfree Webhook: Payment confirmation email sent to ${user.email}`);

                        // Send plan upgrade email for any successful payment
                        const upgradeDetails = {
                            userName: user.name,
                            oldPlan: oldPlan === 'snap' ? 'Snap (Free)' : 'Previous Plan',
                            newPlan: 'SnapX (Premium)',
                            upgradeDate: new Date(),
                            expiryDate: user.subscriptionExpiresAt,
                            features: [
                                'Unlimited query history',
                                'Save & organize queries',
                                'Unlimited database connections',
                                'Unlimited executions',
                                'Enhanced AI generation',
                                'Export database schemas',
                                'Upload your own databases',
                                'Priority support'
                            ]
                        };

                        // Check if upgrade email already sent
                        if (!transaction.upgradeEmailSent) {
                            await sendPlanUpgradeEmail(user.email, upgradeDetails);
                            console.log(`Cashfree Webhook: Plan upgrade email sent to ${user.email}`);
                            transaction.upgradeEmailSent = true;
                        }
                    } catch (emailError) {
                        console.error('Cashfree Webhook: Error sending payment confirmation emails:', emailError);
                        // Don't fail the webhook process if email fails
                    }
                }
            }
        }

        await transaction.save();

        console.log('Cashfree webhook processed successfully:', { orderId, status: transaction.status });
        res.status(200).send('Webhook processed successfully');

    } catch (error) {
        console.error('Error processing Cashfree webhook:', error);
        res.status(500).send('Webhook processing error');
    }
});

/**
 * GET /api/payment/transaction/:txnid
 * Get transaction details
 */
router.get('/transaction/:txnid', verifyToken, async (req, res) => {
    try {
        const { txnid } = req.params;
        const userId = req.userId;

        const transaction = await PaymentTransaction.findOne({ 
            txnid, 
            userId 
        }).select('-hash -cardhash');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/payment/history
 * Get user's payment history
 */
router.get('/history', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        const transactions = await PaymentTransaction.find({ userId })
            .select('-hash -cardhash')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PaymentTransaction.countDocuments({ userId });

        res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// (Optional) test-config endpoint removed; Cashfree testing uses sandbox mode with live URL

// Legacy callback endpoints removed

module.exports = router; 