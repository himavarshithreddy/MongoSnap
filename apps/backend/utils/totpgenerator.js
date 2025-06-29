const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

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

const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        // Generate 8-character alphanumeric code
        const plainCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const encryptedCode = encryptBackupCode(plainCode);
        
        codes.push({
            code: JSON.stringify(encryptedCode), // Serialize to JSON string for DB storage
            plainCode: plainCode, // Return plain version for initial display
            used: false,
            usedAt: null
        });
    }
    return codes;
};

// Encryption configuration for backup codes
const ALGORITHM = 'aes-256-gcm';

// Ensure we have a proper 32-byte key for AES-256-GCM
const getEncryptionKey = () => {
    if (process.env.BACKUP_CODES_ENCRYPTION_KEY) {
        try {
            const key = Buffer.from(process.env.BACKUP_CODES_ENCRYPTION_KEY, 'base64');
            if (key.length === 32) {
                return key;
            } else {
                console.warn('BACKUP_CODES_ENCRYPTION_KEY is not 32 bytes, generating new key');
            }
        } catch (error) {
            console.warn('Invalid BACKUP_CODES_ENCRYPTION_KEY format, generating new key');
        }
    }
    
    // Generate a new 32-byte key if not properly set
    const newKey = crypto.randomBytes(32);
    console.warn('Generated new encryption key. Set BACKUP_CODES_ENCRYPTION_KEY environment variable for persistence');
    return newKey;
};

const ENCRYPTION_KEY = getEncryptionKey();

// Encrypt backup code
const encryptBackupCode = (text) => {
    try {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input for encryption');
        }
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    } catch (error) {
        console.error('Error encrypting backup code:', error);
        throw new Error('Failed to encrypt backup code');
    }
};

// Decrypt backup code
const decryptBackupCode = (encryptedData) => {
    try {
        if (!encryptedData || !encryptedData.iv || !encryptedData.encrypted || !encryptedData.authTag) {
            throw new Error('Invalid encrypted data structure');
        }
        
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Error decrypting backup code:', error);
        return null;
    }
};

// Verify backup code against encrypted version
const verifyBackupCode = (inputCode, encryptedCodeString) => {
    try {
        // Parse the JSON string back to object
        const encryptedCode = JSON.parse(encryptedCodeString);
        const decryptedCode = decryptBackupCode(encryptedCode);
        return decryptedCode && decryptedCode.toLowerCase() === inputCode.toLowerCase();
    } catch (error) {
        console.error('Error verifying backup code:', error);
        return false;
    }
};

module.exports = { 
    generateTOTPSecret, 
    verifyTOTPToken, 
    generateBackupCodes,
    verifyBackupCode,
    encryptBackupCode,
    decryptBackupCode
};