const mongoose = require('mongoose');
require('dotenv').config();

async function fixPaymentIndexes() {
    try {
        console.log('🔧 Fixing PaymentTransaction indexes...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get the PaymentTransaction collection
        const db = mongoose.connection.db;
        const collection = db.collection('paymenttransactions');
        
        // Drop existing indexes that might cause conflicts
        console.log('🗑️ Dropping existing indexes...');
        try {
            await collection.dropIndex('txnid_1');
            console.log('✅ Dropped txnid_1 index');
        } catch (error) {
            console.log('ℹ️ txnid_1 index not found or already dropped');
        }
        
        try {
            await collection.dropIndex('mihpayid_1');
            console.log('✅ Dropped mihpayid_1 index');
        } catch (error) {
            console.log('ℹ️ mihpayid_1 index not found or already dropped');
        }
        
        // Create new sparse indexes
        console.log('📊 Creating new sparse indexes...');
        
        // Create sparse index for txnid
        await collection.createIndex({ txnid: 1 }, { sparse: true });
        console.log('✅ Created sparse index for txnid');
        
        // Create sparse index for mihpayid
        await collection.createIndex({ mihpayid: 1 }, { sparse: true });
        console.log('✅ Created sparse index for mihpayid');
        
        // Create other necessary indexes
        await collection.createIndex({ userId: 1, payment_status: 1 });
        console.log('✅ Created index for userId + payment_status');
        
        await collection.createIndex({ order_id: 1 });
        console.log('✅ Created index for order_id');
        
        await collection.createIndex({ cf_payment_id: 1 });
        console.log('✅ Created index for cf_payment_id');
        
        await collection.createIndex({ createdAt: -1 });
        console.log('✅ Created index for createdAt');
        
        // List all indexes to verify
        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
        console.log('\n✅ PaymentTransaction indexes fixed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the fix
fixPaymentIndexes(); 