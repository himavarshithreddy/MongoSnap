const express = require('express');
const router = express.Router();
const axios = require('axios');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Helper to generate tokens
function generateAccessToken(user) {
    return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1m' });
}

// Step 1: Redirect to Google OAuth
router.get('/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent'
    })}`;
    res.redirect(url);
});

// Step 1: Redirect to GitHub OAuth
router.get('/github', (req, res) => {
    // Generate a secure state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session or temporary storage (for now, we'll validate it in callback)
    // In production, you might want to use Redis or a session store
    const url = `https://github.com/login/oauth/authorize?${qs.stringify({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: 'user:email',
        state: state
    })}`;
    
    // Set state as a cookie for validation in callback
    res.cookie('github_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
    });
    
    res.redirect(url);
});

// Step 2: Handle Google callback and login
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
            redirect_uri: GOOGLE_REDIRECT_URI,
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

        console.log('Redirecting to frontend...');

        // Redirect to frontend popup with token
        return res.redirect(`http://192.168.1.10:5173/oauth-popup?token=${token}`);

    } catch (err) {
        console.error('OAuth error details:', err.response?.data || err.message);
        console.error('OAuth error stack:', err.stack);
        return res.status(500).send('OAuth failed: ' + (err.response?.data?.error_description || err.message));
    }
});

// Step 2: Handle GitHub callback and login
router.get('/github/callback', async (req, res) => {
    const { code, error, state } = req.query;

    // Check for OAuth errors
    if (error) {
        console.error('OAuth error from GitHub:', error);
        return res.status(400).send(`OAuth error: ${error}`);
    }

    if (!code) {
        console.error('No authorization code received');
        return res.status(400).send('No authorization code received');
    }

    // Validate state parameter for CSRF protection
    const storedState = req.cookies.github_oauth_state;
    if (!state || !storedState || state !== storedState) {
        console.error('Invalid or missing state parameter');
        return res.status(400).send('Invalid state parameter');
    }

    // Clear the state cookie after validation
    res.clearCookie('github_oauth_state');

    try {
        console.log('Exchanging code for GitHub tokens...');
        
        // Exchange code for access token using form data (not JSON)
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            qs.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_REDIRECT_URI
            }),
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token } = tokenResponse.data;
        
        if (!access_token) {
            console.error('No access token received from GitHub');
            return res.status(500).send('Failed to get access token from GitHub');
        }

        console.log('Getting user info from GitHub...');

        // Get user info
        const githubUserResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Get user emails
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const { login: username, name, id: githubId } = githubUserResponse.data;
        const primaryEmail = emailsResponse.data.find(email => email.primary)?.email;

        if (!primaryEmail) {
            console.error('No primary email found for GitHub user');
            return res.status(500).send('Failed to get user email from GitHub');
        }

        console.log('Checking if user exists in database...');

        // Check if user exists
        let user = await User.findOne({ email: primaryEmail });
        if (!user) {
            console.log('Creating new GitHub user...');
            user = await User.create({ 
                name: name || username, 
                email: primaryEmail, 
                isVerified: true, 
                oauthProvider: 'github', 
                oauthId: githubId.toString() 
            });
        } else {
            console.log('User found, updating OAuth info...');
            // Update OAuth info if user exists but doesn't have it
            if (!user.oauthProvider || !user.oauthId) {
                user.oauthProvider = 'github';
                user.oauthId = githubId.toString();
                await user.save();
            }
        }

        console.log('Generating JWT token...');

        // Generate JWT
        const token = generateAccessToken(user);

        console.log('Redirecting to frontend...');

        // Redirect to frontend popup with token
        return res.redirect(`http://192.168.1.10:5173/oauth-popup?token=${token}`);

    } catch (err) {
        console.error('GitHub OAuth error details:', err.response?.data || err.message);
        console.error('GitHub OAuth error stack:', err.stack);
        return res.status(500).send('GitHub OAuth failed: ' + (err.response?.data?.error_description || err.message));
    }
});

module.exports = router;
