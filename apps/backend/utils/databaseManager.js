const { MongoClient } = require('mongodb');

class DatabaseManager {
    constructor() {
        this.connections = new Map(); // Map of userId -> Map of connectionId -> client
        this.connectionInfo = new Map(); // Map of userId -> Map of connectionId -> connection info
    }

    // Connect to a database and store the connection
    async connect(userId, connectionId, uri, nickname) {
        try {
            console.log(`Connecting to database for user ${userId}, connection ${connectionId}`);
            
            // Disconnect any existing connection for this user first
            await this.disconnectAll(userId);
            
            // Create client with timeout options
            const client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 10000,
                maxPoolSize: 10,
                minPoolSize: 1,
            });

            // Connect to the database
            await client.connect();
            
            // Test the connection
            await client.db().admin().ping();
            
            // Extract database info from URI
            const uriMatch = uri.match(/mongodb(?:\+srv)?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
            const host = uriMatch ? uriMatch[1] : 'Unknown';
            const databaseName = uriMatch ? uriMatch[2] : 'Unknown';
            
            // Store the connection
            if (!this.connections.has(userId)) {
                this.connections.set(userId, new Map());
                this.connectionInfo.set(userId, new Map());
            }
            
            this.connections.get(userId).set(connectionId, client);
            this.connectionInfo.get(userId).set(connectionId, {
                nickname,
                host,
                databaseName,
                uri: uri.substring(0, 20) + '...', // Store masked URI for logging
                connectedAt: new Date(),
                isActive: true
            });
            
            console.log(`Successfully connected to database: ${nickname} (${host}/${databaseName})`);
            
            return {
                success: true,
                host,
                databaseName,
                connectedAt: new Date()
            };
            
        } catch (error) {
            console.error(`Failed to connect to database for user ${userId}, connection ${connectionId}:`, error.message);
            throw error;
        }
    }

    // Disconnect from a specific database
    async disconnect(userId, connectionId) {
        try {
            console.log(`Disconnecting from database for user ${userId}, connection ${connectionId}`);
            
            const userConnections = this.connections.get(userId);
            if (userConnections && userConnections.has(connectionId)) {
                const client = userConnections.get(connectionId);
                await client.close();
                userConnections.delete(connectionId);
                
                const userInfo = this.connectionInfo.get(userId);
                if (userInfo && userInfo.has(connectionId)) {
                    userInfo.delete(connectionId);
                }
                
                console.log(`Successfully disconnected from database for user ${userId}, connection ${connectionId}`);
            }
        } catch (error) {
            console.error(`Error disconnecting from database for user ${userId}, connection ${connectionId}:`, error.message);
        }
    }

    // Disconnect all connections for a user
    async disconnectAll(userId) {
        try {
            console.log(`Disconnecting all databases for user ${userId}`);
            
            const userConnections = this.connections.get(userId);
            if (userConnections) {
                const disconnectPromises = [];
                for (const [connectionId, client] of userConnections) {
                    disconnectPromises.push(this.disconnect(userId, connectionId));
                }
                await Promise.all(disconnectPromises);
            }
        } catch (error) {
            console.error(`Error disconnecting all databases for user ${userId}:`, error.message);
        }
    }

    // Get a database client for a specific connection
    getClient(userId, connectionId) {
        const userConnections = this.connections.get(userId);
        if (userConnections && userConnections.has(connectionId)) {
            return userConnections.get(connectionId);
        }
        return null;
    }

    // Get database info for a specific connection
    getConnectionInfo(userId, connectionId) {
        const userInfo = this.connectionInfo.get(userId);
        if (userInfo && userInfo.has(connectionId)) {
            return userInfo.get(connectionId);
        }
        return null;
    }

    // Check if a connection is active
    isConnected(userId, connectionId) {
        const userConnections = this.connections.get(userId);
        return userConnections && userConnections.has(connectionId);
    }

    // Get database instance for a specific connection
    getDatabase(userId, connectionId, databaseName = null) {
        const client = this.getClient(userId, connectionId);
        if (client) {
            return databaseName ? client.db(databaseName) : client.db();
        }
        return null;
    }

    // Test if a connection is still alive
    async testConnection(userId, connectionId) {
        try {
            const client = this.getClient(userId, connectionId);
            if (client) {
                await client.db().admin().ping();
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Connection test failed for user ${userId}, connection ${connectionId}:`, error.message);
            return false;
        }
    }

    // Cleanup stale connections (run periodically)
    async cleanupStaleConnections() {
        try {
            console.log('Starting connection cleanup...');
            const now = new Date();
            const staleThreshold = 30 * 60 * 1000; // 30 minutes

            for (const [userId, userConnections] of this.connections) {
                for (const [connectionId, client] of userConnections) {
                    const connectionInfo = this.getConnectionInfo(userId, connectionId);
                    if (connectionInfo) {
                        const timeSinceLastActivity = now - connectionInfo.connectedAt;
                        
                        // Disconnect if connection is older than threshold
                        if (timeSinceLastActivity > staleThreshold) {
                            console.log(`Disconnecting stale connection: user ${userId}, connection ${connectionId}`);
                            await this.disconnect(userId, connectionId);
                        } else {
                            // Test if connection is still alive
                            const isAlive = await this.testConnection(userId, connectionId);
                            if (!isAlive) {
                                console.log(`Disconnecting dead connection: user ${userId}, connection ${connectionId}`);
                                await this.disconnect(userId, connectionId);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during connection cleanup:', error.message);
        }
    }

    // Get connection statistics
    getConnectionStats() {
        let totalConnections = 0;
        let activeConnections = 0;

        for (const [userId, userConnections] of this.connections) {
            totalConnections += userConnections.size;
            for (const [connectionId, client] of userConnections) {
                if (client && client.topology && client.topology.isConnected()) {
                    activeConnections++;
                }
            }
        }

        return {
            totalConnections,
            activeConnections,
            staleConnections: totalConnections - activeConnections
        };
    }
}

// Create a singleton instance
const databaseManager = new DatabaseManager();

module.exports = databaseManager; 