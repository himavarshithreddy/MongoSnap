const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const User = require('../models/User');

router.get('/', (req, res) => {
    res.json({ message: 'Hello World', userId: req.userId });
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Test route to check if server is running
router.get('/health', (req, res) => {
    res.json({ 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

module.exports = router;