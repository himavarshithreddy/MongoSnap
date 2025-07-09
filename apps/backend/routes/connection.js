const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const Connection = require('../models/Connection');
const QueryHistory = require('../models/QueryHistory');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const databaseManager = require('../utils/databaseManager');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
const geminiApi = require('../utils/geminiApi');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const yauzl = require('yauzl-promise');
const StreamValues = require('stream-json/streamers/StreamValues');
const parser = require('stream-json');
const execa = require('execa');
dotenv.config();

// Rate limiters for database operations
const connectionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 connection attempts per 15 minutes per IP
    message: { message: 'Too many connection attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Connection rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many connection attempts, please try again later' });
    }
});

// User-based usage checking middleware
const checkQueryUsage = async (req, res, next) => {
    try {
        const userId = req.userId;
        const userUsage = await UserUsage.getOrCreateUsage(userId);
        const canExecute = userUsage.canExecuteQuery();
        
        if (!canExecute.allowed) {
            const message = canExecute.reason === 'daily_limit_exceeded' 
                ? `Daily query limit reached (${canExecute.dailyLimit}/day). Resets tomorrow.`
                : `Monthly query limit reached (${canExecute.monthlyLimit}/month). Resets next month.`;
            
            return res.status(429).json({ 
                message: message,
                limitType: canExecute.reason,
                usage: {
                    daily: { used: canExecute.dailyLimit - canExecute.dailyRemaining, limit: canExecute.dailyLimit },
                    monthly: { used: canExecute.monthlyLimit - canExecute.monthlyRemaining, limit: canExecute.monthlyLimit }
                }
            });
        }
        
        req.userUsage = userUsage;
        next();
    } catch (error) {
        console.error('Error checking query usage:', error);
        res.status(500).json({ message: 'Error checking usage limits' });
    }
};

const checkAIUsage = async (req, res, next) => {
    try {
        const userId = req.userId;
        const userUsage = await UserUsage.getOrCreateUsage(userId);
        const canGenerate = userUsage.canGenerateAI();
        
        if (!canGenerate.allowed) {
            const message = canGenerate.reason === 'daily_limit_exceeded' 
                ? `Daily AI generation limit reached (${canGenerate.dailyLimit}/day). Resets tomorrow.`
                : `Monthly AI generation limit reached (${canGenerate.monthlyLimit}/month). Resets next month.`;
            
            return res.status(429).json({ 
                message: message,
                limitType: canGenerate.reason,
                usage: {
                    daily: { used: canGenerate.dailyLimit - canGenerate.dailyRemaining, limit: canGenerate.dailyLimit },
                    monthly: { used: canGenerate.monthlyLimit - canGenerate.monthlyRemaining, limit: canGenerate.monthlyLimit }
                }
            });
        }
        
        req.userUsage = userUsage;
        next();
    } catch (error) {
        console.error('Error checking AI usage:', error);
        res.status(500).json({ message: 'Error checking usage limits' });
    }
};

const generalDbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes for general DB operations
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        console.log(`General DB rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ message: 'Too many requests, please try again later' });
    }
});

// Rate limiter for export operations
const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 exports per hour per IP
    message: { message: 'Export limit reached. You can export up to 2 databases per hour.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Export rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ 
            message: 'Export limit reached. You can export up to 2 databases per hour.',
            retryAfter: 3600 // 1 hour in seconds
        });
    }
});

const ENCRYPTION_KEY = process.env.CONNECTION_ENCRYPTION_KEY;
const ENCRYPTION_IV_LENGTH = 16;
const MAX_CONNECTIONS_PER_USER = 2; // Limit per user (excluding sample connections)
const execAsync = util.promisify(exec);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename with user ID and timestamp
        const uniqueName = `${req.userId}_${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept MongoDB dump formats and zip files with JSON collections
        const allowedTypes = [
            'application/gzip',
            'application/x-gzip',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream'
        ];
        
        const allowedExtensions = ['.gz', '.zip'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload a MongoDB dump file (.gz) or a zip file containing JSON collections (.zip)'));
        }
    }
});

// Check if encryption key is set
if (!ENCRYPTION_KEY) {
    console.error('CONNECTION_ENCRYPTION_KEY is not set in environment variables');
    process.exit(1);
}

// Helper function to check connection limits
const checkConnectionLimit = async (userId) => {
    try {
        const nonSampleConnections = await Connection.countDocuments({ 
            userId, 
            isSample: { $ne: true }, // Exclude sample connections
            isTemporary: { $ne: true } // Exclude temporary connections
        });
        
        if (nonSampleConnections >= MAX_CONNECTIONS_PER_USER) {
            return {
                allowed: false,
                message: `Connection limit reached. You can have up to ${MAX_CONNECTIONS_PER_USER} database connections (excluding sample and temporary databases).`,
                currentCount: nonSampleConnections,
                limit: MAX_CONNECTIONS_PER_USER
            };
        }
        
        return {
            allowed: true,
            currentCount: nonSampleConnections,
            limit: MAX_CONNECTIONS_PER_USER
        };
    } catch (error) {
        console.error('Error checking connection limit:', error);
        throw new Error('Failed to check connection limits');
    }
};

const encrypt = (text) => {
    try {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt connection URI');
    }
};

const decrypt = (encrypted) => {
    try {
    const [iv, encryptedText] = encrypted.split(':');
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, ivBuffer);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt connection URI');
    }
};

router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connections = await Connection.find({ userId }).sort({ lastUsed: -1 });
        
        // Transform connections to match frontend expectations
        const transformedConnections = connections.map(conn => ({
            _id: conn._id,
            nickname: conn.nickname,
            lastUsed: conn.lastUsed,
            isActive: conn.isActive || false,
            createdAt: conn.createdAt,
            isSample: conn.isSample || false,
            isTemporary: conn.isTemporary || false,
            tempExpiresAt: conn.tempExpiresAt,
            originalFileName: conn.originalFileName
        }));
        
        // Get connection limit info
        let limitCheck;
        try {
            limitCheck = await checkConnectionLimit(userId);
        } catch (error) {
            console.error('Failed to check connection limits:', error);
      
            limitCheck = {
                currentCount: 0,
                limit: MAX_CONNECTIONS_PER_USER,
                allowed: true
            };
        }

        res.status(200).json({ 
            connections: transformedConnections,
            connectionLimits: {
                current: limitCheck.currentCount,
                maximum: limitCheck.limit,
                remaining: limitCheck.limit - limitCheck.currentCount,
                canCreateMore: limitCheck.allowed
            }
        });
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ message: 'Failed to fetch connections' });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { nickname, uri } = req.body;
        
        // Check connection limit before creating new connection
        const limitCheck = await checkConnectionLimit(userId);
        if (!limitCheck.allowed) {
            return res.status(429).json({ 
                message: limitCheck.message,
                currentCount: limitCheck.currentCount,
                limit: limitCheck.limit
            });
        }
       
        await testConnection(uri);
        const encryptedUri = encrypt(uri);
        const connection = new Connection({ userId, nickname, uri: encryptedUri });
        await connection.save();

        res.status(201).json({ 
            message: 'Connection saved successfully',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                lastUsed: connection.lastUsed,
                isActive: connection.isActive || false,
                createdAt: connection.createdAt
            }
        });
    } catch (err) {
        console.error('Save connection error:', err);

        if (err.code === 11000) {
            return res.status(400).json({ message: 'Connection with this nickname already exists' });
        }

        if (err.message === 'Failed to connect to MongoDB') {
            return res.status(400).json({
                message: err.message,
                details: err.details || 'Could not establish MongoDB connection. Please check your URI.'
            });
        }

        return res.status(500).json({ message: 'Failed to save connection' });
    }
});

router.post('/test-uri', connectionLimiter, async (req, res) => {
    try {
        const { uri } = req.body;
        
        if (!uri) {
            return res.status(400).json({ message: 'URI is required' });
        }
        
        // Validate URI format
        const mongoUriRegex = /^mongodb(?:\+srv)?:\/\/.+:.+@.+\/[^?]+(?:\?.*)?$/;
        if (!mongoUriRegex.test(uri)) {
            return res.status(400).json({ message: 'Invalid MongoDB URI format. Database name is required.' });
        }
        
        console.log('Testing URI without saving:', uri.substring(0, 20) + '...');
        
        try {
            await testConnection(uri);
            console.log('URI test successful');
            return res.status(200).json({ 
                message: 'Connection test successful',
                details: 'The URI is valid and accessible'
            });
        } catch (testError) {
            console.log('URI test failed:', testError.message);
            return res.status(400).json({ 
                message: testError.message || 'Failed to test connection',
                details: testError.details || 'Unknown error occurred while testing connection' 
            });
        }
    } catch (error) {
        console.error('Error testing URI:', error);
        return res.status(500).json({ 
            message: 'Failed to test connection',
            details: error.message 
        });
    }
});

// Get connection limits for the current user
router.get('/limits', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const limitCheck = await checkConnectionLimit(userId);
        
        // Get more detailed connection info
        const totalConnections = await Connection.countDocuments({ userId });
        const sampleConnections = await Connection.countDocuments({ userId, isSample: true });
        const temporaryConnections = await Connection.countDocuments({ userId, isTemporary: true });
        const regularConnections = totalConnections - sampleConnections - temporaryConnections;
        
        res.status(200).json({
            limits: {
                maximum: limitCheck.limit,
                current: limitCheck.currentCount,
                remaining: limitCheck.limit - limitCheck.currentCount,
                canCreateMore: limitCheck.allowed
            },
            breakdown: {
                total: totalConnections,
                regular: regularConnections,
                sample: sampleConnections,
                temporary: temporaryConnections
            }
        });
    } catch (error) {
        console.error('Error fetching connection limits:', error);
        res.status(500).json({ message: 'Failed to fetch connection limits' });
    }
});

// Get server IP address for whitelisting (public endpoint - no auth required)
router.get('/server-ip', async (req, res) => {
    try {
        // Try multiple services to get the public IP
        const https = require('https');
        
        const getIP = () => {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.ipify.org',
                    path: '/',
                    method: 'GET',
                    timeout: 5000
                };
                
                const req = https.request(options, (response) => {
                    let data = '';
                    response.on('data', (chunk) => {
                        data += chunk;
                    });
                    response.on('end', () => {
                        resolve(data.trim());
                    });
                });
                
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                req.end();
            });
        };
        
        try {
            const serverIP = await getIP();
            console.log('Server IP retrieved:', serverIP);
            
            res.status(200).json({
                serverIP: serverIP,
                message: 'Add this IP address to your MongoDB Atlas Network Access whitelist'
            });
        } catch (ipError) {
            console.error('Error getting server IP:', ipError.message);
            
            // Fallback: try to get from environment variable or provide manual instruction
            const fallbackIP = process.env.SERVER_PUBLIC_IP;
            
            if (fallbackIP) {
                res.status(200).json({
                    serverIP: fallbackIP,
                    message: 'Add this IP address to your MongoDB Atlas Network Access whitelist'
                });
            } else {
                res.status(200).json({
                    serverIP: 'Unable to detect automatically',
                    message: 'Please contact support for the server IP address to whitelist'
                });
            }
        }
        
    } catch (error) {
        console.error('Error in server-ip endpoint:', error);
        res.status(500).json({
            serverIP: 'Error retrieving IP',
            message: 'Please contact support for the server IP address'
        });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connection = await Connection.findOne({ _id: req.params.id, userId });
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        let uri = '';
        if (connection.isTemporary) {
            // For temporary databases, reconstruct the URI but don't expose the main database credentials
            // We'll return a placeholder that indicates it's a temporary database
            uri = `[Temporary Database: ${connection.tempDatabaseName}]`;
        } else {
            // For regular connections, decrypt and return the actual URI
            uri = decrypt(connection.uri);
        }
        
        res.status(200).json({
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                uri: uri,
                lastUsed: connection.lastUsed,
                isActive: connection.isActive || false,
                createdAt: connection.createdAt,
                isTemporary: connection.isTemporary || false,
                tempDatabaseName: connection.tempDatabaseName,
                tempExpiresAt: connection.tempExpiresAt,
                originalFileName: connection.originalFileName
            }
        });
    } catch (error) {
        console.error('Error fetching connection:', error);
        res.status(500).json({ message: 'Failed to fetch connection' });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        console.log('Deleting connection:', connectionId, 'for user:', userId);
        
        // First, find the connection to check if it's temporary
        const connection = await Connection.findOne({ _id: connectionId, userId });
        if (!connection) {
            console.log('Connection not found for deletion');
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        // If it's a temporary database, clean up the actual database first
        if (connection.isTemporary) {
            console.log('Deleting temporary database:', connection.tempDatabaseName);
            
            try {
                // Disconnect any active connections first
                await databaseManager.disconnect(userId, connectionId);
                
                // Drop the temporary database
                const tempURI = createTempMongoURI(connection.tempDatabaseName);
                const client = new MongoClient(tempURI);
                await client.connect();
                await client.db().dropDatabase();
                await client.close();
                console.log('Temporary database dropped successfully:', connection.tempDatabaseName);
            } catch (dbError) {
                console.error('Error dropping temporary database:', dbError);
                // Continue with connection deletion even if database drop fails
                // This ensures the connection record is still removed from our system
            }
        } else {
            // For regular connections, just disconnect if active
            try {
                await databaseManager.disconnect(userId, connectionId);
            } catch (disconnectError) {
                console.error('Error disconnecting regular connection:', disconnectError);
                // Continue with deletion
            }
        }
        
        // Delete the connection record
        await Connection.findByIdAndDelete(connectionId);
        
        console.log('Connection deleted successfully');
        res.status(200).json({ 
            message: connection.isTemporary 
                ? 'Temporary database and connection deleted successfully' 
                : 'Connection deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting connection:', error);
        res.status(500).json({ message: 'Failed to delete connection' });
    }
});

router.post('/:id/test', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        console.log('Testing connection:', req.params.id, 'for user:', userId);
        
        const connection = await Connection.findOne({ _id: req.params.id, userId });
        if (!connection) {
            console.log('Connection not found for testing');
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        let uri = '';
        if (connection.isTemporary) {
            // For temporary databases, reconstruct the actual URI for testing
            uri = createTempMongoURI(connection.tempDatabaseName);
        } else {
            // For regular connections, decrypt the stored URI
            uri = decrypt(connection.uri);
        }
        
        console.log('Testing URI:', uri.substring(0, 20) + '...');
        
        try {
            console.log('Starting connection test...');
        await testConnection(uri);
            
            // Update connection status on successful test
            connection.isActive = true;
            connection.isConnected = true;
            connection.isAlive = true;
            connection.disconnectedAt = null;
            connection.lastUsed = new Date();
            await connection.save();
            
            console.log('Connection test successful - status updated');
            return res.status(200).json({ 
                message: 'Connection tested successfully',
                details: 'Connection is working properly'
            });
        } catch (testError) {
            // Update connection status on failed test
            connection.isActive = false;
            connection.isConnected = false;
            connection.isAlive = false;
            connection.disconnectedAt = new Date();
            connection.lastUsed = new Date();
            await connection.save();
            
            console.log('Connection test failed:', testError.message);
            return res.status(400).json({ 
                message: testError.message || 'Failed to test connection',
                details: testError.details || 'Unknown error occurred while testing connection' 
            });
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        return res.status(500).json({ 
            message: 'Failed to test connection',
            details: error.message 
        });
    }
});

// Sample database connection endpoint
router.post('/sample', connectionLimiter, verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        console.log('Connecting to sample database for user:', userId);
        
        // Get sample database URI from environment variables
        const sampleDatabaseURI = process.env.SAMPLE_DATABASE_URI;
        const sampleNickname = 'Sample Database (Read Only)';
        
        if (!sampleDatabaseURI) {
            return res.status(500).json({
                message: 'Sample database is not configured',
                details: 'Please contact support'
            });
        }
        
        // Test the sample database connection first
        console.log('Testing sample database connection...');
        try {
            await testConnection(sampleDatabaseURI);
            console.log('Sample database connection test passed');
        } catch (testError) {
            console.error('Sample database connection test failed:', testError.message);
            return res.status(500).json({
                message: 'Sample database is currently unavailable',
                details: 'Please try again later or use your own MongoDB connection'
            });
        }
        
        // Check if user already has a sample database connection
        let sampleConnection = await Connection.findOne({ 
            userId, 
            nickname: sampleNickname 
        });
        
        if (!sampleConnection) {
            // Create new sample connection entry
            const encryptedUri = encrypt(sampleDatabaseURI);
            sampleConnection = new Connection({ 
                userId, 
                nickname: sampleNickname, 
                uri: encryptedUri,
                isSample: true  // Mark as sample connection
            });
            await sampleConnection.save();
            console.log('Created new sample connection for user:', userId);
        } else {
            console.log('Using existing sample connection for user:', userId);
        }
        
        // Connect to the database using the database manager
        const connectionResult = await databaseManager.connect(
            userId, 
            sampleConnection._id.toString(), 
            sampleDatabaseURI, 
            sampleNickname
        );
        
        // Update connection status in database
        sampleConnection.isActive = true;
        sampleConnection.isConnected = true;
        sampleConnection.isAlive = true;
        sampleConnection.disconnectedAt = null;
        sampleConnection.lastUsed = new Date();
        await sampleConnection.save();
        
        console.log('Sample database connection successful');
        return res.status(200).json({
            message: 'Successfully connected to sample database',
            connection: {
                _id: sampleConnection._id,
                nickname: sampleConnection.nickname,
                host: connectionResult.host,
                databaseName: connectionResult.databaseName,
                isActive: sampleConnection.isActive,
                lastUsed: sampleConnection.lastUsed,
                createdAt: sampleConnection.createdAt,
                isSample: true,
                connectedAt: connectionResult.connectedAt,
                isReadOnly: true // Mark as read-only for UI
            }
        });
        
    } catch (error) {
        console.error('Error connecting to sample database:', error);
        return res.status(500).json({ 
            message: 'Failed to connect to sample database',
            details: error.message 
        });
    }
});

// New endpoint for actual database connection
router.post('/connect', connectionLimiter, verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { nickname, uri, connectionId } = req.body;
        
        console.log('Connecting to database:', { nickname, connectionId, uri: uri ? uri.substring(0, 20) + '...' : 'undefined' });
        
        let connection;
        let isNewConnection = false;
        
        if (connectionId) {
            // Connect to existing connection
            connection = await Connection.findOne({ _id: connectionId, userId });
            if (!connection) {
                return res.status(404).json({ message: 'Connection not found' });
            }
            console.log('Using existing connection:', connection.nickname);
        } else {
            // For new connections, test first before saving
            if (!nickname || !uri) {
                return res.status(400).json({ message: 'Nickname and URI are required for new connections' });
            }
            
            // Test the connection first
            console.log('Testing new connection before saving...');
            try {
                await testConnection(uri);
                console.log('Connection test passed - proceeding to save');
            } catch (testError) {
                console.log('Connection test failed - not saving:', testError.message);
                return res.status(400).json({
                    message: testError.message || 'Failed to test connection',
                    details: testError.details || 'Could not establish MongoDB connection. Please check your URI.'
                });
            }
            
            // Check if connection with this nickname already exists
            const existingConnection = await Connection.findOne({ userId, nickname });
            if (existingConnection) {
                // Use existing connection instead of creating duplicate
                connection = existingConnection;
                console.log('Using existing connection with same nickname:', connection.nickname);
            } else {
                // Check connection limit before creating new connection
                const limitCheck = await checkConnectionLimit(userId);
                if (!limitCheck.allowed) {
                    return res.status(429).json({ 
                        message: limitCheck.message,
                        currentCount: limitCheck.currentCount,
                        limit: limitCheck.limit
                    });
                }
                
                // Create new connection only after successful test and limit check
                const encryptedUri = encrypt(uri);
                connection = new Connection({ userId, nickname, uri: encryptedUri });
                await connection.save();
                isNewConnection = true;
                console.log('Created new connection:', connection.nickname);
            }
        }
        
        // Get the URI for connection
        let connectionUri = '';
        if (connection.isTemporary) {
            // For temporary databases, reconstruct the actual URI
            connectionUri = createTempMongoURI(connection.tempDatabaseName);
        } else {
            // For regular connections, decrypt the stored URI
            connectionUri = decrypt(connection.uri);
        }
        
        // Connect to the database using the database manager
        const connectionResult = await databaseManager.connect(
            userId, 
            connection._id.toString(), 
            connectionUri, 
            connection.nickname
        );
        
        // Update connection status in database
        connection.isActive = true;
        connection.isConnected = true;
        connection.isAlive = true;
        connection.disconnectedAt = null;
        connection.lastUsed = new Date();
        await connection.save();
        
        console.log('Connection successful - returning details');
        return res.status(200).json({
            message: 'Successfully connected to database',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                host: connectionResult.host,
                databaseName: connectionResult.databaseName,
                isActive: connection.isActive,
                lastUsed: connection.lastUsed,
                createdAt: connection.createdAt,
                isNewConnection: isNewConnection,
                connectedAt: connectionResult.connectedAt
            }
        });
        
    } catch (error) {
        console.error('Error connecting to database:', error);
        
        if (error.message === 'Failed to connect to MongoDB') {
            return res.status(400).json({
                message: error.message,
                details: error.details || 'Could not establish MongoDB connection. Please check your URI.'
            });
        }
        
        return res.status(500).json({ 
            message: 'Failed to connect to database',
            details: error.message 
        });
    }
});

// Disconnect from a database
router.post('/:id/disconnect', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        
        console.log('Disconnecting from database:', connectionId, 'for user:', userId);
        
        // Check if connection exists in database
        const connection = await Connection.findOne({ _id: connectionId, userId });
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        // Disconnect using database manager
        await databaseManager.disconnect(userId, connectionId);
        
        // Update connection status in database
        connection.isActive = false;
        connection.isConnected = false;
        connection.isAlive = false;
        connection.disconnectedAt = new Date();
        connection.lastUsed = new Date();
        await connection.save();
        
        console.log('Successfully disconnected from database');
        return res.status(200).json({
            message: 'Successfully disconnected from database',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                isActive: connection.isActive,
                isConnected: connection.isConnected,
                isAlive: connection.isAlive,
                disconnectedAt: connection.disconnectedAt,
                lastUsed: connection.lastUsed
            }
        });
        
    } catch (error) {
        console.error('Error disconnecting from database:', error);
        return res.status(500).json({ 
            message: 'Failed to disconnect from database',
            details: error.message 
        });
    }
});

// Get connection status
router.get('/:id/status', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        
        console.log('Getting connection status for:', connectionId, 'user:', userId);
        
        // Check if connection exists in database
        const connection = await Connection.findOne({ _id: connectionId, userId });
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        // Check if connection is active in database manager
        const isConnected = databaseManager.isConnected(userId, connectionId);
        const connectionInfo = databaseManager.getConnectionInfo(userId, connectionId);
        
        // Test connection if it's supposed to be active
        let isAlive = false;
        if (isConnected) {
            isAlive = await databaseManager.testConnection(userId, connectionId);
        }
        
        // Extract database info from URI
        let statusUri = '';
        if (connection.isTemporary) {
            // For temporary databases, reconstruct the actual URI
            statusUri = createTempMongoURI(connection.tempDatabaseName);
        } else {
            // For regular connections, decrypt the stored URI
            statusUri = decrypt(connection.uri);
        }
        
        const uriMatch = statusUri.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
        const host = uriMatch ? uriMatch[1] : 'Unknown';
        const databaseName = uriMatch ? uriMatch[2] : 'Unknown';
        
        return res.status(200).json({
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                host: host,
                databaseName: databaseName,
                isActive: connection.isActive,
                isConnected: isConnected,
                isAlive: isAlive,
                lastUsed: connection.lastUsed,
                createdAt: connection.createdAt,
                connectionInfo: connectionInfo
            }
        });
        
    } catch (error) {
        console.error('Error getting connection status:', error);
        return res.status(500).json({ 
            message: 'Failed to get connection status',
            details: error.message 
        });
    }
});

// Reconnect to a database
router.post('/:id/reconnect', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        
        console.log('Reconnecting to database:', connectionId, 'for user:', userId);
        
        // Check if connection exists in database
        const connection = await Connection.findOne({ _id: connectionId, userId });
        if (!connection) {
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        // Get the appropriate URI for connection
        let connectionUri;
        if (connection.isTemporary) {
            // For temporary databases, construct URI using temp database name
            connectionUri = createTempMongoURI(connection.tempDatabaseName);
        } else {
            // For regular connections, decrypt the stored URI
            connectionUri = decrypt(connection.uri);
        }
        
        // Reconnect using the database manager
        const connectionResult = await databaseManager.connect(
            userId, 
            connection._id.toString(), 
            connectionUri, 
            connection.nickname
        );
        
        // Update connection status in database
        connection.isActive = true;
        connection.isConnected = true;
        connection.isAlive = true;
        connection.disconnectedAt = null;
        connection.lastUsed = new Date();
        await connection.save();
        
        console.log('Reconnection successful - returning details');
        return res.status(200).json({
            message: 'Successfully reconnected to database',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                host: connectionResult.host,
                databaseName: connectionResult.databaseName,
                isActive: connection.isActive,
                lastUsed: connection.lastUsed,
                createdAt: connection.createdAt,
                connectedAt: connectionResult.connectedAt
            }
        });
        
    } catch (error) {
        console.error('Error reconnecting to database:', error);
        
        if (error.message === 'Failed to connect to MongoDB') {
            return res.status(400).json({
                message: error.message,
                details: error.details || 'Could not establish MongoDB connection. Please check your URI.'
            });
        }
        
        return res.status(500).json({ 
            message: 'Failed to reconnect to database',
            details: error.message 
        });
    }
});

// Execute a query on the connected database
router.post('/:id/query', verifyToken, checkQueryUsage, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        const { collection, operation, query, options, update } = req.body;

        if (!collection || !operation) {
            return res.status(400).json({ message: 'Collection and operation are required.' });
        }

        // Prevent dangerous operations
        const forbiddenOps = ['dropDatabase', 'drop', 'remove'];
        if (forbiddenOps.includes(operation)) {
            return res.status(403).json({ message: 'DropDatabase, Drop and Remove Operations are not allowed.' });
        }

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get the database name from the connection info
        const dbName = dbConn.databaseName || undefined;
        const db = databaseManager.getDatabase(userId, connectionId, dbName);
        if (!db) {
            return res.status(400).json({ message: 'Not connected to the database.' });
        }

        const col = db.collection(collection);
        let result;
        switch (operation) {
            case 'find':
                result = await col.find(query || {}, options || {}).toArray();
                break;
            case 'findOne':
                result = await col.findOne(query || {}, options || {});
                break;
            case 'insertOne':
                result = await col.insertOne(query);
                break;
            case 'insertMany':
                result = await col.insertMany(query);
                break;
            case 'updateOne':
                result = await col.updateOne(query, update, options || {});
                break;
            case 'updateMany':
                result = await col.updateMany(query, update, options || {});
                break;
            case 'deleteOne':
                result = await col.deleteOne(query, options || {});
                break;
            case 'deleteMany':
                result = await col.deleteMany(query, options || {});
                break;
            default:
                return res.status(400).json({ message: 'Unsupported operation.' });
        }

        // Track successful query execution
        await req.userUsage.incrementQueryExecution(operation, connectionId);

        return res.status(200).json({ result });
    } catch (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ message: 'Failed to execute query', details: error.message });
    }
});

// Get active connection details for playground
router.get('/active', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Find the user's active connection
        const activeConnection = await Connection.findOne({ 
            userId, 
            isActive: true 
        }).sort({ lastUsed: -1 });
        
        if (!activeConnection) {
            return res.status(404).json({ message: 'No active connection found' });
        }
        
        // Check if connection is still active in database manager
        const isConnected = databaseManager.isConnected(userId, activeConnection._id.toString());
        const connectionInfo = databaseManager.getConnectionInfo(userId, activeConnection._id.toString());
        
        // Extract database info from URI
        let host = 'Unknown';
        let databaseName = 'Unknown';
        
        if (activeConnection.isTemporary) {
            // For temporary databases, extract info from temp database name
            host = 'Temporary Database';
            databaseName = activeConnection.tempDatabaseName || 'Unknown';
        } else {
            // For regular connections, decrypt URI and extract info
            const decryptedUri = decrypt(activeConnection.uri);
            const uriMatch = decryptedUri.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
            host = uriMatch ? uriMatch[1] : 'Unknown';
            databaseName = uriMatch ? uriMatch[2] : 'Unknown';
        }
        
        return res.status(200).json({
            connection: {
                _id: activeConnection._id,
                nickname: activeConnection.nickname,
                host: host,
                databaseName: databaseName,
                isActive: activeConnection.isActive,
                isConnected: isConnected,
                lastUsed: activeConnection.lastUsed,
                createdAt: activeConnection.createdAt,
                connectionInfo: connectionInfo
            }
        });
        
    } catch (error) {
        console.error('Error getting active connection:', error);
        return res.status(500).json({ 
            message: 'Failed to get active connection',
            details: error.message 
        });
    }
});

// Helper function to convert MongoDB extended JSON to proper MongoDB types
const convertExtendedJSON = (obj) => {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(convertExtendedJSON);
    }
    
    if (typeof obj === 'object') {
        // Handle custom ObjectId format from frontend
        if (obj.__type === 'ObjectId') {
            return new ObjectId(obj.value);
        }
        
        // Handle custom Date format from frontend
        if (obj.__type === 'Date') {
            return new Date(obj.value);
        }
        
        // Handle ObjectId
        if (obj.$oid) {
            return new ObjectId(obj.$oid);
        }
        
        // Handle Date
        if (obj.$date) {
            return new Date(obj.$date);
        }
        
        // Recursively convert nested objects
        const converted = {};
        for (const [key, value] of Object.entries(obj)) {
            converted[key] = convertExtendedJSON(value);
        }
        return converted;
    }
    
    return obj;
};

// Execute a raw MongoDB query string directly (bypass parsing)
router.post('/:id/execute-raw', verifyToken, checkQueryUsage, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        const { queryString, naturalLanguage, generatedQuery } = req.body;

        if (!queryString) {
            return res.status(400).json({ message: 'Query string is required.' });
        }

        // Prevent dangerous operations
        const forbiddenOps = ['dropDatabase', 'drop', 'remove'];
        if (forbiddenOps.some(op => queryString.includes(op))) {
            return res.status(403).json({ message: 'DropDatabase, Drop and Remove Operations are not allowed.' });
        }

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get the database using the connection manager
        const db = databaseManager.getDatabase(userId, connectionId);
        if (!db) {
            return res.status(400).json({ message: 'Not connected to the database.' });
        }

        let result;
        let executionTime = 0;
        let documentsAffected = 0;
        let status = 'success';
        let errorMessage = null;

        // Record start time
        const startTime = Date.now();

        try {
            // Helper function to create collection operations
            const createCollectionOperations = (collectionName) => ({
                find: (query = {}, options = {}) => db.collection(collectionName).find(query, options).toArray(),
                findOne: (query = {}, options = {}) => db.collection(collectionName).findOne(query, options),
                insertOne: (doc) => db.collection(collectionName).insertOne(doc),
                insertMany: (docs) => db.collection(collectionName).insertMany(docs),
                updateOne: (filter, update, options = {}) => db.collection(collectionName).updateOne(filter, update, options),
                updateMany: (filter, update, options = {}) => db.collection(collectionName).updateMany(filter, update, options),
                deleteOne: (filter, options = {}) => db.collection(collectionName).deleteOne(filter, options),
                deleteMany: (filter, options = {}) => db.collection(collectionName).deleteMany(filter, options),
                countDocuments: (query = {}) => db.collection(collectionName).countDocuments(query),
                estimatedDocumentCount: () => db.collection(collectionName).estimatedDocumentCount(),
                aggregate: (pipeline) => db.collection(collectionName).aggregate(pipeline).toArray(),
                distinct: (field, query = {}) => db.collection(collectionName).distinct(field, query),
                createIndex: (keys, options = {}) => db.collection(collectionName).createIndex(keys, options),
                listIndexes: () => db.collection(collectionName).listIndexes().toArray(),
                dropIndex: (indexSpec) => db.collection(collectionName).dropIndex(indexSpec),
                dropIndexes: () => db.collection(collectionName).dropIndexes(),
                drop: () => db.collection(collectionName).drop(),
                renameCollection: (newName, options = {}) => db.collection(collectionName).rename(newName, options),
                replaceOne: (filter, replacement, options = {}) => db.collection(collectionName).replaceOne(filter, replacement, options),
                collMod: (options) => db.command({ collMod: collectionName, ...options }),
                // Add additional methods for completeness
                findAndModify: (options) => db.collection(collectionName).findAndModify(options.query || {}, options.sort || {}, options.update || {}, options),
                findOneAndUpdate: (filter, update, options = {}) => db.collection(collectionName).findOneAndUpdate(filter, update, options),
                findOneAndDelete: (filter, options = {}) => db.collection(collectionName).findOneAndDelete(filter, options),
                findOneAndReplace: (filter, replacement, options = {}) => db.collection(collectionName).findOneAndReplace(filter, replacement, options),
                bulkWrite: (operations, options = {}) => db.collection(collectionName).bulkWrite(operations, options),
                watch: (pipeline = [], options = {}) => db.collection(collectionName).watch(pipeline, options),
                stats: () => db.command({ collStats: collectionName }),
                validate: (options = {}) => db.command({ validate: collectionName, ...options })
            });

            // Create a safe execution context with MongoDB operations
            const executionContext = {
                db: new Proxy({}, {
                    get: function(target, propertyName) {
                        // Handle getCollection method specifically
                        if (propertyName === 'getCollection') {
                            return (collectionName) => {
                                if (typeof collectionName !== 'string') {
                                    throw new Error('Collection name must be a string');
                                }
                                return createCollectionOperations(collectionName);
                            };
                        }
                        
                        // Handle collection method (alternative to getCollection)
                        if (propertyName === 'collection') {
                            return (collectionName) => {
                                if (typeof collectionName !== 'string') {
                                    throw new Error('Collection name must be a string');
                                }
                                return createCollectionOperations(collectionName);
                            };
                        }
                        
                        // Handle database-level operations
                        if (propertyName === 'dropDatabase') {
                            return () => db.dropDatabase();
                        }
                        if (propertyName === 'createCollection') {
                            return (name, options = {}) => db.createCollection(name, options);
                        }
                        if (propertyName === 'runCommand') {
                            return (command) => db.command(command);
                        }
                        if (propertyName === 'command') {
                            return (command) => db.command(command);
                        }
                        if (propertyName === 'listCollections') {
                            return () => db.listCollections().toArray();
                        }
                        if (propertyName === 'stats') {
                            return () => db.stats();
                        }
                        if (propertyName === 'admin') {
                            return () => ({
                                ping: () => db.admin().ping(),
                                command: (cmd) => db.admin().command(cmd),
                                listDatabases: () => db.admin().listDatabases(),
                                serverStatus: () => db.admin().command({ serverStatus: 1 })
                            });
                        }
                        
                        // For direct collection access (db.collectionName syntax)
                        // Return collection operations for any other property name
                        if (typeof propertyName === 'string' && propertyName !== 'constructor' && propertyName !== 'prototype') {
                            return createCollectionOperations(propertyName);
                        }
                        
                        return undefined;
                    }
                }),
                ObjectId: require('mongodb').ObjectId,
                Date: Date,
                // Add additional MongoDB utilities
                ISODate: (dateString) => dateString ? new Date(dateString) : new Date(),
                NumberLong: (value) => parseInt(value),
                NumberInt: (value) => parseInt(value),
                NumberDecimal: (value) => parseFloat(value)
            };

            // Prepare the query for execution
            let executableQuery = queryString.trim();
            

            
            // Execute the query in the safe context
            const executeQuery = new Function('db', 'ObjectId', 'Date', `
                return (async function() {
                    return ${executableQuery};
                })();
            `);

            result = await executeQuery(executionContext.db, executionContext.ObjectId, executionContext.Date);

            // Handle the result (it's already processed since we made operations async)
            if (result && typeof result.then === 'function') {
                result = await result;
            }

            // Calculate documents affected
            if (Array.isArray(result)) {
                documentsAffected = result.length;
            } else if (result && typeof result === 'object') {
                documentsAffected = result.modifiedCount || result.deletedCount || result.insertedCount || (result.acknowledged ? 1 : 0);
            } else {
                documentsAffected = result ? 1 : 0;
            }

            // Calculate execution time
            executionTime = Date.now() - startTime;

        } catch (queryError) {
            // Calculate execution time even for failed queries
            executionTime = Date.now() - startTime;
            status = 'error';
            errorMessage = queryError.message;
            throw queryError;
        }

        // Save query to history
        try {
            console.log('Saving raw query to history:', {
                userId,
                connectionId,
                query: queryString,
                naturalLanguage,
                generatedQuery,
                status,
                executionTime,
                documentsAffected
            });
            
            // Enhanced collection name and operation extraction
            const extractCollectionAndOperation = (queryStr) => {
                let collectionName = 'unknown';
                let operation = 'unknown';
                
                // Try to extract collection name from different patterns
                
                // Pattern 1: db.getCollection('collectionName') or db.getCollection("collectionName")
                let match = queryStr.match(/db\.getCollection\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                if (match) {
                    collectionName = match[1];
                } else {
                    // Pattern 2: db.collection('collectionName') or db.collection("collectionName")  
                    match = queryStr.match(/db\.collection\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                    if (match) {
                        collectionName = match[1];
                    } else {
                        // Pattern 3: Direct collection access db.collectionName
                        match = queryStr.match(/db\.([a-zA-Z_][a-zA-Z0-9_]*)\./);
                        if (match) {
                            collectionName = match[1];
                        }
                    }
                }
                
                // Extract operation (method name)
                const operationMatch = queryStr.match(/\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/);
                if (operationMatch) {
                    operation = operationMatch[1];
                }
                
                return { collectionName, operation };
            };
            
            const { collectionName, operation } = extractCollectionAndOperation(queryString);

            const queryHistoryEntry = new QueryHistory({
                userId,
                connectionId,
                query: queryString,
                naturalLanguage,
                generatedQuery,
                result: status === 'success' ? result : null,
                status,
                errorMessage,
                executionTime,
                documentsAffected,
                collectionName,
                operation
            });

            await queryHistoryEntry.save();
            console.log('Raw query saved to history successfully, ID:', queryHistoryEntry._id);
        } catch (historyError) {
            console.error('Error saving raw query to history:', historyError);
            // Don't fail the main query if history saving fails
        }

        // Track successful query execution
        await req.userUsage.incrementQueryExecution(
            queryString.match(/\.([a-zA-Z]+)\(/)?.[1] || 'unknown',
            connectionId
        );

        return res.status(200).json({ result });
    } catch (error) {
        console.error('Error executing raw query:', error);
        return res.status(500).json({ 
            message: 'Failed to execute query', 
            details: error.message 
        });
    }
});

// Get database schema information
router.get('/:id/schema', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get the database using the connection manager
        const db = databaseManager.getDatabase(userId, connectionId);
        if (!db) {
            return res.status(400).json({ message: 'Not connected to the database.' });
        }

        // Get all collections
        const collections = await db.listCollections().toArray();
        
        const schema = {
            databaseName: db.databaseName,
            collections: []
        };

        // Get schema info for each collection
        for (const collection of collections) {
            const collectionName = collection.name;
            const col = db.collection(collectionName);
            
            try {
                // Get collection stats
                const stats = await db.command({ collStats: collectionName });
                
                // Get indexes
                const indexes = await col.listIndexes().toArray();
                
                // Get document count
                const count = await col.estimatedDocumentCount();
                
                // Try to get schema analysis using MongoDB's analyzeSchema command
                let schemaAnalysis = null;
                let fields = [];
                let sampleDoc = null;
                
                try {
                    console.log(`Attempting schema analysis for collection: ${collectionName}`);
                    
                    // Use MongoDB's analyzeSchema command for richer insights
                    schemaAnalysis = await db.command({ 
                        analyzeSchema: collectionName,
                        sampleSize: 1000  // Analyze up to 1000 documents
                    });
                    
                    console.log(`Schema analysis successful for ${collectionName}:`, {
                        hasSchema: !!schemaAnalysis.schema,
                        fieldCount: schemaAnalysis.schema ? Object.keys(schemaAnalysis.schema).length : 0
                    });
                    
                    // Extract field information from schema analysis
                    if (schemaAnalysis && schemaAnalysis.schema) {
                        fields = extractSchemaFields(schemaAnalysis.schema);
                        console.log(`Extracted ${fields.length} fields from schema analysis for ${collectionName}`);
                    }
                } catch (schemaError) {
                    console.log(`Schema analysis failed for ${collectionName}:`, {
                        error: schemaError.message,
                        code: schemaError.code,
                        name: schemaError.name
                    });
                    
                    // Fallback to sample document analysis
                    console.log(`Falling back to sample document analysis for ${collectionName}`);
                    try {
                        sampleDoc = await col.findOne({});
                        if (sampleDoc) {
                            fields = extractFields(sampleDoc);
                            console.log(`Extracted ${fields.length} fields from sample document for ${collectionName}`);
                        } else {
                            console.log(`No sample document found for ${collectionName}`);
                        }
                    } catch (sampleError) {
                        console.error(`Sample document analysis failed for ${collectionName}:`, sampleError.message);
                    }
                }
                
                schema.collections.push({
                    name: collectionName,
                    type: collection.type,
                    count: count,
                    size: stats.size || 0,
                    avgObjSize: stats.avgObjSize || 0,
                    indexes: indexes.map(idx => ({
                        name: idx.name,
                        key: idx.key,
                        unique: idx.unique || false,
                        sparse: idx.sparse || false,
                        background: idx.background || false
                    })),
                    sampleDocument: sampleDoc,
                    fields: fields,
                    schemaAnalysis: schemaAnalysis,
                    hasSchemaAnalysis: !!schemaAnalysis
                });
            } catch (error) {
                // If we can't get stats for a collection, still include basic info
                schema.collections.push({
                    name: collectionName,
                    type: collection.type,
                    count: 0,
                    size: 0,
                    avgObjSize: 0,
                    indexes: [],
                    sampleDocument: null,
                    fields: [],
                    schemaAnalysis: null,
                    hasSchemaAnalysis: false,
                    error: 'Could not retrieve collection details'
                });
            }
        }

        return res.status(200).json({ schema });
    } catch (error) {
        console.error('Error getting database schema:', error);
        return res.status(500).json({ 
            message: 'Failed to get database schema', 
            details: error.message 
        });
    }
});

// Helper function to extract field information from MongoDB schema analysis
const extractSchemaFields = (schemaData, prefix = '') => {
    const fields = [];
    
    if (!schemaData || typeof schemaData !== 'object') {
        return fields;
    }
    
    for (const [fieldName, fieldInfo] of Object.entries(schemaData)) {
        const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
        
        if (fieldInfo && typeof fieldInfo === 'object') {
            // Extract type information
            const types = fieldInfo.types || [];
            const primaryType = types.length > 0 ? types[0].type : 'unknown';
            
            // Get type statistics
            const typeStats = types.reduce((acc, typeInfo) => {
                acc[typeInfo.type] = {
                    count: typeInfo.count || 0,
                    percentage: typeInfo.percentage || 0
                };
                return acc;
            }, {});
            
            // Check if field has nested fields
            const hasNestedFields = fieldInfo.schema && Object.keys(fieldInfo.schema).length > 0;
            
            fields.push({
                name: fullFieldName,
                type: primaryType,
                types: types,
                typeStats: typeStats,
                hasNestedFields: hasNestedFields,
                totalCount: fieldInfo.count || 0,
                nullCount: fieldInfo.nullCount || 0,
                nullPercentage: fieldInfo.nullPercentage || 0,
                uniqueCount: fieldInfo.uniqueCount || 0,
                uniquePercentage: fieldInfo.uniquePercentage || 0,
                avgLength: fieldInfo.avgLength,
                minLength: fieldInfo.minLength,
                maxLength: fieldInfo.maxLength,
                avgValue: fieldInfo.avgValue,
                minValue: fieldInfo.minValue,
                maxValue: fieldInfo.maxValue
            });
            
            // Recursively extract nested fields (limit depth to prevent infinite recursion)
            if (hasNestedFields && prefix.split('.').length < 3) {
                const nestedFields = extractSchemaFields(fieldInfo.schema, fullFieldName);
                fields.push(...nestedFields);
            }
        }
    }
    
    return fields;
};

// Enhanced helper function to extract field types from a document (fallback)
const extractFields = (doc, prefix = '') => {
    const fields = [];
    
    for (const [key, value] of Object.entries(doc)) {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        const fieldType = getFieldType(value);
        
        fields.push({
            name: fieldName,
            type: fieldType,
            hasNestedFields: fieldType === 'object' && value !== null,
            types: [{ type: fieldType, count: 1, percentage: 100 }],
            typeStats: { [fieldType]: { count: 1, percentage: 100 } },
            totalCount: 1,
            nullCount: value === null ? 1 : 0,
            nullPercentage: value === null ? 100 : 0
        });
        
        // Recursively extract nested fields for objects (but limit depth)
        if (fieldType === 'object' && value !== null && prefix.split('.').length < 2) {
            fields.push(...extractFields(value, fieldName));
        }
    }
    
    return fields;
};

// Helper function to determine field type
const getFieldType = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'double';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (value instanceof ObjectId) return 'objectId';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
};

const testConnection = async (uri) => {
    // Create client with timeout options
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000, // 10 seconds timeout
        connectTimeoutMS: 10000,         // 10 seconds connection timeout
        socketTimeoutMS: 10000,          // 10 seconds socket timeout
    });
    
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        
        console.log('Connected, testing ping...');
        await client.db().admin().ping();
        
        console.log('Ping successful - connection is working');
        return true;
        
    } catch (error) {
        console.error('MongoDB connection test failed:', error.message);
        
        let customError = new Error('Failed to connect to MongoDB');
        
        if (error.message.includes('ECONNREFUSED')) {
            customError.details = 'Connection refused. Check if the host is reachable and MongoDB is running.';
        } else if (error.message.includes('Authentication failed')) {
            customError.details = 'Authentication failed. Verify username and password are correct.';
        } else if (error.message.includes('ENOTFOUND')) {
            customError.details = 'Hostname not found. Check the URI format and DNS resolution.';
        } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
            customError.details = 'Connection timed out. Check network connectivity and firewall settings.';
        } else if (error.message.includes('MongoServerSelectionError')) {
            customError.details = 'Cannot reach MongoDB server. Check if the cluster is accessible from your IP.';
        } else if (error.message.includes('MongoNetworkError')) {
            customError.details = 'Network error. Check your internet connection and firewall settings.';
        } else {
            customError.details = error.message;
        }
        
        throw customError;
    } finally {
        try {
        await client.close();
            console.log('MongoDB client closed');
        } catch (closeError) {
            console.error('Error closing MongoDB client:', closeError.message);
        }
    }
};

// Get detailed schema analysis for a specific collection
router.get('/:id/schema/:collection', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        const collectionName = req.params.collection;

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get the database using the connection manager
        const db = databaseManager.getDatabase(userId, connectionId);
        if (!db) {
            return res.status(400).json({ message: 'Not connected to the database.' });
        }

        const col = db.collection(collectionName);
        
        // Get comprehensive schema analysis
        const schemaAnalysis = await db.command({ 
            analyzeSchema: collectionName,
            sampleSize: 5000  // Larger sample for detailed analysis
        });
        
        // Get additional collection information
        const stats = await db.command({ collStats: collectionName });
        const indexes = await col.listIndexes().toArray();
        const count = await col.estimatedDocumentCount();
        
        // Get sample documents for reference
        const sampleDocs = await col.find({}).limit(5).toArray();
        
        return res.status(200).json({
            collection: {
                name: collectionName,
                count: count,
                size: stats.size || 0,
                avgObjSize: stats.avgObjSize || 0,
                indexes: indexes,
                schemaAnalysis: schemaAnalysis,
                sampleDocuments: sampleDocs
            }
        });
        
    } catch (error) {
        console.error('Error getting collection schema:', error);
        return res.status(500).json({ 
            message: 'Failed to get collection schema', 
            details: error.message 
        });
    }
});

// Debug endpoint to check connection status
router.get('/debug/connections', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get all connections for the user
        const connections = await Connection.find({ userId });
        
        // Get active connections from database manager
        const activeConnections = databaseManager.connections.get(userId) || new Map();
        const connectionInfo = databaseManager.connectionInfo.get(userId) || new Map();
        
        const debugInfo = {
            userId,
            totalConnections: connections.length,
            activeConnectionsInDB: connections.filter(c => c.isActive).length,
            activeConnectionsInManager: activeConnections.size,
            connections: connections.map(conn => ({
                _id: conn._id,
                nickname: conn.nickname,
                isActive: conn.isActive,
                isConnected: conn.isConnected,
                isAlive: conn.isAlive,
                lastUsed: conn.lastUsed,
                disconnectedAt: conn.disconnectedAt,
                inManager: activeConnections.has(conn._id.toString()),
                managerInfo: connectionInfo.get(conn._id.toString())
            }))
        };
        
        console.log('Debug connection info:', debugInfo);
        res.json(debugInfo);
        
    } catch (error) {
        console.error('Error getting debug connection info:', error);
        res.status(500).json({ message: 'Failed to get debug info', error: error.message });
    }
});

// Disconnect on page close (for sendBeacon)
router.post('/disconnect-on-close', async (req, res) => {
    try {
        console.log('Disconnect-on-close request received:', {
            method: req.method,
            contentType: req.headers['content-type'],
            body: req.body,
            bodyType: typeof req.body
        });

        // Extract connection ID from request body
        let connectionId;
        
        // Handle different content types
        if (req.headers['content-type']?.includes('application/json')) {
            // JSON data from sendBeacon with Blob
            connectionId = req.body.connectionId;
        } else if (typeof req.body === 'string') {
            // String data from sendBeacon
            try {
                const parsed = JSON.parse(req.body);
                connectionId = parsed.connectionId;
            } catch (parseError) {
                console.error('Failed to parse request body as JSON:', parseError);
                return res.status(400).json({ message: 'Invalid JSON in request body.' });
            }
        } else {
            // Try to extract from body object
            connectionId = req.body.connectionId;
        }
        
        if (!connectionId) {
            console.error('No connection ID found in request:', req.body);
            return res.status(400).json({ message: 'Connection ID is required.' });
        }

        console.log('Attempting to disconnect connection:', connectionId);

        // Get the connection info from DB (no user verification for cleanup)
        const dbConn = await Connection.findOne({ _id: connectionId });
        if (!dbConn) {
            console.error('Connection not found in database:', connectionId);
            return res.status(404).json({ message: 'Connection not found.' });
        }

        console.log('Found connection in database:', {
            connectionId: dbConn._id,
            userId: dbConn.userId,
            nickname: dbConn.nickname
        });

        // Disconnect from database using the correct method signature
        await databaseManager.disconnect(dbConn.userId, connectionId);
        
        // Update connection status in database
        const updatedConnection = await Connection.findByIdAndUpdate(connectionId, {
            isActive: false,
            isConnected: false,
            isAlive: false,
            disconnectedAt: new Date()
        }, { new: true });
        
        console.log(`Connection ${connectionId} successfully disconnected on page close`);
        console.log('Updated connection status:', {
            isActive: updatedConnection.isActive,
            isConnected: updatedConnection.isConnected,
            isAlive: updatedConnection.isAlive,
            disconnectedAt: updatedConnection.disconnectedAt
        });
        
        res.status(200).json({ message: 'Disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting on page close:', error);
        res.status(500).json({ message: 'Failed to disconnect', error: error.message });
    }
});

// Generate MongoDB query from natural language using Gemini API
router.post('/:id/generate-query', verifyToken, checkAIUsage, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        const { naturalLanguage } = req.body;

        if (!naturalLanguage || !naturalLanguage.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Natural language request is required' 
            });
        }

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ 
                success: false, 
                message: 'Connection not found' 
            });
        }

        // Get database schema for context
        let schema = null;
        try {
            const db = databaseManager.getDatabase(userId, connectionId);
            if (db) {
                const collections = await db.listCollections().toArray();
                
                // Get detailed schema information for each collection
                const detailedCollections = [];
                for (const col of collections) {
                    try {
                        const collection = db.collection(col.name);
                        
                        // Get sample documents to understand field structure
                        const sampleDocs = await collection.find({}).limit(10).toArray();
                        
                        // Analyze field types from sample documents
                        const fieldAnalysis = {};
                        sampleDocs.forEach(doc => {
                            const fields = extractFields(doc);
                            fields.forEach(field => {
                                if (!fieldAnalysis[field.name]) {
                                    fieldAnalysis[field.name] = {
                                        type: field.type,
                                        examples: new Set(),
                                        count: 0
                                    };
                                }
                                fieldAnalysis[field.name].count++;
                                if (field.value !== null && field.value !== undefined) {
                                    fieldAnalysis[field.name].examples.add(String(field.value).substring(0, 50));
                                }
                            });
                        });
                        
                        // Convert to array format
                        const fields = Object.entries(fieldAnalysis).map(([name, info]) => ({
                            name,
                            type: info.type,
                            examples: Array.from(info.examples).slice(0, 3), // Limit to 3 examples
                            frequency: info.count
                        }));
                        
                        // Get collection stats
                        const stats = await collection.estimatedDocumentCount();
                        
                        detailedCollections.push({
                            name: col.name,
                            type: col.type,
                            documentCount: stats,
                            fields: fields,
                            sampleDocuments: sampleDocs.slice(0, 2) // Include 2 sample docs for context
                        });
                    } catch (collectionError) {
                        console.log(`Could not analyze collection ${col.name}:`, collectionError.message);
                        // Add basic collection info if detailed analysis fails
                        detailedCollections.push({
                            name: col.name,
                            type: col.type,
                            documentCount: 0,
                            fields: [],
                            sampleDocuments: []
                        });
                    }
                }
                
                schema = {
                    databaseName: db.databaseName,
                    collections: detailedCollections
                };
                
                console.log('Generated detailed schema for Gemini:', {
                    databaseName: schema.databaseName,
                    collectionCount: schema.collections.length,
                    collections: schema.collections.map(c => ({
                        name: c.name,
                        fieldCount: c.fields.length,
                        documentCount: c.documentCount
                    }))
                });
            }
        } catch (schemaError) {
            console.log('Could not fetch detailed schema for context:', schemaError.message);
            // Fallback to basic schema
            try {
                const db = databaseManager.getDatabase(userId, connectionId);
                if (db) {
                    const collections = await db.listCollections().toArray();
                    schema = {
                        databaseName: db.databaseName,
                        collections: collections.map(col => ({
                            name: col.name,
                            type: col.type,
                            documentCount: 0,
                            fields: [],
                            sampleDocuments: []
                        }))
                    };
                }
            } catch (fallbackError) {
                console.log('Could not fetch even basic schema:', fallbackError.message);
            }
        }

        // Generate query using Gemini API
        const generatedQuery = await geminiApi.generateMongoQuery(naturalLanguage, schema);
        
        // Generate explanation
        const explanation = await geminiApi.explainQuery(generatedQuery, naturalLanguage);

        // Track successful AI generation
        await req.userUsage.incrementAIGeneration(
            'query_generation',
            connectionId
        );

        res.json({
            success: true,
            data: {
                query: generatedQuery,
                explanation: explanation,
                naturalLanguage: naturalLanguage
            }
        });

    } catch (error) {
        console.error('Error generating query:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to generate query',
            details: error.message 
        });
    }
});

// Export database as ZIP file
router.post('/:id/export', verifyToken, exportLimiter, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get the database using the connection manager
        const db = databaseManager.getDatabase(userId, connectionId);
        if (!db) {
            return res.status(400).json({ message: 'Not connected to the database.' });
        }

        console.log('Starting database export for:', dbConn.nickname);

        // Get user information for metadata
        const user = await User.findById(userId).select('name email');
        const exportedByName = user ? user.name : 'Unknown User';

        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log(`Found ${collections.length} collections to export`);

        // Set response headers for ZIP download
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `MongoSnap-${db.databaseName}-export-${timestamp}.zip`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } 
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add metadata file with export limits and statistics
        const metadata = {
            database: db.databaseName,
            exportedAt: new Date().toISOString(),
            exportedBy: exportedByName,
            exportedByEmail: user ? user.email : null,
            connectionName: dbConn.nickname,
            totalCollections: collections.length,
            exportLimits: {
                maxCollectionSize: "100MB",
                maxDocumentsPerCollection: 50000,
                note: "Large collections may be skipped or truncated. Use mongodump for complete exports."
            },
            collections: collections.map(col => ({
                name: col.name,
                type: col.type
            })),
            version: "1.0",
            mongoSnapVersion: "2.1.0",
            exportMethod: "MongoSnap Web Export (Memory-Safe)"
        };

        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Export each collection with memory-safe streaming
        for (const collectionInfo of collections) {
            try {
                const collection = db.collection(collectionInfo.name);
                
                // Check collection size before export
                let collectionStats;
                try {
                    collectionStats = await db.command({ collStats: collectionInfo.name });
                } catch (statsError) {
                    console.warn(`Could not get stats for collection ${collectionInfo.name}, proceeding with export`);
                    collectionStats = { size: 0, count: 0 };
                }
                
                const MAX_COLLECTION_SIZE = 100 * 1024 * 1024; // 100MB limit
                const MAX_DOCUMENT_COUNT = 50000; // 50k documents limit
                
                if (collectionStats.size > MAX_COLLECTION_SIZE) {
                    console.warn(`Skipping large collection ${collectionInfo.name}: ${Math.round(collectionStats.size / 1024 / 1024)}MB (limit: 100MB)`);
                    
                    const skipData = {
                        collection: collectionInfo.name,
                        skipped: true,
                        reason: `Collection too large: ${Math.round(collectionStats.size / 1024 / 1024)}MB (limit: 100MB)`,
                        suggestedAction: "Use MongoDB tools like mongodump for large collections",
                        exportedAt: new Date().toISOString()
                    };
                    
                    archive.append(
                        JSON.stringify(skipData, null, 2), 
                        { name: `collections/${collectionInfo.name}_SKIPPED.json` }
                    );
                    continue;
                }
                
                // Stream documents in batches to avoid memory issues
                const BATCH_SIZE = 1000;
                const cursor = collection.find({});
                const documents = [];
                let totalProcessed = 0;
                let hasMore = true;
                
                console.log(`Exporting collection ${collectionInfo.name} (estimated: ${collectionStats.count || 'unknown'} documents)`);
                
                while (hasMore && totalProcessed < MAX_DOCUMENT_COUNT) {
                    const batch = [];
                    
                    // Process documents in batches
                    for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
                        const doc = await cursor.next();
                        
                        // Convert MongoDB types to JSON-serializable format
                        const jsonDoc = JSON.parse(JSON.stringify(doc, (key, value) => {
                            if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
                                return { $oid: value.toString() };
                            }
                            if (value instanceof Date) {
                                return { $date: value.toISOString() };
                            }
                            return value;
                        }));
                        
                        batch.push(jsonDoc);
                        totalProcessed++;
                    }
                    
                    // Add batch to documents array
                    documents.push(...batch);
                    
                    // Check if we've reached the end or hit limits
                    hasMore = await cursor.hasNext();
                    
                    if (totalProcessed >= MAX_DOCUMENT_COUNT) {
                        console.warn(`Reached document limit for collection ${collectionInfo.name}: ${MAX_DOCUMENT_COUNT} documents`);
                        break;
                    }
                    
                    // Log progress for large collections
                    if (totalProcessed % (BATCH_SIZE * 5) === 0) {
                        console.log(`Processed ${totalProcessed} documents from ${collectionInfo.name}`);
                    }
                }
                
                await cursor.close();
                
                console.log(`Exported collection ${collectionInfo.name}: ${documents.length} documents`);
                
                // Create collection data with metadata
                const collectionData = {
                    collection: collectionInfo.name,
                    count: documents.length,
                    totalDocuments: collectionStats.count || documents.length,
                    truncated: totalProcessed >= MAX_DOCUMENT_COUNT,
                    exportedAt: new Date().toISOString(),
                    documents: documents
                };
                
                // Add warning if truncated
                if (collectionData.truncated) {
                    collectionData.warning = `Collection truncated to ${MAX_DOCUMENT_COUNT} documents. Use MongoDB tools for complete export.`;
                }

                archive.append(
                    JSON.stringify(collectionData, null, 2), 
                    { name: `collections/${collectionInfo.name}.json` }
                );

            } catch (collectionError) {
                console.error(`Error exporting collection ${collectionInfo.name}:`, collectionError);
                
                // Add detailed error file for failed collection
                const errorData = {
                    collection: collectionInfo.name,
                    error: collectionError.message,
                    errorType: collectionError.name || 'UnknownError',
                    suggestion: "Check database permissions and collection accessibility",
                    exportedAt: new Date().toISOString()
                };
                
                archive.append(
                    JSON.stringify(errorData, null, 2), 
                    { name: `collections/${collectionInfo.name}_ERROR.json` }
                );
            }
        }

        // Finalize the archive
        await archive.finalize();
        console.log('Database export completed successfully');

    } catch (error) {
        console.error('Error exporting database:', error);
        
        // If response hasn't been sent yet, send error
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Failed to export database', 
                details: error.message 
            });
        }
    }
});

// Helper function to generate unique database name
const generateTempDatabaseName = (userId, originalFileName) => {
    const random = Math.random().toString(36).substring(2, 7);
    const userSuffix = userId.toString().substring(0, 3);
    const fileSuffix = originalFileName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const databaseName = `temp_${userSuffix}_${fileSuffix}_${random}`;
    
    // Additional validation: ensure the database name only contains safe characters
    // MongoDB database names can contain letters, numbers, and underscores
    const safeDbName = databaseName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Ensure it doesn't start with a number or special character
    const finalDbName = /^[a-zA-Z_]/.test(safeDbName) ? safeDbName : `temp_${safeDbName}`;
    
    return finalDbName;
};

// Helper function to create MongoDB URI for temporary database
const createTempMongoURI = (tempDatabaseName) => {
    // Use a MongoDB instance for temporary databases
    // In production, you might want to use a separate MongoDB instance
    const baseURI = process.env.TEMP_MONGO_URI || process.env.MONGO_URI;
    const uriParts = baseURI.split('/');
    uriParts[uriParts.length - 1] = tempDatabaseName;
    return uriParts.join('/');
};

// Helper function to restore MongoDB dump (.gz files only)
const restoreMongoDBDump = async (filePath, tempDatabaseName) => {
    try {
        // Validate inputs to prevent command injection
        if (!tempDatabaseName || typeof tempDatabaseName !== 'string') {
            throw new Error('Invalid database name provided');
        }
        
        // Ensure tempDatabaseName only contains safe characters
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tempDatabaseName)) {
            throw new Error('Database name contains invalid characters');
        }
        
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path provided');
        }
        
        const baseURI = process.env.TEMP_MONGO_URI || process.env.MONGO_URI;
        const uriWithoutDb = baseURI.substring(0, baseURI.lastIndexOf('/'));
        
        // This function only handles .gz files (MongoDB dumps)
        const fileExtension = path.extname(filePath).toLowerCase();
        if (fileExtension !== '.gz') {
            throw new Error('This function only supports .gz MongoDB dump files');
        }
        
        // Restore command for .gz archive files (mongodump with gzip) - using secure argument passing
        const restoreArgs = [
            '--uri', uriWithoutDb,
            '--archive', filePath,
            '--gzip',
            '--nsFrom', '*',
            '--nsTo', `${tempDatabaseName}.*`
        ];
        
        console.log('Executing restore command with args:', ['mongorestore', ...restoreArgs.map(arg => 
            arg.includes('mongodb') ? arg.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@') : arg
        )]);
        
        const { stdout, stderr } = await execa('mongorestore', restoreArgs);
        
        // Check if restoration was successful
        if (stderr && stderr.includes('0 document(s) restored successfully')) {
            console.warn('No documents were restored. Trying alternative approach...');
            
            // Try without namespace transformation - using secure argument passing
            const altArgs = [
                '--uri', `${uriWithoutDb}/${tempDatabaseName}`,
                '--archive', filePath,
                '--gzip'
            ];
            console.log('Trying alternative command with args:', ['mongorestore', ...altArgs.map(arg => 
                arg.includes('mongodb') ? arg.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@') : arg
            )]);
            
            const { stdout: altStdout, stderr: altStderr } = await execa('mongorestore', altArgs);
            
            if (altStderr && !altStderr.includes('done') && !altStderr.includes('successfully')) {
                console.error('Alternative restore stderr:', altStderr);
            }
            
            console.log('Alternative restore completed:', altStdout);
            return { success: true, output: altStdout };
        }
        
        if (stderr && !stderr.includes('done') && !stderr.includes('successfully')) {
            console.error('Restore stderr:', stderr);
        }
        
        console.log('Restore completed:', stdout);
        return { success: true, output: stdout };
        
    } catch (error) {
        console.error('Restore error:', error);
        
        // Try one more fallback approach
        if (error.message.includes('failed') && path.extname(filePath).toLowerCase() === '.gz') {
            try {
                console.log('Attempting fallback restore for .gz file...');
                const baseURI = process.env.TEMP_MONGO_URI || process.env.MONGO_URI;
                const uriWithoutDb = baseURI.substring(0, baseURI.lastIndexOf('/'));
                
                // Simple restore to specific database - using secure argument passing
                const fallbackArgs = [
                    '--uri', uriWithoutDb,
                    '--gzip',
                    '--archive', filePath,
                    '--drop'
                ];
                console.log('Fallback command with args:', ['mongorestore', ...fallbackArgs.map(arg => 
                    arg.includes('mongodb') ? arg.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@') : arg
                )]);
                
                const { stdout, stderr } = await execa('mongorestore', fallbackArgs);
                console.log('Fallback restore completed:', stdout);
                
                // Now copy the restored data to our temp database - using secure argument passing
                const copyArgs = [
                    '--uri', uriWithoutDb,
                    '--drop',
                    '--nsFrom', '*',
                    '--nsTo', `${tempDatabaseName}.*`
                ];
                await execa('mongorestore', copyArgs);
                
                return { success: true, output: stdout };
            } catch (fallbackError) {
                console.error('Fallback restore also failed:', fallbackError);
                throw new Error(`Failed to restore database: ${error.message}`);
            }
        }
        
        throw new Error(`Failed to restore database: ${error.message}`);
    }
};

// Extract and process zip file containing JSON collections
const extractAndImportZipFile = async (filePath, tempDatabaseName) => {
    try {
        // Validate inputs to prevent command injection
        if (!tempDatabaseName || typeof tempDatabaseName !== 'string') {
            throw new Error('Invalid database name provided');
        }
        
        // Ensure tempDatabaseName only contains safe characters
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tempDatabaseName)) {
            throw new Error('Database name contains invalid characters');
        }
        
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path provided');
        }
        
        console.log('Starting zip file extraction:', filePath);
        
        const tempURI = createTempMongoURI(tempDatabaseName);
        const client = new MongoClient(tempURI);
        await client.connect();
        const db = client.db();
        
        let importedCollections = 0;
        let totalDocuments = 0;
        
        try {
            // Open the zip file
            const zipFile = await yauzl.open(filePath);
            
            // Process each entry in the zip file
            const entries = await zipFile.readEntries();
            
            for (const entry of entries) {
                // Skip directories and non-JSON files
                if (entry.filename.endsWith('/') || !entry.filename.toLowerCase().endsWith('.json')) {
                    console.log(`Skipping non-JSON entry: ${entry.filename}`);
                    continue;
                }
                
                // Extract collection name from filename (remove .json extension and directory path)
                const baseName = path.basename(entry.filename, '.json');
                const collectionName = baseName.replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize collection name
                
                if (!collectionName) {
                    console.log(`Skipping entry with invalid collection name: ${entry.filename}`);
                    continue;
                }
                
                console.log(`Processing JSON file: ${entry.filename} -> collection: ${collectionName}`);
                
                try {
                    // Read the JSON file content
                    const readStream = await entry.openReadStream();
                    const content = await streamToString(readStream);
                    
                    if (!content.trim()) {
                        console.log(`Skipping empty file: ${entry.filename}`);
                        continue;
                    }
                    
                    // Parse JSON content
                    let jsonData;
                    try {
                        jsonData = JSON.parse(content);
                    } catch (parseError) {
                        console.error(`Invalid JSON in file ${entry.filename}:`, parseError.message);
                        continue;
                    }
                    
                    // Ensure data is an array
                    if (!Array.isArray(jsonData)) {
                        // If it's a single object, wrap it in an array
                        jsonData = [jsonData];
                    }
                    
                    if (jsonData.length === 0) {
                        console.log(`No documents to import from: ${entry.filename}`);
                        continue;
                    }
                    
                    // Process ObjectId fields and other MongoDB-specific types
                    const processedData = jsonData.map(doc => processMongoDBTypes(doc));
                    
                    // Import documents into collection
                    const collection = db.collection(collectionName);
                    const result = await collection.insertMany(processedData, { ordered: false });
                    
                    console.log(`Imported ${result.insertedCount} documents into collection: ${collectionName}`);
                    importedCollections++;
                    totalDocuments += result.insertedCount;
                    
                } catch (fileError) {
                    console.error(`Error processing file ${entry.filename}:`, fileError.message);
                    // Continue with other files
                }
            }
            
            await zipFile.close();
            
        } finally {
            await client.close();
        }
        
        if (importedCollections === 0) {
            throw new Error('No valid JSON collections found in the zip file');
        }
        
        console.log(`Zip import completed: ${importedCollections} collections, ${totalDocuments} total documents`);
        return { 
            success: true, 
            output: `Successfully imported ${importedCollections} collections with ${totalDocuments} total documents`,
            collections: importedCollections,
            documents: totalDocuments
        };
        
    } catch (error) {
        console.error('Zip extraction error:', error);
        throw new Error(`Failed to extract and import zip file: ${error.message}`);
    }
};

// Helper function to convert stream to string
const streamToString = (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
};

// Process MongoDB-specific types in JSON documents
const processMongoDBTypes = (obj) => {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => processMongoDBTypes(item));
    }
    
    if (typeof obj === 'object') {
        // Handle MongoDB ObjectId
        if (obj.$oid && typeof obj.$oid === 'string') {
            try {
                return new ObjectId(obj.$oid);
            } catch (error) {
                console.warn('Invalid ObjectId format:', obj.$oid);
                return obj;
            }
        }
        
        // Handle MongoDB Date
        if (obj.$date) {
            if (typeof obj.$date === 'string') {
                return new Date(obj.$date);
            } else if (obj.$date.$numberLong) {
                return new Date(parseInt(obj.$date.$numberLong));
            }
        }
        
        // Handle MongoDB NumberLong
        if (obj.$numberLong && typeof obj.$numberLong === 'string') {
            const value = BigInt(obj.$numberLong);
            // Return as BigInt if outside safe integer range
            if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
                return value;
            }
            return Number(value);
        }
        
        // Handle MongoDB NumberInt
        if (obj.$numberInt && typeof obj.$numberInt === 'string') {
            return parseInt(obj.$numberInt);
        }
        
        // Handle MongoDB NumberDecimal
        if (obj.$numberDecimal && typeof obj.$numberDecimal === 'string') {
            return parseFloat(obj.$numberDecimal);
        }
        
        // Recursively process nested objects
        const processed = {};
        for (const [key, value] of Object.entries(obj)) {
            processed[key] = processMongoDBTypes(value);
        }
        return processed;
    }
    
    return obj;
};

// Upload MongoDB dump file and create temporary database
router.post('/upload', verifyToken, upload.single('dumpFile'), async (req, res) => {
    try {
        const userId = req.userId;
        const { nickname } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        if (!nickname || !nickname.trim()) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Nickname is required' });
        }
        
        // Validate file type - .gz and .zip files allowed
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (fileExtension !== '.gz' && fileExtension !== '.zip') {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Only .gz and .zip formats are supported for database uploads' });
        }
        
        // Check connection limit before creating new connection
        const limitCheck = await checkConnectionLimit(userId);
        if (!limitCheck.allowed) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(429).json({ 
                message: limitCheck.message,
                currentCount: limitCheck.currentCount,
                limit: limitCheck.limit
            });
        }
        
        console.log('File uploaded:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            nickname: nickname
        });
        
        // Generate unique database name
        const tempDatabaseName = generateTempDatabaseName(userId, req.file.originalname);
        
        // Create temporary database connection entry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
        
        // For temporary databases, we don't store the actual URI to prevent security issues
        // The URI will be reconstructed when needed using the tempDatabaseName
        const connection = new Connection({
            userId,
            nickname: nickname.trim(),
            isTemporary: true, // Set this first so validation works correctly
            uri: '', // Empty for temporary databases - will be reconstructed when needed
            tempExpiresAt: expiresAt,
            originalFileName: req.file.originalname,
            tempDatabaseName: tempDatabaseName
        });
        
        await connection.save();
        
        console.log('Temporary connection created:', {
            connectionId: connection._id,
            tempDatabaseName: tempDatabaseName,
            expiresAt: expiresAt
        });
        
        // Start restoration process in background
        setImmediate(async () => {
            try {
                console.log('Starting restoration process for:', req.file.filename);
                
                // Update status to indicate processing
                await Connection.findByIdAndUpdate(connection._id, {
                    isActive: false,
                    isConnected: false,
                    isAlive: false
                });
                
                // Determine which restoration method to use based on file extension
                const fileExtension = path.extname(req.file.originalname).toLowerCase();
                let restoreResult;
                
                if (fileExtension === '.gz') {
                    restoreResult = await restoreMongoDBDump(req.file.path, tempDatabaseName);
                } else if (fileExtension === '.zip') {
                    restoreResult = await extractAndImportZipFile(req.file.path, tempDatabaseName);
                } else {
                    throw new Error('Unsupported file format');
                }
                
                // Verify that data was actually restored by checking the database
                const tempURI = createTempMongoURI(tempDatabaseName);
                const testClient = new MongoClient(tempURI);
                
                try {
                    await testClient.connect();
                    const db = testClient.db();
                    const collections = await db.listCollections().toArray();
                    
                    if (collections.length === 0) {
                        throw new Error('No collections found in restored database');
                    }
                    
                    console.log(`Database restoration verified: ${collections.length} collections found`);
                    
                    // Update connection status to indicate successful restoration
                    await Connection.findByIdAndUpdate(connection._id, {
                        isActive: true,
                        isConnected: true,
                        isAlive: true
                    });
                    
                } catch (verifyError) {
                    console.error('Database verification failed:', verifyError);
                    throw new Error(`Restoration completed but database verification failed: ${verifyError.message}`);
                } finally {
                    await testClient.close();
                }
                
                console.log('Database restoration completed successfully for:', tempDatabaseName);
                
                // Clean up uploaded file after successful restoration
                try {
                    fs.unlinkSync(req.file.path);
                    console.log('Uploaded file cleaned up:', req.file.filename);
                } catch (cleanupError) {
                    console.error('Error cleaning up uploaded file:', cleanupError);
                }
                
            } catch (restoreError) {
                console.error('Restoration failed:', restoreError);
                
                // Mark connection as failed and clean up
                try {
                    await Connection.findByIdAndUpdate(connection._id, {
                        isActive: false,
                        isConnected: false,
                        isAlive: false,
                        // Store error message for debugging
                        disconnectedAt: new Date()
                    });
                    
                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);
                    
                    // Also try to clean up any partially created database
                    try {
                        const tempURI = createTempMongoURI(tempDatabaseName);
                        const cleanupClient = new MongoClient(tempURI);
                        await cleanupClient.connect();
                        await cleanupClient.db().dropDatabase();
                        await cleanupClient.close();
                        console.log('Cleaned up failed database:', tempDatabaseName);
                    } catch (cleanupDbError) {
                        console.error('Error cleaning up failed database:', cleanupDbError);
                    }
                    
                } catch (cleanupError) {
                    console.error('Error during failed restoration cleanup:', cleanupError);
                }
            }
        });
        
        res.status(201).json({
            message: 'File uploaded successfully. Database restoration in progress.',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                lastUsed: connection.lastUsed,
                isActive: false, // Will be updated when restoration completes
                isTemporary: true,
                tempExpiresAt: connection.tempExpiresAt,
                originalFileName: connection.originalFileName,
                createdAt: connection.createdAt
            }
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up uploaded file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up file after upload error:', cleanupError);
            }
        }
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Connection with this nickname already exists' });
        }
        
        res.status(500).json({ 
            message: 'Failed to upload and process file',
            details: error.message 
        });
    }
});

// Test MongoDB tools availability
router.get('/upload/test-tools', verifyToken, async (req, res) => {
    try {
        // Test if mongorestore is available - using secure argument passing
        const { stdout } = await execa('mongorestore', ['--version']);
        res.json({
            mongorestore: {
                available: true,
                version: stdout.trim()
            }
        });
    } catch (error) {
        res.json({
            mongorestore: {
                available: false,
                error: error.message
            }
        });
    }
});

// Debug endpoint to show exact schema sent to Gemini
router.get('/:id/debug-schema', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;

        // Get the connection info from DB
        const dbConn = await Connection.findOne({ _id: connectionId, userId });
        if (!dbConn) {
            return res.status(404).json({ message: 'Connection not found.' });
        }

        // Get database schema for context (same logic as Gemini generation)
        let schema = null;
        try {
            const db = databaseManager.getDatabase(userId, connectionId);
            if (db) {
                const collections = await db.listCollections().toArray();
                
                // Get detailed schema information for each collection
                const detailedCollections = [];
                for (const col of collections) {
                    try {
                        const collection = db.collection(col.name);
                        
                        // Get sample documents to understand field structure
                        const sampleDocs = await collection.find({}).limit(10).toArray();
                        
                        // Analyze field types from sample documents
                        const fieldAnalysis = {};
                        sampleDocs.forEach(doc => {
                            const fields = extractFields(doc);
                            fields.forEach(field => {
                                if (!fieldAnalysis[field.name]) {
                                    fieldAnalysis[field.name] = {
                                        type: field.type,
                                        examples: new Set(),
                                        count: 0
                                    };
                                }
                                fieldAnalysis[field.name].count++;
                                if (field.value !== null && field.value !== undefined) {
                                    fieldAnalysis[field.name].examples.add(String(field.value).substring(0, 50));
                                }
                            });
                        });
                        
                        // Convert to array format
                        const fields = Object.entries(fieldAnalysis).map(([name, info]) => ({
                            name,
                            type: info.type,
                            examples: Array.from(info.examples).slice(0, 3), // Limit to 3 examples
                            frequency: info.count
                        }));
                        
                        // Get collection stats
                        const stats = await collection.estimatedDocumentCount();
                        
                        detailedCollections.push({
                            name: col.name,
                            type: col.type,
                            documentCount: stats,
                            fields: fields,
                            sampleDocuments: sampleDocs.slice(0, 2) // Include 2 sample docs for context
                        });
                    } catch (collectionError) {
                        console.log(`Could not analyze collection ${col.name}:`, collectionError.message);
                        // Add basic collection info if detailed analysis fails
                        detailedCollections.push({
                            name: col.name,
                            type: col.type,
                            documentCount: 0,
                            fields: [],
                            sampleDocuments: []
                        });
                    }
                }
                
                schema = {
                    databaseName: db.databaseName,
                    collections: detailedCollections
                };
                
                console.log('Generated detailed schema for Gemini:', {
                    databaseName: schema.databaseName,
                    collectionCount: schema.collections.length,
                    collections: schema.collections.map(c => ({
                        name: c.name,
                        fieldCount: c.fields.length,
                        documentCount: c.documentCount
                    }))
                });
            }
        } catch (schemaError) {
            console.log('Could not fetch detailed schema for context:', schemaError.message);
            // Fallback to basic schema
            try {
                const db = databaseManager.getDatabase(userId, connectionId);
                if (db) {
                    const collections = await db.listCollections().toArray();
                    schema = {
                        databaseName: db.databaseName,
                        collections: collections.map(col => ({
                            name: col.name,
                            type: col.type,
                            documentCount: 0,
                            fields: [],
                            sampleDocuments: []
                        }))
                    };
                }
            } catch (fallbackError) {
                console.log('Could not fetch even basic schema:', fallbackError.message);
            }
        }

        // Build the prompt to show exactly what Gemini sees
        const geminiApi = require('../utils/geminiApi');
        const prompt = geminiApi.buildPrompt("Find all documents", schema);

        res.json({
            schema: schema,
            promptSentToGemini: prompt,
            collectionNamesWithDots: schema?.collections?.filter(c => c.name.includes('.')).map(c => c.name) || [],
            totalCollections: schema?.collections?.length || 0,
            databaseName: schema?.databaseName || 'Unknown'
        });
        
    } catch (error) {
        console.error('Error getting debug schema:', error);
        res.status(500).json({ message: 'Failed to get debug schema', error: error.message });
    }
});

// Get supported query patterns and examples
router.get('/:id/query-patterns', verifyToken, async (req, res) => {
    try {
        const patterns = {
            description: "MongoSnap supports multiple MongoDB query patterns for maximum flexibility",
            supportedPatterns: [
                {
                    name: "Direct Collection Access",
                    pattern: "db.collectionName.operation()",
                    examples: [
                        "db.users.find({})",
                        "db.products.insertOne({name: 'Product 1'})",
                        "db.orders.aggregate([{$match: {status: 'completed'}}])"
                    ],
                    description: "Access collections directly by name (collections with valid JavaScript identifiers)"
                },
                {
                    name: "getCollection Method",
                    pattern: "db.getCollection('collectionName').operation()",
                    examples: [
                        "db.getCollection('user-profiles').find({})",
                        "db.getCollection('collection with spaces').findOne({})",
                        "db.getCollection('123numbers').countDocuments({})"
                    ],
                    description: "Use getCollection() for collections with special characters, spaces, or starting with numbers"
                },
                {
                    name: "collection Method",
                    pattern: "db.collection('collectionName').operation()",
                    examples: [
                        "db.collection('users').find({})",
                        "db.collection('my-collection').updateMany({}, {$set: {updated: true}})",
                        "db.collection('temp_data').deleteMany({})"
                    ],
                    description: "Alternative syntax using collection() method"
                },
                {
                    name: "Database Operations",
                    pattern: "db.operation()",
                    examples: [
                        "db.listCollections()",
                        "db.createCollection('newCollection')",
                        "db.stats()",
                        "db.runCommand({ping: 1})"
                    ],
                    description: "Database-level operations"
                }
            ],
            supportedMethods: [
                "find", "findOne", "insertOne", "insertMany", 
                "updateOne", "updateMany", "deleteOne", "deleteMany",
                "countDocuments", "estimatedDocumentCount", "aggregate", "distinct",
                "createIndex", "listIndexes", "dropIndex", "dropIndexes",
                "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
                "bulkWrite", "replaceOne", "stats", "validate"
            ],
            utilities: [
                "ObjectId('...')", "Date()", "ISODate('...')",
                "NumberLong(123)", "NumberInt(123)", "NumberDecimal(123.45)"
            ],
            tips: [
                "Use getCollection() when collection names contain special characters or spaces",
                "All queries are executed asynchronously - no need for await in your query strings",
                "Query results are automatically converted to JSON for display",
                "Use ObjectId('id') for ObjectId comparisons in queries",
                "Complex aggregation pipelines are fully supported"
            ]
        };

        res.json(patterns);
    } catch (error) {
        console.error('Error getting query patterns:', error);
        res.status(500).json({ message: 'Failed to get query patterns' });
    }
});

// Get status of temporary database restoration
router.get('/upload/status/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        
        const connection = await Connection.findOne({ 
            _id: connectionId, 
            userId, 
            isTemporary: true 
        });
        
        if (!connection) {
            return res.status(404).json({ message: 'Temporary connection not found' });
        }
        
        // Check if database actually has collections (for more accurate status)
        let collectionCount = 0;
        let statusDetails = 'processing';
        
        if (connection.isActive) {
            try {
                // For temporary databases, use the temp database name to create URI
                const tempURI = createTempMongoURI(connection.tempDatabaseName);
                const client = new MongoClient(tempURI);
                await client.connect();
                const collections = await client.db().listCollections().toArray();
                collectionCount = collections.length;
                await client.close();
                statusDetails = collectionCount > 0 ? 'ready' : 'empty';
            } catch (error) {
                console.error('Error checking collections:', error);
                statusDetails = 'error';
            }
        } else if (connection.disconnectedAt && 
                   (Date.now() - new Date(connection.disconnectedAt).getTime()) > 5 * 60 * 1000) {
            // If it's been more than 5 minutes since disconnection, likely failed
            statusDetails = 'failed';
        }

        res.json({
            connectionId: connection._id,
            nickname: connection.nickname,
            isActive: connection.isActive,
            isConnected: connection.isConnected,
            isAlive: connection.isAlive,
            tempExpiresAt: connection.tempExpiresAt,
            originalFileName: connection.originalFileName,
            status: statusDetails,
            collectionCount: collectionCount,
            lastStatusCheck: new Date()
        });
        
    } catch (error) {
        console.error('Error getting upload status:', error);
        res.status(500).json({ message: 'Failed to get upload status' });
    }
});

// Delete temporary database manually
router.delete('/temp/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        
        const connection = await Connection.findOne({ 
            _id: connectionId, 
            userId, 
            isTemporary: true 
        });
        
        if (!connection) {
            return res.status(404).json({ message: 'Temporary connection not found' });
        }
        
        // Disconnect any active connections
        await databaseManager.disconnect(userId, connectionId);
        
        // Drop the temporary database
        try {
            // For temporary databases, use the temp database name to create URI
            const tempURI = createTempMongoURI(connection.tempDatabaseName);
            const client = new MongoClient(tempURI);
            await client.connect();
            await client.db().dropDatabase();
            await client.close();
            console.log('Temporary database dropped:', connection.tempDatabaseName);
        } catch (dropError) {
            console.error('Error dropping temporary database:', dropError);
            // Continue with connection deletion even if database drop fails
        }
        
        // Delete the connection record
        await Connection.findByIdAndDelete(connectionId);
        
        res.json({ message: 'Temporary database deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting temporary database:', error);
        res.status(500).json({ message: 'Failed to delete temporary database' });
    }
});

// Cleanup expired temporary databases (called periodically)
const cleanupExpiredTempDatabases = async () => {
    try {
        console.log('Starting cleanup of expired temporary databases...');
        
        const expiredConnections = await Connection.find({
            isTemporary: true,
            tempExpiresAt: { $lte: new Date() }
        });
        
        console.log(`Found ${expiredConnections.length} expired temporary databases`);
        
        for (const connection of expiredConnections) {
            try {
                console.log('Cleaning up expired database:', connection.tempDatabaseName);
                
                // Disconnect any active connections
                await databaseManager.disconnect(connection.userId, connection._id.toString());
                
                // Drop the temporary database
                try {
                    // For temporary databases, use the temp database name to create URI
                    const tempURI = createTempMongoURI(connection.tempDatabaseName);
                    const client = new MongoClient(tempURI);
                    await client.connect();
                    await client.db().dropDatabase();
                    await client.close();
                    console.log('Expired database dropped:', connection.tempDatabaseName);
                } catch (dropError) {
                    console.error('Error dropping expired database:', dropError);
                }
                
                // Delete the connection record
                await Connection.findByIdAndDelete(connection._id);
                console.log('Expired connection record deleted:', connection._id);
                
            } catch (cleanupError) {
                console.error('Error cleaning up expired connection:', cleanupError);
            }
        }
        
        console.log('Temporary database cleanup completed');
        
    } catch (error) {
        console.error('Error during temporary database cleanup:', error);
    }
};

// Export the cleanup function so it can be called from the main server
router.cleanupExpiredTempDatabases = cleanupExpiredTempDatabases;

module.exports = router;