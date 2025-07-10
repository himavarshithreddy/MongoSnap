const { 
    extractQueryMetadata, 
    executeAsyncQuery, 
    createEnhancedExecutionContext,
    validateQuerySecurity 
} = require('../utils/queryExecutor');

describe('Enhanced Query Execution System', () => {
    
    describe('extractQueryMetadata', () => {
        test('should extract collection and operation from simple query', () => {
            const query = "db.users.find({})";
            const metadata = extractQueryMetadata(query);
            
            expect(metadata.collections).toContain('users');
            expect(metadata.operations).toContain('find');
            expect(metadata.primaryCollection).toBe('users');
            expect(metadata.primaryOperation).toBe('find');
        });

        test('should extract from getCollection syntax', () => {
            const query = "db.getCollection('user-profiles').findOne({})";
            const metadata = extractQueryMetadata(query);
            
            expect(metadata.collections).toContain('user-profiles');
            expect(metadata.operations).toContain('findOne');
        });

        test('should extract multiple collections and operations', () => {
            const query = `
                db.users.findOne({ email: "test@example.com" })
                db.orders.updateMany({ userId: ObjectId("...") }, { $set: { status: "updated" } })
            `;
            const metadata = extractQueryMetadata(query);
            
            expect(metadata.collections).toContain('users');
            expect(metadata.collections).toContain('orders');
            expect(metadata.operations).toContain('findOne');
            expect(metadata.operations).toContain('updateMany');
            expect(metadata.hasMultipleCollections).toBe(true);
            expect(metadata.hasMultipleOperations).toBe(true);
        });

        test('should handle nested async query', () => {
            const query = `
                db.userusages.updateOne(
                    { userId: (await db.users.findOne({ email: "abc@x.com" }))._id },
                    { $set: { "x": 0 } }
                )
            `;
            const metadata = extractQueryMetadata(query);
            
            expect(metadata.collections).toContain('users');
            expect(metadata.collections).toContain('userusages');
            expect(metadata.operations).toContain('findOne');
            expect(metadata.operations).toContain('updateOne');
        });
    });

    describe('validateQuerySecurity', () => {
        test('should allow safe MongoDB queries', () => {
            const safeQuery = "db.users.find({})";
            const validation = validateQuerySecurity(safeQuery);
            
            expect(validation.isValid).toBe(true);
            expect(validation.violations).toHaveLength(0);
        });

        test('should detect dangerous require() calls', () => {
            const dangerousQuery = "require('fs').readFileSync('/etc/passwd')";
            const validation = validateQuerySecurity(dangerousQuery);
            
            expect(validation.isValid).toBe(false);
            expect(validation.violations.length).toBeGreaterThan(0);
        });

        test('should detect process access attempts', () => {
            const dangerousQuery = "process.exit(1)";
            const validation = validateQuerySecurity(dangerousQuery);
            
            expect(validation.isValid).toBe(false);
            expect(validation.violations.length).toBeGreaterThan(0);
        });

        test('should detect eval usage', () => {
            const dangerousQuery = "eval('malicious code')";
            const validation = validateQuerySecurity(dangerousQuery);
            
            expect(validation.isValid).toBe(false);
            expect(validation.violations.length).toBeGreaterThan(0);
        });

        test('should allow nested async queries', () => {
            const asyncQuery = `
                db.userusages.updateOne(
                    { userId: (await db.users.findOne({ email: "abc@x.com" }))._id },
                    { $set: { "x": 0 } }
                )
            `;
            const validation = validateQuerySecurity(asyncQuery);
            
            expect(validation.isValid).toBe(true);
            expect(validation.violations).toHaveLength(0);
        });
    });

    describe('createEnhancedExecutionContext', () => {
        let mockDb;
        let context;

        beforeEach(() => {
            mockDb = {
                collection: jest.fn().mockReturnValue({
                    find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
                    findOne: jest.fn().mockResolvedValue(null),
                    insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
                    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
                    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
                    countDocuments: jest.fn().mockResolvedValue(0),
                    estimatedDocumentCount: jest.fn().mockResolvedValue(0),
                    aggregate: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) })
                }),
                command: jest.fn().mockResolvedValue({}),
                listCollections: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
                stats: jest.fn().mockResolvedValue({}),
                createCollection: jest.fn().mockResolvedValue({}),
                dropDatabase: jest.fn().mockResolvedValue({})
            };

            context = createEnhancedExecutionContext(mockDb);
        });

        test('should provide database proxy with collection access', () => {
            expect(context.db).toBeDefined();
            expect(typeof context.db.getCollection).toBe('function');
            expect(typeof context.db.collection).toBe('function');
        });

        test('should provide MongoDB utilities', () => {
            expect(context.ObjectId).toBeDefined();
            expect(context.Date).toBeDefined();
            expect(context.ISODate).toBeDefined();
            expect(context.NumberLong).toBeDefined();
            expect(context.NumberInt).toBeDefined();
            expect(context.NumberDecimal).toBeDefined();
        });

        test('should handle direct collection access', async () => {
            const collection = context.db.users;
            await collection.find({});
            
            expect(mockDb.collection).toHaveBeenCalledWith('users');
        });

        test('should handle getCollection method', async () => {
            const collection = context.db.getCollection('user-profiles');
            await collection.findOne({});
            
            expect(mockDb.collection).toHaveBeenCalledWith('user-profiles');
        });

        test('should handle database-level operations', async () => {
            await context.db.listCollections();
            expect(mockDb.listCollections).toHaveBeenCalled();
        });
    });

    describe('Integration Tests', () => {
        test('should demonstrate nested async query capability', async () => {
            // Mock database with realistic data
            const mockDb = {
                collection: jest.fn().mockImplementation((collectionName) => {
                    if (collectionName === 'users') {
                        return {
                            findOne: jest.fn().mockResolvedValue({
                                _id: 'user-123',
                                email: 'test@example.com',
                                name: 'Test User'
                            })
                        };
                    } else if (collectionName === 'userusages') {
                        return {
                            updateOne: jest.fn().mockResolvedValue({
                                modifiedCount: 1,
                                acknowledged: true
                            })
                        };
                    }
                    return {};
                })
            };

            const nestedQuery = `
                const user = await db.users.findOne({ email: "test@example.com" });
                const result = await db.userusages.updateOne(
                    { userId: user._id },
                    { $set: { lastActivity: new Date() } }
                );
                return { userId: user._id, updated: result.modifiedCount };
            `;

            const result = await executeAsyncQuery(nestedQuery, mockDb);
            
            expect(result).toBeDefined();
            expect(result.userId).toBe('user-123');
            expect(result.updated).toBe(1);
        });

        test('should handle complex multi-step operations', async () => {
            const mockDb = {
                collection: jest.fn().mockImplementation((collectionName) => {
                    if (collectionName === 'users') {
                        return {
                            findOne: jest.fn().mockResolvedValue({ _id: 'user-123' }),
                            find: jest.fn().mockReturnValue({
                                toArray: jest.fn().mockResolvedValue([
                                    { _id: 'user-123', status: 'active' },
                                    { _id: 'user-456', status: 'active' }
                                ])
                            })
                        };
                    } else if (collectionName === 'orders') {
                        return {
                            find: jest.fn().mockReturnValue({
                                toArray: jest.fn().mockResolvedValue([
                                    { _id: 'order-1', userId: 'user-123', amount: 100 }
                                ])
                            }),
                            insertOne: jest.fn().mockResolvedValue({ insertedId: 'order-789' })
                        };
                    }
                    return {};
                })
            };

            const complexQuery = `
                // Get all active users
                const activeUsers = await db.users.find({ status: "active" });
                
                // Calculate total orders for all active users
                let totalOrders = 0;
                for (const user of activeUsers) {
                    const userOrders = await db.orders.find({ userId: user._id });
                    totalOrders += userOrders.length;
                }
                
                // Create a summary
                return {
                    activeUserCount: activeUsers.length,
                    totalOrderCount: totalOrders,
                    avgOrdersPerUser: totalOrders / activeUsers.length
                };
            `;

            const result = await executeAsyncQuery(complexQuery, mockDb);
            
            expect(result).toBeDefined();
            expect(result.activeUserCount).toBe(2);
            expect(result.totalOrderCount).toBeGreaterThanOrEqual(0);
            expect(result.avgOrdersPerUser).toBeGreaterThanOrEqual(0);
        });

        test('should handle errors gracefully', async () => {
            const mockDb = {
                collection: jest.fn().mockReturnValue({
                    findOne: jest.fn().mockRejectedValue(new Error('Database connection failed'))
                })
            };

            const errorQuery = `
                await db.users.findOne({ email: "test@example.com" });
            `;

            await expect(executeAsyncQuery(errorQuery, mockDb)).rejects.toThrow('Database connection failed');
        });

        test('should respect timeout limits', async () => {
            const mockDb = {
                collection: jest.fn().mockReturnValue({
                    findOne: jest.fn().mockImplementation(() => 
                        new Promise(resolve => setTimeout(resolve, 5000))
                    )
                })
            };

            const slowQuery = `
                await db.users.findOne({ email: "test@example.com" });
            `;

            await expect(executeAsyncQuery(slowQuery, mockDb, 1000)).rejects.toThrow('timed out');
        }, 10000);
    });

    describe('Real-world Query Examples', () => {
        test('should handle user-order relationship queries', async () => {
            const mockDb = {
                collection: jest.fn().mockImplementation((collectionName) => {
                    if (collectionName === 'users') {
                        return {
                            findOne: jest.fn().mockResolvedValue({
                                _id: 'user-123',
                                email: 'customer@example.com'
                            })
                        };
                    } else if (collectionName === 'orders') {
                        return {
                            find: jest.fn().mockReturnValue({
                                toArray: jest.fn().mockResolvedValue([
                                    { _id: 'order-1', amount: 100, status: 'completed' },
                                    { _id: 'order-2', amount: 200, status: 'pending' }
                                ])
                            }),
                            aggregate: jest.fn().mockReturnValue({
                                toArray: jest.fn().mockResolvedValue([
                                    { _id: 'completed', total: 100, count: 1 },
                                    { _id: 'pending', total: 200, count: 1 }
                                ])
                            })
                        };
                    }
                    return {};
                })
            };

            const customerAnalysisQuery = `
                // Find customer by email
                const customer = await db.users.findOne({ email: "customer@example.com" });
                
                if (!customer) {
                    return { error: "Customer not found" };
                }
                
                // Get all orders for this customer
                const orders = await db.orders.find({ userId: customer._id });
                
                // Calculate statistics
                const totalSpent = orders.reduce((sum, order) => sum + order.amount, 0);
                const completedOrders = orders.filter(order => order.status === 'completed');
                
                return {
                    customerId: customer._id,
                    customerEmail: customer.email,
                    totalOrders: orders.length,
                    completedOrders: completedOrders.length,
                    totalSpent: totalSpent,
                    averageOrderValue: totalSpent / orders.length
                };
            `;

            const result = await executeAsyncQuery(customerAnalysisQuery, mockDb);
            
            expect(result.customerId).toBe('user-123');
            expect(result.customerEmail).toBe('customer@example.com');
            expect(result.totalOrders).toBe(2);
            expect(result.totalSpent).toBe(300);
            expect(result.averageOrderValue).toBe(150);
        });

        test('should handle data migration scenarios', async () => {
            const mockDb = {
                collection: jest.fn().mockImplementation((collectionName) => {
                    if (collectionName === 'oldUsers') {
                        return {
                            find: jest.fn().mockReturnValue({
                                toArray: jest.fn().mockResolvedValue([
                                    { _id: 'old-1', name: 'User 1', email: 'user1@example.com' },
                                    { _id: 'old-2', name: 'User 2', email: 'user2@example.com' }
                                ])
                            })
                        };
                    } else if (collectionName === 'newUsers') {
                        return {
                            insertMany: jest.fn().mockResolvedValue({
                                insertedCount: 2,
                                insertedIds: ['new-1', 'new-2']
                            })
                        };
                    }
                    return {};
                })
            };

            const migrationQuery = `
                // Get all users from old collection
                const oldUsers = await db.oldUsers.find({});
                
                // Transform data for new schema
                const transformedUsers = oldUsers.map(user => ({
                    originalId: user._id,
                    fullName: user.name,
                    emailAddress: user.email,
                    createdAt: new Date(),
                    migrated: true
                }));
                
                // Insert into new collection
                const result = await db.newUsers.insertMany(transformedUsers);
                
                return {
                    migratedCount: result.insertedCount,
                    sourceCount: oldUsers.length,
                    success: result.insertedCount === oldUsers.length
                };
            `;

            const result = await executeAsyncQuery(migrationQuery, mockDb);
            
            expect(result.migratedCount).toBe(2);
            expect(result.sourceCount).toBe(2);
            expect(result.success).toBe(true);
        });
    });
});

// Performance and Memory Tests
describe('Performance and Memory', () => {
    test('should handle large dataset operations efficiently', async () => {
        // Simulate processing large dataset
        const mockDb = {
            collection: jest.fn().mockReturnValue({
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue(
                        Array.from({ length: 1000 }, (_, i) => ({ _id: `doc-${i}`, value: i }))
                    )
                })
            })
        };

        const largeDataQuery = `
            const docs = await db.largeCollection.find({});
            const processed = docs.map(doc => ({ ...doc, processed: true }));
            return { count: processed.length, first: processed[0], last: processed[processed.length - 1] };
        `;

        const startTime = Date.now();
        const result = await executeAsyncQuery(largeDataQuery, mockDb);
        const endTime = Date.now();

        expect(result.count).toBe(1000);
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle memory efficiently with streaming operations', async () => {
        let memoryUsage = process.memoryUsage();
        const initialMemory = memoryUsage.heapUsed;

        const mockDb = {
            collection: jest.fn().mockReturnValue({
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue(
                        Array.from({ length: 10000 }, (_, i) => ({ 
                            _id: `doc-${i}`, 
                            data: 'x'.repeat(100) // Simulate larger documents
                        }))
                    )
                })
            })
        };

        const memoryIntensiveQuery = `
            const docs = await db.collection.find({});
            // Process in chunks to manage memory
            const chunkSize = 100;
            let processedCount = 0;
            
            for (let i = 0; i < docs.length; i += chunkSize) {
                const chunk = docs.slice(i, i + chunkSize);
                processedCount += chunk.length;
            }
            
            return { processedCount };
        `;

        const result = await executeAsyncQuery(memoryIntensiveQuery, mockDb);
        
        memoryUsage = process.memoryUsage();
        const finalMemory = memoryUsage.heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        expect(result.processedCount).toBe(10000);
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
});

module.exports = {
    extractQueryMetadata,
    executeAsyncQuery,
    createEnhancedExecutionContext,
    validateQuerySecurity
}; 