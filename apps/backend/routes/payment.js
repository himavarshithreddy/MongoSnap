const express = require('express');
const router = express.Router();
const { preparePayUParams } = require('../utils/payu');
const User = require('../models/User');
const { verifyToken } = require('./middleware');
const { generatePayUHash } = require('../utils/payu');

// Initiate PayU payment
router.post('/payu/initiate', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    // For now, only SnapX plan is supported
    if (plan !== 'snapx') {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    // Fetch user from DB using req.userId
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    // Prepare payment params
    const params = preparePayUParams({
      amount: '359.00',
      productinfo: 'SnapX Subscription',
      firstname: user.name || user.username || 'User',
      email: user.email,
      phone: user.phone || '',
      userId: user._id.toString(),
    });
    // Return params to frontend
    res.json({
      payuUrl: process.env.PAYU_BASE_URL,
      params,
    });
  } catch (err) {
    console.error('Error initiating PayU payment:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// PayU callback (success/failure)
router.post('/payu/callback', async (req, res) => {
  try {
    console.log('[PayU Callback] Received body:', req.body);
    const body = req.body;
    // PayU sends POST data (x-www-form-urlencoded)
    const {
      key, txnid, amount, productinfo, firstname, email, status, hash, udf1
    } = body;
    // Recreate hash string for verification (see PayU docs for response hash sequence)
    // hash = sha512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
    const hashString = [
      process.env.PAYU_MERCHANT_SALT,
      status,
      '', '', '', '', '', '', '', '', '', '', '',
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      key
    ].join('|');
    const expectedHash = require('crypto').createHash('sha512').update(hashString).digest('hex');
    console.log('[PayU Callback] Calculated hash:', expectedHash);
    console.log('[PayU Callback] Received hash:', hash);
    if (expectedHash !== hash) {
      console.error('[PayU Callback] Hash mismatch:', { expectedHash, hash });
      return res.status(400).send('Hash mismatch');
    }
    // Find user by udf1 (userId)
    const userId = udf1;
    const user = await User.findById(userId);
    if (!user) {
      console.error('[PayU Callback] User not found for userId:', userId);
      return res.status(404).send('User not found');
    }
    if (status === 'success') {
      // Update user subscription
      user.subscriptionPlan = 'snapx';
      user.subscriptionStatus = 'active';
      // Set expiry to 1 month from now
      user.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await user.save();
      console.log('[PayU Callback] Subscription updated for user:', user.email);
      // Redirect to frontend with success
      return res.redirect('https://mongosnap.live/pricing?payment=success');
    } else {
      // Payment failed
      console.warn('[PayU Callback] Payment failed for user:', user.email, 'Status:', status);
      return res.redirect('https://mongosnap.live/pricing?payment=failure');
    }
  } catch (err) {
    console.error('[PayU Callback] Error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router; 