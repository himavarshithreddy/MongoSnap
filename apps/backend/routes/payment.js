const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken, verifyTokenAndValidateCSRF } = require('./middleware');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const {
    generatePaymentHash,
    verifyResponseHash,
    generateTransactionId,
    validatePaymentParams,
    formatAmount,
    getPayUUrls,
    sanitizeResponse
} = require('../utils/payuHelper');

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
 * Create PayU payment order
 */
router.post('/create-order', paymentLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
    try {
        const userId = req.userId;
        const { subscriptionPlan, phone } = req.body;

        console.log('Creating PayU payment order:', { userId, subscriptionPlan, phone });

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

        // Validate phone number
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Valid 10-digit phone number is required'
            });
        }

        // Get PayU configuration
        const payuKey = process.env.PAYU_KEY;
        const payuSalt = process.env.PAYU_SALT;
        const isProduction = process.env.NODE_ENV === 'production';

        if (!payuKey || !payuSalt) {
            console.error('PayU configuration missing');
            return res.status(500).json({
                success: false,
                message: 'Payment configuration error'
            });
        }

        // Generate transaction ID
        const txnid = generateTransactionId('MONGOSNAP');
        
        // Set amount based on subscription plan
        const amount = formatAmount(359); // SnapX price: ₹359

        // Prepare payment parameters
        const paymentParams = {
            key: payuKey,
            txnid: txnid,
            amount: amount,
            productinfo: `MongoSnap ${subscriptionPlan.toUpperCase()} Subscription`,
            firstname: user.name,
            email: user.email,
            phone: phone,
            surl: `${process.env.FRONTEND_URL}/payment/success`,
            furl: `${process.env.FRONTEND_URL}/payment/failure`,
            udf1: subscriptionPlan,
            udf2: userId.toString(),
            udf3: '30', // Subscription duration in days
            udf4: '',
            udf5: ''
        };

        // Validate payment parameters
        const validation = validatePaymentParams(paymentParams);
        if (!validation.isValid) {
            console.error('Payment parameter validation failed:', validation.missing);
            return res.status(400).json({
                success: false,
                message: 'Payment parameter validation failed',
                missing: validation.missing
            });
        }

        // Generate hash
        const hash = generatePaymentHash(paymentParams, payuSalt);

        // Save transaction to database
        const transaction = new PaymentTransaction({
            userId: userId,
            txnid: txnid,
            amount: parseFloat(amount),
            productinfo: paymentParams.productinfo,
            firstname: paymentParams.firstname,
            email: paymentParams.email,
            phone: phone,
            key: payuKey,
            hash: hash,
            subscriptionPlan: subscriptionPlan,
            subscriptionDuration: 30,
            field1: paymentParams.udf1,
            field2: paymentParams.udf2,
            field3: paymentParams.udf3,
            status: 'pending'
        });

        await transaction.save();

        // Get PayU URLs
        const payuUrls = getPayUUrls(isProduction);

        // Return payment form data
        const paymentFormData = {
            ...paymentParams,
            hash: hash,
            service_provider: 'payu_paisa'
        };

        console.log('Payment order created successfully:', { txnid, amount, subscriptionPlan });

        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                paymentUrl: payuUrls.paymentUrl,
                formData: paymentFormData,
                txnid: txnid
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
 * Verify PayU payment response
 */
router.post('/verify', async (req, res) => {
    try {
        console.log('PayU payment verification request received');
        console.log('Request body:', sanitizeResponse(req.body));

        const payuSalt = process.env.PAYU_SALT;
        if (!payuSalt) {
            console.error('PayU salt not configured');
            return res.status(500).json({
                success: false,
                message: 'Payment configuration error'
            });
        }

        // Extract PayU response parameters
        const {
            key, txnid, amount, productinfo, firstname, email, phone,
            mihpayid, mode, status, unmappedstatus, hash, bank_ref_num,
            bankcode, error, error_Message, cardnum, cardhash,
            udf1, udf2, udf3, udf4, udf5
        } = req.body;

        // Validate required fields
        if (!txnid || !status || !hash) {
            console.error('Missing required fields in PayU response');
            return res.status(400).json({
                success: false,
                message: 'Invalid payment response'
            });
        }

        // Find transaction in database
        const transaction = await PaymentTransaction.findOne({ txnid });
        if (!transaction) {
            console.error('Transaction not found:', txnid);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Verify hash
        const isHashValid = verifyResponseHash(req.body, payuSalt);
        if (!isHashValid) {
            console.error('Hash verification failed for transaction:', txnid);
            
            // Update transaction with failure
            transaction.status = 'failure';
            transaction.error = 'Hash verification failed';
            await transaction.save();

            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Update transaction with PayU response
        transaction.mihpayid = mihpayid;
        transaction.mode = mode;
        transaction.status = status === 'success' ? 'success' : 'failure';
        transaction.unmappedstatus = unmappedstatus;
        transaction.bank_ref_num = bank_ref_num;
        transaction.bankcode = bankcode;
        transaction.error = error;
        transaction.error_Message = error_Message;
        transaction.cardnum = cardnum ? cardnum.slice(-4) : null; // Store only last 4 digits
        transaction.cardhash = cardhash;
        transaction.paymentDate = new Date();

        await transaction.save();

        // If payment successful, update user subscription
        if (status === 'success') {
            const user = await User.findById(transaction.userId);
            if (user) {
                user.subscriptionPlan = transaction.subscriptionPlan;
                user.subscriptionStatus = 'active';
                user.subscriptionExpiresAt = new Date(Date.now() + transaction.subscriptionDuration * 24 * 60 * 60 * 1000);
                await user.save();

                // Reset user usage limits for SnapX
                const userUsage = await UserUsage.getOrCreateUsage(transaction.userId);
                userUsage.updateLimitsForPlan('snapx');
                await userUsage.save();

                console.log(`Subscription updated for user ${user.email}: ${transaction.subscriptionPlan}`);
            }
        }

        console.log('Payment verification completed:', { txnid, status, mihpayid });

        res.status(200).json({
            success: true,
            message: status === 'success' ? 'Payment successful' : 'Payment failed',
            data: {
                txnid: txnid,
                status: status,
                mihpayid: mihpayid,
                amount: amount,
                subscriptionPlan: transaction.subscriptionPlan
            }
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during payment verification'
        });
    }
});

/**
 * POST /api/payment/webhook
 * Handle PayU webhook notifications
 */
router.post('/webhook', webhookLimiter, async (req, res) => {
    try {
        console.log('PayU webhook received');
        console.log('Webhook body:', sanitizeResponse(req.body));

        const payuSalt = process.env.PAYU_SALT;
        if (!payuSalt) {
            console.error('PayU salt not configured for webhook');
            return res.status(500).send('Webhook configuration error');
        }

        const { txnid, status, hash } = req.body;

        if (!txnid || !status || !hash) {
            console.error('Invalid webhook data received');
            return res.status(400).send('Invalid webhook data');
        }

        // Verify hash
        const isHashValid = verifyResponseHash(req.body, payuSalt);
        if (!isHashValid) {
            console.error('Webhook hash verification failed for transaction:', txnid);
            return res.status(400).send('Hash verification failed');
        }

        // Find and update transaction
        const transaction = await PaymentTransaction.findOne({ txnid });
        if (!transaction) {
            console.error('Transaction not found in webhook:', txnid);
            return res.status(404).send('Transaction not found');
        }

        // Mark webhook as verified
        transaction.webhookVerified = true;
        
        // Update status if different
        if (transaction.status !== status) {
            console.log(`Updating transaction status from ${transaction.status} to ${status}`);
            transaction.status = status;
            
            // Update user subscription based on webhook status
            if (status === 'success' && transaction.subscriptionPlan === 'snapx') {
                const user = await User.findById(transaction.userId);
                if (user && !user.isSnapXUser()) {
                    user.subscriptionPlan = 'snapx';
                    user.subscriptionStatus = 'active';
                    user.subscriptionExpiresAt = new Date(Date.now() + transaction.subscriptionDuration * 24 * 60 * 60 * 1000);
                    await user.save();
                    console.log(`Webhook activated SnapX subscription for user: ${user.email}`);
                }
            }
        }

        await transaction.save();

        console.log('Webhook processed successfully:', { txnid, status });
        res.status(200).send('Webhook processed successfully');

    } catch (error) {
        console.error('Error processing webhook:', error);
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

/**
 * GET /api/payment/test-config
 * Get test configuration for development
 */
router.get('/test-config', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({
            success: false,
            message: 'Not available in production'
        });
    }

    const { getTestCardDetails, getPayUUrls } = require('../utils/payuHelper');

    res.status(200).json({
        success: true,
        data: {
            testCards: getTestCardDetails(),
            payuUrls: getPayUUrls(false),
            environment: 'test'
        }
    });
});

module.exports = router; 