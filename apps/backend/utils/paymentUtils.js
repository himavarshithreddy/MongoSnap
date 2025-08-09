// Shared payment utilities (gateway-agnostic)

function generateTransactionId(prefix = 'TXN') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}_${timestamp}_${random}`;
}

function formatAmount(amount) {
  return parseFloat(amount).toFixed(2);
}

module.exports = { generateTransactionId, formatAmount };


