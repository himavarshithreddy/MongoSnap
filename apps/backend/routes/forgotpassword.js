const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendResetPasswordEmail } = require('../utils/mailer');

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.resetPasswordToken = tokenHash;
         
            await user.save();

            const resetLink = `https://mongosnap.mp:5173/reset-password/${resetToken}`;
            await sendResetPasswordEmail(user.email, resetLink);
        }

        // Always return the same response
        res.status(200).json({
            message: 'If an account exists, an email has been sent to reset your password.'
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: tokenHash });
    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
   
    await user.save();
    res.status(200).json({ message: 'Password reset successfully' });
});
module.exports = router;