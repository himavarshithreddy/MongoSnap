const crypto = require('crypto');

/**
 * Generate unique, non-predictable transaction ID
 * @param {string} prefix - Optional prefix for transaction ID
 * @returns {string} Unique transaction ID
 */
const generateTransactionId = (prefix = 'TXN') => {
    const uniqueComponent =
        typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString('hex');
    return `${prefix}_${uniqueComponent}`;
};

/**
 * Format amount for payment (ensure 2 decimal places)
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted amount
 */
const formatAmount = (amount) => {
    return parseFloat(amount).toFixed(2);
};

module.exports = {
    generateTransactionId,
    formatAmount,
}; 