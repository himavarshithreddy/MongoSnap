/**
 * Generate unique transaction ID
 * @param {string} prefix - Optional prefix for transaction ID
 * @returns {string} Unique transaction ID
 */
const generateTransactionId = (prefix = 'TXN') => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}_${timestamp}_${random}`;
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