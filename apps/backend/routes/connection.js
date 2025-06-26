const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const Connection = require('../models/Connection');
const databaseManager = require('../utils/databaseManager');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
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
router.post('/:id/query', verifyToken, async (req, res) => {
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
            return res.status(403).json({ message: 'Operation not allowed.' });
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
        return res.status(200).json({ result });
    } catch (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ message: 'Failed to execute query', details: error.message });
    }
});

// Get active connection details for query console
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

// Execute a raw MongoDB query (enhanced version)
router.post('/:id/execute', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const connectionId = req.params.id;
        const { collection, operation, args } = req.body;

        if (!collection || !operation) {
            return res.status(400).json({ message: 'Collection and operation are required.' });
        }

        // Prevent dangerous operations
        const forbiddenOps = ['dropDatabase', 'drop', 'remove'];
        if (forbiddenOps.includes(operation)) {
            return res.status(403).json({ message: 'Operation not allowed.' });
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

        // Convert extended JSON format to proper MongoDB types
        const convertedArgs = args.map(convertExtendedJSON);

        const col = db.collection(collection);
        let result;

        // Handle different MongoDB operations
        switch (operation) {
            case 'find':
                result = await col.find(convertedArgs[0] || {}, convertedArgs[1] || {}).toArray();
                break;
            case 'findOne':
                result = await col.findOne(convertedArgs[0] || {}, convertedArgs[1] || {});
                break;
            case 'insertOne':
                result = await col.insertOne(convertedArgs[0]);
                break;
            case 'insertMany':
                result = await col.insertMany(convertedArgs[0]);
                break;
            case 'updateOne':
                result = await col.updateOne(convertedArgs[0], convertedArgs[1], convertedArgs[2] || {});
                break;
            case 'updateMany':
                result = await col.updateMany(convertedArgs[0], convertedArgs[1], convertedArgs[2] || {});
                break;
            case 'deleteOne':
                result = await col.deleteOne(convertedArgs[0], convertedArgs[1] || {});
                break;
            case 'deleteMany':
                result = await col.deleteMany(convertedArgs[0], convertedArgs[1] || {});
                break;
            case 'countDocuments':
                result = await col.countDocuments(convertedArgs[0] || {});
                break;
            case 'estimatedDocumentCount':
                result = await col.estimatedDocumentCount();
                break;
            case 'aggregate':
                result = await col.aggregate(convertedArgs[0] || []).toArray();
                break;
            case 'distinct':
                result = await col.distinct(convertedArgs[0], convertedArgs[1] || {});
                break;
            case 'createIndex':
                result = await col.createIndex(convertedArgs[0], convertedArgs[1] || {});
                break;
            case 'listIndexes':
                result = await col.listIndexes().toArray();
                break;
            default:
                return res.status(400).json({ message: `Unsupported operation: ${operation}` });
        }

        return res.status(200).json({ result });
    } catch (error) {
        console.error('Error executing query:', error);
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
                    // Use MongoDB's analyzeSchema command for richer insights
                    schemaAnalysis = await db.command({ 
                        analyzeSchema: collectionName,
                        sampleSize: 1000  // Analyze up to 1000 documents
                    });
                    
                    // Extract field information from schema analysis
                    if (schemaAnalysis && schemaAnalysis.schema) {
                        fields = extractSchemaFields(schemaAnalysis.schema);
                    }
                } catch (schemaError) {
                    console.log(`Schema analysis failed for ${collectionName}, falling back to sample document:`, schemaError.message);
                    
                    // Fallback to sample document analysis
                    sampleDoc = await col.findOne({});
                    if (sampleDoc) {
                        fields = extractFields(sampleDoc);
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

module.exports = router;