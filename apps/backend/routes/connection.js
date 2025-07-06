const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const Connection = require('../models/Connection');
const QueryHistory = require('../models/QueryHistory');
const UserUsage = require('../models/UserUsage');
const databaseManager = require('../utils/databaseManager');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
const geminiApi = require('../utils/geminiApi');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
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

const ENCRYPTION_KEY = process.env.CONNECTION_ENCRYPTION_KEY;
const ENCRYPTION_IV_LENGTH = 16;
const MAX_CONNECTIONS_PER_USER = 2; // Limit per user (excluding sample connections)

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
            isSample: { $ne: true } // Exclude sample connections
        });
        
        if (nonSampleConnections >= MAX_CONNECTIONS_PER_USER) {
            return {
                allowed: false,
                message: `Connection limit reached. You can have up to ${MAX_CONNECTIONS_PER_USER} database connections (excluding sample database).`,
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
            isSample: conn.isSample || false
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
        const regularConnections = totalConnections - sampleConnections;
        
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
                sample: sampleConnections
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
        const decryptedUri = decrypt(connection.uri);
        res.status(200).json({
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                uri: decryptedUri,
                lastUsed: connection.lastUsed,
                isActive: connection.isActive || false,
                createdAt: connection.createdAt
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
        console.log('Deleting connection:', req.params.id, 'for user:', userId);
        
        const connection = await Connection.findOneAndDelete({ _id: req.params.id, userId });
        if (!connection) {
            console.log('Connection not found for deletion');
            return res.status(404).json({ message: 'Connection not found' });
        }
        
        console.log('Connection deleted successfully');
        res.status(200).json({ message: 'Connection deleted successfully' });
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
        
        const decryptedUri = decrypt(connection.uri);
        console.log('Testing URI:', decryptedUri.substring(0, 20) + '...');
        
        try {
            console.log('Starting connection test...');
        await testConnection(decryptedUri);
            
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
        
        // Get the decrypted URI
        const decryptedUri = decrypt(connection.uri);
        
        // Connect to the database using the database manager
        const connectionResult = await databaseManager.connect(
            userId, 
            connection._id.toString(), 
            decryptedUri, 
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
        const decryptedUri = decrypt(connection.uri);
        const uriMatch = decryptedUri.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
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
        
        // Get the decrypted URI
        const decryptedUri = decrypt(connection.uri);
        
        // Reconnect using the database manager
        const connectionResult = await databaseManager.connect(
            userId, 
            connection._id.toString(), 
            decryptedUri, 
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
        const decryptedUri = decrypt(activeConnection.uri);
        const uriMatch = decryptedUri.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
        const host = uriMatch ? uriMatch[1] : 'Unknown';
        const databaseName = uriMatch ? uriMatch[2] : 'Unknown';
        
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
            // Create a safe execution context with MongoDB operations
            const executionContext = {
                db: new Proxy({}, {
                    get: function(target, collectionName) {
                        // Handle database-level operations
                        if (collectionName === 'dropDatabase') {
                            return () => db.dropDatabase();
                        }
                        if (collectionName === 'createCollection') {
                            return (name, options = {}) => db.createCollection(name, options);
                        }
                        if (collectionName === 'runCommand') {
                            return (command) => db.command(command);
                        }
                        if (collectionName === 'listCollections') {
                            return () => db.listCollections().toArray();
                        }
                        
                        // Return collection operations for any collection name
                        return {
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
                            collMod: (options) => db.command({ collMod: collectionName, ...options })
                        };
                    }
                }),
                ObjectId: require('mongodb').ObjectId,
                Date: Date
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
                collectionName: queryString.match(/db\.([a-zA-Z_][a-zA-Z0-9_]*)\./)?.[1] || 'unknown',
                operation: queryString.match(/\.([a-zA-Z]+)\(/)?.[1] || 'unknown'
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
router.post('/:id/export', verifyToken, async (req, res) => {
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
            zlib: { level: 9 } // Best compression
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add metadata file
        const metadata = {
            database: db.databaseName,
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            connectionName: dbConn.nickname,
            collections: collections.map(col => ({
                name: col.name,
                type: col.type
            })),
            version: "1.0",
            mongoSnapVersion: "2.1.0"
        };

        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Export each collection
        for (const collectionInfo of collections) {
            try {
                const collection = db.collection(collectionInfo.name);
                const documents = await collection.find({}).toArray();
                
                console.log(`Exporting collection ${collectionInfo.name}: ${documents.length} documents`);
                
                // Convert ObjectId and other MongoDB types to JSON-serializable format
                const jsonDocuments = documents.map(doc => {
                    return JSON.parse(JSON.stringify(doc, (key, value) => {
                        if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
                            return { $oid: value.toString() };
                        }
                        if (value instanceof Date) {
                            return { $date: value.toISOString() };
                        }
                        return value;
                    }));
                });

                // Add collection file to ZIP
                const collectionData = {
                    collection: collectionInfo.name,
                    count: documents.length,
                    documents: jsonDocuments
                };

                archive.append(
                    JSON.stringify(collectionData, null, 2), 
                    { name: `collections/${collectionInfo.name}.json` }
                );

            } catch (collectionError) {
                console.error(`Error exporting collection ${collectionInfo.name}:`, collectionError);
                
                // Add error file for failed collection
                const errorData = {
                    collection: collectionInfo.name,
                    error: collectionError.message,
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

module.exports = router;