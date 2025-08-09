// Shared payment utilities (gateway-agnostic)

function generateTransactionId(prefix = 'TXN') {
  const crypto = require('crypto');
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return `${prefix}_${id}`;
function formatAmount(amount) {
  const n = typeof amount === 'string'
    ? Number(amount.replace(/,/g, ''))
    : Number(amount);
  if (!Number.isFinite(n)) {
    throw new TypeError(
      'formatAmount: amount must be a finite number or numeric string'
    );
  }
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  const res = rounded.toFixed(2);
  return res === '-0.00' ? '0.00' : res;
}}

module.exports = { generateTransactionId, formatAmount };


