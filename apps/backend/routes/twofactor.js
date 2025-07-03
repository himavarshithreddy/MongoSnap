const express=require('express');
const router=express.Router();
const User = require('../models/User');
const { sendTwoFactorConfirmationEmail, sendTwoFactorDisableConfirmationEmail, sendTwoFactorEmailOTP, sendLoginNotificationEmail } = require('../utils/mailer');
const crypto=require('crypto');
const {verifyToken} = require('./middleware');
const {generateAccessToken,generateRefreshToken,sendRefreshToken} = require('../utils/tokengeneration');
const rateLimit = require('express-rate-limit');
const {generateTOTPSecret, verifyTOTPToken, generateBackupCodes, verifyBackupCode} = require('../utils/totpgenerator');
const speakeasy = require('speakeasy');

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

// Helper function to get login details from request
const getLoginDetails = (req) => {
  const userAgent = req.get('User-Agent') || 'Unknown Device';
  const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
    (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'Unknown IP';
  
  // Clean up the user agent for better readability
  let deviceInfo = userAgent;
  if (userAgent.includes('Chrome')) {
    const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (chromeMatch && osMatch) {
      deviceInfo = `Chrome ${chromeMatch[1]} on ${osMatch[1]}`;
    }
  } else if (userAgent.includes('Firefox')) {
    const firefoxMatch = userAgent.match(/Firefox\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (firefoxMatch && osMatch) {
      deviceInfo = `Firefox ${firefoxMatch[1]} on ${osMatch[1]}`;
    }
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const safariMatch = userAgent.match(/Safari\/([0-9.]+)/);
    const osMatch = userAgent.match(/\(([^)]+)\)/);
    if (safariMatch && osMatch) {
      deviceInfo = `Safari ${safariMatch[1]} on ${osMatch[1]}`;
    }
  }

  return {
    timestamp: new Date(),
    ipAddress: ipAddress,
    userAgent: deviceInfo,
    location: null // We could integrate with a geolocation service here
  };
};

// Helper function to send login notification
const sendLoginNotification = async (user, req) => {
  try {
    if (user.loginNotificationsEnabled) {
      const loginDetails = getLoginDetails(req);
      await sendLoginNotificationEmail(user.email, loginDetails);
    }
  } catch (error) {
    console.error('Failed to send login notification:', error);
    // Don't throw error as this shouldn't fail the login process
  }
};

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

        // Send login notification email
        await sendLoginNotification(user, req);

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

router.post('/enable-totp-verification',verifyToken,async(req,res)=>{
    const userId=req.userId;
    try {
        const user=await User.findById(userId);
        if(!user){
            return res.status(400).json({message:'User not found'});
        }
        if(user.twoFactorEnabled){
            return res.status(400).json({message:'Two-factor authentication already enabled'});
        }
        
        // Generate TOTP secret and QR code
        const { ascii, base32, qrCodeDataURL } = await generateTOTPSecret(user.email);
        
        // Store secret temporarily for verification (don't enable 2FA yet)
        user.twoFactorSecret = ascii;
        user.twoFactorSetupPending = true; // Add this flag to track setup state
        await user.save();
        
        res.status(200).json({message:'TOTP setup initiated', qrCodeDataURL, secretKey: base32});
    } catch (error) {
        console.error('Enable TOTP two-factor error:',error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }
});

router.post('/verify-totp-verification',verifyToken,async(req,res)=>{
    const userId=req.userId;
    const {token}=req.body;
    
    // Validate token input
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
        return res.status(400).json({message:'Invalid TOTP token format. Please enter a 6-digit code.'});
    }
    
    try {
        const user=await User.findById(userId);
        if(!user){
            return res.status(400).json({message:'User not found'});
        }
        if(!user.twoFactorSecret){
            return res.status(400).json({message:'TOTP setup not initiated. Please start TOTP setup first.'});
        }
        if(!user.twoFactorSetupPending){
            return res.status(400).json({message:'TOTP setup not in progress. Please start TOTP setup first.'});
        }
        
        const verified = verifyTOTPToken(user.twoFactorSecret, token);
        
        if(!verified){
            return res.status(400).json({message:'Invalid TOTP token. Please check your authenticator app and try again.'});
        }
        
        // Only now enable 2FA after successful verification
        const backupCodesData = generateBackupCodes();
        user.twoFactorEnabled = true;
        user.twoFactormethod = 'totp';
        user.twoFactorSetupPending = false; // Clear setup flag
        // Store encrypted codes in database
        user.backupCodes = backupCodesData.map(bc => ({
            code: bc.code, // This is the encrypted version
            used: bc.used,
            usedAt: bc.usedAt
        }));
        await user.save();
        
        // Return plain codes to user (only time they'll see them)
        const backupCodesDisplay = backupCodesData.map(bc => bc.plainCode);
        res.status(200).json({
            message:'TOTP two-factor authentication verified and enabled',
            backupCodes: backupCodesDisplay
        });
    } catch (error) {
        console.error('Verify TOTP two-factor error:',error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }
});

router.post('/cancel-totp-setup',verifyToken,async(req,res)=>{
    const userId=req.userId;
    try {
        const user=await User.findById(userId);
        if(!user){
            return res.status(400).json({message:'User not found'});
        }
        
        // Clear setup state and secret
        user.twoFactorSecret = null;
        user.twoFactorSetupPending = false;
        await user.save();
        
        res.status(200).json({message:'TOTP setup cancelled'});
    } catch (error) {
        console.error('Cancel TOTP setup error:',error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }
});

router.post('/disable-totp-verification',verifyToken,async(req,res)=>{
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
        res.status(200).json({message:'TOTP two-factor authentication disabled'});
    } catch (error) {
        console.error('Disable TOTP two-factor error:',error);
        res.status(500).json({message:'Something went wrong. Please try again.'});
    }
});

router.post('/verify-totp-login', async (req, res) => {
    const { email, token } = req.body;

    if (!email || !token) {
        return res.status(400).json({ message: 'Email and token are required' });
    }

    // Validate token input - could be 6-digit TOTP or 8-character backup code
    const isTotpToken = /^\d{6}$/.test(token);
    const isBackupCode = /^[A-F0-9]{8}$/i.test(token);
    
    if (!isTotpToken && !isBackupCode) {
        return res.status(400).json({ message: 'Invalid token format. Please enter a 6-digit TOTP code or 8-character backup code.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (!user.twoFactorEnabled || user.twoFactormethod !== 'totp') {
            return res.status(400).json({ message: 'TOTP two-factor authentication is not enabled for this user' });
        }

        let verified = false;
        let usedBackupCode = false;

        if (isTotpToken) {
            // Verify TOTP token
            if (!user.twoFactorSecret) {
                return res.status(400).json({ message: 'TOTP secret not found' });
            }
            verified = verifyTOTPToken(user.twoFactorSecret, token);
        } else if (isBackupCode) {
            // Verify backup code against encrypted versions
            const backupCode = user.backupCodes.find(bc => 
                !bc.used && verifyBackupCode(token, bc.code)
            );
            
            if (backupCode) {
                verified = true;
                usedBackupCode = true;
                // Mark backup code as used
                backupCode.used = true;
                backupCode.usedAt = new Date();
                await user.save();
            }
        }
        
        if (!verified) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Generate JWT tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        sendRefreshToken(res, refreshToken);

        // Send login notification email
        await sendLoginNotification(user, req);

        res.status(200).json({ 
            message: usedBackupCode ? 'Backup code authentication successful' : 'TOTP two-factor authentication successful', 
            token: accessToken, 
            user: {id: user._id, name: user.name, email: user.email },
            usedBackupCode: usedBackupCode
        });

    } catch (err) {
        console.error('TOTP verification error:', err);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

// Regenerate backup codes
router.post('/regenerate-backup-codes', verifyToken, async (req, res) => {
    const userId = req.userId;
    
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        
        if (!user.twoFactorEnabled || user.twoFactormethod !== 'totp') {
            return res.status(400).json({ message: 'TOTP two-factor authentication is not enabled' });
        }
        
        // Generate new backup codes
        const newBackupCodesData = generateBackupCodes();
        // Store encrypted codes in database
        user.backupCodes = newBackupCodesData.map(bc => ({
            code: bc.code, // This is the encrypted version
            used: bc.used,
            usedAt: bc.usedAt
        }));
        await user.save();
        
        // Return plain codes to user (only time they'll see them)
        const backupCodesDisplay = newBackupCodesData.map(bc => bc.plainCode);
        res.status(200).json({
            message: 'Backup codes regenerated successfully',
            backupCodes: backupCodesDisplay
        });
        
    } catch (error) {
        console.error('Regenerate backup codes error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});

// Get backup codes status
router.get('/backup-codes-status', verifyToken, async (req, res) => {
    const userId = req.userId;
    
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        
        if (!user.twoFactorEnabled || user.twoFactormethod !== 'totp') {
            return res.status(400).json({ message: 'TOTP two-factor authentication is not enabled' });
        }
        
        const totalCodes = user.backupCodes.length;
        const usedCodes = user.backupCodes.filter(bc => bc.used).length;
        const remainingCodes = totalCodes - usedCodes;
        
        res.status(200).json({
            totalCodes,
            usedCodes,
            remainingCodes,
            needsRegeneration: remainingCodes <= 2
        });
        
    } catch (error) {
        console.error('Get backup codes status error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});

module.exports=router;