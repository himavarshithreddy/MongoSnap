const mongoose = require('mongoose');

const userUsageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    
    // Query Execution Tracking
    queryExecution: {
        daily: {
            count: { type: Number, default: 0 },
            date: { type: String, default: () => new Date().toISOString().split('T')[0] }, // YYYY-MM-DD format
            limit: { type: Number, default: 20 } // Default for Snap plan
        },
        monthly: {
            count: { type: Number, default: 0 },
            month: { type: String, default: () => new Date().toISOString().substring(0, 7) }, // YYYY-MM format
            limit: { type: Number, default: 400 } // Default for Snap plan
        }
    },
    
    // AI Query Generation Tracking
    aiGeneration: {
        daily: {
            count: { type: Number, default: 0 },
            date: { type: String, default: () => new Date().toISOString().split('T')[0] },
            limit: { type: Number, default: 5 } // Default for Snap plan
        },
        monthly: {
            count: { type: Number, default: 0 },
            month: { type: String, default: () => new Date().toISOString().substring(0, 7) },
            limit: { type: Number, default: 100 } // Default for Snap plan
        }
    },
    
    // Track last reset times for debugging
    lastDailyReset: { type: Date, default: Date.now },
    lastMonthlyReset: { type: Date, default: Date.now },
    
    // Usage history for analytics (optional)
    usageHistory: [{
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['query', 'ai_generation'], required: true },
        operation: String, // The actual operation performed
        connectionId: mongoose.Schema.Types.ObjectId
    }]
}, {
    timestamps: true
});

// Index for efficient queries
userUsageSchema.index({ 'queryExecution.daily.date': 1 });
userUsageSchema.index({ 'queryExecution.monthly.month': 1 });
userUsageSchema.index({ 'aiGeneration.daily.date': 1 });
userUsageSchema.index({ 'aiGeneration.monthly.month': 1 });

// Static method to get or create usage record for user
userUsageSchema.statics.getOrCreateUsage = async function(userId) {
    let usage = await this.findOne({ userId });
    
    if (!usage) {
        usage = new this({ userId });
        await usage.save();
    }
    
    return usage;
};

// Method to get limits based on subscription plan
userUsageSchema.methods.getLimitsForPlan = function(plan = 'snap') {
    const limits = {
        snap: {
            queryExecution: {
                daily: 20,
                monthly: 400
            },
            aiGeneration: {
                daily: 5,
                monthly: 100
            },
            queryHistory: 50,
            connections: 2
        },
        snapx: {
            queryExecution: {
                daily: -1, // Unlimited
                monthly: -1 // Unlimited
            },
            aiGeneration: {
                daily: 100,
                monthly: 2500
            },
            queryHistory: -1, // Unlimited
            connections: -1 // Unlimited
        }
    };
    
    return limits[plan] || limits.snap;
};

// Method to update limits based on user's subscription plan
userUsageSchema.methods.updateLimitsForPlan = function(plan = 'snap') {
    const limits = this.getLimitsForPlan(plan);
    
    this.queryExecution.daily.limit = limits.queryExecution.daily;
    this.queryExecution.monthly.limit = limits.queryExecution.monthly;
    this.aiGeneration.daily.limit = limits.aiGeneration.daily;
    this.aiGeneration.monthly.limit = limits.aiGeneration.monthly;
    
    return this;
};

// Method to check and reset daily/monthly counters if needed
userUsageSchema.methods.checkAndResetCounters = function() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.toISOString().substring(0, 7);
    
    let changed = false;
    
    // Reset daily counters if new day
    if (this.queryExecution.daily.date !== today) {
        this.queryExecution.daily.count = 0;
        this.queryExecution.daily.date = today;
        this.lastDailyReset = now;
        changed = true;
    }
    
    if (this.aiGeneration.daily.date !== today) {
        this.aiGeneration.daily.count = 0;
        this.aiGeneration.daily.date = today;
        changed = true;
    }
    
    // Reset monthly counters if new month
    if (this.queryExecution.monthly.month !== thisMonth) {
        this.queryExecution.monthly.count = 0;
        this.queryExecution.monthly.month = thisMonth;
        this.lastMonthlyReset = now;
        changed = true;
    }
    
    if (this.aiGeneration.monthly.month !== thisMonth) {
        this.aiGeneration.monthly.count = 0;
        this.aiGeneration.monthly.month = thisMonth;
        changed = true;
    }
    
    return changed;
};

// Method to check if user can perform query execution
userUsageSchema.methods.canExecuteQuery = function() {
    this.checkAndResetCounters();
    
    // Check if unlimited (SnapX plan)
    if (this.queryExecution.daily.limit === -1 && this.queryExecution.monthly.limit === -1) {
        return {
            allowed: true,
            dailyRemaining: -1, // Unlimited
            monthlyRemaining: -1, // Unlimited
            dailyLimit: -1,
            monthlyLimit: -1,
            reason: null
        };
    }
    
    const dailyOk = this.queryExecution.daily.count < this.queryExecution.daily.limit;
    const monthlyOk = this.queryExecution.monthly.count < this.queryExecution.monthly.limit;
    
    return {
        allowed: dailyOk && monthlyOk,
        dailyRemaining: Math.max(0, this.queryExecution.daily.limit - this.queryExecution.daily.count),
        monthlyRemaining: Math.max(0, this.queryExecution.monthly.limit - this.queryExecution.monthly.count),
        dailyLimit: this.queryExecution.daily.limit,
        monthlyLimit: this.queryExecution.monthly.limit,
        reason: !dailyOk ? 'daily_limit_exceeded' : (!monthlyOk ? 'monthly_limit_exceeded' : null)
    };
};

// Method to check if user can perform AI generation
userUsageSchema.methods.canGenerateAI = function() {
    this.checkAndResetCounters();
    
    // Check if unlimited (SnapX plan)
    if (this.aiGeneration.daily.limit === -1 && this.aiGeneration.monthly.limit === -1) {
        return {
            allowed: true,
            dailyRemaining: -1, // Unlimited
            monthlyRemaining: -1, // Unlimited
            dailyLimit: -1,
            monthlyLimit: -1,
            reason: null
        };
    }
    
    const dailyOk = this.aiGeneration.daily.count < this.aiGeneration.daily.limit;
    const monthlyOk = this.aiGeneration.monthly.count < this.aiGeneration.monthly.limit;
    
    return {
        allowed: dailyOk && monthlyOk,
        dailyRemaining: Math.max(0, this.aiGeneration.daily.limit - this.aiGeneration.daily.count),
        monthlyRemaining: Math.max(0, this.aiGeneration.monthly.limit - this.aiGeneration.monthly.count),
        dailyLimit: this.aiGeneration.daily.limit,
        monthlyLimit: this.aiGeneration.monthly.limit,
        reason: !dailyOk ? 'daily_limit_exceeded' : (!monthlyOk ? 'monthly_limit_exceeded' : null)
    };
};

// Method to increment query execution count
userUsageSchema.methods.incrementQueryExecution = async function(operation = 'unknown', connectionId = null) {
    this.checkAndResetCounters();
    
    this.queryExecution.daily.count += 1;
    this.queryExecution.monthly.count += 1;
    
    // Add to usage history
    this.usageHistory.push({
        type: 'query',
        operation: operation,
        connectionId: connectionId
    });
    
    // Keep only last 1000 history entries to prevent unlimited growth
    if (this.usageHistory.length > 1000) {
        this.usageHistory = this.usageHistory.slice(-1000);
    }
    
    await this.save();
};

// Method to increment AI generation count
userUsageSchema.methods.incrementAIGeneration = async function(operation = 'unknown', connectionId = null) {
    this.checkAndResetCounters();
    
    this.aiGeneration.daily.count += 1;
    this.aiGeneration.monthly.count += 1;
    
    // Add to usage history
    this.usageHistory.push({
        type: 'ai_generation',
        operation: operation,
        connectionId: connectionId
    });
    
    // Keep only last 1000 history entries
    if (this.usageHistory.length > 1000) {
        this.usageHistory = this.usageHistory.slice(-1000);
    }
    
    await this.save();
};

// Method to get usage statistics
userUsageSchema.methods.getUsageStats = function() {
    this.checkAndResetCounters();
    
    const formatUsage = (used, limit) => {
        if (limit === -1) {
            return {
                used: used,
                limit: 'Unlimited',
                remaining: 'Unlimited',
                percentage: 0
            };
        }
        return {
            used: used,
            limit: limit,
            remaining: Math.max(0, limit - used),
            percentage: Math.round((used / limit) * 100)
        };
    };
    
    return {
        queryExecution: {
            daily: formatUsage(this.queryExecution.daily.count, this.queryExecution.daily.limit),
            monthly: formatUsage(this.queryExecution.monthly.count, this.queryExecution.monthly.limit)
        },
        aiGeneration: {
            daily: formatUsage(this.aiGeneration.daily.count, this.aiGeneration.daily.limit),
            monthly: formatUsage(this.aiGeneration.monthly.count, this.aiGeneration.monthly.limit)
        }
    };
};

module.exports = mongoose.model('UserUsage', userUsageSchema); 