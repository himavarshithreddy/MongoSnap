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
const databaseManager = require('./utils/databaseManager');
const path = require('path');
dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://mongosnap.mp:5173'],
  credentials: true,
  sameSite: 'lax'
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api', testRoutes);
app.use('/api', verifyRoutes);
app.use('/api', forgotPasswordRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/connection', connectionRoutes);
app.use('/api/query', queryHistoryRoutes);

console.log('✅ All routes registered successfully');
console.log('📋 Available routes:');
console.log('  - /api/auth/* (authentication routes)');
console.log('  - /api/connection/* (database connection routes)');
console.log('  - /api/query/* (query history and saved queries routes)');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  // Removed deprecated options: useNewUrlParser and useUnifiedTopology
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));

const sslOptions = {
  key: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp.pem')),
};

const server = https.createServer(sslOptions, app);

server.listen(4000, '0.0.0.0', () => {
  console.log(`🔒 HTTPS server running at https://mongosnap.mp:4000`);
  console.log(`🚀 Frontend expected at https://mongosnap.mp:5173`);
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

console.log('🧹 Connection cleanup scheduled (every hour)');
