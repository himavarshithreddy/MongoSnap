# 🔐 MongoSnap Authentication System Guide
*A Complete Guide to How User Authentication and Security Works*

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Types of Tokens](#types-of-tokens)
3. [User Registration Process](#user-registration-process)
4. [Login Process](#login-process)
5. [Session Management](#session-management)
6. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
7. [OAuth Social Login](#oauth-social-login)
8. [Security Features](#security-features)
9. [Token Lifecycle](#token-lifecycle)
10. [User Experience Flows](#user-experience-flows)
11. [Troubleshooting Common Issues](#troubleshooting-common-issues)
12. [Technical Implementation](#technical-implementation)

---

## Overview

MongoSnap is a web application that helps users manage MongoDB databases. To keep user data secure and prevent unauthorized access, it uses a sophisticated multi-layered authentication system.

### What is Authentication?
Authentication is like showing your ID card to prove who you are. In MongoSnap, when you log in, the system verifies your identity and gives you special "tokens" (digital passes) that prove you're allowed to use the application.

### Why Multiple Types of Tokens?
Think of tokens like different types of keys:
- **Short-term keys** (Access Tokens) for immediate access
- **Long-term keys** (Refresh Tokens) for staying logged in
- **Security keys** (CSRF Tokens) for protection against attacks

---

## Types of Tokens

### 1. 🎫 Access Token (JWT)
**Purpose**: Your main "ticket" to use the application

**How it works**:
- Valid for **15 minutes only**
- Contains your user ID and basic information
- Required for every action you take in the app
- Automatically included in requests

**Think of it as**: A day pass to an amusement park - you need it for rides, but it expires quickly

### 2. 🔄 Refresh Token
**Purpose**: Automatically gets you new access tokens without logging in again

**How it works**:
- Valid for **7 days**
- Stored securely in the database with detailed information
- Automatically rotates (changes) when used
- Stored in your browser as a secure cookie

**Think of it as**: A season pass that automatically renews your day pass

**Database Information Stored**:
- Which device you're using
- Your IP address
- When you last used it
- Device fingerprint for security
- Token family (related login sessions)

### 3. 🛡️ CSRF Token
**Purpose**: Protects against malicious websites trying to perform actions on your behalf

**How it works**:
- Valid for **24 hours**
- Required for actions that change data (create, update, delete)
- Automatically managed by the application
- Refreshed automatically when needed

**Think of it as**: A secret handshake that proves requests are really coming from you

---

## User Registration Process

### Step 1: User Provides Information
- **Name**: Your display name
- **Email**: Must be unique (one account per email)
- **Password**: Must meet security requirements:
  - At least 8 characters
  - One uppercase letter (A-Z)
  - One lowercase letter (a-z)
  - One number (0-9)
  - One special character (!@#$%^&*)

### Step 2: Account Creation
1. Password is encrypted (hashed) for security
2. Account is created but marked as "unverified"
3. Verification token is generated
4. Verification email is sent

### Step 3: Email Verification
1. User clicks link in email
2. System verifies the token
3. Account is marked as "verified"
4. User can now log in

**Security Note**: Unverified accounts cannot log in, preventing spam registrations.

---

## Login Process

### Standard Login Flow

#### Step 1: Credentials Check
1. User enters email and password
2. System finds user account
3. Password is verified against encrypted version
4. Account verification status is checked

#### Step 2: Two-Factor Authentication (if enabled)
- **Email Method**: 4-character code sent to email
- **Authenticator App**: 6-digit TOTP code
- **Backup Codes**: One-time emergency codes

#### Step 3: Token Generation (if authentication succeeds)
1. **Access Token** (15-min): Generated for immediate use
2. **Refresh Token** (7-day): Created and stored in database
3. **CSRF Token** (24-hour): Generated for security
4. **Session Data**: Device info, IP address, location stored

#### Step 4: Response to User
- Access token sent to frontend
- Refresh token stored as secure HTTP-only cookie
- CSRF token sent for future requests
- User redirected to main application

### Login Notification
- Email notification sent with login details:
  - Device information (Chrome on Windows)
  - IP address
  - Login timestamp
  - Can be disabled in user settings

---

## Session Management

### What is a Session?
A session represents one login instance on one device. If you log in on your phone and laptop, you have two sessions.

### Session Information Tracked
For each session, MongoSnap stores:

**Basic Information**:
- Session ID
- Token family (groups related tokens)
- Creation time
- Last used time
- Expiration time

**Device Information**:
- Browser type (Chrome, Firefox, Safari)
- Operating system (Windows, Mac, Linux)
- IP address
- Device fingerprint (unique identifier)

**Security Information**:
- Whether token has been used
- Revocation status and reason
- Successor tokens (token chain)

### Session Lifecycle

#### 1. Session Creation
- New session starts when you log in
- Unique session ID generated
- Device fingerprint created
- Initial refresh token stored

#### 2. Session Activity
- Every API request updates "last used" time
- Device fingerprint verified for security
- Access tokens refreshed automatically

#### 3. Session Management
Users can:
- **View Active Sessions**: See all devices where they're logged in
- **Revoke Individual Sessions**: Log out from specific device
- **Revoke All Sessions**: Log out from all devices (emergency)

#### 4. Session End
Sessions end when:
- User logs out manually
- Refresh token expires (7 days)
- User revokes session
- Security breach detected
- Admin revokes session

### Token Rotation Security
**What happens when you use the app**:
1. Access token expires (every 15 minutes)
2. System automatically uses refresh token
3. Old refresh token marked as "used"
4. New refresh token generated
5. Process continues seamlessly

**Security Benefit**: If someone steals an old token, it won't work because it's already been used.

---

## Two-Factor Authentication (2FA)

### What is 2FA?
Two-Factor Authentication adds an extra security layer. Even if someone knows your password, they still need the second factor to access your account.

### Available Methods

#### 1. Email-Based 2FA
**How it works**:
- 4-character hexadecimal code (0-9, A-F)
- Sent to registered email address
- Valid for 10 minutes
- Enter code to complete login

**User Experience**:
1. Enter email and password
2. System sends code to email
3. Check email and enter 4-character code
4. Access granted

#### 2. Authenticator App (TOTP)
**How it works**:
- Uses apps like Google Authenticator, Authy
- Generates 6-digit codes every 30 seconds
- Works offline
- More secure than email

**Setup Process**:
1. Enable 2FA in settings
2. Scan QR code with authenticator app
3. Enter verification code to confirm
4. Save backup codes for emergencies

**Login Process**:
1. Enter email and password
2. Enter 6-digit code from authenticator app
3. Access granted

#### 3. Backup Codes
**Purpose**: Emergency access when primary 2FA method unavailable

**How they work**:
- 10 one-time use codes generated during 2FA setup
- Each code can only be used once
- Should be stored securely (printed or password manager)
- Can be regenerated if needed

### 2FA Security Features
- **Rate Limiting**: Prevents brute force attacks
- **Token Expiration**: Codes expire quickly
- **Resend Capability**: New email codes can be requested
- **Account Recovery**: Backup codes for emergency access

---

## OAuth Social Login

### Supported Providers
- **Google**: Login with Google account
- **GitHub**: Login with GitHub account

### How OAuth Works
1. **Initiate Login**: User clicks "Login with Google/GitHub"
2. **Redirect**: Opens popup to provider (Google/GitHub)
3. **User Authorizes**: User grants permission to MongoSnap
4. **Token Exchange**: Provider sends authorization code
5. **Account Creation/Login**: MongoSnap creates account or logs in existing user
6. **Session Creation**: Same token system as regular login

### OAuth Account Features
- **No Password Required**: Uses provider's authentication
- **Email Verification**: Automatically verified through provider
- **Profile Information**: Name and email imported from provider
- **Account Linking**: Can't link to existing password-based account

### Security Considerations
- **Popup Protection**: Prevents malicious sites from hijacking
- **Origin Verification**: Only accepts responses from legitimate sources
- **Token Validation**: Verifies tokens with provider
- **Timeout Protection**: Popup closes after 5 minutes

---

## Security Features

### Rate Limiting
**Purpose**: Prevents automated attacks and abuse

**Different Limits for Different Actions**:
- **Login Attempts**: 5 per 15 minutes per IP
- **Signup Attempts**: 3 per hour per IP
- **Password Reset**: 3 per hour per IP
- **General Auth Operations**: 20 per 15 minutes per IP
- **Global Requests**: 1000 per 15 minutes per IP

### Token Security

#### Refresh Token Protection
- **Database Storage**: All tokens stored server-side
- **Token Families**: Related tokens grouped together
- **Reuse Detection**: If old token used, entire family revoked
- **Device Fingerprinting**: Detects device changes
- **Automatic Cleanup**: Expired tokens automatically deleted

#### CSRF Protection
- **Automatic Inclusion**: Added to all state-changing requests
- **Header Validation**: Verified on server side
- **Token Refresh**: New tokens provided automatically
- **Error Handling**: Graceful retry with fresh tokens

### Session Security

#### Suspicious Activity Detection
**System monitors for**:
- **Rapid Token Creation**: More than 5 tokens per hour
- **Multiple IP Addresses**: More than 10 IPs in 7 days
- **Device Changes**: Fingerprint mismatches
- **Token Reuse**: Previously used tokens

**Automated Responses**:
- **Risk Assessment**: Low/Medium/High risk levels calculated
- **Family Revocation**: All related tokens revoked on breach
- **Security Notifications**: Users alerted to suspicious activity
- **Account Protection**: Automatic logout on high risk

#### Device Monitoring
- **IP Address Tracking**: Changes logged and analyzed
- **Browser Fingerprinting**: Unique device identification
- **Location Awareness**: Unusual locations flagged
- **Session Comparison**: Cross-reference with other sessions

### Password Security
- **Bcrypt Hashing**: Industry-standard encryption
- **Salt Rounds**: 10 rounds for optimal security/performance balance
- **Strength Requirements**: Enforced complexity rules
- **No Storage**: Plaintext passwords never stored

---

## Token Lifecycle

### Access Token Journey

#### 1. Creation (Login/Refresh)
```
User logs in → Server generates JWT → Contains user ID → Expires in 15 minutes
```

#### 2. Usage (Every Request)
```
Frontend includes token → Server validates → Request processed → Response sent
```

#### 3. Expiration (15 minutes)
```
Token expires → Frontend gets 401 error → Automatic refresh triggered
```

#### 4. Refresh Process
```
Refresh token used → New access token generated → Old refresh token retired
```

### Refresh Token Journey

#### 1. Creation
```
User logs in → Token generated → Stored in database → Sent as cookie
```

#### 2. Storage Details
```javascript
{
  token: "encrypted_string",
  userId: "user_database_id", 
  family: "token_family_id",
  expiresAt: "7_days_from_creation",
  deviceInfo: {
    userAgent: "Chrome 120.0 on Windows",
    ipAddress: "192.168.1.100",
    deviceFingerprint: "unique_hash"
  },
  securityInfo: {
    isUsed: false,
    isRevoked: false,
    lastUsedAt: "timestamp",
    revokedBy: null
  }
}
```

#### 3. Usage (Every 15 minutes)
```
Access token expires → Refresh token validated → New tokens generated → Old token marked used
```

#### 4. Security Checks
```
Validate JWT → Check database record → Verify not used/revoked → Check expiration
```

#### 5. Rotation
```
Mark old token used → Generate new token → Link via successor → Update database
```

#### 6. Cleanup
```
Daily process → Remove expired tokens → Update statistics → Free database space
```

### CSRF Token Journey

#### 1. Generation
```
User authenticated → Generate random token → Store in database → Return to frontend
```

#### 2. Storage
```
Database: Associated with user account
Frontend: Stored in localStorage
```

#### 3. Usage
```
State-changing request → Include in X-CSRF-Token header → Server validates → Request processed
```

#### 4. Refresh
```
Token expires → New token generated → Automatic retry with new token
```

---

## User Experience Flows

### Flow 1: New User Registration

**User's Experience**:
1. Visit MongoSnap website
2. Click "Sign Up"
3. Enter name, email, and password
4. See password strength indicator
5. Submit form
6. See "Check your email" message
7. Find email in inbox
8. Click verification link
9. Redirected to login page
10. Enter credentials to log in

**Behind the Scenes**:
```
Form submission → Password validation → Hash password → Create user record 
→ Generate verification token → Send email → Wait for click → Verify token 
→ Mark account verified → Allow login
```

### Flow 2: Returning User Login

**User's Experience**:
1. Visit MongoSnap
2. Enter email and password
3. Click login
4. (If 2FA enabled) Enter authentication code
5. Automatically redirected to dashboard
6. Can use application normally

**Behind the Scenes**:
```
Credentials check → 2FA verification → Generate all tokens → Store refresh token 
→ Send login notification → Create session record → Return access token 
→ Frontend stores tokens → Redirect to dashboard
```

### Flow 3: Using the Application

**User's Experience**:
1. Click to connect to database
2. Enter database credentials
3. Browse database collections
4. Run queries
5. Save query results
6. View query history

**Behind the Scenes**:
```
Every action → Check access token → If expired, use refresh token → Get new access token 
→ Include CSRF token → Validate all tokens → Process request → Update session activity 
→ Return response
```

### Flow 4: Session Management

**User's Experience**:
1. Go to account settings
2. View "Active Sessions" section
3. See list of devices/locations
4. Click "Revoke" on old session
5. Confirm action
6. Session removed from list

**Behind the Scenes**:
```
Load sessions → Query database for user tokens → Format for display → Show to user 
→ Revoke action → Mark tokens revoked → Clear cookies → Update display
```

### Flow 5: Logout Process

**User's Experience**:
1. Click logout button
2. Immediately redirected to login page
3. Previous session no longer works

**Behind the Scenes**:
```
Logout request → Revoke refresh token → Clear cookie → Close database connections 
→ Clear frontend tokens → Redirect to login → Session ended
```

### Flow 6: Security Breach Response

**Automatic System Response**:
1. Detect token reuse
2. Revoke entire token family
3. Log security event
4. Update risk assessment
5. (Optional) Notify user

**User Experience**:
1. Suddenly logged out
2. See "Security breach detected" message
3. Must log in again
4. All devices logged out for safety

---

## Troubleshooting Common Issues

### Issue 1: "Token Missing" Error
**Symptoms**: Can't access protected features
**Causes**: 
- Logged out automatically
- Browser cleared cookies
- Token expired

**Solutions**:
1. Log in again
2. Check if cookies enabled
3. Contact support if persists

### Issue 2: "CSRF Token Invalid" Error
**Symptoms**: Forms don't submit, get 403 errors
**Causes**:
- CSRF token expired
- Network issues
- Browser issues

**Solutions**:
1. Refresh the page
2. Try logging out and back in
3. Clear browser cache

### Issue 3: "Too Many Requests" Error
**Symptoms**: Can't perform actions, rate limit messages
**Causes**:
- Too many failed login attempts
- Automated tools/scripts
- Network sharing IP with others

**Solutions**:
1. Wait 15 minutes
2. Check for malware/scripts
3. Contact support if legitimate use

### Issue 4: Sessions Not Showing
**Symptoms**: Active sessions list empty or incomplete
**Causes**:
- Database cleanup removed old sessions
- Privacy mode browsers
- Cookie settings

**Solutions**:
1. Normal behavior for privacy mode
2. Check cookie settings
3. Re-login to create new session

### Issue 5: 2FA Code Not Working
**Symptoms**: Authentication codes rejected
**Causes**:
- Code expired (10 minutes for email, 30 seconds for TOTP)
- Clock synchronization issues
- Typed incorrectly

**Solutions**:
1. Request new email code
2. Check device time/timezone
3. Use backup codes
4. Contact support to reset 2FA

---

## Technical Implementation

### Backend Architecture

#### Database Schema
**User Model**:
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  isVerified: Boolean,
  twoFactorEnabled: Boolean,
  csrfToken: String,
  csrfTokenExpiresAt: Date,
  // OAuth fields
  oauthProvider: String,
  oauthId: String,
  // 2FA fields
  twoFactorSecret: String,
  backupCodes: [{ code: String, used: Boolean }]
}
```

**RefreshToken Model**:
```javascript
{
  token: String (unique),
  userId: ObjectId (reference to User),
  family: String (token family identifier),
  isUsed: Boolean,
  isRevoked: Boolean,
  expiresAt: Date,
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    deviceFingerprint: String
  },
  securityInfo: {
    revokedBy: String,
    revokedAt: Date,
    successorToken: String
  }
}
```

#### API Endpoints
**Authentication Routes**:
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `POST /api/auth/refresh` - Get new access token
- `GET /api/auth/me` - Get user information

**Session Management**:
- `GET /api/auth/active-sessions` - List user sessions
- `POST /api/auth/revoke-session` - Revoke specific session
- `POST /api/auth/revoke-all-sessions` - Revoke all sessions

**Security Endpoints**:
- `GET /api/auth/csrf-token` - Get new CSRF token
- `GET /api/auth/session-analytics` - Security analytics
- `GET /api/auth/security-monitor` - Threat monitoring

#### Middleware Protection
1. **Rate Limiting**: Applied to all routes with different limits
2. **Token Verification**: Validates JWT tokens
3. **CSRF Validation**: Checks CSRF tokens for state-changing operations
4. **Session Tracking**: Updates token usage statistics

### Frontend Architecture

#### Authentication Context
The UserContext provides:
- User authentication state
- Token management
- Automatic token refresh
- CSRF token handling
- Session persistence

#### Automatic Behaviors
- **Token Refresh**: Happens automatically when access token expires
- **CSRF Inclusion**: Added to all state-changing requests
- **Error Handling**: Graceful handling of authentication errors
- **Session Persistence**: User stays logged in across browser sessions

#### Security Features
- **Secure Storage**: Sensitive tokens in HTTP-only cookies
- **Automatic Cleanup**: Tokens cleared on logout
- **Error Recovery**: Automatic retry with fresh tokens
- **Session Validation**: Regular verification of authentication state

### Security Best Practices Implemented

1. **Token Security**:
   - Short-lived access tokens (15 minutes)
   - Secure refresh token storage
   - Automatic token rotation
   - Device fingerprinting

2. **Password Security**:
   - Strong password requirements
   - Bcrypt hashing with salt
   - No plaintext storage
   - Password reset with tokens

3. **Session Security**:
   - Comprehensive session tracking
   - Suspicious activity detection
   - Automatic cleanup of stale sessions
   - Multiple session management

4. **Network Security**:
   - HTTPS-only communication
   - CSRF protection
   - Rate limiting
   - Origin validation

5. **Privacy Protection**:
   - Minimal data collection
   - Secure cookie settings
   - Optional login notifications
   - User-controlled session management

---

## Summary

MongoSnap's authentication system provides enterprise-grade security while maintaining a smooth user experience. The multi-token approach ensures both security and usability:

- **Access tokens** provide immediate, short-term access
- **Refresh tokens** enable long-term sessions without compromising security
- **CSRF tokens** protect against cross-site attacks
- **Session management** gives users control over their account security
- **2FA and OAuth** provide additional security options
- **Comprehensive monitoring** detects and responds to security threats

This system protects user accounts while allowing seamless access to MongoSnap's database management features. The automatic token management means users rarely need to think about authentication after the initial login, while the security features work behind the scenes to keep accounts safe.