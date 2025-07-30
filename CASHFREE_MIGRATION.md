# CashFree Payment Gateway Migration

This document outlines the complete migration from PayU to CashFree payment gateway for the MongoSnap application.

## 🚀 Overview

The payment gateway has been successfully migrated from PayU to CashFree Payments API v2023-08-01. This migration includes:

- Complete backend API integration
- Frontend payment flow updates
- Database schema updates
- Webhook handling
- Security implementation

## 📋 Changes Made

### Backend Changes

1. **New CashFree Helper** (`apps/backend/utils/cashfreeHelper.js`)
   - Order creation and management
   - Payment verification
   - Webhook signature verification
   - API configuration management

2. **Updated Payment Routes** (`apps/backend/routes/payment.js`)
   - Replaced PayU endpoints with CashFree equivalents
   - Updated order creation flow
   - Enhanced webhook handling
   - Added order status verification

3. **Database Schema Updates** (`apps/backend/models/PaymentTransaction.js`)
   - Added CashFree-specific fields
   - Maintained backward compatibility
   - Updated indexes for performance

4. **Middleware Updates** (`apps/backend/routes/middleware.js`)
   - Added raw body capture for webhook signature verification

### Frontend Changes

1. **Payment Component** (`apps/frontend/src/components/PayUPayment.jsx`)
   - Renamed to CashFreePayment (export name)
   - Updated payment flow to use CashFree session IDs
   - Modified form submission process

2. **Payment Pages**
   - Updated PaymentSuccess.jsx for CashFree response format
   - Updated PaymentFailure.jsx for CashFree error handling
   - Modified Pricing.jsx to use new component

## 🔧 Environment Variables

Add the following environment variables to your `.env` file:

```bash
# CashFree Production Environment
CASHFREE_CLIENT_ID_PROD=your_production_client_id
CASHFREE_CLIENT_SECRET_PROD=your_production_client_secret
```

## 🏗️ Setup Instructions

### 1. CashFree Account Setup

1. Create a CashFree merchant account at [cashfree.com](https://cashfree.com)
2. Navigate to the Payment Gateway section
3. Generate API credentials for both test and production environments
4. Configure webhook endpoints in the CashFree dashboard:
   - **Webhook URL**: `https://yourdomain.com/api/payment/webhook`
   - **Events**: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`

### 2. Environment Configuration

1. Add the environment variables listed above
2. Ensure your domain is whitelisted in CashFree dashboard

### 3. Database Migration

The database schema has been updated to support CashFree fields while maintaining backward compatibility. No manual migration is required.

### 4. Testing

Run the test script to verify the integration:

```bash
cd apps/backend
node test-cashfree.js
```

## 🔄 Payment Flow

### 1. Order Creation
```
Frontend → POST /api/payment/create-order
Backend → Creates CashFree order
Response → Returns payment_session_id
```

### 2. Payment Processing
```
Frontend → Redirects to CashFree checkout with payment_session_id
CashFree → Processes payment
CashFree → Redirects to return_url with order details
```

### 3. Payment Verification
```
Frontend → POST /api/payment/verify
Backend → Fetches order status from CashFree
Backend → Updates user subscription if successful
```

### 4. Webhook Processing
```
CashFree → POST /api/payment/webhook
Backend → Verifies webhook signature
Backend → Updates transaction and user subscription
```

## 🔐 Security Features

1. **Webhook Signature Verification**
   - HMAC-SHA256 signature validation
   - Timestamp-based verification
   - Raw body processing for accurate signatures

2. **API Authentication**
   - Client ID and Secret authentication
   - Environment-specific credentials
   - Request ID tracking

3. **Data Validation**
   - Order data validation
   - Phone number format validation
   - Email format validation

## 📊 Database Schema

### New CashFree Fields

```javascript
// CashFree Order details
order_id: String (required, unique)
payment_session_id: String
order_status: ['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED']
payment_status: ['SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED']

// CashFree Payment details
cf_payment_id: String
payment_method: String
payment_gateway_details: Object
bank_reference: String
upi_id: String

// Card details (if applicable)
card_number: String (last 4 digits)
card_network: String
card_type: String
card_country: String
card_bank_name: String

// Webhook details
webhookEventType: ['PAYMENT_SUCCESS_WEBHOOK', 'PAYMENT_FAILED_WEBHOOK', 'PAYMENT_USER_DROPPED_WEBHOOK']
```

### Legacy PayU Fields (Maintained for Backward Compatibility)

All PayU-specific fields are maintained in the database for backward compatibility and data preservation.

## 🧪 Testing

### Manual Testing

1. **Test Order Creation**
   ```bash
   curl -X POST http://localhost:3000/api/payment/create-order \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"subscriptionPlan": "snapx", "phone": "9876543210"}'
   ```

2. **Test Order Status**
   ```bash
   curl -X GET http://localhost:3000/api/payment/order-status/ORDER_ID
   ```

3. **Test Configuration**
   ```bash
   curl -X GET http://localhost:3000/api/payment/test-config
   ```

### Automated Testing

Run the provided test script:

```bash
cd apps/backend
node test-cashfree.js
```

## 🚨 Important Notes

1. **Environment Variables**: Ensure all CashFree credentials are properly set
2. **Webhook Configuration**: Configure webhooks in CashFree dashboard
3. **Domain Whitelisting**: Add your domain to CashFree whitelist
4. **SSL Certificate**: Ensure HTTPS is enabled for webhook endpoints
5. **Rate Limiting**: CashFree has rate limits; implement appropriate error handling

## 🔍 Troubleshooting

### Common Issues

1. **"Configuration missing" error**
   - Check environment variables are set correctly
   - Verify environment (test vs production)

2. **"Webhook signature verification failed"**
   - Ensure raw body middleware is applied
   - Check webhook secret key matches

3. **"Order not found" error**
   - Verify order ID format
   - Check CashFree dashboard for order status

4. **Payment session issues**
   - Ensure payment_session_id is valid
   - Check CashFree session expiration

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=cashfree:*
```

## 📈 Monitoring

Monitor the following metrics:

1. **Order Creation Success Rate**
2. **Payment Success Rate**
3. **Webhook Delivery Success Rate**
4. **API Response Times**
5. **Error Rates by Error Type**

## 🔄 Rollback Plan

If rollback is needed:

1. Restore PayU environment variables
2. Revert payment routes to PayU implementation
3. Restore PayU helper utilities
4. Update frontend components
5. Test payment flow

## 📞 Support

For CashFree-specific issues:
- CashFree Documentation: [docs.cashfree.com](https://docs.cashfree.com)
- CashFree Support: Available through merchant dashboard

For application-specific issues:
- Check application logs
- Review webhook delivery status
- Verify database transaction records

---

**Migration Completed**: ✅  
**Last Updated**: $(date)  
**Version**: CashFree v2023-08-01 