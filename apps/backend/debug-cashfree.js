const { getCashFreeConfig, generateHeaders, createOrder } = require('./utils/cashfreeHelper');

async function debugCashFreeAPI() {
    console.log('🔍 Debugging CashFree API Call...\n');
    
    // Test configuration
    console.log('1. Testing Configuration:');
    const config = getCashFreeConfig();
    console.log('   Config:', {
        baseUrl: config.baseUrl,
        clientId: config.clientId ? `${config.clientId.substring(0, 6)}...` : 'MISSING',
        clientSecret: config.clientSecret ? `${config.clientSecret.substring(0, 6)}...` : 'MISSING',
        apiVersion: config.apiVersion
    });
    
    if (!config.clientId || !config.clientSecret) {
        console.log('   ❌ Configuration incomplete');
        return;
    }
    
    console.log('   ✅ Configuration looks good\n');
    
    // Test headers generation
    console.log('2. Testing Headers Generation:');
    const headers = generateHeaders(config, 'test_order_123');
    console.log('   Generated headers:', headers);
    console.log('   API Version header present:', !!headers['x-api-version']);
    console.log('   API Version value:', headers['x-api-version']);
    
    // Test order creation
    console.log('\n3. Testing Order Creation:');
    const testOrderData = {
        order_id: `DEBUG_${Date.now()}`,
        order_amount: 1.00,
        order_currency: 'INR',
        customer_id: 'debug_user_123',
        customer_phone: '9876543210',
        customer_email: 'debug@example.com',
        customer_name: 'Debug User',
        return_url: 'https://example.com/success',
        notify_url: 'https://example.com/webhook',
        subscription_plan: 'snapx',
        subscription_duration: 30
    };
    
    try {
        const orderResponse = await createOrder(testOrderData);
        
        if (orderResponse.success) {
            console.log('   ✅ Order created successfully');
            console.log('   Response:', orderResponse.data);
        } else {
            console.log('   ❌ Order creation failed');
            console.log('   Error:', orderResponse.error);
        }
        
    } catch (error) {
        console.log('   ❌ Exception during order creation:', error.message);
        if (error.response) {
            console.log('   Response status:', error.response.status);
            console.log('   Response data:', error.response.data);
            console.log('   Response headers:', error.response.headers);
        }
    }
    
    console.log('\n🏁 Debug completed');
}

// Run the debug
debugCashFreeAPI().catch(console.error); 