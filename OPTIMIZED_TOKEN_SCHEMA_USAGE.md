# 🚀 Optimized Refresh Token Schema Usage

This document explains how we've enhanced the MongoSnap authentication system to fully utilize all fields in the `RefreshToken` schema, providing comprehensive security monitoring and session management.

## 🔧 **Schema Field Utilization**

### **Previously Underutilized Fields**

| Field | Previous Usage | Optimized Usage |
|-------|---------------|-----------------|
| `lastUsedAt` | Only set during token rotation | ✅ Updated on every API request |
| `deviceFingerprint` | Generated but unused | ✅ Used for security monitoring & device change detection |
| `successorToken` | Set but not displayed | ✅ Used for token chain tracking |
| `revokedBy` | Generic reasons only | ✅ Granular revocation tracking |
| `revokedAt` | Basic timestamp | ✅ Used in analytics & security monitoring |

## 📊 **Enhanced API Endpoints**

### **🔄 Updated Endpoints**

#### `GET /api/auth/active-sessions` (Enhanced)
```javascript
// Now returns comprehensive session data
{
  "sessions": [
    {
      "id": "session_id",
      "family": "token_family_id",
      "createdAt": "2024-01-15T10:00:00Z",
      "lastUsedAt": "2024-01-15T14:30:00Z",      // ✅ Now accurate
      "expiresAt": "2024-01-22T10:00:00Z",       // ✅ New field
      "deviceInfo": {
        "userAgent": "Chrome 120.0 on Windows",
        "ipAddress": "192.168.1.100",
        "deviceFingerprint": "a1b2c3d4..."       // ✅ Partial display
      },
      "isCurrent": true,                          // ✅ Fixed detection logic
      "isUsed": false,
      "securityInfo": {                           // ✅ New security metadata
        "hasSuccessor": false,
        "revokedBy": null,
        "revokedAt": null
      }
    }
  ],
  "currentSessionId": "session_id"               // ✅ New field
}
```

### **🆕 New Analytics Endpoints**

#### `GET /api/auth/session-analytics`
```javascript
{
  "analytics": {
    "totalSessions": 25,
    "activeSessions": 3,
    "revokedSessions": 18,
    "usedSessions": 4,
    "uniqueFamilies": 8,                    // Distinct login sessions
    "uniqueDevices": 4,                     // Based on device fingerprints
    "lastActivity": "2024-01-15T14:30:00Z",
    "revocationReasons": {                  // ✅ Granular tracking
      "logout": 12,
      "logout_all_devices": 4,
      "user_revocation": 2,
      "token_reuse": 0
    },
    "recentSessions": [...]                 // Last 10 sessions with metadata
  }
}
```

#### `GET /api/auth/security-monitor`
```javascript
{
  "securityData": {
    "analytics": {
      "periodDays": 30,
      "totalTokens": 25,
      "uniqueDevices": 4,
      "deviceChanges": [                    // ✅ IP change detection
        {
          "fingerprint": "a1b2c3d4...",
          "oldIp": "192.168.1.100",
          "newIp": "192.168.1.101",
          "changedAt": "2024-01-14T08:00:00Z"
        }
      ],
      "securityEvents": {
        "tokenReuse": 0,
        "familyBreaches": 0,
        "deviceChanges": 1,
        "suspiciousActivity": false
      }
    },
    "suspiciousActivity": [                 // ✅ Threat detection
      {
        "type": "rapid_token_creation",
        "hour": "2024-01-15T10:00:00Z",
        "count": 6,
        "severity": "high"
      }
    ],
    "currentTokenChain": [                  // ✅ Token succession tracking
      {
        "token": "eyJ0eXAiOi...",
        "family": "family_id",
        "createdAt": "2024-01-15T10:00:00Z",
        "isUsed": true,
        "isRevoked": false,
        "revokedBy": null
      }
    ],
    "riskLevel": "low"                      // ✅ Calculated risk assessment
  }
}
```

## 🔧 **Implementation Enhancements**

### **1. Real-Time Usage Tracking**

```javascript
// apps/backend/routes/middleware.js
function verifyToken(req, res, next) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized' });
        
        req.userId = decoded.id;
        
        // ✅ Track refresh token usage on every API request
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            updateTokenUsage(refreshToken, req).catch(err => {
                console.error('Failed to update token usage:', err);
            });
        }
        
        next();
    });
}
```

### **2. Device Security Monitoring**

```javascript
// apps/backend/utils/tokengeneration.js
async function updateTokenUsage(token, req) {
    const refreshTokenDoc = await RefreshToken.findOne({ token: token });
    if (refreshTokenDoc) {
        // ✅ Update last used timestamp
        refreshTokenDoc.lastUsedAt = new Date();
        
        // ✅ Check for device fingerprint changes (security)
        const currentDeviceInfo = extractDeviceInfo(req);
        if (refreshTokenDoc.deviceInfo.deviceFingerprint !== currentDeviceInfo.deviceFingerprint) {
            console.warn(`⚠️ Device fingerprint mismatch for token ${token.substring(0, 10)}...`);
            // Could trigger additional security measures
        }
        
        await refreshTokenDoc.save();
    }
}
```

### **3. Granular Revocation Tracking**

```javascript
// Enhanced revocation reasons
await revokeRefreshToken(token, 'logout');           // Normal logout
await revokeAllUserTokens(userId, 'logout_all_devices'); // Logout all
await session.revoke('user_revocation');            // Manual session revocation
await RefreshToken.revokeFamily(family, 'token_reuse'); // Security breach
```

### **4. Token Chain Analysis**

```javascript
// apps/backend/models/RefreshToken.js
refreshTokenSchema.statics.getTokenChain = async function(startToken) {
    const chain = [];
    let currentToken = await this.findOne({ token: startToken });
    
    // ✅ Follow successor tokens to build complete chain
    while (currentToken) {
        chain.push({
            token: currentToken.token.substring(0, 10) + '...',
            family: currentToken.family,
            createdAt: currentToken.createdAt,
            isUsed: currentToken.isUsed,
            isRevoked: currentToken.isRevoked,
            revokedBy: currentToken.revokedBy
        });
        
        if (currentToken.successorToken) {
            currentToken = await this.findOne({ token: currentToken.successorToken });
        } else {
            break;
        }
    }
    
    return chain;
};
```

## 🛡️ **Advanced Security Features**

### **1. Automated Threat Detection**

```javascript
refreshTokenSchema.statics.findSuspiciousSessions = async function(userId) {
    const suspicious = [];
    
    // ✅ Detect rapid token creation (brute force attempts)
    const tokensByHour = new Map();
    recentTokens.forEach(token => {
        const hour = new Date(token.createdAt).setMinutes(0, 0, 0);
        tokensByHour.set(hour, (tokensByHour.get(hour) || 0) + 1);
    });
    
    tokensByHour.forEach((count, hour) => {
        if (count > 5) { // More than 5 tokens in one hour
            suspicious.push({
                type: 'rapid_token_creation',
                hour: new Date(hour),
                count: count,
                severity: 'high'
            });
        }
    });
    
    // ✅ Detect unusual IP patterns
    if (ipCounts.size > 10) { // More than 10 different IPs in 7 days
        suspicious.push({
            type: 'multiple_ip_addresses',
            uniqueIps: ipCounts.size,
            severity: 'medium'
        });
    }
    
    return suspicious;
};
```

### **2. Device Change Analysis**

```javascript
refreshTokenSchema.statics.getSecurityAnalytics = async function(userId, days = 30) {
    // ✅ Track device fingerprint changes over time
    const deviceChanges = [];
    const deviceMap = new Map();
    
    tokens.forEach(token => {
        const fingerprint = token.deviceInfo.deviceFingerprint;
        const ip = token.deviceInfo.ipAddress;
        
        if (deviceMap.has(fingerprint)) {
            const existing = deviceMap.get(fingerprint);
            if (existing.ip !== ip) {
                deviceChanges.push({
                    fingerprint: fingerprint.substring(0, 8) + '...',
                    oldIp: existing.ip,
                    newIp: ip,
                    changedAt: token.createdAt
                });
            }
        }
        
        deviceMap.set(fingerprint, { ip, lastSeen: token.createdAt });
    });
    
    return {
        deviceChanges: deviceChanges,
        securityEvents: {
            deviceChanges: deviceChanges.length,
            suspiciousActivity: deviceChanges.length > 3
        }
    };
};
```

### **3. Risk Level Calculation**

```javascript
function calculateRiskLevel(analytics, suspicious) {
    let riskScore = 0;
    
    // ✅ Weight different security factors
    riskScore += analytics.deviceChanges.length * 2;      // Device changes
    riskScore += analytics.securityEvents.tokenReuse * 10; // Token reuse
    riskScore += analytics.securityEvents.familyBreaches * 15; // Family breaches
    
    // ✅ Factor in suspicious activity
    suspicious.forEach(event => {
        if (event.severity === 'high') riskScore += 20;
        if (event.severity === 'medium') riskScore += 10;
    });
    
    // ✅ Return calculated risk level
    if (riskScore === 0) return 'low';
    if (riskScore < 10) return 'low';
    if (riskScore < 30) return 'medium';
    return 'high';
}
```

## 📈 **Performance Optimizations**

### **Database Indexes**
```javascript
// Optimized indexes for new usage patterns
refreshTokenSchema.index({ userId: 1, family: 1 });        // Family operations
refreshTokenSchema.index({ userId: 1, createdAt: -1 });    // Recent sessions
refreshTokenSchema.index({ userId: 1, lastUsedAt: -1 });   // ✅ Usage tracking
refreshTokenSchema.index({ 'deviceInfo.deviceFingerprint': 1 }); // ✅ Device analysis
refreshTokenSchema.index({ revokedBy: 1, revokedAt: -1 }); // ✅ Revocation analysis
```

### **Efficient Queries**
```javascript
// Optimized query patterns
const activeSessions = await RefreshToken.getActiveTokensForUser(userId);
const securityAnalytics = await RefreshToken.getSecurityAnalytics(userId, 30);
const suspiciousSessions = await RefreshToken.findSuspiciousSessions(userId);
```

## 🎯 **Benefits of Full Schema Utilization**

### **Security Benefits**
- ✅ **Real-time threat detection** via device fingerprint monitoring
- ✅ **Comprehensive audit trails** with granular revocation tracking
- ✅ **Token chain analysis** for forensic investigation
- ✅ **Automated risk assessment** based on usage patterns

### **User Experience Benefits**
- ✅ **Accurate session metadata** showing real last usage times
- ✅ **Detailed session information** for better user control
- ✅ **Security dashboard** with actionable insights
- ✅ **Proactive security notifications** for unusual activity

### **Administrative Benefits**
- ✅ **Complete session analytics** for user behavior analysis
- ✅ **Security monitoring dashboards** for threat assessment
- ✅ **Forensic capabilities** for incident investigation
- ✅ **Automated cleanup** of unused schema fields

## 🚀 **Usage Examples**

### **Frontend Integration**
```javascript
// Get comprehensive session data
const { sessions, currentSessionId } = await fetchWithAuth('/api/auth/active-sessions');

// Monitor security status
const { securityData } = await fetchWithAuth('/api/auth/security-monitor');
console.log(`Current risk level: ${securityData.riskLevel}`);

// View session analytics
const { analytics } = await fetchWithAuth('/api/auth/session-analytics');
console.log(`Active across ${analytics.uniqueDevices} devices`);
```

### **Security Monitoring**
```javascript
// Check for security threats
const suspicious = await RefreshToken.findSuspiciousSessions(userId);
if (suspicious.length > 0) {
    console.log('⚠️ Suspicious activity detected:', suspicious);
    // Trigger security notifications
}

// Analyze device changes
const analytics = await RefreshToken.getSecurityAnalytics(userId);
if (analytics.securityEvents.suspiciousActivity) {
    console.log('🚨 High security risk detected');
    // Consider requiring re-authentication
}
```

This optimization ensures that every field in the `RefreshToken` schema serves a purpose, providing enterprise-level security monitoring while maintaining excellent performance and user experience. 