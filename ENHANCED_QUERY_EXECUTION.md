# Enhanced MongoDB Query Execution System

## Overview

MongoSnap now supports enhanced MongoDB query execution with full support for asynchronous and deeply nested operations. This system allows you to write complex MongoDB queries that use the results of one query as input to another, all within a secure sandboxed environment.

## Key Features

- **Full Async Support**: All MongoDB operations are fully asynchronous and can be awaited
- **Nested Queries**: Use the result of one query directly in another query
- **Secure Sandboxing**: Execution happens in a secure VM context with limited access
- **Enhanced Metadata**: Automatic extraction of collection names and operations
- **Performance Monitoring**: Built-in execution time and document count tracking

## Supported Query Patterns

### 1. Simple Queries
```javascript
// Find all users
db.users.find({})

// Find one document
db.users.findOne({ email: "user@example.com" })

// Count documents
db.users.countDocuments({ status: "active" })
```

### 2. Nested Asynchronous Queries
```javascript
// Use result of one query in another - THE KEY IMPROVEMENT
db.userusages.updateOne(
  { userId: (await db.users.findOne({ email: "abc@x.com" }))._id },
  { $set: { "status": "updated" } }
)

// Complex nested query with multiple awaits
db.orders.insertOne({
  userId: (await db.users.findOne({ email: "customer@example.com" }))._id,
  productId: (await db.products.findOne({ sku: "ABC123" }))._id,
  quantity: 2,
  createdAt: new Date()
})

// ❌ INCORRECT: Can't chain .map() on async operations
db.userusages.updateMany(
  { userId: { $in: db.users.find({ email: /@outlook\.com$/ }).map(user => user._id) } },
  { $set: { status: "updated" } }
)

// ✅ CORRECT: Use await first, then chain array methods
const outlookUsers = await db.users.find({ email: { $regex: /@outlook\.com$/ } });
const userIds = outlookUsers.map(user => user._id);
db.userusages.updateMany(
  { userId: { $in: userIds } },
  { $set: { status: "updated" } }
)

// ✅ ALTERNATIVE: One-liner with proper await
db.userusages.updateMany(
  { userId: { $in: (await db.users.find({ email: { $regex: /@outlook\.com$/ } })).map(user => user._id) } },
  { $set: { status: "updated" } }
)
```

### 3. Array Operations with Nested Queries
```javascript
// Find orders for a specific user by email
db.orders.find({
  userId: (await db.users.findOne({ email: "user@example.com" }))._id
})

// Update multiple documents using nested query result
db.notifications.updateMany(
  { userId: (await db.users.findOne({ email: "user@example.com" }))._id },
  { $set: { read: true } }
)
```

### 4. Aggregation with Nested Queries
```javascript
// Complex aggregation using nested query results
db.orders.aggregate([
  {
    $match: {
      userId: (await db.users.findOne({ email: "user@example.com" }))._id
    }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
    }
  }
])
```

### 5. Collection Names with Special Characters
```javascript
// Use getCollection for collection names with special characters
db.getCollection('user-profiles').findOne({ userId: ObjectId("...") })

// Or use the collection method
db.collection('my-collection').find({})
```

## MongoDB Utilities Available

### Data Types
- `ObjectId(id)` - Create MongoDB ObjectId
- `Date()` - JavaScript Date constructor
- `ISODate(dateString)` - Create date from ISO string
- `NumberLong(value)` - Long integer values
- `NumberInt(value)` - Integer values
- `NumberDecimal(value)` - Decimal values

### Example Usage
```javascript
// Using ObjectId in queries
db.users.findOne({ _id: ObjectId("507f1f77bcf86cd799439011") })

// Using dates
db.events.find({
  createdAt: { $gte: ISODate("2023-01-01") }
})

// Complex query with multiple utilities
db.transactions.insertOne({
  _id: ObjectId(),
  userId: (await db.users.findOne({ email: "user@example.com" }))._id,
  amount: NumberDecimal("99.99"),
  status: "pending",
  createdAt: new Date()
})
```

## Advanced Examples

### Example 1: User Management Workflow
```javascript
// Create a new user and immediately assign them to a group
const newUser = await db.users.insertOne({
  email: "newuser@example.com",
  name: "New User",
  createdAt: new Date()
});

// Add user to default group using the inserted user's ID
db.userGroups.updateOne(
  { name: "default" },
  { $push: { userIds: newUser.insertedId } }
)
```

### Example 2: Complex Data Migration
```javascript
// Migrate user preferences based on existing data
const activeUsers = await db.users.find({ status: "active" });

// Process each user (Note: In real scenarios, consider batch operations)
activeUsers.forEach(async (user) => {
  await db.userPreferences.insertOne({
    userId: user._id,
    theme: "light",
    notifications: true,
    language: "en",
    createdAt: new Date()
  });
});
```

### Example 3: Analytics Query
```javascript
// Get user engagement statistics
const totalUsers = await db.users.countDocuments({});
const activeUsers = await db.users.countDocuments({ lastLogin: { $gte: ISODate("2023-01-01") } });

// Return computed result
({
  totalUsers: totalUsers,
  activeUsers: activeUsers,
  engagementRate: (activeUsers / totalUsers * 100).toFixed(2) + "%"
})
```

### Example 4: Bulk Operations with Array Processing
```javascript
// Find all users with specific domain and reset their quota
const outlookUsers = await db.users.find({ 
  email: { $regex: /@outlook\.com$/i } 
});

// Extract user IDs for bulk update
const userIds = outlookUsers.map(user => user._id);

// Bulk update using the extracted IDs
const result = await db.userusages.updateMany(
  { userId: { $in: userIds } },
  { $set: { "aiGeneration.daily.count": 0 } }
);

return {
  foundUsers: outlookUsers.length,
  updatedRecords: result.modifiedCount,
  userEmails: outlookUsers.map(u => u.email)
};
```

### Example 5: Complex Data Processing Pipeline
```javascript
// Multi-step data processing with proper async handling
const activeUsers = await db.users.find({ status: "active" });

// Process each user's data
const userStats = await Promise.all(
  activeUsers.map(async (user) => {
    const orders = await db.orders.find({ userId: user._id });
    const totalSpent = orders.reduce((sum, order) => sum + order.amount, 0);
    
    return {
      userId: user._id,
      email: user.email,
      orderCount: orders.length,
      totalSpent: totalSpent,
      avgOrderValue: orders.length > 0 ? totalSpent / orders.length : 0
    };
  })
);

// Insert analytics data
await db.userAnalytics.insertMany(userStats);

return { processedUsers: userStats.length };
```

## Security Features

### 1. Sandboxed Execution
All queries run in a secure VM context with:
- No access to Node.js `require()`
- No access to file system
- No access to process or global objects
- No ability to execute system commands
- Limited to MongoDB operations only

### 2. Query Validation
Automatic validation checks for:
- Dangerous function calls (`eval`, `Function`, etc.)
- Process access attempts
- File system access attempts
- Network operation attempts
- Prototype pollution attempts

### 3. Resource Limits
- **Execution Timeout**: 30 seconds maximum
- **Memory Limit**: Controlled by VM context
- **Operation Limits**: Rate limiting on API endpoints

### 4. Forbidden Operations
The following operations are explicitly blocked:
- `dropDatabase()` - Database deletion
- `drop()` - Collection deletion
- `remove()` - Legacy delete operations (use `deleteOne` or `deleteMany`)

## Performance Monitoring

Every query execution provides detailed metadata:

```javascript
{
  "result": [...], // Query results
  "metadata": {
    "executionTime": 245, // Milliseconds
    "documentsAffected": 10,
    "collections": ["users", "orders"], // Collections accessed
    "operations": ["findOne", "updateMany"], // Operations performed
    "hasMultipleCollections": true,
    "hasMultipleOperations": true
  }
}
```

## Error Handling

The system provides detailed error information:

```javascript
// Syntax errors
{
  "message": "Failed to execute query",
  "details": "Unexpected token ';'"
}

// Security violations
{
  "message": "Query contains potentially dangerous operations",
  "violations": ["Potentially dangerous pattern detected: /require\\s*\\(/"]
}

// MongoDB errors
{
  "message": "Failed to execute query",
  "details": "Collection 'nonexistent' does not exist"
}
```

## Best Practices

### 1. Always Use Await for Database Operations
```javascript
// ✅ Correct
const user = await db.users.findOne({ email: "user@example.com" });
const userId = user._id;

// ❌ Incorrect - Will not work as expected
const userId = db.users.findOne({ email: "user@example.com" })._id;
```

### 2. Can't Chain Array Methods on Async Operations
```javascript
// ❌ Incorrect - find() returns a Promise, not an array
const userIds = db.users.find({}).map(user => user._id);

// ✅ Correct - await first, then use array methods
const users = await db.users.find({});
const userIds = users.map(user => user._id);

// ✅ Alternative - inline with parentheses
const userIds = (await db.users.find({})).map(user => user._id);
```

### 3. Handle Null Results
```javascript
// ✅ Correct
const user = await db.users.findOne({ email: "user@example.com" });
if (user) {
  await db.orders.updateMany(
    { userId: user._id },
    { $set: { customerEmail: user.email } }
  );
}

// ❌ Incorrect - May cause errors if user not found
const userId = (await db.users.findOne({ email: "user@example.com" }))._id;
```

### 4. Use Proper Collection Names
```javascript
// ✅ For normal collection names
db.users.find({})
db.products.find({})

// ✅ For collection names with special characters
db.getCollection('user-profiles').find({})
db.getCollection('collection with spaces').find({})
db.collection('123numbers').find({})
```

### 5. Optimize Performance
```javascript
// ✅ Use indexed fields for lookups
const user = await db.users.findOne({ email: "user@example.com" }); // Assuming email is indexed

// ✅ Use projection to limit returned fields
const user = await db.users.findOne(
  { email: "user@example.com" },
  { projection: { _id: 1, name: 1 } }
);

// ✅ Use appropriate query methods
const count = await db.users.countDocuments({ status: "active" }); // For exact counts
const estimate = await db.users.estimatedDocumentCount(); // For quick estimates
```

## Migration from Old System

If you have existing queries using the old system, here's how to update them:

### Old System (Limited Async Support)
```javascript
// This wouldn't work reliably in the old system
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { lastOrder: db.orders.findOne({ userId: ObjectId("...") })._id } }
)
```

### New System (Full Async Support)
```javascript
// This works perfectly in the new system
const lastOrder = await db.orders.findOne({ userId: ObjectId("...") });
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { lastOrderId: lastOrder._id, lastOrderDate: lastOrder.createdAt } }
)
```

## Security Recommendations

1. **Never expose user credentials** in queries
2. **Validate input data** before using in queries
3. **Use parameterized queries** when possible
4. **Avoid dynamic collection names** from user input
5. **Test queries thoroughly** before running on production data
6. **Monitor query performance** and set appropriate timeouts
7. **Use read-only operations** when possible for data exploration
8. **Implement proper error handling** for production applications

## Common Async Patterns & Mistakes

### ❌ Attempting to Chain Array Methods on Promises
**Problem**: Trying to use array methods directly on async operations
```javascript
// This will fail with "map is not a function"
const userIds = db.users.find({}).map(user => user._id);
const emails = db.users.find({}).filter(user => user.active).map(user => user.email);
```

**Solution**: Always await first, then use array methods
```javascript
// ✅ Correct approach
const users = await db.users.find({});
const userIds = users.map(user => user._id);

const activeUsers = await db.users.find({ active: true });
const emails = activeUsers.map(user => user.email);
```

### ❌ Nested Queries Without Proper Await
**Problem**: Using query results in other queries without awaiting
```javascript
// This won't work as expected
db.orders.updateMany(
  { userId: db.users.findOne({ email: "user@example.com" })._id },
  { $set: { processed: true } }
)
```

**Solution**: Always await nested queries
```javascript
// ✅ Correct approach
const user = await db.users.findOne({ email: "user@example.com" });
if (user) {
  await db.orders.updateMany(
    { userId: user._id },
    { $set: { processed: true } }
  );
}
```

### ❌ Forgetting Async/Await in Complex Operations
**Problem**: Not handling promises properly in complex queries
```javascript
// This won't work correctly
const result = Promise.all([
  db.users.find({}),
  db.orders.find({}),
  db.products.find({})
]);
// result is a Promise, not the actual data
```

**Solution**: Use await with Promise.all
```javascript
// ✅ Correct approach
const [users, orders, products] = await Promise.all([
  db.users.find({}),
  db.orders.find({}),
  db.products.find({})
]);
```

### ✅ Recommended Patterns for Complex Queries

**1. Multi-step Processing:**
```javascript
// Step 1: Get base data
const users = await db.users.find({ status: "active" });

// Step 2: Process and transform
const userIds = users.map(user => user._id);
const emails = users.filter(user => user.email.includes("@company.com"));

// Step 3: Use in subsequent queries
await db.notifications.updateMany(
  { userId: { $in: userIds } },
  { $set: { sent: true } }
);
```

**2. Conditional Queries:**
```javascript
// Check if data exists before proceeding
const user = await db.users.findOne({ email: "user@example.com" });
if (user) {
  const orders = await db.orders.find({ userId: user._id });
  if (orders.length > 0) {
    // Process orders...
  }
}
```

**3. Bulk Operations with Validation:**
```javascript
// Get data and validate before bulk operations
const targetUsers = await db.users.find({ 
  lastLogin: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days ago
});

if (targetUsers.length > 0) {
  console.log(`Found ${targetUsers.length} inactive users`);
  
  const result = await db.users.updateMany(
    { _id: { $in: targetUsers.map(u => u._id) } },
    { $set: { status: "inactive" } }
  );
  
  console.log(`Updated ${result.modifiedCount} users`);
}
```

## Troubleshooting

### Common Issues

1. **"Cannot read property '_id' of null"**
   - Solution: Always check if query results exist before accessing properties
   
2. **"Query execution timed out"**
   - Solution: Optimize your query or break it into smaller operations
   
3. **"Collection not found"**
   - Solution: Verify collection name spelling and existence

4. **"Invalid ObjectId"**
   - Solution: Ensure ObjectId strings are valid 24-character hex strings

5. **"map is not a function" or "filter is not a function"**
   - Cause: Trying to use array methods on async operations (Promises)
   - Solution: Always await the database operation first, then use array methods
   - Example: `const users = await db.users.find({}); const ids = users.map(u => u._id);`

6. **"Class constructor ObjectId cannot be invoked without 'new'"**
   - Cause: This should not happen with the enhanced system, but if it does, ensure ObjectId is called correctly
   - Solution: Use `ObjectId("string")` not `new ObjectId("string")` in queries

### Debug Tips

1. Test simple queries first, then build complexity
2. Use `console.log()` for debugging (available in query context)
3. Check the metadata for performance insights
4. Verify collection and field names in your database schema

## Support

For additional help:
- Check the MongoDB documentation for specific operation syntax
- Use the schema explorer to verify collection structures
- Test queries incrementally to isolate issues
- Monitor the query history for successful patterns 