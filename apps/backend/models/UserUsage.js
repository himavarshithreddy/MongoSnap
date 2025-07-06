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
            limit: { type: Number, default: 100 }
        },
        monthly: {
            count: { type: Number, default: 0 },
            month: { type: String, default: () => new Date().toISOString().substring(0, 7) }, // YYYY-MM format
            limit: { type: Number, default: 2000 }
        }
    },
    
    // AI Query Generation Tracking
    aiGeneration: {
        daily: {
            count: { type: Number, default: 0 },
            date: { type: String, default: () => new Date().toISOString().split('T')[0] },
            limit: { type: Number, default: 10 }
        },
        monthly: {
            count: { type: Number, default: 0 },
            month: { type: String, default: () => new Date().toISOString().substring(0, 7) },
            limit: { type: Number, default: 200 }
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
    
    return {
        queryExecution: {
            daily: {
                used: this.queryExecution.daily.count,
                limit: this.queryExecution.daily.limit,
                remaining: Math.max(0, this.queryExecution.daily.limit - this.queryExecution.daily.count),
                percentage: Math.round((this.queryExecution.daily.count / this.queryExecution.daily.limit) * 100)
            },
            monthly: {
                used: this.queryExecution.monthly.count,
                limit: this.queryExecution.monthly.limit,
                remaining: Math.max(0, this.queryExecution.monthly.limit - this.queryExecution.monthly.count),
                percentage: Math.round((this.queryExecution.monthly.count / this.queryExecution.monthly.limit) * 100)
            }
        },
        aiGeneration: {
            daily: {
                used: this.aiGeneration.daily.count,
                limit: this.aiGeneration.daily.limit,
                remaining: Math.max(0, this.aiGeneration.daily.limit - this.aiGeneration.daily.count),
                percentage: Math.round((this.aiGeneration.daily.count / this.aiGeneration.daily.limit) * 100)
            },
            monthly: {
                used: this.aiGeneration.monthly.count,
                limit: this.aiGeneration.monthly.limit,
                remaining: Math.max(0, this.aiGeneration.monthly.limit - this.aiGeneration.monthly.count),
                percentage: Math.round((this.aiGeneration.monthly.count / this.aiGeneration.monthly.limit) * 100)
            }
        }
    };
};

module.exports = mongoose.model('UserUsage', userUsageSchema); 