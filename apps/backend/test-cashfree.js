const { getCashFreeConfig, createOrder, getOrder } = require('./utils/cashfreeHelper');

async function testCashFreeIntegration() {
    console.log('🧪 Testing CashFree Integration...\n');
    
    // Test configuration
    console.log('1. Testing Configuration:');
    const config = getCashFreeConfig(false); // Test environment
    console.log('   Base URL:', config.baseUrl);
    console.log('   Client ID present:', !!config.clientId);
    console.log('   Client Secret present:', !!config.clientSecret);
    console.log('   API Version:', config.apiVersion);
    
    if (!config.clientId || !config.clientSecret) {
        console.log('   ❌ Configuration incomplete - missing credentials');
        console.log('   Please set CASHFREE_CLIENT_ID_TEST and CASHFREE_CLIENT_SECRET_TEST environment variables');
        return;
    }
    
    console.log('   ✅ Configuration looks good\n');
    
    // Test order creation
    console.log('2. Testing Order Creation:');
    const testOrderData = {
        order_id: `TEST_${Date.now()}`,
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
        const orderResponse = await createOrder(testOrderData, false);
        
        if (orderResponse.success) {
            console.log('   ✅ Order created successfully');
            console.log('   Order ID:', orderResponse.data.order_id);
            console.log('   Payment Session ID:', orderResponse.data.payment_session_id);
            console.log('   Order Status:', orderResponse.data.order_status);
            
            // Test order retrieval
            console.log('\n3. Testing Order Retrieval:');
            const getOrderResponse = await getOrder(orderResponse.data.order_id, false);
            
            if (getOrderResponse.success) {
                console.log('   ✅ Order retrieved successfully');
                console.log('   Retrieved Order ID:', getOrderResponse.data.order_id);
                console.log('   Retrieved Status:', getOrderResponse.data.order_status);
            } else {
                console.log('   ❌ Failed to retrieve order:', getOrderResponse.error);
            }
            
        } else {
            console.log('   ❌ Order creation failed:', orderResponse.error);
        }
        
    } catch (error) {
        console.log('   ❌ Error during testing:', error.message);
    }
    
    console.log('\n🏁 CashFree integration test completed');
}

// Run the test
testCashFreeIntegration().catch(console.error); 