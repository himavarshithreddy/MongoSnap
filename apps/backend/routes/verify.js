// routes/verify.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Failed - MongoPilot</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #101813;
                  color: white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
              }
              .container {
                  text-align: center;
                  padding: 2rem;
                  max-width: 400px;
              }
              .logo {
                  color: #3CBC6B;
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-bottom: 2rem;
              }
              h1 { color: #ff4444; margin-bottom: 1rem; }
              p { color: #cccccc; margin-bottom: 2rem; line-height: 1.5; }
              .btn {
                  background: #3CBC6B;
                  color: white;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 8px;
                  text-decoration: none;
                  font-weight: 600;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="logo">MongoPilot</div>
              <h1>Verification Failed</h1>
              <p>The verification link is invalid or has expired.</p>
              <a href="http://192.168.1.10:5173/login" class="btn">Go to Login</a>
          </div>
      </body>
      </html>
    `);
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified - MongoPilot</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #101813;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
            }
            .container {
                text-align: center;
                padding: 2rem;
                max-width: 400px;
            }
            .logo {
              
                color: white;
                font-size: 1.5rem;
                font-weight: bold;
                margin-bottom: 2rem;
            }
                .pilot{
                    color: #3CBC6B;
                }
            .success {
                color: #3CBC6B;
                font-size: 3rem;
                margin-bottom: 1rem;
            }
            h1 { 
                color: #3CBC6B; 
                margin-bottom: 1rem; 
                font-size: 2rem;
            }
            p { 
                color: #cccccc; 
                margin-bottom: 2rem; 
                line-height: 1.5;
            }
            .btn {
                background: #3CBC6B;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">Mongo<span class="pilot">Pilot</span></div>
            <div class="success">✓</div>
            <h1>Email Verified!</h1>
            <p>Your email has been successfully verified. You can now log in to your account.</p>
            <a href="http://192.168.1.10:5173/login" class="btn">Continue to Login</a>
        </div>
    </body>
    </html>
  `);
});

module.exports = router;
