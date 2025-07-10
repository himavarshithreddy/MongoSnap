const vm = require('vm');
const { ObjectId } = require('mongodb');

/**
 * Enhanced query metadata extraction
 * Extracts collection names and operations from MongoDB query strings
 */
const extractQueryMetadata = (queryString) => {
    const collections = new Set();
    const operations = new Set();
    
    // Patterns to match different ways of accessing collections and their operations
    const patterns = [
        // db.collectionName.operation() - direct access
        {
            regex: /\bdb\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z][a-zA-Z0-9]*)\s*\(/g,
            collectionIndex: 1,
            operationIndex: 2
        },
        // db.getCollection('name').operation() or db.getCollection("name").operation()
        {
            regex: /\bdb\.getCollection\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*([a-zA-Z][a-zA-Z0-9]*)\s*\(/g,
            collectionIndex: 1,
            operationIndex: 2
        },
        // db.collection('name').operation() or db.collection("name").operation()
        {
            regex: /\bdb\.collection\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*([a-zA-Z][a-zA-Z0-9]*)\s*\(/g,
            collectionIndex: 1,
            operationIndex: 2
        }
    ];
    
    // Extract collections and operations using all patterns
    patterns.forEach(({ regex, collectionIndex, operationIndex }) => {
        let match;
        while ((match = regex.exec(queryString)) !== null) {
            collections.add(match[collectionIndex]);
            operations.add(match[operationIndex]);
        }
    });
    
    // Also look for database-level operations
    const dbOperationRegex = /\bdb\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g;
    let dbMatch;
    while ((dbMatch = dbOperationRegex.exec(queryString)) !== null) {
        const operation = dbMatch[1];
        // Only add if it's not a collection access pattern
        if (!['getCollection', 'collection'].includes(operation)) {
            operations.add(operation);
        }
    }
    
    return {
        collections: Array.from(collections),
        operations: Array.from(operations),
        primaryCollection: Array.from(collections)[0] || 'unknown',
        primaryOperation: Array.from(operations)[0] || 'unknown',
        hasMultipleCollections: collections.size > 1,
        hasMultipleOperations: operations.size > 1
    };
};

/**
 * Enhanced async query execution with improved sandboxing
 * Supports deeply nested asynchronous operations
 */
const executeAsyncQuery = async (queryString, db, timeoutMs = 30000) => {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
            reject(new Error(`Query execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        
        try {
            // Create enhanced execution context with async support
            const executionContext = createEnhancedExecutionContext(db);
            
            // Enhanced query wrapper that properly handles async operations
            const wrappedQuery = `
                (async function executeQuery() {
                    try {
                        // User's query - fully async supported
                        const result = await (async function() {
                            return ${queryString};
                        })();
                        
                        return {
                            success: true,
                            result: result,
                            executionTime: ${Date.now()} - ${startTime}
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                message: error.message,
                                name: error.name,
                                stack: error.stack
                            },
                            executionTime: ${Date.now()} - ${startTime}
                        };
                    }
                })()
            `;
            
            // Create sandbox with limited global access for security
            const sandbox = {
                ...executionContext,
                console: {
                    log: (...args) => console.log('[QUERY]', ...args),
                    error: (...args) => console.error('[QUERY ERROR]', ...args),
                    warn: (...args) => console.warn('[QUERY WARN]', ...args)
                },
                // Disable dangerous globals
                setTimeout: undefined,
                setInterval: undefined,
                setImmediate: undefined,
                process: undefined,
                require: undefined,
                module: undefined,
                exports: undefined,
                global: undefined,
                Buffer: undefined,
                // Add specific allowed globals
                Date: (...args) => args.length > 0 ? new Date(...args) : new Date(),
                JSON: JSON,
                Math: Math,
                parseInt: parseInt,
                parseFloat: parseFloat,
                isNaN: isNaN,
                isFinite: isFinite,
                Array: Array,
                Object: Object,
                String: String,
                Number: Number,
                Boolean: Boolean
            };
            
            // Create VM context with security restrictions
            const context = vm.createContext(sandbox, {
                name: 'MongoQueryExecution',
                origin: 'mongosnap-query',
                codeGeneration: {
                    strings: false, // Disable eval and Function constructor
                    wasm: false     // Disable WebAssembly
                }
            });
            
            // Execute the query in the sandboxed environment
            const script = new vm.Script(wrappedQuery, {
                filename: 'user-query.js',
                timeout: timeoutMs,
                displayErrors: true
            });
            
            const result = await script.runInContext(context, {
                timeout: timeoutMs,
                breakOnSigint: true
            });
            
            clearTimeout(timeoutId);
            
            if (result.success) {
                resolve(result.result);
            } else {
                const error = new Error(result.error.message);
                error.name = result.error.name;
                error.stack = result.error.stack;
                reject(error);
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }
    });
};

/**
 * Enhanced execution context factory
 * Creates a secure, async-capable MongoDB execution environment
 */
const createEnhancedExecutionContext = (db) => {
    // Helper function to create async collection operations
    const createAsyncCollectionOperations = (collectionName) => {
        const collection = db.collection(collectionName);
        
        return {
            // Read operations - all async
            find: async (query = {}, options = {}) => {
                return await collection.find(query, options).toArray();
            },
            findOne: async (query = {}, options = {}) => {
                return await collection.findOne(query, options);
            },
            countDocuments: async (query = {}) => {
                return await collection.countDocuments(query);
            },
            estimatedDocumentCount: async () => {
                return await collection.estimatedDocumentCount();
            },
            distinct: async (field, query = {}) => {
                return await collection.distinct(field, query);
            },
            aggregate: async (pipeline) => {
                return await collection.aggregate(pipeline).toArray();
            },
            
            // Write operations - all async
            insertOne: async (doc) => {
                return await collection.insertOne(doc);
            },
            insertMany: async (docs) => {
                return await collection.insertMany(docs);
            },
            updateOne: async (filter, update, options = {}) => {
                return await collection.updateOne(filter, update, options);
            },
            updateMany: async (filter, update, options = {}) => {
                return await collection.updateMany(filter, update, options);
            },
            replaceOne: async (filter, replacement, options = {}) => {
                return await collection.replaceOne(filter, replacement, options);
            },
            deleteOne: async (filter, options = {}) => {
                return await collection.deleteOne(filter, options);
            },
            deleteMany: async (filter, options = {}) => {
                return await collection.deleteMany(filter, options);
            },
            
            // FindAndModify operations - all async
            findOneAndUpdate: async (filter, update, options = {}) => {
                return await collection.findOneAndUpdate(filter, update, options);
            },
            findOneAndDelete: async (filter, options = {}) => {
                return await collection.findOneAndDelete(filter, options);
            },
            findOneAndReplace: async (filter, replacement, options = {}) => {
                return await collection.findOneAndReplace(filter, replacement, options);
            },
            
            // Index operations - all async
            createIndex: async (keys, options = {}) => {
                return await collection.createIndex(keys, options);
            },
            listIndexes: async () => {
                return await collection.listIndexes().toArray();
            },
            dropIndex: async (indexSpec) => {
                return await collection.dropIndex(indexSpec);
            },
            dropIndexes: async () => {
                return await collection.dropIndexes();
            },
            
            // Bulk operations - all async
            bulkWrite: async (operations, options = {}) => {
                return await collection.bulkWrite(operations, options);
            },
            
            // Collection management - all async
            drop: async () => {
                return await collection.drop();
            },
            rename: async (newName, options = {}) => {
                return await collection.rename(newName, options);
            },
            
            // Collection stats - all async
            stats: async () => {
                return await db.command({ collStats: collectionName });
            },
            validate: async (options = {}) => {
                return await db.command({ validate: collectionName, ...options });
            }
        };
    };
    
    // Create the database proxy with enhanced async support
    const dbProxy = new Proxy({}, {
        get: function(target, propertyName) {
            // Handle getCollection method
            if (propertyName === 'getCollection') {
                return (collectionName) => {
                    if (typeof collectionName !== 'string') {
                        throw new Error('Collection name must be a string');
                    }
                    return createAsyncCollectionOperations(collectionName);
                };
            }
            
            // Handle collection method (alternative to getCollection)
            if (propertyName === 'collection') {
                return (collectionName) => {
                    if (typeof collectionName !== 'string') {
                        throw new Error('Collection name must be a string');
                    }
                    return createAsyncCollectionOperations(collectionName);
                };
            }
            
            // Handle database-level operations - all async
            if (propertyName === 'dropDatabase') {
                return async () => await db.dropDatabase();
            }
            if (propertyName === 'createCollection') {
                return async (name, options = {}) => await db.createCollection(name, options);
            }
            if (propertyName === 'runCommand' || propertyName === 'command') {
                return async (command) => await db.command(command);
            }
            if (propertyName === 'listCollections') {
                return async () => await db.listCollections().toArray();
            }
            if (propertyName === 'stats') {
                return async () => await db.stats();
            }
            if (propertyName === 'admin') {
                return () => ({
                    ping: async () => await db.admin().ping(),
                    command: async (cmd) => await db.admin().command(cmd),
                    listDatabases: async () => await db.admin().listDatabases(),
                    serverStatus: async () => await db.admin().command({ serverStatus: 1 })
                });
            }
            
            // For direct collection access (db.collectionName syntax)
            if (typeof propertyName === 'string' && 
                propertyName !== 'constructor' && 
                propertyName !== 'prototype' &&
                propertyName !== 'toString' &&
                propertyName !== 'valueOf') {
                return createAsyncCollectionOperations(propertyName);
            }
            
            return undefined;
        }
    });
    
    return {
        db: dbProxy,
        ObjectId: (id) => {
            try {
                if (id === undefined) {
                    return new ObjectId();
                }
                return new ObjectId(id);
            } catch (error) {
                throw new Error(`Invalid ObjectId: ${id}. ObjectId must be a 24-character hex string.`);
            }
        },
        Date: (...args) => args.length > 0 ? new Date(...args) : new Date(),
        ISODate: (dateString) => dateString ? new Date(dateString) : new Date(),
        NumberLong: (value) => parseInt(value),
        NumberInt: (value) => parseInt(value),
        NumberDecimal: (value) => parseFloat(value)
    };
};

/**
 * Security validator for query strings
 */
const validateQuerySecurity = (queryString) => {
    const dangerousPatterns = [
        /require\s*\(/,           // Node.js require()
        /process\./,              // Process access
        /global\./,               // Global object access
        /Function\s*\(/,          // Function constructor
        /eval\s*\(/,              // eval() function
        /setTimeout\s*\(/,        // setTimeout
        /setInterval\s*\(/,       // setInterval
        /setImmediate\s*\(/,      // setImmediate
        /child_process/,          // Child process
        /fs\./,                   // File system
        /os\./,                   // Operating system
        /__proto__/,              // Prototype pollution
        /constructor\.constructor/, // Constructor access
        /import\s*\(/,            // Dynamic imports
    ];
    
    const violations = [];
    dangerousPatterns.forEach((pattern, index) => {
        if (pattern.test(queryString)) {
            violations.push(`Potentially dangerous pattern detected: ${pattern.toString()}`);
        }
    });
    
    return {
        isValid: violations.length === 0,
        violations: violations
    };
};

module.exports = {
    extractQueryMetadata,
    executeAsyncQuery,
    createEnhancedExecutionContext,
    validateQuerySecurity
}; 