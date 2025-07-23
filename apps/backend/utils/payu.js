const crypto = require('crypto');

const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL;
const PAYU_SUCCESS_URL = process.env.PAYU_SUCCESS_URL;
const PAYU_FAILURE_URL = process.env.PAYU_FAILURE_URL;

/**
 * Generate a unique transaction ID (for demo, use timestamp + random)
 */
function generateTxnId() {
  return 'txn_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

/**
 * Generate PayU payment hash (SHA512)
 * @param {Object} params - Payment params (see PayU docs for order)
 * @returns {string} hash
 */
function generatePayUHash(params) {
  // Correct hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  const hashString = [
    PAYU_MERCHANT_KEY,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || '',
    params.udf2 || '',
    params.udf3 || '',
    params.udf4 || '',
    params.udf5 || '',
    '', '', '', '', '',
    PAYU_MERCHANT_SALT
  ].join('|');
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Prepare PayU payment parameters
 * @param {Object} options - { amount, productinfo, firstname, email, phone, userId }
 * @returns {Object} params for PayU form
 */
function preparePayUParams(options) {
  const txnid = generateTxnId();
  const params = {
    key: PAYU_MERCHANT_KEY,
    txnid,
    amount: options.amount,
    productinfo: options.productinfo,
    firstname: options.firstname,
    email: options.email,
    phone: options.phone,
    surl: PAYU_SUCCESS_URL,
    furl: PAYU_FAILURE_URL,
    udf1: options.userId || '',
    udf2: '', udf3: '', udf4: '', udf5: '',
    service_provider: 'payu_paisa',
  };
  params.hash = generatePayUHash(params);
  return params;
}

module.exports = {
  preparePayUParams,
  generateTxnId,
  generatePayUHash,
}; 