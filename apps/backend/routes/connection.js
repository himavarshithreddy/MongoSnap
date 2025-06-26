const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const Connection = require('../models/Connection');
const databaseManager = require('../utils/databaseManager');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
dotenv.config();

const ENCRYPTION_KEY = process.env.CONNECTION_ENCRYPTION_KEY;
const ENCRYPTION_IV_LENGTH = 16;

// Check if encryption key is set
if (!ENCRYPTION_KEY) {
    console.error('CONNECTION_ENCRYPTION_KEY is not set in environment variables');
    process.exit(1);
}

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
            createdAt: conn.createdAt
        }));
        
        res.status(200).json({ connections: transformedConnections });
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ message: 'Failed to fetch connections' });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { nickname, uri } = req.body;
       
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

router.post('/test-uri', async (req, res) => {
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

// New endpoint for actual database connection
router.post('/connect', verifyToken, async (req, res) => {
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
                // Create new connection only after successful test
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
        connection.lastUsed = new Date();
        await connection.save();
        
        console.log('Successfully disconnected from database');
        return res.status(200).json({
            message: 'Successfully disconnected from database',
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
                isActive: connection.isActive,
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
        
        return res.status(200).json({
            connection: {
                _id: connection._id,
                nickname: connection.nickname,
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

module.exports = router;