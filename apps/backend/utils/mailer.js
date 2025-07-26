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
                background: #101813;
                color: #e5e7eb;
                margin: 0;
                padding: 0;
                min-width: 100vw;
            }
            .container {
                background: #203127;
                max-width: 480px;
                margin: 40px auto;
                border-radius: 18px;
                box-shadow: 0 4px 32px 0 #00000033;
                padding: 32px 24px 24px 24px;
                border: 1px solid #235337;
            }
            .header {
                text-align: center;
                margin-bottom: 24px;
                border-bottom: 2px solid #3CBC6B;
                padding-bottom: 16px;
            }
            .title {
                color: #3CBC6B;
                font-size: 26px;
                font-weight: 800;
                margin: 0;
                letter-spacing: 1px;
            }
            .main-content {
                margin-top: 24px;
                margin-bottom: 24px;
            }
            .button {
                display: inline-block;
                background: linear-gradient(90deg, #3CBC6B 0%, #35c56a 100%);
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 10px;
                font-weight: 700;
                font-size: 16px;
                margin: 24px 0 12px 0;
                transition: background 0.2s, transform 0.2s;
                box-shadow: 0 2px 8px 0 #3cbc6b22;
            }
            .button:hover {
                background: linear-gradient(90deg, #35c56a 0%, #3CBC6B 100%);
                transform: scale(1.03);
            }
            .code {
                background: #235337;
                border: 2px solid #3CBC6B;
                border-radius: 8px;
                padding: 18px;
                text-align: center;
                font-size: 28px;
                font-weight: bold;
                color: #3CBC6B;
                margin: 24px 0;
                letter-spacing: 2px;
            }
            .footer {
                text-align: center;
                color: #9ca3af;
                font-size: 13px;
                margin-top: 32px;
                border-top: 1px solid #235337;
                padding-top: 18px;
            }
            .warning {
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 8px;
                padding: 12px;
                margin: 20px 0;
                color: #fbbf24;
                font-size: 15px;
            }
            .info-box {
                background: #17211b;
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
                color: #fff;
                font-weight: 700;
                margin-bottom: 16px;
                font-size: 22px;
            }
            p {
                color: #d1d5db;
                margin-bottom: 15px;
                font-size: 16px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">MongoSnap</h1>
            </div>
            <div class="main-content">
                ${content}
            </div>
            <div class="footer">
                <p>© 2025 MongoSnap. All rights reserved.</p>
                <p>Need help? Contact <a href="mailto:support@mongosnap.live" style="color:#3CBC6B;text-decoration:none;">support@mongosnap.live</a></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Email verification template
const createVerificationTemplate = (token) => {
  const verificationLink = `https://mongosnap.live/api/verify-email/${token}`;
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
      <a href="https://mongosnap.live" class="button">Go to MongoSnap</a>
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
      <a href="https://mongosnap.live/settings" class="button">Re-enable 2FA</a>
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
      <a href="https://mongosnap.live/settings" class="button">Review Security Settings</a>
    </div>
    
    <div class="warning">
      If this wasn't you, please secure your account immediately by changing your password and enabling two-factor authentication.
    </div>
  `;
  
  return createBaseTemplate(content, 'New Login Alert');
};

// Payment confirmation template
const createPaymentConfirmationTemplate = (paymentDetails) => {
  const { 
    userName, 
    amount, 
    transactionId, 
    subscriptionPlan, 
    paymentDate, 
    expiryDate,
    paymentMethod,
    cardLast4
  } = paymentDetails;

  const formattedAmount = `₹${amount}`;
  const formattedPaymentDate = new Date(paymentDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedExpiryDate = new Date(expiryDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h2>Payment Confirmation</h2>
    <p>Thank you for your payment! Your subscription has been successfully activated.</p>
    
    <div class="info-box">
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
      <p><strong>Plan:</strong> ${subscriptionPlan.toUpperCase()}</p>
      <p><strong>Payment Date:</strong> ${formattedPaymentDate}</p>
      <p><strong>Subscription Expires:</strong> ${formattedExpiryDate}</p>
      ${paymentMethod ? `<p><strong>Payment Method:</strong> ${paymentMethod}</p>` : ''}
      ${cardLast4 ? `<p><strong>Card:</strong> **** **** **** ${cardLast4}</p>` : ''}
    </div>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.live/connect" class="button">Go to Dashboard</a>
    </div>
    
    <div class="info-box">
      <h3 style="color: #3CBC6B; margin-top: 0;">What's Next?</h3>
      <p>You now have access to all premium features including:</p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Unlimited query history</li>
        <li>Save & organize queries</li>
        <li>Unlimited database connections</li>
        <li>Unlimited executions</li>
        <li>Enhanced AI generation</li>
        <li>Export database schemas</li>
        <li>Upload your own databases</li>
        <li>Priority support</li>
      </ul>
    </div>
  `;
  
  return createBaseTemplate(content, 'Payment Confirmation');
};

// Plan upgrade notification template
const createPlanUpgradeTemplate = (upgradeDetails) => {
  const { 
    userName, 
    oldPlan, 
    newPlan, 
    upgradeDate, 
    expiryDate,
    features
  } = upgradeDetails;

  const formattedUpgradeDate = new Date(upgradeDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedExpiryDate = new Date(expiryDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h2>Plan Upgrade Successful!</h2>
    <p>Congratulations! Your MongoSnap plan has been successfully upgraded.</p>
    
    <div class="info-box">
      <p><strong>Previous Plan:</strong> ${oldPlan}</p>
      <p><strong>New Plan:</strong> ${newPlan}</p>
      <p><strong>Upgrade Date:</strong> ${formattedUpgradeDate}</p>
      <p><strong>Subscription Expires:</strong> ${formattedExpiryDate}</p>
    </div>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.live/connect" class="button">Start Using Premium Features</a>
    </div>
    
    <div class="info-box">
      <h3 style="color: #3CBC6B; margin-top: 0;">New Features Available:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
    </div>
    
    <p>Thank you for choosing MongoSnap! We're excited to see what you'll build with these powerful features.</p>
  `;
  
  return createBaseTemplate(content, 'Plan Upgrade Successful');
};

// Subscription cancellation template
const createSubscriptionCancellationTemplate = (cancellationDetails) => {
  const { 
    userName, 
    planName, 
    cancellationDate,
    featuresLost
  } = cancellationDetails;

  const formattedCancellationDate = new Date(cancellationDate).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const content = `
    <h2>Subscription Cancelled</h2>
    <p>Your ${planName} subscription has been cancelled as requested.</p>
    
    <div class="info-box">
      <p><strong>Plan:</strong> ${planName}</p>
      <p><strong>Cancellation Date:</strong> ${formattedCancellationDate}</p>
      <p><strong>Status:</strong> Cancelled</p>
    </div>
    
    <div style="text-align: center;">
      <a href="https://mongosnap.live/pricing" class="button">Reactivate Subscription</a>
    </div>
    
    <div class="warning">
      <h3 style="color: #fbbf24; margin-top: 0;">Features No Longer Available:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${featuresLost.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
    </div>
    
    <p>You can reactivate your subscription at any time to regain access to premium features.</p>
    
    <div class="info-box">
      <p><strong>Need help?</strong> Contact our support team at <a href="mailto:support@mongosnap.live" style="color:#3CBC6B;text-decoration:none;">support@mongosnap.live</a></p>
    </div>
  `;
  
  return createBaseTemplate(content, 'Subscription Cancelled');
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

const sendPaymentConfirmationEmail = async (email, paymentDetails) => {
  const html = createPaymentConfirmationTemplate(paymentDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Payment Confirmation - MongoSnap",
    html: html
  });
};

const sendPlanUpgradeEmail = async (email, upgradeDetails) => {
  const html = createPlanUpgradeTemplate(upgradeDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Plan Upgrade Successful - MongoSnap",
    html: html
  });
};

const sendSubscriptionCancellationEmail = async (email, cancellationDetails) => {
  const html = createSubscriptionCancellationTemplate(cancellationDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.live>`,
    to: email,
    subject: "Subscription Cancelled - MongoSnap",
    html: html
  });
};

module.exports = { 
  sendVerificationEmail, 
  sendResetPasswordEmail, 
  sendTwoFactorConfirmationEmail, 
  sendTwoFactorDisableConfirmationEmail, 
  sendTwoFactorEmailOTP,
  sendLoginNotificationEmail,
  sendPaymentConfirmationEmail,
  sendPlanUpgradeEmail,
  sendSubscriptionCancellationEmail
};
