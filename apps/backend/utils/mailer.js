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

// Base email template with consistent styling
const createBaseTemplate = (content, title) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #101813 0%, #1a2f24 100%);
                color: #ffffff;
                line-height: 1.6;
                padding: 20px;
            }
            
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #17211b 0%, #203127 100%);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                border: 1px solid #2d4c38;
            }
            
            .header {
                background: linear-gradient(135deg, #235337 0%, #3CBC6B 100%);
                padding: 30px;
                text-align: center;
                position: relative;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.05)"/><circle cx="10" cy="60" r="0.5" fill="rgba(255,255,255,0.05)"/><circle cx="90" cy="40" r="0.5" fill="rgba(255,255,255,0.05)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                opacity: 0.3;
            }
            
            .logo {
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                position: relative;
                z-index: 1;
            }
            
            .logo svg {
                width: 100%;
                height: 100%;
            }
            
            .header h1 {
                font-size: 28px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            
            .header p {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.9);
                position: relative;
                z-index: 1;
            }
            
            .content {
                padding: 40px 30px;
                background: linear-gradient(135deg, #17211b 0%, #203127 100%);
            }
            
            .message {
                font-size: 16px;
                color: #e0e0e0;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #3CBC6B 0%, #35c56a 100%);
                color: #ffffff;
                text-decoration: none;
                padding: 16px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                transition: all 0.3s ease;
                box-shadow: 0 8px 20px rgba(60, 188, 107, 0.3);
                border: none;
                cursor: pointer;
                margin: 20px 0;
            }
            
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 25px rgba(60, 188, 107, 0.4);
                background: linear-gradient(135deg, #35c56a 0%, #2fb55a 100%);
            }
            
            .otp-container {
                background: linear-gradient(135deg, #1a2f24 0%, #243c2d 100%);
                border: 2px solid #3CBC6B;
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                margin: 30px 0;
                box-shadow: 0 8px 20px rgba(60, 188, 107, 0.2);
            }
            
            .otp-code {
                font-size: 32px;
                font-weight: 700;
                color: #3CBC6B;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 10px rgba(60, 188, 107, 0.3);
            }
            
            .footer {
                background: linear-gradient(135deg, #1a2f24 0%, #243c2d 100%);
                padding: 30px;
                text-align: center;
                border-top: 1px solid #2d4c38;
            }
            
            .footer p {
                color: #a0a0a0;
                font-size: 14px;
                margin-bottom: 10px;
            }
            
            .footer a {
                color: #3CBC6B;
                text-decoration: none;
            }
            
            .footer a:hover {
                text-decoration: underline;
            }
            
            .warning {
                background: linear-gradient(135deg, #2d1a1a 0%, #3d2a2a 100%);
                border: 1px solid #4a2a2a;
                border-radius: 8px;
                padding: 16px;
                margin: 20px 0;
                color: #ffb3b3;
                font-size: 14px;
            }
            
            .info {
                background: linear-gradient(135deg, #1a2a2d 0%, #243a3d 100%);
                border: 1px solid #2d4c4f;
                border-radius: 8px;
                padding: 16px;
                margin: 20px 0;
                color: #b3d9ff;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                body {
                    padding: 10px;
                }
                
                .email-container {
                    border-radius: 12px;
                }
                
                .header {
                    padding: 20px;
                }
                
                .content {
                    padding: 30px 20px;
                }
                
                .footer {
                    padding: 20px;
                }
                
                .otp-code {
                    font-size: 24px;
                    letter-spacing: 4px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">
                    <svg viewBox="280 100 450 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M499.346 101H512.05L530.2 119.917L544.719 137.113L561.053 156.03L584.647 183.545L610.056 216.219L628.205 240.295L649.985 271.249L666.319 297.044L686.283 336.597L702.617 377.87L713.507 413.983L720.766 453.536L722.581 472.453V506.846L718.952 542.96L709.877 580.793L697.173 615.187L675.393 658.179L660.874 678.815L642.725 701.171L599.167 745.883L586.462 757.921L573.758 771.678L548.349 795.754L533.829 814.67L528.385 833.587L526.57 849.064L524.755 883.458L519.31 892.056L510.235 898.935H497.531L488.456 893.776L483.012 886.897L481.197 881.738L479.382 837.026L472.122 816.39L459.418 797.474L439.453 775.118L414.045 749.322L392.266 728.686L379.561 714.929L359.597 692.573L337.818 663.338L316.039 625.505L301.519 587.672L292.445 551.558L288.815 527.483L287 505.127V463.854L290.63 432.9L299.704 393.347L316.039 346.915L330.558 315.961L345.078 290.166L370.486 252.333L394.08 221.378L412.23 199.022L432.194 174.947L452.158 152.591L472.122 128.515L488.456 111.318L495.716 102.72L499.346 101Z" fill="#148D22"/>
                        <path d="M499.346 101H506.606V291.885L441.268 432.9L401.34 520.604L399.525 525.763H497.531L499.346 611.747V696.012H506.606L508.421 778.557L522.94 802.633L530.2 818.11L526.57 849.064L524.755 883.458L519.31 892.056L510.235 898.935H497.531L488.456 893.776L483.012 886.897L481.197 881.738L479.382 837.026L472.122 816.39L459.418 797.474L439.453 775.118L414.045 749.322L392.266 728.686L379.561 714.929L359.597 692.573L337.818 663.338L316.039 625.505L301.519 587.672L292.445 551.558L288.815 527.483L287 505.127V463.854L290.63 432.9L299.704 393.347L316.039 346.915L330.558 315.961L345.078 290.166L370.486 252.333L394.08 221.378L412.23 199.022L432.194 174.947L452.158 152.591L472.122 128.515L488.456 111.318L495.716 102.72L499.346 101Z" fill="#35BB33"/>
                        <path d="M508.421 285.007H512.05V463.854H606.426L608.241 470.733L586.462 517.164L548.349 601.429L508.421 689.133L504.791 696.012H499.346L497.531 611.747V525.763H399.525L401.34 517.164L428.564 456.975L493.901 315.961L506.606 286.726L508.421 285.007Z" fill="#161A1C"/>
                    </svg>
                </div>
                <h1>MongoSnap</h1>
                <p>Your MongoDB Query Generator</p>
            </div>
            
            <div class="content">
                ${content}
            </div>
            
            <div class="footer">
                <p>© 2024 MongoSnap. All rights reserved.</p>
                <p>If you didn't request this email, please ignore it.</p>
                <p>Need help? Contact us at <a href="mailto:support@mongosnap.live">support@mongosnap.live</a></p>
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
      <h2 style="color: #3CBC6B; margin-bottom: 20px; font-size: 24px;">Welcome to MongoSnap! 🎉</h2>
      <p>Thank you for signing up! To complete your registration and start using MongoSnap, please verify your email address by clicking the button below.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button">Verify Email Address</a>
    </div>
    
    <div class="info">
      <strong>What happens next?</strong><br>
      After verifying your email, you'll be able to connect to your MongoDB databases and start generating queries with AI assistance.
    </div>
    
    <div class="warning">
      <strong>Security Notice:</strong><br>
      This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification link.
    </div>
  `;
  
  return createBaseTemplate(content, 'Verify Your MongoSnap Account');
};

// Password reset template
const createPasswordResetTemplate = (link) => {
  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 20px; font-size: 24px;">Reset Your Password 🔐</h2>
      <p>We received a request to reset your MongoSnap password. Click the button below to create a new password.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${link}" class="button">Reset Password</a>
    </div>
    
    <div class="info">
      <strong>Need help?</strong><br>
      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </div>
    
    <div class="warning">
      <strong>Security Notice:</strong><br>
      This password reset link will expire in 1 hour for your security. If you don't reset your password within this time, you'll need to request a new link.
    </div>
  `;
  
  return createBaseTemplate(content, 'Reset Your MongoSnap Password');
};

// 2FA OTP template
const createTwoFactorOTPTemplate = (token) => {
  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 20px; font-size: 24px;">Two-Factor Authentication 🔒</h2>
      <p>You've requested to log in to your MongoSnap account. Please enter the verification code below to complete your login.</p>
    </div>
    
    <div class="otp-container">
      <div style="margin-bottom: 16px; color: #e0e0e0; font-size: 16px;">Your verification code:</div>
      <div class="otp-code">${token.toUpperCase()}</div>
      <div style="margin-top: 16px; color: #a0a0a0; font-size: 14px;">This code expires in 10 minutes</div>
    </div>
    
    <div class="info">
      <strong>Security Tip:</strong><br>
      Never share this code with anyone. MongoSnap will never ask for this code via email, phone, or text message.
    </div>
    
    <div class="warning">
      <strong>Didn't request this?</strong><br>
      If you didn't try to log in to your account, please change your password immediately and contact our support team.
    </div>
  `;
  
  return createBaseTemplate(content, 'MongoSnap - Two-Factor Authentication');
};

// 2FA enabled confirmation template
const createTwoFactorEnabledTemplate = () => {
  const content = `
    <div class="message">
      <h2 style="color: #3CBC6B; margin-bottom: 20px; font-size: 24px;">Two-Factor Authentication Enabled ✅</h2>
      <p>Great news! Your two-factor authentication has been successfully enabled for your MongoSnap account.</p>
    </div>
    
    <div class="info">
      <strong>What this means:</strong><br>
      • Your account is now protected with an additional layer of security<br>
      • You'll receive a verification code via email each time you log in<br>
      • This helps prevent unauthorized access to your account
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://mongosnap.mp:5173" class="button">Go to MongoSnap</a>
    </div>
    
    <div class="warning">
      <strong>Keep your email secure:</strong><br>
      Since your 2FA codes are sent to your email, make sure your email account is also protected with a strong password and 2FA if possible.
    </div>
  `;
  
  return createBaseTemplate(content, 'Two-Factor Authentication Enabled');
};

// 2FA disabled confirmation template
const createTwoFactorDisabledTemplate = () => {
  const content = `
    <div class="message">
      <h2 style="color: #ff6b6b; margin-bottom: 20px; font-size: 24px;">Two-Factor Authentication Disabled ⚠️</h2>
      <p>Your two-factor authentication has been disabled for your MongoSnap account.</p>
    </div>
    
    <div class="warning">
      <strong>Security Notice:</strong><br>
      Your account is now less secure. We recommend re-enabling two-factor authentication as soon as possible to protect your account.
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://mongosnap.mp:5173/settings" class="button">Re-enable 2FA</a>
    </div>
    
    <div class="info">
      <strong>Need help?</strong><br>
      If you didn't disable 2FA yourself, please contact our support team immediately and change your password.
    </div>
  `;
  
  return createBaseTemplate(content, 'Two-Factor Authentication Disabled');
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
    subject: "MongoSnap - Two-Factor Authentication Code",
    html: html
  });
};

const sendTwoFactorConfirmationEmail = async (email) => {
  const html = createTwoFactorEnabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Two-Factor Authentication Enabled - MongoSnap",
    html: html
  });
};

const sendTwoFactorDisableConfirmationEmail = async (email) => {
  const html = createTwoFactorDisabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Two-Factor Authentication Disabled - MongoSnap",
    html: html
  });
};

module.exports = { 
  sendVerificationEmail, 
  sendResetPasswordEmail, 
  sendTwoFactorConfirmationEmail, 
  sendTwoFactorDisableConfirmationEmail, 
  sendTwoFactorEmailOTP 
};
