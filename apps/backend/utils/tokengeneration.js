const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET ;


function generateAccessToken(user) {
    return jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  }
  function generateRefreshToken(user) {
    return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: '1d',
    });
  }
  
  function sendRefreshToken(res, token) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',  // strict is best for refresh
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });
  
}
module.exports = {generateAccessToken,generateRefreshToken,sendRefreshToken};