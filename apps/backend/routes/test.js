const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware');
const User = require('../models/User');

router.get('/', verifyToken, (req, res) => {
    res.json({ message: 'Hello World', userId: req.userId });
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;