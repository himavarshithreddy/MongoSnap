const axios = require('axios');
const crypto = require('crypto');

function getBaseUrl() {
  const env = (process.env.CASHFREE_ENV || process.env.CASHFREE_ENVIRONMENT || '').toLowerCase();
  const isProd = env === 'production' || env === 'prod';
  return isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

function getAuthHeaders() {
  const clientId = process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials missing');
  }
  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
    'x-api-version': '2023-08-01',
  };
}

async function createOrder({ amount, currency = 'INR', customer, returnUrl }) {
  const base = getBaseUrl();
  const headers = getAuthHeaders();
  const requestBody = {
    order_amount: String(amount),
    order_currency: currency,
    customer_details: {
      customer_id: customer.id,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_name: customer.name,
    },
    order_meta: {
      return_url: returnUrl,
    },
  };
  const { data } = await axios.post(`${base}/orders`, requestBody, { headers });
  return data; // contains order_id, payment_session_id, etc.
}

async function getOrder(orderId) {
  const base = getBaseUrl();
  const headers = getAuthHeaders();
  const { data } = await axios.get(`${base}/orders/${orderId}`, { headers });
  return data; // contains order_status, payments, etc.
}

function verifyWebhookSignature(rawBodyBuffer, timestamp, receivedSignature) {
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientSecret || !timestamp || !receivedSignature) return false;
  try {
    const signedPayload = Buffer.concat([
      Buffer.from(String(timestamp), 'utf8'),
      Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer : Buffer.from(rawBodyBuffer)
    ]);
    const computed = crypto
      .createHmac('sha256', clientSecret)
      .update(signedPayload)
      .digest('base64');
    return computed === receivedSignature;
  } catch (e) {
    return false;
  }
}

module.exports = {
  createOrder,
  getOrder,
  verifyWebhookSignature,
};


