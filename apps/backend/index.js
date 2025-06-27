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
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));

const sslOptions = {
  key: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp.pem')),
};

https.createServer(sslOptions, app).listen(4000, '0.0.0.0', () => {
  console.log(`🔒 HTTPS server running at https://mongosnap.mp:4000`);
  console.log(`🚀 Frontend expected at https://mongosnap.mp:5173`);
});

// Start periodic connection cleanup (every 15 minutes)
setInterval(async () => {
  try {
    await databaseManager.cleanupStaleConnections();
    const stats = databaseManager.getConnectionStats();
    console.log(`📊 Connection stats: ${stats.activeConnections} active, ${stats.staleConnections} stale`);
  } catch (error) {
    console.error('❌ Error during periodic cleanup:', error);
  }
}, 15 * 60 * 1000); // 15 minutes

console.log('🧹 Connection cleanup scheduled (every 15 minutes)');
