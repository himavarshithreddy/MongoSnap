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

const sendVerificationEmail = async (email, token) => {
  const link = `http://mongopilot.mp:5173/api/verify-email/${token}`;
  await transporter.sendMail({
    from: `"MongoPilot" <noreply@himavarshithreddy.in>`,
    to: email,
    subject: "Verify your MongoPilot account",
    html: `<p>Click the link to verify your email: <a href="${link}">${link}</a></p>`
  });
};
const sendResetPasswordEmail = async (email, link) => {
    await transporter.sendMail({
        from: `"MongoPilot" <noreply@himavarshithreddy.in>`,
        to: email,
        subject: "Reset your MongoPilot password",
        html: `<p>Click the link to reset your password: <a href="${link}">${link}</a></p>`
    });
};
module.exports = { sendVerificationEmail, sendResetPasswordEmail };
