const express = require('express');
const router = express.Router();
const QueryHistory = require('../models/QueryHistory');
const SavedQuery = require('../models/SavedQuery');
const { verifyToken } = require('./middleware');
const { checkUserSubscription } = require('./middleware'); // Added this import

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
    console.log('GET /api/query/test - Test endpoint hit');
    res.json({ 
        success: true, 
        message: 'Query history routes are working!',
        timestamp: new Date().toISOString()
    });
});

// Get query history for a user
router.get('/history', verifyToken, checkUserSubscription, async (req, res) => {
    console.log('GET /api/query/history - Request received:', {
        userId: req.userId,
        userPlan: req.userPlan,
        query: req.query,
        headers: req.headers.authorization ? 'Bearer token present' : 'No auth header'
    });
    
    try {
        const { page = 1, limit = 20, connectionId, status, collection, operation } = req.query;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = { userId: req.userId };
        if (connectionId) filter.connectionId = connectionId;
        if (status) filter.status = status;
        if (collection) filter.collectionName = collection;
        if (operation) filter.operation = operation;

        console.log('Query history filter:', filter);

        // Get total count first
        const total = await QueryHistory.countDocuments(filter);
        
        // Check if user is on Snap plan and enforce 50 query limit
        const isSnapUser = req.userPlan === 'snap';
        const maxQueries = isSnapUser ? 50 : -1; // -1 means unlimited for SnapX
        
        if (isSnapUser && total > maxQueries) {
            console.log(`Snap user ${req.userId} has ${total} queries, limiting to ${maxQueries}`);
            // For Snap users, only return the most recent 50 queries
            const queryHistory = await QueryHistory.find(filter)
                .sort({ createdAt: -1 })
                .limit(maxQueries)
                .populate('connectionId', 'nickname databaseName host');
            
            return res.json({
                success: true,
                data: {
                    history: queryHistory,
                    pagination: {
                        page: 1,
                        limit: maxQueries,
                        total: maxQueries,
                        pages: 1,
                        limited: true,
                        message: `Showing most recent ${maxQueries} queries. Upgrade to SnapX for unlimited query history.`
                    }
                }
            });
        }

        // For SnapX users or Snap users with <= 50 queries, use normal pagination
        const queryHistory = await QueryHistory.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('connectionId', 'nickname databaseName host');

        console.log(`Query history results: ${queryHistory.length} items, total: ${total}`);

        res.json({
            success: true,
            data: {
                history: queryHistory,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                    limited: false
                }
            }
        });
    } catch (error) {
        console.error('Error fetching query history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch query history' });
    }
});

// Get query history statistics
router.get('/history/stats', verifyToken, async (req, res) => {
    try {
        const { connectionId, days = 30 } = req.query;
        const filter = { userId: req.userId };
        if (connectionId) filter.connectionId = connectionId;

        // Date filter for last N days
        const dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - parseInt(days));
        filter.createdAt = { $gte: dateFilter };

        const stats = await QueryHistory.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalQueries: { $sum: 1 },
                    successfulQueries: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    failedQueries: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    avgExecutionTime: { $avg: '$executionTime' },
                    totalDocumentsAffected: { $sum: { $ifNull: ['$documentsAffected', 0] } }
                }
            }
        ]);

        // Get top collections
        const topCollections = await QueryHistory.aggregate([
            { $match: filter },
            { $group: { _id: '$collectionName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Get top operations
        const topOperations = await QueryHistory.aggregate([
            { $match: filter },
            { $group: { _id: '$operation', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            data: {
                stats: stats[0] || {
                    totalQueries: 0,
                    successfulQueries: 0,
                    failedQueries: 0,
                    avgExecutionTime: 0,
                    totalDocumentsAffected: 0
                },
                topCollections,
                topOperations
            }
        });
    } catch (error) {
        console.error('Error fetching query history stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch query history statistics' });
    }
});

// Add query to history
router.post('/history', verifyToken, async (req, res) => {
    try {
        const {
            connectionId,
            query,
            naturalLanguage,
            generatedQuery,
            result,
            status,
            errorMessage,
            executionTime,
            documentsAffected,
            collection,
            operation
        } = req.body;

        const queryHistoryEntry = new QueryHistory({
            userId: req.userId,
            connectionId,
            query,
            naturalLanguage,
            generatedQuery,
            result,
            status,
            errorMessage,
            executionTime,
            documentsAffected,
            collectionName: collection,
            operation
        });

        await queryHistoryEntry.save();

        res.json({
            success: true,
            data: queryHistoryEntry
        });
    } catch (error) {
        console.error('Error adding query to history:', error);
        res.status(500).json({ success: false, message: 'Failed to add query to history' });
    }
});

// Delete query from history
router.delete('/history/:id', verifyToken, async (req, res) => {
    try {
        const queryHistory = await QueryHistory.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!queryHistory) {
            return res.status(404).json({ success: false, message: 'Query history not found' });
        }

        res.json({
            success: true,
            message: 'Query history deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting query history:', error);
        res.status(500).json({ success: false, message: 'Failed to delete query history' });
    }
});

// Clear all query history for a user
router.delete('/history', verifyToken, async (req, res) => {
    try {
        const { connectionId } = req.query;
        const filter = { userId: req.userId };
        if (connectionId) filter.connectionId = connectionId;

        await QueryHistory.deleteMany(filter);

        res.json({
            success: true,
            message: 'Query history cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing query history:', error);
        res.status(500).json({ success: false, message: 'Failed to clear query history' });
    }
});

// Get saved queries for a user (SnapX only)
router.get('/saved', verifyToken, checkUserSubscription, async (req, res) => {
    console.log('GET /api/query/saved - Request received:', {
        userId: req.userId,
        userPlan: req.userPlan,
        query: req.query,
        headers: req.headers.authorization ? 'Bearer token present' : 'No auth header'
    });
    
    // Check if user is on SnapX plan
    if (req.userPlan !== 'snapx') {
        return res.status(403).json({
            success: false,
            message: 'Saved queries feature is only available for SnapX users. Upgrade to save and organize your queries.'
        });
    }
    
    try {
        const { connectionId, collection, tags } = req.query;
        const filter = { userId: req.userId };
        if (connectionId) filter.connectionId = connectionId;
        if (collection) filter.collectionName = collection;
        if (tags) filter.tags = { $in: tags.split(',') };

        console.log('Saved queries filter:', filter);

        const savedQueries = await SavedQuery.find(filter)
            .sort({ updatedAt: -1 })
            .populate('connectionId', 'nickname databaseName host');

        console.log(`Saved queries results: ${savedQueries.length} items`);

        res.json({
            success: true,
            data: savedQueries
        });
    } catch (error) {
        console.error('Error fetching saved queries:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch saved queries' });
    }
});

// Save a query (SnapX only)
router.post('/saved', verifyToken, checkUserSubscription, async (req, res) => {
    console.log('POST /api/query/saved - Request received:', {
        userId: req.userId,
        userPlan: req.userPlan,
        body: req.body,
        headers: req.headers.authorization ? 'Bearer token present' : 'No auth header'
    });
    
    // Check if user is on SnapX plan
    if (req.userPlan !== 'snapx') {
        return res.status(403).json({
            success: false,
            message: 'Saved queries feature is only available for SnapX users. Upgrade to save and organize your queries.'
        });
    }
    
    try {
        const {
            connectionId,
            name,
            description,
            query,
            naturalLanguage,
            generatedQuery,
            result,
            tags,
            collection,
            operation
        } = req.body;

        console.log('Saving query with data:', {
            name,
            description,
            query,
            collection,
            operation,
            hasNaturalLanguage: !!naturalLanguage,
            hasGeneratedQuery: !!generatedQuery
        });

        // Check if a saved query with the same name already exists
        const existingQuery = await SavedQuery.findOne({
            userId: req.userId,
            name: name
        });

        if (existingQuery) {
            console.log('Query with same name already exists:', name);
            return res.status(400).json({
                success: false,
                message: 'A saved query with this name already exists'
            });
        }

        const savedQuery = new SavedQuery({
            userId: req.userId,
            connectionId,
            name,
            description,
            query,
            naturalLanguage,
            generatedQuery,
            result,
            tags: tags || [],
            collectionName: collection,
            operation
        });

        await savedQuery.save();
        console.log('Query saved successfully, ID:', savedQuery._id);

        res.json({
            success: true,
            data: savedQuery
        });
    } catch (error) {
        console.error('Error saving query:', error);
        res.status(500).json({ success: false, message: 'Failed to save query' });
    }
});

// Update a saved query (SnapX only)
router.put('/saved/:id', verifyToken, checkUserSubscription, async (req, res) => {
    try {
        const {
            name,
            description,
            query,
            naturalLanguage,
            generatedQuery,
            result,
            tags,
            collection,
            operation
        } = req.body;

        // Check if user is on SnapX plan
        if (req.userPlan !== 'snapx') {
            return res.status(403).json({
                success: false,
                message: 'Saved queries feature is only available for SnapX users. Upgrade to save and organize your queries.'
            });
        }

        // Check if name is being changed and if it conflicts with another saved query
        if (name) {
            const existingQuery = await SavedQuery.findOne({
                userId: req.userId,
                name: name,
                _id: { $ne: req.params.id }
            });

            if (existingQuery) {
                return res.status(400).json({
                    success: false,
                    message: 'A saved query with this name already exists'
                });
            }
        }

        const savedQuery = await SavedQuery.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            {
                name,
                description,
                query,
                naturalLanguage,
                generatedQuery,
                result,
                tags,
                collectionName: collection,
                operation,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!savedQuery) {
            return res.status(404).json({ success: false, message: 'Saved query not found' });
        }

        res.json({
            success: true,
            data: savedQuery
        });
    } catch (error) {
        console.error('Error updating saved query:', error);
        res.status(500).json({ success: false, message: 'Failed to update saved query' });
    }
});

// Delete a saved query (SnapX only)
router.delete('/saved/:id', verifyToken, checkUserSubscription, async (req, res) => {
    try {
        // Check if user is on SnapX plan
        if (req.userPlan !== 'snapx') {
            return res.status(403).json({
                success: false,
                message: 'Saved queries feature is only available for SnapX users. Upgrade to save and organize your queries.'
            });
        }

        const savedQuery = await SavedQuery.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!savedQuery) {
            return res.status(404).json({ success: false, message: 'Saved query not found' });
        }

        res.json({
            success: true,
            message: 'Saved query deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting saved query:', error);
        res.status(500).json({ success: false, message: 'Failed to delete saved query' });
    }
});

// Execute a saved query and update usage stats
router.post('/saved/:id/execute', verifyToken, async (req, res) => {
    try {
        const savedQuery = await SavedQuery.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!savedQuery) {
            return res.status(404).json({ success: false, message: 'Saved query not found' });
        }

        // Update usage stats
        savedQuery.usageCount += 1;
        savedQuery.lastUsed = new Date();
        await savedQuery.save();

        res.json({
            success: true,
            data: {
                query: savedQuery.query,
                naturalLanguage: savedQuery.naturalLanguage,
                generatedQuery: savedQuery.generatedQuery
            }
        });
    } catch (error) {
        console.error('Error executing saved query:', error);
        res.status(500).json({ success: false, message: 'Failed to execute saved query' });
    }
});

// Get saved query tags for a user
router.get('/saved/tags', verifyToken, async (req, res) => {
    try {
        const { connectionId } = req.query;
        const filter = { userId: req.userId };
        if (connectionId) filter.connectionId = connectionId;

        const tags = await SavedQuery.aggregate([
            { $match: filter },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: tags.map(tag => ({ name: tag._id, count: tag.count }))
        });
    } catch (error) {
        console.error('Error fetching saved query tags:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch saved query tags' });
    }
});

module.exports = router; 