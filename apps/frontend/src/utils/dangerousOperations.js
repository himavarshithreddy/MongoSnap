// Utility to detect and categorize dangerous database operations

export const DANGEROUS_OPERATIONS = {
    high: [
        'dropDatabase',
        'drop',
        'remove'
    ],
    medium: [
        'dropIndex',
        'dropIndexes',
        'deleteMany',
        'updateMany',
        'collMod'
    ]
    // Removed low-level operations like deleteOne, updateOne, replaceOne
    // Removed createCollection and renameCollection as they're less dangerous
};

export const OPERATION_MESSAGES = {
    dropDatabase: {
        title: 'Drop Database',
        message: 'This will permanently delete the entire database and all its data.',
        level: 'high'
    },
    drop: {
        title: 'Drop Collection',
        message: 'This will permanently delete the collection and all its documents.',
        level: 'high'
    },
    remove: {
        title: 'Remove Documents',
        message: 'This deprecated operation will remove documents. Consider using deleteOne/deleteMany.',
        level: 'high'
    },
    dropIndex: {
        title: 'Drop Index',
        message: 'This will delete the database index and may impact query performance.',
        level: 'medium'
    },
    dropIndexes: {
        title: 'Drop All Indexes',
        message: 'This will delete all indexes and may severely impact performance.',
        level: 'medium'
    },
    deleteMany: {
        title: 'Delete Multiple Documents',
        message: 'This will delete multiple documents that match the criteria.',
        level: 'medium'
    },
    updateMany: {
        title: 'Update Multiple Documents',
        message: 'This will update multiple documents that match the criteria.',
        level: 'medium'
    },
    collMod: {
        title: 'Modify Collection',
        message: 'This will modify collection properties and structure.',
        level: 'medium'
    }
};

/**
 * Analyzes a MongoDB query string to detect dangerous operations
 * @param {string} query - The MongoDB query string
 * @returns {Object|null} - Returns operation info if dangerous, null if safe
 */
export function analyzeDangerousOperation(query) {
    if (!query || typeof query !== 'string') {
        return null;
    }

  
    
    // Check for each dangerous operation
    for (const [level, operations] of Object.entries(DANGEROUS_OPERATIONS)) {
        for (const operation of operations) {
            // Check for operation patterns
            const patterns = [
                new RegExp(`\\.${operation}\\s*\\(`, 'i'),  // .operation(
                new RegExp(`db\\.runCommand\\s*\\(\\s*{\\s*["']?${operation}["']?`, 'i'), // db.runCommand({operation
                new RegExp(`["']${operation}["']\\s*:`, 'i') // "operation": or 'operation':
            ];
            
            if (patterns.some(pattern => pattern.test(query))) {
                return {
                    operation: operation,
                    level: level,
                    ...OPERATION_MESSAGES[operation]
                };
            }
        }
    }

    return null;
}

/**
 * Extracts the collection name from a MongoDB query
 * @param {string} query - The MongoDB query string
 * @returns {string|null} - The collection name or null if not found
 */
export function extractCollectionName(query) {
    if (!query || typeof query !== 'string') {
        return null;
    }

    // Pattern to match db.collectionName.operation
    const match = query.match(/db\.([a-zA-Z_][a-zA-Z0-9_]*)\./);
    return match ? match[1] : null;
}

/**
 * Checks if an operation is considered dangerous
 * @param {string} operation - The operation name
 * @returns {boolean} - True if dangerous, false if safe
 */
export function isDangerousOperation(operation) {
    if (!operation) return false;
    
    return Object.values(DANGEROUS_OPERATIONS).flat().includes(operation.toLowerCase());
}

/**
 * Gets the danger level of an operation
 * @param {string} operation - The operation name
 * @returns {string|null} - The danger level or null if not dangerous
 */
export function getDangerLevel(operation) {
    if (!operation) return null;
    
    const operationLower = operation.toLowerCase();
    
    for (const [level, operations] of Object.entries(DANGEROUS_OPERATIONS)) {
        if (operations.includes(operationLower)) {
            return level;
        }
    }
    
    return null;
} 