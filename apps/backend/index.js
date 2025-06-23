const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const forgotPasswordRoutes = require('./routes/forgotpassword');
const verifyRoutes = require('./routes/verify');

dotenv.config();

const app = express();
app.use(cors({
  origin: 'http://192.168.1.10:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/', testRoutes);
app.use('/', verifyRoutes);
app.use('/', forgotPasswordRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));


app.listen(4000,'0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:4000`);
});
