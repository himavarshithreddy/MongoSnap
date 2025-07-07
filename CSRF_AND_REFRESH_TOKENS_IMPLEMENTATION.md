# CSRF Protection and Database-Stored Refresh Tokens Implementation

This document outlines the comprehensive implementation of CSRF protection and database-stored refresh tokens for enhanced security in the MongoSnap application.

## 🛡️ Security Features Implemented

### 1. **Database-Stored Refresh Tokens**
- Refresh tokens are now stored in MongoDB with comprehensive metadata
- Token families prevent token reuse attacks
- Automatic token rotation on each use
- Device fingerprinting for session tracking
- Configurable expiration and revocation

### 2. **CSRF Protection**
- CSRF tokens generated and validated for state-changing operations
- 24-hour token expiration with automatic refresh
- Integration with existing JWT authentication
- Protection for all POST/PUT/DELETE endpoints

### 3. **Enhanced Session Management**
- Active session tracking per user
- Individual session revocation
- Bulk session revocation (logout all devices)
- Session metadata (device info, IP address, last used)

## 📁 New Files Created

### Backend Models
- `apps/backend/models/RefreshToken.js` - Database schema for refresh tokens

### Updated Files
- `apps/backend/models/User.js` - Added CSRF token fields and methods
- `apps/backend/routes/middleware.js` - Added CSRF middleware functions
- `apps/backend/utils/tokengeneration.js` - Enhanced token management
- `apps/backend/routes/auth.js` - Updated authentication routes
- `apps/backend/routes/twofactor.js` - Updated 2FA routes with new tokens
- `apps/frontend/src/contexts/UserContext.jsx` - Added CSRF token handling
- `apps/frontend/src/pages/Login.jsx` - Updated to handle CSRF tokens

## 🔧 API Endpoints

### New Authentication Endpoints

#### `GET /api/auth/active-sessions`
- **Purpose**: Retrieve user's active refresh token sessions
- **Authentication**: Required (JWT + CSRF token generation)
- **Response**: List of active sessions with metadata

#### `POST /api/auth/revoke-session`
- **Purpose**: Revoke a specific session
- **Authentication**: Required (JWT + CSRF validation)
- **Body**: `{ "sessionId": "session_id" }`

#### `POST /api/auth/revoke-all-sessions`
- **Purpose**: Revoke all user sessions (logout from all devices)
- **Authentication**: Required (JWT + CSRF validation)
- **Effect**: Clears current refresh token cookie

#### `GET /api/auth/csrf-token`
- **Purpose**: Generate a new CSRF token
- **Authentication**: Required (JWT)
- **Response**: Fresh CSRF token

### Enhanced Existing Endpoints

#### `POST /api/auth/login`
- **Enhanced**: Now returns CSRF token in response
- **Response**: `{ token, csrfToken, user, message }`

#### `POST /api/auth/refresh`
- **Enhanced**: Returns new CSRF token with access token
- **Response**: `{ token, csrfToken, message }`

#### `POST /api/auth/logout`
- **Enhanced**: Properly revokes refresh token in database

## 🔐 Security Features

### Refresh Token Security

```javascript
// Token Family System
const tokenFamily = RefreshToken.createTokenFamily(); // Unique family ID
// All tokens in same family are related (same login session)

// Token Rotation
// Old token marked as used -> New token generated -> Successor link maintained

// Reuse Detection
if (tokenDoc.isUsed) {
    await RefreshToken.revokeFamily(tokenDoc.family, 'token_reuse');
    throw new Error('Token reuse detected - security breach');
}
```

### CSRF Protection

```javascript
// Automatic CSRF validation for state-changing requests
const method = (options.method || 'GET').toUpperCase();
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers['X-CSRF-Token'] = getCurrentCSRFToken();
}
```

## 🎯 Frontend Integration

### UserContext Enhancements

The `UserContext` now automatically handles:
- CSRF token storage and management
- Automatic CSRF token inclusion in requests
- CSRF token refresh on 403 errors
- Token cleanup on logout

### Example Usage

```javascript
// The fetchWithAuth function automatically includes CSRF tokens
const { fetchWithAuth } = useUser();

// POST request - CSRF token automatically included
const response = await fetchWithAuth('/api/connection/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(connectionData)
});

// GET request - No CSRF token needed
const userData = await fetchWithAuth('/api/auth/me');
```

## 🔄 Token Lifecycle

### 1. **Login Flow**
```
User Login -> Generate Access Token (15min) + Refresh Token (7 days) + CSRF Token (24h)
-> Store refresh token in database with metadata
-> Send refresh token as HTTP-only cookie
-> Return access token and CSRF token to frontend
```

### 2. **Request Flow**
```
API Request -> Check if state-changing -> Include CSRF token in header
-> Validate CSRF token (if required) -> Process request
-> Return new CSRF token in response headers (if generated)
```

### 3. **Token Refresh Flow**
```
Access token expires -> Frontend calls /api/auth/refresh
-> Validate refresh token from database -> Mark old token as used
-> Generate new refresh token in same family -> Store in database
-> Return new access token + CSRF token -> Update frontend state
```

### 4. **Logout Flow**
```
User logout -> Revoke refresh token in database
-> Clear refresh token cookie -> Clear frontend tokens
-> Disconnect database connections -> Redirect to login
```

## 🚨 Security Breach Detection

### Token Reuse Detection
```javascript
// If a used refresh token is presented again
await RefreshToken.revokeFamily(tokenDoc.family, 'token_reuse');
// All tokens in the family are revoked
// User must re-authenticate
```

### CSRF Token Validation
```javascript
// Missing CSRF token
res.status(403).json({ 
    message: 'CSRF token missing',
    code: 'CSRF_TOKEN_MISSING'
});

// Invalid CSRF token
res.status(403).json({ 
    message: 'Invalid or expired CSRF token',
    code: 'CSRF_TOKEN_INVALID'
});
```

## 🧹 Maintenance & Cleanup

### Automatic Cleanup
```javascript
// Periodic cleanup of expired tokens
const { cleanupExpiredTokens } = require('./utils/tokengeneration');

// Run cleanup (can be scheduled)
setInterval(async () => {
    const deletedCount = await cleanupExpiredTokens();
    console.log(`Cleaned up ${deletedCount} expired tokens`);
}, 24 * 60 * 60 * 1000); // Daily
```

### Manual Session Management
```javascript
// Revoke all sessions for a user (admin function)
await RefreshToken.revokeAllForUser(userId, 'admin');

// Revoke specific token family (security incident)
await RefreshToken.revokeFamily(family, 'security_breach');
```

## ⚡ Performance Considerations

### Database Indexes
The RefreshToken model includes optimized indexes:
- `{ token: 1 }` - Unique index for fast token lookups
- `{ userId: 1, family: 1 }` - Compound index for family operations
- `{ userId: 1, createdAt: -1 }` - User session listing
- `{ expiresAt: 1 }` - TTL index for automatic cleanup

### Caching Strategy
- CSRF tokens cached in localStorage (24h expiry)
- User data cached in localStorage (no expiry)
- Refresh tokens only in HTTP-only cookies (7 days)

## 🔧 Configuration

### Environment Variables
```bash
# JWT secrets (keep these secure!)
JWT_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# Security settings
NODE_ENV=production  # Affects cookie security settings
```

### Token Durations
- **Access Token**: 15 minutes (configurable in tokengeneration.js)
- **Refresh Token**: 7 days (configurable in tokengeneration.js)
- **CSRF Token**: 24 hours (configurable in User.js)

## 🧪 Testing the Implementation

### Test CSRF Protection
```bash
# This should fail without CSRF token
curl -X POST http://localhost:5000/api/auth/request-password-change \
     -H "Authorization: Bearer your_jwt_token" \
     -H "Content-Type: application/json"

# This should succeed with CSRF token
curl -X POST http://localhost:5000/api/auth/request-password-change \
     -H "Authorization: Bearer your_jwt_token" \
     -H "X-CSRF-Token: your_csrf_token" \
     -H "Content-Type: application/json"
```

### Test Token Rotation
```bash
# Call refresh endpoint multiple times
curl -X POST http://localhost:5000/api/auth/refresh \
     --cookie "refreshToken=your_refresh_token"
```

### Test Session Management
```bash
# Get active sessions
curl -X GET http://localhost:5000/api/auth/active-sessions \
     -H "Authorization: Bearer your_jwt_token"

# Revoke specific session
curl -X POST http://localhost:5000/api/auth/revoke-session \
     -H "Authorization: Bearer your_jwt_token" \
     -H "X-CSRF-Token: your_csrf_token" \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "session_id"}'
```

## 🎯 Next Steps

### Recommended Enhancements
1. **Rate Limiting**: Add more granular rate limiting per endpoint
2. **Geolocation**: Integrate IP geolocation for session metadata
3. **Device Fingerprinting**: Enhanced device identification
4. **Audit Logging**: Detailed security event logging
5. **Admin Panel**: UI for session management and security monitoring

### OAuth Integration
Update OAuth routes to also generate CSRF tokens:
```javascript
// In OAuth success callback
const csrfToken = user.generateCSRFToken();
await user.save();
// Include csrfToken in OAuth response
```

## 📊 Monitoring & Alerts

Consider implementing alerts for:
- Multiple refresh token reuse attempts
- High number of CSRF token failures
- Unusual session patterns (many devices for one user)
- Failed authentication attempts patterns

This implementation provides enterprise-level security for the MongoSnap application while maintaining a smooth user experience. 