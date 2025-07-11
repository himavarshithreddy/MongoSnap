const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const BugReport = require('../models/BugReport');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { verifyToken, verifyTokenAndValidateCSRF } = require('./middleware');

// Rate limiter for bug reports - prevent spam
const bugReportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 bug reports per hour per IP
    message: { message: 'Too many bug reports submitted. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Bug report rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ 
            success: false,
            message: 'Too many bug reports submitted. Please try again later.' 
        });
    }
});

// General rate limiter for bug report operations
const generalBugReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`General bug report rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ 
            success: false,
            message: 'Too many requests, please try again later' 
        });
    }
});

// Helper function to extract browser information from user agent
const extractBrowserInfo = (userAgent) => {
    if (!userAgent) {
        return {
            userAgent: 'Unknown',
            browserName: 'Unknown',
            browserVersion: 'Unknown',
            osName: 'Unknown',
            osVersion: 'Unknown'
        };
    }

    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let osName = 'Unknown';
    let osVersion = 'Unknown';

    // Browser detection
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browserName = 'Chrome';
        const match = userAgent.match(/Chrome\/([0-9.]+)/);
        if (match) browserVersion = match[1];
    } else if (userAgent.includes('Firefox')) {
        browserName = 'Firefox';
        const match = userAgent.match(/Firefox\/([0-9.]+)/);
        if (match) browserVersion = match[1];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browserName = 'Safari';
        const match = userAgent.match(/Safari\/([0-9.]+)/);
        if (match) browserVersion = match[1];
    } else if (userAgent.includes('Edg')) {
        browserName = 'Edge';
        const match = userAgent.match(/Edg\/([0-9.]+)/);
        if (match) browserVersion = match[1];
    }

    // OS detection
    if (userAgent.includes('Windows NT')) {
        osName = 'Windows';
        const match = userAgent.match(/Windows NT ([0-9.]+)/);
        if (match) {
            const version = match[1];
            if (version === '10.0') osVersion = '10/11';
            else if (version === '6.3') osVersion = '8.1';
            else if (version === '6.2') osVersion = '8';
            else if (version === '6.1') osVersion = '7';
            else osVersion = version;
        }
    } else if (userAgent.includes('Mac OS X')) {
        osName = 'macOS';
        const match = userAgent.match(/Mac OS X ([0-9_]+)/);
        if (match) osVersion = match[1].replace(/_/g, '.');
    } else if (userAgent.includes('Linux')) {
        osName = 'Linux';
    } else if (userAgent.includes('Android')) {
        osName = 'Android';
        const match = userAgent.match(/Android ([0-9.]+)/);
        if (match) osVersion = match[1];
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        osName = 'iOS';
        const match = userAgent.match(/OS ([0-9_]+)/);
        if (match) osVersion = match[1].replace(/_/g, '.');
    }

    return {
        userAgent,
        browserName,
        browserVersion,
        osName,
        osVersion
    };
};

// Helper function to anonymize IP addresses for privacy compliance
const anonymizeIP = (ipAddress) => {
    if (!ipAddress || ipAddress === 'Unknown') {
        return 'Unknown';
    }
    
    // Handle IPv4 addresses
    if (ipAddress.includes('.')) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
        }
    }
    
    // Handle IPv6 addresses (mask last 64 bits)
    if (ipAddress.includes(':')) {
        const parts = ipAddress.split(':');
        if (parts.length >= 4) {
            // Keep first 4 segments, mask the rest
            return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::xxx`;
        }
    }
    
    // Fallback for unknown formats
    return 'Unknown';
};

// GET /categories - Get predefined bug report categories
router.get('/categories', generalBugReportLimiter, (req, res) => {
    try {
        const categories = BugReport.getCategories();
        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching bug report categories:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching categories'
        });
    }
});

// POST /submit - Submit a new bug report
router.post('/submit', bugReportLimiter, verifyTokenAndValidateCSRF, async (req, res) => {
    const userId = req.userId;
    
    try {
        const {
            category,
            customCategory,
            title,
            description,
            page,
            problematicQuery,
            connectionId,
            collectionName,
            screenResolution
        } = req.body;

        // Basic validation
        if (!category || !title || !description || !page) {
            return res.status(400).json({
                success: false,
                message: 'Category, title, description, and page are required'
            });
        }

        // Validate category
        const validCategories = BugReport.getCategories().map(cat => cat.value);
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category provided'
            });
        }

        // If category is 'other', customCategory is required
        if (category === 'other' && (!customCategory || customCategory.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Custom category is required when selecting "Other"'
            });
        }

        // Validate title and description length
        if (title.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Title must be 200 characters or less'
            });
        }

        if (description.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Description must be 2000 characters or less'
            });
        }

        const user = await User.findById(userId).select('name email');        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Extract browser information
        const browserInfo = extractBrowserInfo(req.get('User-Agent'));
        if (screenResolution) {
            browserInfo.screenResolution = screenResolution;
        }

        // Prepare connection context if connectionId is provided
        let connectionContext = {};
        if (connectionId) {
            try {
                const connection = await Connection.findOne({
                    _id: connectionId,
                    userId: userId
                });
                
                if (connection) {
                    connectionContext = {
                        connectionId: connection._id,
                        databaseName: connection.databaseName,
                        collectionName: collectionName || null,
                        isTemporary: connection.isTemporary || false,
                        isSample: connection.isSample || false
                    };
                }
            } catch (connError) {
                console.log('Could not fetch connection context:', connError.message);
                // Continue without connection context
            }
        }

        // Sanitize user input fields to prevent XSS attacks
        const sanitizeOptions = {
            allowedTags: [], // No HTML tags allowed
            allowedAttributes: {}, // No attributes allowed
            allowedIframeHostnames: [] // No iframes allowed
        };

        // Create the bug report
        const bugReport = new BugReport({
            userId: userId,
            userEmail: user.email,
            userName: user.name,
            category: category,
            customCategory: category === 'other' ? sanitizeHtml(customCategory.trim(), sanitizeOptions) : undefined,
            title: sanitizeHtml(title.trim(), sanitizeOptions),
            description: sanitizeHtml(description.trim(), sanitizeOptions),
            page: sanitizeHtml(page, sanitizeOptions),
            problematicQuery: problematicQuery ? sanitizeHtml(problematicQuery.trim(), sanitizeOptions) : undefined,
            browserInfo: browserInfo,
            connectionContext: Object.keys(connectionContext).length > 0 ? connectionContext : undefined,
            ipAddress: anonymizeIP(req.ip || req.connection.remoteAddress || 'Unknown')
        });

        // Auto-assign priority based on category
        bugReport.autoAssignPriority();

        // Save the bug report
        await bugReport.save();

        console.log(`Bug report submitted by user ${user.email} (${userId}): ${category} - ${title}`);

        res.status(201).json({
            success: true,
            message: 'Bug report submitted successfully. Thank you for helping us improve MongoSnap!',
            data: {
                reportId: bugReport._id,
                category: bugReport.category,
                priority: bugReport.priority,
                createdAt: bugReport.createdAt
            }
        });

    } catch (error) {
        console.error('Error submitting bug report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting bug report. Please try again later.'
        });
    }
});

// GET /my-reports - Get current user's bug reports
router.get('/my-reports', generalBugReportLimiter, verifyToken, async (req, res) => {
    const userId = req.userId;
    
    try {
        const { page = 1, limit = 10, status, category } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query
        const query = { userId: userId };
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        // Get reports with pagination
        const reports = await BugReport.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-ipAddress -adminNotes') // Don't expose sensitive admin data
            .lean();

        // Get total count for pagination
        const totalReports = await BugReport.countDocuments(query);

        // Format reports for frontend
        const formattedReports = reports.map(report => ({
            id: report._id,
            category: report.category,
            customCategory: report.customCategory,
            title: report.title,
            description: report.description,
            status: report.status,
            priority: report.priority,
            page: report.page,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            resolution: report.resolution,
            resolvedAt: report.resolvedAt,
            // Add category description
            categoryDescription: BugReport.getCategories().find(cat => cat.value === report.category)?.description || 'No description'
        }));

        res.status(200).json({
            success: true,
            data: {
                reports: formattedReports,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalReports / parseInt(limit)),
                    totalReports: totalReports,
                    hasNextPage: skip + formattedReports.length < totalReports,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Error fetching user bug reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bug reports'
        });
    }
});

// GET /stats - Get bug report statistics for current user
router.get('/stats', generalBugReportLimiter, verifyToken, async (req, res) => {
    const userId = req.userId;
    
    try {
        // Get user's bug report statistics
        const stats = await BugReport.aggregate([
            { $match: { userId: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    totalReports: { $sum: 1 },
                    openReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
                    },
                    resolvedReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    },
                    highPriorityReports: {
                        $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get category breakdown
        const categoryStats = await BugReport.aggregate([
            { $match: { userId: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const userStats = stats[0] || {
            totalReports: 0,
            openReports: 0,
            resolvedReports: 0,
            highPriorityReports: 0
        };

        res.status(200).json({
            success: true,
            data: {
                summary: userStats,
                categoryBreakdown: categoryStats
            }
        });

    } catch (error) {
        console.error('Error fetching bug report stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching statistics'
        });
    }
});

// Admin middleware to check if user is admin
const verifyAdmin = async (req, res, next) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if user is admin (you can adjust this logic based on your admin system)
        // For now, I'll check if the user's email is in an admin list or has an admin flag
        const adminEmails = process.env.ADMIN_EMAILS 
            ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase()) 
            : [];
        const isAdmin = user.isAdmin || adminEmails.includes(user.email.toLowerCase());        
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during admin verification'
        });
    }
};

// ADMIN ROUTES

// GET /admin/reports - Get all bug reports (admin only)
router.get('/admin/reports', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            category, 
            priority, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            search
        } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query
        const query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
        }
        if (priority && priority !== 'all') {
            query.priority = priority;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get reports with pagination and populate user info
        const reports = await BugReport.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email createdAt')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .lean();

        // Get total count for pagination
        const totalReports = await BugReport.countDocuments(query);

        // Format reports for admin view
        const formattedReports = reports.map(report => ({
            id: report._id,
            category: report.category,
            customCategory: report.customCategory,
            title: report.title,
            description: report.description,
            status: report.status,
            priority: report.priority,
            page: report.page,
            problematicQuery: report.problematicQuery,
            userInfo: {
                id: report.userId,
                name: report.userName,
                email: report.userEmail,
                accountCreated: report.userId?.createdAt
            },
            browserInfo: report.browserInfo,
            connectionContext: report.connectionContext,
            adminNotes: report.adminNotes,
            assignedTo: report.assignedTo,
            resolution: report.resolution,
            resolvedAt: report.resolvedAt,
            resolvedBy: report.resolvedBy,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            ipAddress: report.ipAddress,
            duplicateOf: report.duplicateOf,
            categoryDescription: BugReport.getCategories().find(cat => cat.value === report.category)?.description || 'No description'
        }));

        res.status(200).json({
            success: true,
            data: {
                reports: formattedReports,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalReports / parseInt(limit)),
                    totalReports: totalReports,
                    hasNextPage: skip + formattedReports.length < totalReports,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Error fetching admin bug reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bug reports'
        });
    }
});

// GET /admin/reports/:id - Get specific bug report details (admin only)
router.get('/admin/reports/:id', verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const report = await BugReport.findById(id)
            .populate('userId', 'name email createdAt loginNotificationsEnabled twoFactorEnabled')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('duplicateOf', 'title category status')
            .lean();

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Bug report not found'
            });
        }

        // Get related reports (same user, similar category)
        const relatedReports = await BugReport.find({
            _id: { $ne: report._id },
            $or: [
                { userId: report.userId },
                { category: report.category }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title category status priority createdAt')
        .lean();

        const formattedReport = {
            ...report,
            categoryDescription: BugReport.getCategories().find(cat => cat.value === report.category)?.description || 'No description',
            relatedReports: relatedReports
        };

        res.status(200).json({
            success: true,
            data: formattedReport
        });

    } catch (error) {
        console.error('Error fetching bug report details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bug report details'
        });
    }
});

// PUT /admin/reports/:id/status - Update bug report status (admin only)
router.put('/admin/reports/:id/status', generalBugReportLimiter, verifyTokenAndValidateCSRF, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, resolution, assignedTo } = req.body;
    const adminId = req.userId;

    try {
        const validStatuses = ['open', 'in_progress', 'resolved', 'closed', 'duplicate'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status provided'
            });
        }

        const report = await BugReport.findById(id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Bug report not found'
            });
        }

        // Sanitize resolution to prevent XSS attacks
        const sanitizeOptions = {
            allowedTags: [], // No HTML tags allowed
            allowedAttributes: {}, // No attributes allowed
            allowedIframeHostnames: [] // No iframes allowed
        };

        // Update fields
        report.status = status;
        if (resolution) {
            report.resolution = sanitizeHtml(resolution, sanitizeOptions);
        }
        if (assignedTo) {
            report.assignedTo = assignedTo;
        }
        if (status === 'resolved' || status === 'closed') {
            report.resolvedAt = new Date();
            report.resolvedBy = adminId;
        }

        await report.save();

        res.status(200).json({
            success: true,
            message: 'Bug report status updated successfully',
            data: {
                id: report._id,
                status: report.status,
                resolution: report.resolution,
                resolvedAt: report.resolvedAt,
                updatedAt: report.updatedAt
            }
        });

    } catch (error) {
        console.error('Error updating bug report status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating bug report status'
        });
    }
});

// POST /admin/reports/:id/notes - Add admin note to bug report (admin only)
router.post('/admin/reports/:id/notes', generalBugReportLimiter, verifyTokenAndValidateCSRF, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.userId;

    try {
        if (!note || note.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Note content is required'
            });
        }

        const report = await BugReport.findById(id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Bug report not found'
            });
        }

        // Sanitize admin note to prevent XSS attacks
        const sanitizeOptions = {
            allowedTags: [], // No HTML tags allowed
            allowedAttributes: {}, // No attributes allowed
            allowedIframeHostnames: [] // No iframes allowed
        };

        // Add admin note
        report.adminNotes.push({
            note: sanitizeHtml(note.trim(), sanitizeOptions),
            addedBy: adminId,
            addedAt: new Date()
        });

        await report.save();

        res.status(200).json({
            success: true,
            message: 'Admin note added successfully',
            data: {
                noteId: report.adminNotes[report.adminNotes.length - 1]._id,
                addedAt: report.adminNotes[report.adminNotes.length - 1].addedAt
            }
        });

    } catch (error) {
        console.error('Error adding admin note:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while adding admin note'
        });
    }
});

// GET /admin/stats - Get bug report statistics (admin only)
router.get('/admin/stats', generalBugReportLimiter, verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        
        // Calculate date range
        let startDate = new Date();
        switch (timeframe) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        // Get overall statistics
        const totalReports = await BugReport.countDocuments();
        const recentReports = await BugReport.countDocuments({
            createdAt: { $gte: startDate }
        });

        // Status breakdown
        const statusStats = await BugReport.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Priority breakdown
        const priorityStats = await BugReport.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Category breakdown
        const categoryStats = await BugReport.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Page breakdown
        const pageStats = await BugReport.aggregate([
            {
                $group: {
                    _id: '$page',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Recent reports by day
        const dailyStats = await BugReport.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalReports,
                    recentReports,
                    timeframe
                },
                breakdowns: {
                    status: statusStats,
                    priority: priorityStats,
                    category: categoryStats,
                    page: pageStats
                },
                timeline: dailyStats
            }
        });

    } catch (error) {
        console.error('Error fetching bug report statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching statistics'
        });
    }
});

module.exports = router; 