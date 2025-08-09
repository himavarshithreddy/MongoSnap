const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const https = require('https');
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const forgotPasswordRoutes = require('./routes/forgotpassword');
const verifyRoutes = require('./routes/verify');
const oauthRoutes = require('./routes/oauth');
const connectionRoutes = require('./routes/connection');
const queryHistoryRoutes = require('./routes/queryHistory');
const bugReportRoutes = require('./routes/bugReport');
const contactRoutes = require('./routes/contact');
const paymentRoutes = require('./routes/payment');
const databaseManager = require('./utils/databaseManager');
const twoFactorRoutes = require('./routes/twofactor');
const path = require('path');
const rateLimit = require('express-rate-limit');
dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:5173','https://mongosnap.live'],
  credentials: true,
  sameSite: 'lax'
}));
// JSON parser; keep raw body for Cashfree webhook route only
app.use((req, res, next) => {
  if (req.path === '/api/payment/cf/webhook') return next();
  express.json()(req, res, () => express.urlencoded({ extended: true })(req, res, next));
});
app.use(cookieParser());

// Global rate limiter - applies to all requests
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes per IP
    message: { message: 'Too many requests from this IP, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Global rate limit exceeded for IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
        res.status(429).json({ 
            message: 'Too many requests from this IP, please try again later',
            retryAfter: Math.round(15 * 60) // 15 minutes in seconds
        });
    },
    // Skip rate limiting for certain routes
    skip: (req) => {
        // Skip rate limiting for health checks and static files
        return req.path === '/health' || req.path.startsWith('/static/');
    }
});

// Strict rate limiter for unauthenticated endpoints
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes for public endpoints
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Public endpoint rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
        res.status(429).json({ message: 'Too many requests, please try again later' });
    }
});

// Apply global rate limiter to all requests
app.use(globalLimiter);

// Health check endpoint (bypassed by rate limiter)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Apply public rate limiter to public/auth routes (more restrictive)
app.use('/api/auth', publicLimiter, authRoutes);
app.use('/api', publicLimiter, forgotPasswordRoutes);
app.use('/api/verify-email', publicLimiter, verifyRoutes);
app.use('/api/auth', publicLimiter, oauthRoutes); // OAuth routes are also public

// Protected routes with standard rate limiting (already have specific limiters)
app.use('/api', authRoutes); // Mount auth routes at /api for protected endpoints like /api/me
app.use('/api/connection', connectionRoutes);
app.use('/api/query', queryHistoryRoutes);
app.use('/api/bug-report', bugReportRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/twofactor', twoFactorRoutes);
app.use('/api/test', testRoutes);
console.log('✅ All routes registered successfully');


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  // Removed deprecated options: useNewUrlParser and useUnifiedTopology
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));



app.listen(4000, '0.0.0.0', () => {
  console.log(`🔒 HTTP server running at http://localhost:4000`);
  console.log(`🚀 Frontend expected at http://localhost:5173`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ Port 4000 is already in use. Please stop any other services using this port.');
    console.error('💡 You can kill the process using: netstat -ano | findstr :4000');
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Start periodic connection cleanup (every hour)
setInterval(async () => {
  try {
    await databaseManager.cleanupStaleConnections();
    const stats = databaseManager.getConnectionStats();
    console.log(`📊 Connection stats: ${stats.activeConnections} active, ${stats.staleConnections} stale`);
  } catch (error) {
    console.error('❌ Error during periodic cleanup:', error);
  }
}, 60 * 60 * 1000); // 1 hour instead of 15 minutes

// Start periodic temporary database cleanup (every 6 hours)
setInterval(async () => {
  try {
    await connectionRoutes.cleanupExpiredTempDatabases();
  } catch (error) {
    console.error('❌ Error during temporary database cleanup:', error);
  }
}, 6 * 60 * 60 * 1000); // 6 hours

console.log('🧹 Connection cleanup scheduled (every hour)');
console.log('🗑️ Temporary database cleanup scheduled (every 6 hours)');
