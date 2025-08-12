const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const User = require('../models/User');
const { 
  sendPaymentConfirmationEmail, 
  sendPlanUpgradeEmail, 
  sendSubscriptionCancellationEmail 
} = require('../utils/mailer');

router.get('/', (req, res) => {
    res.json({ message: 'Hello World', userId: req.userId });
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Test route to check if server is running
router.get('/health', (req, res) => {
    res.json({ 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test route to send payment confirmation email
router.post('/send-payment-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const paymentDetails = {
      userName: 'Test User',
      amount: 299,
      transactionId: 'TEST_TXN_123456',
      subscriptionPlan: 'snapx',
      paymentDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentMethod: 'Credit Card',
      cardLast4: '1234'
    };

    await sendPaymentConfirmationEmail(email, paymentDetails);
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment confirmation email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test payment email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email' 
    });
  }
});

// Test route to send plan upgrade email
router.post('/send-upgrade-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const upgradeDetails = {
      userName: 'Test User',
      oldPlan: 'Snap (Free)',
      newPlan: 'SnapX (Premium)',
      upgradeDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

    await sendPlanUpgradeEmail(email, upgradeDetails);
    
    res.status(200).json({ 
      success: true, 
      message: 'Plan upgrade email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test upgrade email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email' 
    });
  }
});

// Test route to send cancellation email
router.post('/send-cancellation-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const cancellationDetails = {
      userName: 'Test User',
      planName: 'SnapX (Premium)',
      cancellationDate: new Date(),
      featuresLost: [
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

    await sendSubscriptionCancellationEmail(email, cancellationDetails);
    
    res.status(200).json({ 
      success: true, 
      message: 'Cancellation email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test cancellation email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email' 
    });
  }
});

module.exports = router;