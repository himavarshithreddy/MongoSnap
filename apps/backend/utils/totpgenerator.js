const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const generateTOTPSecret = async (userEmail) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `MongoSnap (${userEmail})`, // This shows in the Authenticator app
            issuer: 'MongoSnap',
            length: 20
        });

        const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

        return {
            ascii: secret.ascii,            // Store this in DB (more reliable)
            base32: secret.base32,          // Alternative format
            otpauth_url: secret.otpauth_url,
            qrCodeDataURL                   // Send to frontend for QR display
        };
    } catch (error) {
        console.error('Error generating TOTP secret:', error);
        throw new Error('Failed to generate TOTP secret');
    }
};

const verifyTOTPToken = (secret, token) => {
    try {
        return speakeasy.totp.verify({
            secret: secret,
            token: token,
            window: 1, // Allow 1 time step tolerance
            algorithm: 'sha1'
        });
    } catch (error) {
        console.error('Error verifying TOTP token:', error);
        return false;
    }
};

module.exports = { generateTOTPSecret, verifyTOTPToken };