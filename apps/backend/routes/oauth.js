const express = require('express');
const router = express.Router();
const axios = require('axios');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// Helper to generate tokens
function generateAccessToken(user) {
    return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1m' });
}

function generateRefreshToken(user) {
    return jwt.sign({ id: user._id }, REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
}

// Step 1: Redirect to Google OAuth
router.get('/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent'
    })}`;
    res.redirect(url);
});

// Step 2: Handle callback and login
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    // Check for OAuth errors
    if (error) {
        console.error('OAuth error from Google:', error);
        return res.status(400).send(`OAuth error: ${error}`);
    }

    if (!code) {
        console.error('No authorization code received');
        return res.status(400).send('No authorization code received');
    }

    try {
        console.log('Exchanging code for tokens...');
        
        // Exchange code for tokens
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        });

        const { access_token, id_token } = tokenResponse.data;
        
        if (!access_token) {
            console.error('No access token received from Google');
            return res.status(500).send('Failed to get access token from Google');
        }

        console.log('Getting user info from Google...');

        // Get user info
        const googleUserResponse = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        const { email, name, id: googleId } = googleUserResponse.data;

        if (!email) {
            console.error('No email received from Google user info');
            return res.status(500).send('Failed to get user email from Google');
        }

        console.log('Checking if user exists in database...');

        // Check if user exists
        let user = await User.findOne({ email });
        if (!user) {
            console.log('Creating new user...');
            user = await User.create({ 
                name, 
                email, 
                isVerified: true, 
                oauthProvider: 'google', 
                oauthId: googleId 
            });
        } else {
            console.log('User found, updating OAuth info...');
            // Update OAuth info if user exists but doesn't have it
            if (!user.oauthProvider || !user.oauthId) {
                user.oauthProvider = 'google';
                user.oauthId = googleId;
                await user.save();
            }
        }

        console.log('Generating JWT token...');

        // Generate JWT
        const token = generateAccessToken(user);

        // Generate refresh token and set as cookie
        const refreshToken = generateRefreshToken(user);
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        });

        console.log('Redirecting to frontend...');

        // Redirect to frontend popup with token
        return res.redirect(`http://192.168.1.10:5173/oauth-popup?token=${token}`);

    } catch (err) {
        console.error('OAuth error details:', err.response?.data || err.message);
        console.error('OAuth error stack:', err.stack);
        return res.status(500).send('OAuth failed: ' + (err.response?.data?.error_description || err.message));
    }
});

module.exports = router;
