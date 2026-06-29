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

// ──────────────────────────────────────────────────────────────────────────────
// TABLE-BASED EMAIL TEMPLATES — FULLY INLINE + HTML ATTRIBUTE FALLBACKS
//
// Why this approach:
// 1. <style> blocks are stripped by Gmail, Yahoo, and many mobile clients
// 2. <div>-based layouts break in Outlook (uses Word's rendering engine)
// 3. CSS shorthand (margin: 10px 0) is misinterpreted by some clients
// 4. HTML attributes (bgcolor, width, align, cellpadding, cellspacing, border)
//    work even when ALL CSS is stripped — they are the ultimate fallback
// 5. print-color-adjust / -webkit-print-color-adjust forces browsers to
//    preserve background colors when printing
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Base template wrapper — table-based layout with full HTML attribute fallbacks.
 * Every visual property is set via BOTH an HTML attribute AND an inline style.
 */
const createBaseTemplate = (content, title) => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, a { font-family: Arial, sans-serif !important; }
    table { border-collapse: collapse !important; }
  </style>
  <![endif]-->
</head>
<body bgcolor="#101813" style="margin: 0; padding: 0; width: 100%; background-color: #101813; font-family: Arial, Helvetica, sans-serif; color: #e5e7eb; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

  <!-- Outer wrapper table — fills viewport, sets background -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#101813" style="background-color: #101813; margin: 0; padding: 0; width: 100%; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
    <tr>
      <td align="center" valign="top" style="padding-top: 40px; padding-bottom: 40px;">

        <!-- Inner container table — the card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="480" bgcolor="#203127" style="background-color: #203127; max-width: 480px; width: 100%; border-radius: 18px; border: 1px solid #235337; box-shadow: 0 4px 32px 0 rgba(0,0,0,0.2); -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">

          <!-- Header row -->
          <tr>
            <td align="center" style="padding-top: 32px; padding-right: 24px; padding-bottom: 16px; padding-left: 24px; border-bottom: 2px solid #3CBC6B;">
              <h1 style="margin: 0; padding: 0; color: #3CBC6B; font-size: 26px; font-weight: 800; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">
                <font color="#3CBC6B" face="Arial, Helvetica, sans-serif">MongoSnap</font>
              </h1>
            </td>
          </tr>

          <!-- Main content row -->
          <tr>
            <td style="padding-top: 24px; padding-right: 24px; padding-bottom: 24px; padding-left: 24px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #d1d5db;">
              ${content}
            </td>
          </tr>

          <!-- Footer row -->
          <tr>
            <td align="center" style="padding-top: 18px; padding-right: 24px; padding-bottom: 24px; padding-left: 24px; border-top: 1px solid #235337;">
              <p style="margin: 0; margin-bottom: 8px; padding: 0; color: #9ca3af; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
                <font color="#9ca3af" size="2" face="Arial, Helvetica, sans-serif">&copy; 2026 MongoSnap. All rights reserved.</font>
              </p>
              <p style="margin: 0; padding: 0; color: #9ca3af; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
                <font color="#9ca3af" size="2" face="Arial, Helvetica, sans-serif">Need help? Contact <a href="mailto:support@mongosnap.xyz" style="color: #3CBC6B; text-decoration: none;"><font color="#3CBC6B">support@mongosnap.xyz</font></a></font>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Inner container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
};

/**
 * Helper: creates a styled CTA button using a table-based approach.
 * The table-cell-as-button technique ensures padding works in Outlook
 * and the bgcolor attribute provides a fallback when CSS is stripped.
 */
const createButton = (href, label) => {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; margin-bottom: 12px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" strokeweight="0" fillcolor="#3CBC6B">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">
              ${label}
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#3CBC6B" style="background-color: #3CBC6B; border-radius: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                <a href="${href}" target="_blank" style="display: inline-block; padding-top: 14px; padding-right: 32px; padding-bottom: 14px; padding-left: 32px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #3CBC6B; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                  <font color="#ffffff" face="Arial, Helvetica, sans-serif"><b>${label}</b></font>
                </a>
              </td>
            </tr>
          </table>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
};

/**
 * Helper: creates an info-box using a nested table with bgcolor fallback.
 */
const createInfoBox = (innerHtml) => {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#17211b" style="background-color: #17211b; border: 1px solid #374151; border-radius: 8px; margin-top: 20px; margin-bottom: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
      <tr>
        <td style="padding: 15px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #d1d5db;">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
};

/**
 * Helper: creates a warning box using a nested table with bgcolor fallback.
 */
const createWarningBox = (innerHtml) => {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#1f2937" style="background-color: #1f2937; border: 1px solid #374151; border-radius: 8px; margin-top: 20px; margin-bottom: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
      <tr>
        <td style="padding: 12px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #fbbf24;">
          <font color="#fbbf24" face="Arial, Helvetica, sans-serif">${innerHtml}</font>
        </td>
      </tr>
    </table>`;
};

/**
 * Helper: creates a code/OTP display box using a table with bgcolor fallback.
 */
const createCodeBox = (code) => {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#235337" style="background-color: #235337; border: 2px solid #3CBC6B; border-radius: 8px; margin-top: 24px; margin-bottom: 24px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
      <tr>
        <td align="center" style="padding: 18px; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; color: #3CBC6B; letter-spacing: 2px;">
          <font color="#3CBC6B" size="6" face="Arial, Helvetica, sans-serif"><b>${code}</b></font>
        </td>
      </tr>
    </table>`;
};

/**
 * Helper: creates a styled info row (label: value) inside an info-box.
 */
const createInfoRow = (label, value) => {
  return `<p style="margin-top: 8px; margin-bottom: 8px; margin-left: 0; margin-right: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #d1d5db;">
    <font color="#d1d5db" face="Arial, Helvetica, sans-serif"><strong style="color: #3CBC6B;"><font color="#3CBC6B">${label}:</font></strong> ${value}</font>
  </p>`;
};

/**
 * Helper: creates a heading (h2).
 */
const createH2 = (text, color = '#ffffff') => {
  return `<h2 style="margin-top: 0; margin-bottom: 16px; padding: 0; color: ${color}; font-weight: 700; font-size: 22px; font-family: Arial, Helvetica, sans-serif;">
    <font color="${color}" face="Arial, Helvetica, sans-serif">${text}</font>
  </h2>`;
};

/**
 * Helper: creates a paragraph.
 */
const createP = (text) => {
  return `<p style="margin-top: 0; margin-bottom: 15px; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #d1d5db; line-height: 1.5;">
    <font color="#d1d5db" face="Arial, Helvetica, sans-serif">${text}</font>
  </p>`;
};

/**
 * Helper: creates a sub-heading (h3) for inside info-boxes.
 */
const createH3 = (text, color = '#3CBC6B') => {
  return `<h3 style="margin-top: 0; margin-bottom: 10px; padding: 0; color: ${color}; font-weight: 700; font-size: 18px; font-family: Arial, Helvetica, sans-serif;">
    <font color="${color}" face="Arial, Helvetica, sans-serif">${text}</font>
  </h3>`;
};

/**
 * Helper: creates a styled list from an array of items.
 */
const createList = (items, color = '#d1d5db') => {
  const lis = items.map(item =>
    `<li style="margin-bottom: 4px; color: ${color}; font-size: 16px; font-family: Arial, Helvetica, sans-serif;"><font color="${color}" face="Arial, Helvetica, sans-serif">${item}</font></li>`
  ).join('\n        ');
  return `<ul style="margin-top: 10px; margin-bottom: 10px; padding-left: 20px; color: ${color};">
        ${lis}
      </ul>`;
};


// ──────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ──────────────────────────────────────────────────────────────────────────────

// Email verification template
const createVerificationTemplate = (token) => {
  const verificationLink = `https://mongosnap.xyz/api/verify-email/${token}`;
  const content = `
    ${createH2('Welcome to MongoSnap!')}
    ${createP('Please verify your email address to complete your registration.')}
    ${createButton(verificationLink, 'Verify Email')}
    ${createWarningBox('This link expires in 24 hours.')}
  `;
  return createBaseTemplate(content, 'Verify Your Account');
};

// Password reset template
const createPasswordResetTemplate = (link) => {
  const content = `
    ${createH2('Reset Your Password')}
    ${createP('Click the button below to create a new password.')}
    ${createButton(link, 'Reset Password')}
    ${createWarningBox("This link expires in 1 hour. If you didn't request this, please ignore this email.")}
  `;
  return createBaseTemplate(content, 'Reset Password');
};

// 2FA OTP template
const createTwoFactorOTPTemplate = (token) => {
  const content = `
    ${createH2('Two-Factor Authentication')}
    ${createP('Enter this code to complete your login:')}
    ${createCodeBox(token.toUpperCase())}
    ${createWarningBox('This code expires in 10 minutes. Never share this code with anyone.')}
  `;
  return createBaseTemplate(content, '2FA Code');
};

// 2FA enabled template
const createTwoFactorEnabledTemplate = () => {
  const content = `
    ${createH2('Two-Factor Authentication Enabled')}
    ${createP('Your account is now protected with an additional layer of security.')}
    ${createButton('https://mongosnap.xyz', 'Go to MongoSnap')}
  `;
  return createBaseTemplate(content, '2FA Enabled');
};

// 2FA disabled template
const createTwoFactorDisabledTemplate = () => {
  const content = `
    ${createH2('Two-Factor Authentication Disabled', '#ef4444')}
    ${createP('Your account security has been reduced. We recommend re-enabling 2FA.')}
    ${createButton('https://mongosnap.xyz/settings', 'Re-enable 2FA')}
  `;
  return createBaseTemplate(content, '2FA Disabled');
};

// Login notification template
const createLoginNotificationTemplate = (loginDetails) => {
  const { timestamp, ipAddress, userAgent, location, email, loginMethod } = loginDetails;
  const formattedTime = new Date(timestamp).toLocaleString();

  let infoRows = '';
  infoRows += createInfoRow('Email', email || 'Not provided');
  infoRows += createInfoRow('Login Method', loginMethod || 'Email/Password');
  infoRows += createInfoRow('Time', formattedTime);
  if (ipAddress) infoRows += createInfoRow('IP Address', ipAddress);
  if (location) infoRows += createInfoRow('Location', location);
  if (userAgent) infoRows += createInfoRow('Device', userAgent);

  const content = `
    ${createH2('New Login to Your Account')}
    ${createP('We noticed a new login to your MongoSnap account. Here are the details:')}
    ${createInfoBox(infoRows)}
    ${createP('If this was you, no action is required.')}
    ${createButton('https://mongosnap.xyz/settings', 'Review Security Settings')}
    ${createWarningBox("If this wasn't you, please secure your account immediately by changing your password and enabling two-factor authentication.")}
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

  const formattedAmount = `&#8377;${amount}`;
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

  let paymentRows = '';
  paymentRows += createInfoRow('Transaction ID', transactionId);
  paymentRows += createInfoRow('Amount Paid', formattedAmount);
  paymentRows += createInfoRow('Plan', subscriptionPlan.toUpperCase());
  paymentRows += createInfoRow('Payment Date', formattedPaymentDate);
  paymentRows += createInfoRow('Subscription Expires', formattedExpiryDate);
  if (paymentMethod) paymentRows += createInfoRow('Payment Method', paymentMethod);
  if (cardLast4) paymentRows += createInfoRow('Card', `**** **** **** ${cardLast4}`);

  const featuresList = createList([
    'Unlimited query history',
    'Save &amp; organize queries',
    'Unlimited database connections',
    'Unlimited executions',
    'Enhanced AI generation',
    'Export database schemas',
    'Upload your own databases',
    'Priority support'
  ]);

  const content = `
    ${createH2('Payment Confirmation')}
    ${createP('Thank you for your payment! Your subscription has been successfully activated.')}
    ${createInfoBox(paymentRows)}
    ${createButton('https://mongosnap.xyz/connect', 'Go to Dashboard')}
    ${createInfoBox(createH3("What's Next?") + createP('You now have access to all premium features including:') + featuresList)}
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

  let upgradeRows = '';
  upgradeRows += createInfoRow('Previous Plan', oldPlan);
  upgradeRows += createInfoRow('New Plan', newPlan);
  upgradeRows += createInfoRow('Upgrade Date', formattedUpgradeDate);
  upgradeRows += createInfoRow('Subscription Expires', formattedExpiryDate);

  const content = `
    ${createH2('Plan Upgrade Successful!')}
    ${createP('Congratulations! Your MongoSnap plan has been successfully upgraded.')}
    ${createInfoBox(upgradeRows)}
    ${createButton('https://mongosnap.xyz/connect', 'Start Using Premium Features')}
    ${createInfoBox(createH3('New Features Available:') + createList(features))}
    ${createP("Thank you for choosing MongoSnap! We're excited to see what you'll build with these powerful features.")}
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

  let cancellationRows = '';
  cancellationRows += createInfoRow('Plan', planName);
  cancellationRows += createInfoRow('Cancellation Date', formattedCancellationDate);
  cancellationRows += createInfoRow('Status', 'Cancelled');

  const content = `
    ${createH2('Subscription Cancelled')}
    ${createP(`Your ${planName} subscription has been cancelled as requested.`)}
    ${createInfoBox(cancellationRows)}
    ${createButton('https://mongosnap.xyz/pricing', 'Reactivate Subscription')}
    ${createWarningBox(createH3('Features No Longer Available:', '#fbbf24') + createList(featuresLost, '#fbbf24'))}
    ${createP('You can reactivate your subscription at any time to regain access to premium features.')}
    ${createInfoBox(createInfoRow('Need help?', `Contact our support team at <a href="mailto:support@mongosnap.xyz" style="color: #3CBC6B; text-decoration: none;"><font color="#3CBC6B">support@mongosnap.xyz</font></a>`))}
  `;
  return createBaseTemplate(content, 'Subscription Cancelled');
};


// ──────────────────────────────────────────────────────────────────────────────
// EMAIL SENDING FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

const sendVerificationEmail = async (email, token) => {
  const html = createVerificationTemplate(token);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "Verify your MongoSnap account",
    html: html
  });
};

const sendResetPasswordEmail = async (email, link) => {
  const html = createPasswordResetTemplate(link);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "Reset your MongoSnap password",
    html: html
  });
};

const sendTwoFactorEmailOTP = async (email, token) => {
  const html = createTwoFactorOTPTemplate(token);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "MongoSnap - 2FA Code",
    html: html
  });
};

const sendTwoFactorConfirmationEmail = async (email) => {
  const html = createTwoFactorEnabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "2FA Enabled - MongoSnap",
    html: html
  });
};

const sendTwoFactorDisableConfirmationEmail = async (email) => {
  const html = createTwoFactorDisabledTemplate();
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "2FA Disabled - MongoSnap",
    html: html
  });
};

const sendLoginNotificationEmail = async (email, loginDetails) => {
  const html = createLoginNotificationTemplate(loginDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "New Login to Your MongoSnap Account",
    html: html
  });
};

const sendPaymentConfirmationEmail = async (email, paymentDetails) => {
  const html = createPaymentConfirmationTemplate(paymentDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "Payment Confirmation - MongoSnap",
    html: html
  });
};

const sendPlanUpgradeEmail = async (email, upgradeDetails) => {
  const html = createPlanUpgradeTemplate(upgradeDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "Plan Upgrade Successful - MongoSnap",
    html: html
  });
};

const sendSubscriptionCancellationEmail = async (email, cancellationDetails) => {
  const html = createSubscriptionCancellationTemplate(cancellationDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: email,
    subject: "Subscription Cancelled - MongoSnap",
    html: html
  });
};

// Payment Form success template (fixed notification to admin/recipient)
const createPaymentFormSuccessTemplate = (formDetails) => {
  const {
    formId,
    orderId,
    amount,
    currency,
    customerName,
    customerEmail,
    customerPhone,
    paymentTime
  } = formDetails;

  const formattedAmount = `${currency} ${amount}`;
  const formattedPaymentDate = new Date(paymentTime).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let infoRows = '';
  infoRows += createInfoRow('Form ID', formId);
  infoRows += createInfoRow('Order ID', orderId);
  infoRows += createInfoRow('Amount Paid', formattedAmount);
  infoRows += createInfoRow('Customer Name', customerName);
  infoRows += createInfoRow('Customer Email', customerEmail);
  infoRows += createInfoRow('Customer Phone', customerPhone);
  infoRows += createInfoRow('Payment Date', formattedPaymentDate);
  infoRows += createInfoRow('Status', 'PAID (Success)');

  const content = `
    ${createH2('Payment Form Success 🎉')}
    ${createP('A new payment has been successfully received via Cashfree Payment Forms!')}
    ${createInfoBox(infoRows)}
    ${createButton('https://merchant.cashfree.com', 'View in Cashfree Dashboard')}
    ${createP('This automated notification confirms the successful transaction.')}
  `;
  return createBaseTemplate(content, 'Payment Form Success');
};

const sendPaymentFormSuccessEmail = async (formDetails) => {
  const html = createPaymentFormSuccessTemplate(formDetails);
  await transporter.sendMail({
    from: `"MongoSnap" <noreply@mongosnap.xyz>`,
    to: 'himavarshithreddy@gmail.com',
    subject: `Payment Received: ${formDetails.currency} ${formDetails.amount} on ${formDetails.formId}`,
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
  sendSubscriptionCancellationEmail,
  sendPaymentFormSuccessEmail
};
