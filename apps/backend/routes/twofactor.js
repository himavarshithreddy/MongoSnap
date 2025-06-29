const express=require('express');
const router=express.Router();
const User = require('../models/User');
const { sendTwoFactorConfirmationEmail, sendTwoFactorDisableConfirmationEmail, sendTwoFactorEmailOTP } = require('../utils/mailer');
const crypto=require('crypto');
const {verifyToken} = require('./middleware');
const {generateAccessToken,generateRefreshToken,sendRefreshToken} = require('../utils/tokengeneration');
const rateLimit = require('express-rate-limit');

const twoFactorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { message: 'Too many 2FA attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many 2FA attempts, please try again later' });
    }
});

// GET /status - Get current 2FA status
router.get('/status', verifyToken, async (req, res) => {
    const userId = req.userId;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        
        res.status(200).json({
            enabled: user.twoFactorEnabled || false,
            method: user.twoFactormethod || null
        });
    } catch (error) {
        console.error('Get 2FA status error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});

router.post('/enable-email-two-factor',verifyToken,async(req,res)=>{
const userId=req.userId;
try {
    const user=await User.findById(userId);
    if(!user){
        return res.status(400).json({message:'User not found'});
    }
    if(user.twoFactorEnabled){
        return res.status(400).json({message:'Two-factor authentication already enabled'});
    }
    user.twoFactorEnabled=true;
    user.twoFactormethod='email';
    await user.save();
    await sendTwoFactorConfirmationEmail(user.email);
    res.status(200).json({message:'Email two-factor authentication enabled'});
} catch (error) {
    console.error('Enable email two-factor error:',error);
    res.status(500).json({message:'Something went wrong. Please try again.'});
}
   
});

router.post('/disable-email-two-factor',verifyToken,async(req,res)=>{
    const userId=req.userId;
    try {
        const user=await User.findById(userId);
        if(!user){
            return res.status(400).json({message:'User not found'});
        }
        if(!user.twoFactorEnabled){
            return res.status(400).json({message:'Two-factor authentication not enabled'});
        }
        user.twoFactorEnabled=false;
        user.twoFactormethod=null;
        await user.save();
        await sendTwoFactorDisableConfirmationEmail(user.email);
        res.status(200).json({message:'Email two-factor authentication disabled'});
    } catch (error) {
        console.error('Disable email two-factor error:',error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }

});

router.post('/verify-two-factor', async (req, res) => {
    const { email, token } = req.body;

    if (!email || !token) {
        return res.status(400).json({ message: 'Email and token are required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (!user.twoFactorEnabled || user.twoFactormethod !== 'email') {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled for this user' });
        }

        if (!user.twoFactorToken || !user.twoFactorExpiresAt) {
            return res.status(400).json({ message: 'No valid verification token found' });
        }

        if (user.twoFactorExpiresAt < Date.now()) {
            return res.status(400).json({ message: 'Verification token has expired' });
        }

        const tokenHash=crypto.createHash('sha256').update(token.toLowerCase()).digest('hex');
        
        if (user.twoFactorToken !== tokenHash) {
            return res.status(400).json({ message: 'Invalid verification token' });
        }

        // Clear the used token
        user.twoFactorToken = null;
        user.twoFactorExpiresAt = null;
        await user.save();

        // Generate JWT tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        sendRefreshToken(res, refreshToken);

        res.status(200).json({ 
            message: 'Two-factor authentication successful', 
            token: accessToken, 
            user: {id: user._id, name: user.name, email: user.email } 
        });

    } catch (err) {
        console.error('Two-factor verification error:', err);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

router.post('/resend-two-factor', twoFactorLimiter, async(req,res)=>{
    const {email}=req.body;
    
    // Validate email
    if (!email) {
        return res.status(400).json({message:'Email is required'});
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({message:'Invalid email format'});
    }
    
    try {
        const user=await User.findOne({email});
        if(!user){
            return res.status(400).json({message:'User not found'});
        }
        if(!user.twoFactorEnabled){
            return res.status(400).json({message:'Two-factor authentication not enabled'});
        }
        
        const token=crypto.randomBytes(2).toString('hex');
        const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
        user.twoFactorToken=tokenHash;
        user.twoFactorExpiresAt=Date.now()+10*60*1000;
        await user.save();
        await sendTwoFactorEmailOTP(user.email,token);
        res.status(200).json({message:'OTP resent'});
    } catch (error) {
        console.error('Resend two-factor error:', error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }
});

module.exports=router;