// utils/mailer.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_EMAIL,
    pass: process.env.BREVO_API_KEY
  }
});

// Simple base template
const createBaseTemplate = (content, title) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            body {
                font-family: 'Inter', Arial, sans-serif;
                line-height: 1.6;
                color: #ffffff;
                background-color: #101813;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #3CBC6B;
                padding-bottom: 20px;
            }
            .title {
                color: #3CBC6B;
                font-size: 24px;
                margin: 0;
                font-weight: 700;
            }
            .button {
                display: inline-block;
                background-color: #3CBC6B;
                color: white;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                margin: 20px 0;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .button:hover {
                background-color: #0da850;
                transform: scale(1.02);
            }
            .code {
                background-color: #17211b;
                border: 2px solid #3CBC6B;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                color: #3CBC6B;
                margin: 20px 0;
                letter-spacing: 2px;
            }
            .footer {
                text-align: center;
                color: #9ca3af;
                font-size: 12px;
                margin-top: 30px;
                border-top: 1px solid #374151;
                padding-top: 20px;
            }
            .warning {
                background-color: #1f2937;
                border: 1px solid #374151;
                border-radius: 8px;
                padding: 12px;
                margin: 20px 0;
                color: #fbbf24;
            }
            .info-box {
                background-color: #17211b;
                border: 1px solid #374151;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #d1d5db;
            }
            .info-box p {
                margin: 8px 0;
            }
            .info-box strong {
                color: #3CBC6B;
            }
            h2 {
                color: #ffffff;
                font-weight: 600;
                margin-bottom: 15px;
            }
            p {
                color: #d1d5db;
                margin-bottom: 15px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="title">MongoSnap</h1>
        </div>
        
        ${content}
        
        <div class="footer">
            <p>© 2025 MongoSnap. All rights reserved.</p>
            <p>Need help? Contact support@mongosnap.live</p>
        </div>
    </body>
    </html>
  `;
};

// Email verification template
const createVerificationTemplate = (token) => {
  const verificationLink = `https://mongosnap.mp:5173/api/verify-email/${token}`;
  const content = `
    <h2>Welcome to MongoSnap!</h2>
    <p>Please verify your email address to complete your registration.</p>
    
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button">Verify Email</a>
    </div>
    
    <div class="warning">
      This link expires in 24 hours.
    </div>
  `;
  
  return createBaseTemplate(content, 'Verify Your Account');
};

// Password reset template
const createPasswordResetTemplate = (link) => {
  const content = `
    <h2>Reset Your Password</h2>
    <p>Click the button below to create a new password.</p>
    
    <div style="text-align: center;">
      <a href="${link}" class="button">Reset Password</a>
    </div>
    
    <div class="warning">
      This link expires in 1 hour. If you didn't request this, please ignore this email.
    </div>
  `;
  
  return createBaseTemplate(content, 'Reset Password');
};

// 2FA OTP template
const createTwoFactorOTPTemplate = (token) => {
  const content = `
    <h2>Two-Factor Authentication</h2>
    <p>Enter this code to complete your login:</p>
    
    <div class="code">${token.toUpperCase()}</div>
    
    <div class="warning">
      This code expires in 10 minutes. Never share this code with anyone.
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Code');
};

// 2FA enabled template
const createTwoFactorEnabledTemplate = () => {
  const content = `
    <h2>Two-Factor Authentication Enabled</h2>
    <p>Your account is now protected with an additional layer of security.</p>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.mp:5173" class="button">Go to MongoSnap</a>
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Enabled');
};

// 2FA disabled template
const createTwoFactorDisabledTemplate = () => {
  const content = `
    <h2 style="color: #ef4444;">Two-Factor Authentication Disabled</h2>
    <p>Your account security has been reduced. We recommend re-enabling 2FA.</p>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.mp:5173/settings" class="button">Re-enable 2FA</a>
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Disabled');
};

// Login notification template
const createLoginNotificationTemplate = (loginDetails) => {
  const { timestamp, ipAddress, userAgent, location, email, loginMethod } = loginDetails;
  const formattedTime = new Date(timestamp).toLocaleString();

  const content = `
    <h2>New Login to Your Account</h2>
    <p>We noticed a new login to your MongoSnap account. Here are the details:</p>
    
    <div class="info-box">
      <p><strong>Email:</strong> ${email || 'Not provided'}</p>
      <p><strong>Login Method:</strong> ${loginMethod || 'Email/Password'}</p>
      <p><strong>Time:</strong> ${formattedTime}</p>
      ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
      ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
      ${userAgent ? `<p><strong>Device:</strong> ${userAgent}</p>` : ''}
    </div>
    
    <p>If this was you, no action is required.</p>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.mp:5173/settings" class="button">Review Security Settings</a>
    </div>
    
    <div class="warning">
      If this wasn't you, please secure your account immediately by changing your password and enabling two-factor authentication.
    </div>
  `;
  
  return createBaseTemplate(content, 'New Login Alert');
};

// Email sending functions
const sendVerificationEmail = async (email, token) => {
  const html = createVerificationTemplate(token);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Verify your MongoSnap account",
    html: html
  });
};

const sendResetPasswordEmail = async (email, link) => {
  const html = createPasswordResetTemplate(link);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Reset your MongoSnap password",
    html: html
  });
};

const sendTwoFactorEmailOTP = async (email, token) => {
  const html = createTwoFactorOTPTemplate(token);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "MongoSnap - 2FA Code",
    html: html
  });
};

const sendTwoFactorConfirmationEmail = async (email) => {
  const html = createTwoFactorEnabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "2FA Enabled - MongoSnap",
    html: html
  });
};

const sendTwoFactorDisableConfirmationEmail = async (email) => {
  const html = createTwoFactorDisabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "2FA Disabled - MongoSnap",
    html: html
  });
};

const sendLoginNotificationEmail = async (email, loginDetails) => {
  const html = createLoginNotificationTemplate(loginDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "New Login to Your MongoSnap Account",
    html: html
  });
};

module.exports = { 
  sendVerificationEmail, 
  sendResetPasswordEmail, 
  sendTwoFactorConfirmationEmail, 
  sendTwoFactorDisableConfirmationEmail, 
  sendTwoFactorEmailOTP,
  sendLoginNotificationEmail
};
