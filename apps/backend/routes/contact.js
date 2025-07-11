const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { verifyToken } = require('./middleware');
const sanitizeHtml = require('sanitize-html');

// Helper function to anonymize IP addresses
const anonymizeIP = (ip) => {
    if (!ip) return ip;
    
    // Handle IPv4
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
        }
    }
    
    // Handle IPv6
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
            return `${parts[0]}:${parts[1]}:${parts[2]}:*`;
        }
    }
    
    return ip;
};

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
        
        // Check if user is admin
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

// Submit contact form (public endpoint)
router.post('/submit', async (req, res) => {
    try {
        const { name, email, subject, message, category } = req.body;
        
        // Basic validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }
        
        // Check for spam
        const isSpam = await Contact.checkSpam(email);
        if (isSpam) {
            return res.status(429).json({
                success: false,
                message: 'Too many messages sent recently. Please try again later.'
            });
        }
        
        // Sanitize input
        const sanitizedName = sanitizeHtml(name.trim());
        const sanitizedSubject = sanitizeHtml(subject.trim());
        const sanitizedMessage = sanitizeHtml(message.trim());
        
        // Get IP address
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const anonymizedIP = anonymizeIP(ipAddress);
        
        // Check if user is logged in
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (error) {
                // Token invalid, continue as anonymous user
            }
        }
        
        // Create contact submission
        const contact = new Contact({
            name: sanitizedName,
            email: email.toLowerCase().trim(),
            subject: sanitizedSubject,
            message: sanitizedMessage,
            category: category || 'general',
            ipAddress: anonymizedIP,
            userId: userId
        });
        
        await contact.save();
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We\'ll get back to you within 24 hours.',
            data: {
                id: contact._id,
                submittedAt: contact.createdAt
            }
        });
        
    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit message. Please try again.'
        });
    }
});

// Get contact categories (public endpoint)
router.get('/categories', async (req, res) => {
    try {
        const categories = Contact.getCategories();
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching contact categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// Admin: Get all contact submissions
router.get('/admin/contacts', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 1000,
            search = '',
            status = 'all',
            category = 'all',
            priority = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status !== 'all') {
            filter.status = status;
        }
        
        if (category !== 'all') {
            filter.category = category;
        }
        
        if (priority !== 'all') {
            filter.priority = priority;
        }
        
        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Execute queries
        const [contacts, total] = await Promise.all([
            Contact.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name email')
                .populate('respondedBy', 'name email')
                .lean(),
            Contact.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(total / parseInt(limit));
        
        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching contact submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact submissions'
        });
    }
});

// Admin: Get contact statistics
router.get('/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [
            totalContacts,
            newContacts,
            inProgressContacts,
            respondedContacts,
            closedContacts,
            categoryStats,
            priorityStats
        ] = await Promise.all([
            Contact.countDocuments(),
            Contact.countDocuments({ status: 'new' }),
            Contact.countDocuments({ status: 'in_progress' }),
            Contact.countDocuments({ status: 'responded' }),
            Contact.countDocuments({ status: 'closed' }),
            Contact.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Contact.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                total: totalContacts,
                byStatus: {
                    new: newContacts,
                    inProgress: inProgressContacts,
                    responded: respondedContacts,
                    closed: closedContacts
                },
                byCategory: categoryStats,
                byPriority: priorityStats
            }
        });
        
    } catch (error) {
        console.error('Error fetching contact statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Admin: Get single contact submission
router.get('/admin/contacts/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('respondedBy', 'name email')
            .populate('adminNotes.addedBy', 'name email');
            
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact submission not found'
            });
        }
        
        res.json({
            success: true,
            data: contact
        });
        
    } catch (error) {
        console.error('Error fetching contact submission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact submission'
        });
    }
});

// Admin: Update contact status
router.put('/admin/contacts/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { status, priority, response } = req.body;
        
        const updateData = {
            status,
            priority: priority || 'medium',
            updatedAt: new Date()
        };
        
        if (response && status === 'responded') {
            updateData.response = sanitizeHtml(response.trim());
            updateData.respondedAt = new Date();
            updateData.respondedBy = req.userId;
        }
        
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('userId', 'name email')
         .populate('respondedBy', 'name email');
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact submission not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Contact status updated successfully',
            data: contact
        });
        
    } catch (error) {
        console.error('Error updating contact status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact status'
        });
    }
});

// Admin: Add admin note
router.post('/admin/contacts/:id/notes', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { note } = req.body;
        
        if (!note || !note.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note content is required'
            });
        }
        
        const sanitizedNote = sanitizeHtml(note.trim());
        
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    adminNotes: {
                        note: sanitizedNote,
                        addedBy: req.userId
                    }
                },
                updatedAt: new Date()
            },
            { new: true }
        ).populate('userId', 'name email')
         .populate('respondedBy', 'name email')
         .populate('adminNotes.addedBy', 'name email');
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact submission not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Note added successfully',
            data: contact
        });
        
    } catch (error) {
        console.error('Error adding admin note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add note'
        });
    }
});

module.exports = router; 