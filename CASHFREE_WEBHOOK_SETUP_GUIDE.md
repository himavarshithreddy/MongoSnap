# CashFree Webhook Setup Guide

## Overview
This guide will walk you through setting up webhooks in the CashFree merchant dashboard to handle payment notifications for your MongoSnap application.

---

## 🔧 Prerequisites

Before setting up webhooks, ensure you have:
- ✅ CashFree merchant account (test/production)
- ✅ Your application deployed and accessible via HTTPS
- ✅ CashFree credentials configured in your environment

---

## 📋 Step-by-Step Webhook Setup

### Step 1: Access CashFree Merchant Dashboard

1. **Login to CashFree Dashboard**
   - Go to [CashFree Merchant Dashboard](https://merchant.cashfree.com)
   - Login with your merchant credentials

2. **Navigate to Webhook Settings**
   - Click on **"Settings"** in the left sidebar
   - Select **"Webhooks"** from the settings menu

### Step 2: Configure Webhook URL

1. **Add New Webhook**
   - Click **"Add Webhook"** or **"Create Webhook"**
   - You'll see a form to configure webhook settings

2. **Enter Webhook Details**
   ```
   Webhook URL: https://your-domain.com/api/payment/webhook
   
   Note: Replace 'your-domain.com' with your actual domain
   ```

3. **Select Events to Monitor**
   Enable the following webhook events:
   - ✅ **PAYMENT_SUCCESS_WEBHOOK** - When payment is successful
   - ✅ **PAYMENT_FAILED_WEBHOOK** - When payment fails
   - ✅ **PAYMENT_USER_DROPPED_WEBHOOK** - When user abandons payment

### Step 3: Configure Webhook Secret

1. **Generate Webhook Secret**
   - CashFree will provide a webhook secret key
   - Copy this secret key (you'll need it for your environment variables)

2. **Add to Environment Variables**
   ```env
   # For Test Environment
   CASHFREE_WEBHOOK_SECRET_TEST=your_webhook_secret_from_dashboard
   
   # For Production Environment
   CASHFREE_WEBHOOK_SECRET_PROD=your_webhook_secret_from_dashboard
   ```

### Step 4: Test Webhook Configuration

1. **Enable Test Mode**
   - Toggle **"Test Mode"** to ON
   - This allows you to test webhooks without real payments

2. **Send Test Webhook**
   - Click **"Send Test Webhook"** or **"Test"** button
   - CashFree will send a test webhook to your URL

3. **Verify Webhook Reception**
   - Check your application logs for webhook reception
   - Verify the webhook signature is valid
   - Ensure your application responds with HTTP 200

### Step 5: Configure Production Settings

1. **Switch to Production**
   - Once testing is complete, switch to **"Production Mode"**
   - Update webhook URL if needed for production domain

2. **Verify Production Webhook**
   - Send a test webhook in production mode
   - Ensure everything works correctly

---

## 🔍 Webhook Event Details

### PAYMENT_SUCCESS_WEBHOOK
```json
{
  "type": "PAYMENT_SUCCESS_WEBHOOK",
  "data": {
    "order": {
      "order_id": "MONGOSNAP_1234567890_1234",
      "order_amount": 1.00,
      "order_currency": "INR",
      "order_status": "PAID"
    },
    "payment": {
      "cf_payment_id": "CF_PAYMENT_ID_123",
      "payment_status": "SUCCESS",
      "payment_method": "card",
      "payment_channel": "web",
      "payment_gateway_details": {
        "gateway_order_id": "GATEWAY_ORDER_ID",
        "gateway_payment_id": "GATEWAY_PAYMENT_ID",
        "gateway_status": "SUCCESS",
        "gateway_time": "2024-12-01T10:30:00Z",
        "bank_reference": "BANK_REF_123"
      }
    },
    "customer_details": {
      "customer_id": "CUST_USER_ID_123",
      "customer_phone": "+919876543210",
      "customer_name": "John Doe",
      "customer_email": "john@example.com"
    }
  }
}
```

### PAYMENT_FAILED_WEBHOOK
```json
{
  "type": "PAYMENT_FAILED_WEBHOOK",
  "data": {
    "order": {
      "order_id": "MONGOSNAP_1234567890_1234",
      "order_amount": 1.00,
      "order_currency": "INR",
      "order_status": "ACTIVE"
    },
    "payment": {
      "cf_payment_id": "CF_PAYMENT_ID_123",
      "payment_status": "FAILED",
      "payment_method": "card",
      "payment_channel": "web",
      "error_details": {
        "error_code": "PAYMENT_DECLINED",
        "error_description": "Payment was declined by the bank",
        "error_reason": "INSUFFICIENT_FUNDS",
        "error_source": "BANK",
        "error_type": "PAYMENT_ERROR"
      }
    },
    "customer_details": {
      "customer_id": "CUST_USER_ID_123",
      "customer_phone": "+919876543210",
      "customer_name": "John Doe",
      "customer_email": "john@example.com"
    }
  }
}
```

### PAYMENT_USER_DROPPED_WEBHOOK
```json
{
  "type": "PAYMENT_USER_DROPPED_WEBHOOK",
  "data": {
    "order": {
      "order_id": "MONGOSNAP_1234567890_1234",
      "order_amount": 1.00,
      "order_currency": "INR",
      "order_status": "ACTIVE"
    },
    "customer_details": {
      "customer_id": "CUST_USER_ID_123",
      "customer_phone": "+919876543210",
      "customer_name": "John Doe",
      "customer_email": "john@example.com"
    }
  }
}
```

---

## 🔐 Webhook Security

### Signature Verification
Your application automatically verifies webhook signatures using the secret key:

```javascript
// This is already implemented in your cashfreeHelper.js
const verifyWebhookSignature = (webhookData, signature, isProduction = false) => {
    const webhookSecret = isProduction 
        ? process.env.CASHFREE_WEBHOOK_SECRET_PROD 
        : process.env.CASHFREE_WEBHOOK_SECRET_TEST;
    
    const signatureString = JSON.stringify(webhookData);
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signatureString)
        .digest('hex');
    
    return signature === expectedSignature;
};
```

### Security Best Practices
1. **Always verify webhook signatures**
2. **Use HTTPS for webhook URLs**
3. **Keep webhook secrets secure**
4. **Implement idempotency to prevent duplicate processing**
5. **Log all webhook events for debugging**

---

## 🧪 Testing Your Webhook Setup

### 1. Test Configuration Endpoint
Use your application's test endpoint to verify configuration:
```
GET https://your-domain.com/api/payment/test-config
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "environment": "test",
    "client_id_configured": true,
    "client_secret_configured": true,
    "webhook_secret_configured": true
  }
}
```

### 2. Test Payment Flow
1. Create a test order through your application
2. Complete payment using CashFree test cards
3. Verify webhook is received and processed
4. Check user subscription is activated

### 3. Test Cards for Sandbox
- **Success Card**: `4111 1111 1111 1111`
- **Failure Card**: `4000 0000 0000 0002`
- **Expiry**: Any future date
- **CVV**: Any 3 digits

---

## 🚨 Troubleshooting

### Common Issues

#### 1. Webhook Not Received
- **Check URL**: Ensure webhook URL is accessible and returns HTTP 200
- **Check Firewall**: Ensure your server allows incoming webhook requests
- **Check Logs**: Monitor application logs for webhook reception

#### 2. Signature Verification Failed
- **Check Secret**: Verify webhook secret is correctly configured
- **Check Environment**: Ensure using correct secret for test/production
- **Check Implementation**: Verify signature verification logic

#### 3. Webhook Processing Errors
- **Check Database**: Ensure database connection is working
- **Check User Model**: Verify user subscription update logic
- **Check Logs**: Monitor application logs for processing errors

### Debug Commands
```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: test_signature" \
  -d '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{}}'

# Check application logs
tail -f /path/to/your/app/logs/application.log
```

---

## 📊 Monitoring Webhooks

### 1. CashFree Dashboard
- Monitor webhook delivery status in CashFree dashboard
- Check webhook success/failure rates
- View webhook retry attempts

### 2. Application Logs
Monitor these log entries in your application:
```
CashFree webhook received
Webhook signature verification: true/false
Webhook processed successfully
User subscription updated
```

### 3. Database Monitoring
Check these database collections:
- `paymenttransactions` - Payment records
- `users` - User subscription status

---

## ✅ Webhook Setup Checklist

- [ ] CashFree merchant account created
- [ ] Webhook URL configured in dashboard
- [ ] Webhook events selected (SUCCESS, FAILED, USER_DROPPED)
- [ ] Webhook secret generated and added to environment variables
- [ ] Test webhook sent and verified
- [ ] Production webhook configured
- [ ] Application tested with real payment flow
- [ ] Monitoring and logging set up

---

## 🆘 Support

If you encounter issues with webhook setup:

1. **Check CashFree Documentation**: [CashFree Webhook Docs](https://www.cashfree.com/docs/api-reference/payments/previous/v2023-08-01/payments/webhooks)
2. **Contact CashFree Support**: [CashFree Support](https://www.cashfree.com/support)
3. **Review Application Logs**: Check your application logs for detailed error messages
4. **Test Configuration**: Use the `/api/payment/test-config` endpoint

---

**Note**: This webhook setup is essential for your payment system to work correctly. Ensure all steps are completed before going live with payments. 