const { getCashFreeConfig, createOrder } = require('./utils/cashfreeHelper');

async function testCashFreeProduction() {
    console.log('🧪 Testing CashFree Production Integration...\n');
    
    // Test configuration
    console.log('1. Testing Configuration:');
    const config = getCashFreeConfig();
    console.log('   Base URL:', config.baseUrl);
    console.log('   Client ID present:', !!config.clientId);
    console.log('   Client Secret present:', !!config.clientSecret);
    console.log('   API Version:', config.apiVersion);
    
    if (!config.clientId || !config.clientSecret) {
        console.log('   ❌ Configuration incomplete - missing credentials');
        console.log('   Please set CASHFREE_CLIENT_ID_PROD and CASHFREE_CLIENT_SECRET_PROD environment variables');
        return;
    }
    
    console.log('   ✅ Configuration looks good\n');
    
    // Test order creation
    console.log('2. Testing Order Creation:');
    const testOrderData = {
        order_id: `TEST_PROD_${Date.now()}`,
        order_amount: 1.00,
        order_currency: 'INR',
        customer_id: 'test_user_123',
        customer_phone: '9876543210',
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        return_url: 'https://example.com/success',
        notify_url: 'https://example.com/webhook',
        subscription_plan: 'snapx',
        subscription_duration: 30
    };
    
    try {
        const orderResponse = await createOrder(testOrderData);
        
        if (orderResponse.success) {
            console.log('   ✅ Order created successfully');
            console.log('   Order ID:', orderResponse.data.order_id);
            console.log('   Payment Session ID:', orderResponse.data.payment_session_id);
            console.log('   Order Status:', orderResponse.data.order_status);
            console.log('   \n🎉 CashFree Production Integration is working!');
        } else {
            console.log('   ❌ Order creation failed:', orderResponse.error);
            console.log('   \n🔍 Check your CashFree credentials and API access');
        }
        
    } catch (error) {
        console.log('   ❌ Error during testing:', error.message);
        console.log('   \n🔍 Check your network connection and CashFree service status');
    }
    
    console.log('\n🏁 CashFree production test completed');
}

// Run the test
testCashFreeProduction().catch(console.error); 