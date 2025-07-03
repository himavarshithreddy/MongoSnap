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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #101813;
                color: #ffffff;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
            }
            
            .container {
                max-width: 500px;
                margin: 0 auto;
                background-color: #17211b;
                border-radius: 12px;
                padding: 30px;
                border: 1px solid #2d4c38;
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .logo {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
            }
            
            .logo svg {
                width: 100%;
                height: 100%;
            }
            
            .title {
                font-size: 24px;
                font-weight: 600;
                color: #3CBC6B;
                margin-bottom: 8px;
            }
            
            .subtitle {
                color: #a0a0a0;
                font-size: 14px;
            }
            
            .content {
                margin-bottom: 30px;
            }
            
            .message {
                color: #e0e0e0;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .button {
                display: inline-block;
                background-color: #3CBC6B !important;
                color: #ffffff !important;
                text-decoration: none !important;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                text-align: center;
                border: none !important;
                outline: none !important;
            }
            
            .button:hover {
                background-color: #2da55a !important;
                color: #ffffff !important;
            }
            
            .button:visited {
                color: #ffffff !important;
            }
            
            .button:active {
                color: #ffffff !important;
            }
            
            .otp-code {
                background-color: #1a2f24;
                border: 2px solid #3CBC6B;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
                font-size: 28px;
                font-weight: 700;
                color: #3CBC6B;
                font-family: monospace;
                letter-spacing: 4px;
            }
            
            .footer {
                text-align: center;
                color: #808080;
                font-size: 12px;
                border-top: 1px solid #2d4c38;
                padding-top: 20px;
            }
            
            .warning {
                background-color: #2d1a1a;
                border: 1px solid #4a2a2a;
                border-radius: 6px;
                padding: 12px;
                margin: 20px 0;
                color: #ffb3b3;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <svg viewBox="280 100 450 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M499.346 101H512.05L530.2 119.917L544.719 137.113L561.053 156.03L584.647 183.545L610.056 216.219L628.205 240.295L649.985 271.249L666.319 297.044L686.283 336.597L702.617 377.87L713.507 413.983L720.766 453.536L722.581 472.453V506.846L718.952 542.96L709.877 580.793L697.173 615.187L675.393 658.179L660.874 678.815L642.725 701.171L599.167 745.883L586.462 757.921L573.758 771.678L548.349 795.754L533.829 814.67L528.385 833.587L526.57 849.064L524.755 883.458L519.31 892.056L510.235 898.935H497.531L488.456 893.776L483.012 886.897L481.197 881.738L479.382 837.026L472.122 816.39L459.418 797.474L439.453 775.118L414.045 749.322L392.266 728.686L379.561 714.929L359.597 692.573L337.818 663.338L316.039 625.505L301.519 587.672L292.445 551.558L288.815 527.483L287 505.127V463.854L290.63 432.9L299.704 393.347L316.039 346.915L330.558 315.961L345.078 290.166L370.486 252.333L394.08 221.378L412.23 199.022L432.194 174.947L452.158 152.591L472.122 128.515L488.456 111.318L495.716 102.72L499.346 101Z" fill="#148D22"/>
                        <path d="M499.346 101H506.606V291.885L441.268 432.9L401.34 520.604L399.525 525.763H497.531L499.346 611.747V696.012H506.606L508.421 778.557L522.94 802.633L530.2 818.11L526.57 849.064L524.755 883.458L519.31 892.056L510.235 898.935H497.531L488.456 893.776L483.012 886.897L481.197 881.738L479.382 837.026L472.122 816.39L459.418 797.474L439.453 775.118L414.045 749.322L392.266 728.686L379.561 714.929L359.597 692.573L337.818 663.338L316.039 625.505L301.519 587.672L292.445 551.558L288.815 527.483L287 505.127V463.854L290.63 432.9L299.704 393.347L316.039 346.915L330.558 315.961L345.078 290.166L370.486 252.333L394.08 221.378L412.23 199.022L432.194 174.947L452.158 152.591L472.122 128.515L488.456 111.318L495.716 102.72L499.346 101Z" fill="#35BB33"/>
                        <path d="M508.421 285.007H512.05V463.854H606.426L608.241 470.733L586.462 517.164L548.349 601.429L508.421 689.133L504.791 696.012H499.346L497.531 611.747V525.763H399.525L401.34 517.164L428.564 456.975L493.901 315.961L506.606 286.726L508.421 285.007Z" fill="#161A1C"/>
                    </svg>
                </div>
                <div class="title">MongoSnap</div>
                <div class="subtitle">MongoDB Query Generator</div>
            </div>
            
            <div class="content">
                ${content}
            </div>
            
            <div class="footer">
                <p>© 2024 MongoSnap. All rights reserved.</p>
                <p>Need help? Contact support@mongosnap.live</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Email verification template
const createVerificationTemplate = (token) => {
  const verificationLink = `https://mongosnap.mp:5173/api/verify-email/${token}`;
  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 16px;">Welcome to MongoSnap!</h2>
      <p>Please verify your email address to complete your registration.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button" style="display: inline-block; background-color: #3CBC6B !important; color: #ffffff !important; text-decoration: none !important; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; text-align: center; border: none !important; outline: none !important;">Verify Email</a>
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
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 16px;">Reset Your Password</h2>
      <p>Click the button below to create a new password.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${link}" class="button" style="display: inline-block; background-color: #3CBC6B !important; color: #ffffff !important; text-decoration: none !important; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; text-align: center; border: none !important; outline: none !important;">Reset Password</a>
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
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 16px;">Two-Factor Authentication</h2>
      <p>Enter this code to complete your login:</p>
    </div>
    
    <div class="otp-code">${token.toUpperCase()}</div>
    
    <div class="warning">
      This code expires in 10 minutes. Never share this code with anyone.
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Code');
};

// 2FA enabled template
const createTwoFactorEnabledTemplate = () => {
  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 16px;">Two-Factor Authentication Enabled</h2>
      <p>Your account is now protected with an additional layer of security.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.mp:5173" class="button" style="display: inline-block; background-color: #3CBC6B !important; color: #ffffff !important; text-decoration: none !important; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; text-align: center; border: none !important; outline: none !important;">Go to MongoSnap</a>
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Enabled');
};

// 2FA disabled template
const createTwoFactorDisabledTemplate = () => {
  const content = `
    <div class="message">
      <h2 style="color: #ff6b6b; margin-bottom: 16px;">Two-Factor Authentication Disabled</h2>
      <p>Your account security has been reduced. We recommend re-enabling 2FA.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.mp:5173/settings" class="button" style="display: inline-block; background-color: #3CBC6B !important; color: #ffffff !important; text-decoration: none !important; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; text-align: center; border: none !important; outline: none !important;">Re-enable 2FA</a>
    </div>
  `;
  
  return createBaseTemplate(content, '2FA Disabled');
};

// Login notification template
const createLoginNotificationTemplate = (loginDetails) => {
  const { timestamp, ipAddress, userAgent, location } = loginDetails;
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 16px;">New Login to Your Account</h2>
      <p>We noticed a new login to your MongoSnap account. Here are the details:</p>
    </div>
    
    <div style="background-color: #1a2f24; border: 1px solid #3CBC6B; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="margin-bottom: 12px;">
        <strong style="color: #3CBC6B;">Time:</strong> <strong style="color: white;">${formattedTime}</strong>
      </div>
      ${ipAddress ? `<div style="margin-bottom: 12px;">
        <strong style="color: #3CBC6B;">IP Address:</strong> <strong style="color: white;">${ipAddress}</strong>
      </div>` : ''}
      ${location ? `<div style="margin-bottom: 12px;">
        <strong style="color: #3CBC6B;">Location:</strong> <strong style="color: white;">${location}</strong>
      </div>` : ''}
      ${userAgent ? `<div style="margin-bottom: 12px;">
        <strong style="color: #3CBC6B;">Device:</strong> <strong style="color: white;">${userAgent}</strong>
      </div>` : ''}
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <p style="color: #e0e0e0; margin-bottom: 16px;">If this was you, no action is required.</p>
      <a href="https://mongosnap.mp:5173/settings" class="button" style="display: inline-block; background-color: #3CBC6B !important; color: #ffffff !important; text-decoration: none !important; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; text-align: center; border: none !important; outline: none !important;">Review Security Settings</a>
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
