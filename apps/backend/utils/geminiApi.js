const axios = require('axios');

class GeminiAPI {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
    }

    async generateMongoQuery(naturalLanguage, schema = null) {
        try {
            if (!this.apiKey) {
                console.warn('GEMINI_API_KEY is not configured, using fallback');
                throw new Error('GEMINI_API_KEY is not configured');
            }

            console.log('Generating MongoDB query with Gemini API:', { 
                naturalLanguage, 
                hasSchema: !!schema,
                schemaInfo: schema ? {
                    databaseName: schema.databaseName,
                    collectionCount: schema.collections?.length,
                    collections: schema.collections?.map(c => ({
                        name: c.name,
                        fieldCount: c.fields?.length,
                        documentCount: c.documentCount
                    }))
                } : null
            });

            // Build the prompt with context
            let prompt = this.buildPrompt(naturalLanguage, schema);
            
            const response = await axios.post(`${this.baseURL}?key=${this.apiKey}`, {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 seconds timeout
            });

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                const generatedText = response.data.candidates[0].content.parts[0].text;
                const parsedQuery = this.parseGeminiResponse(generatedText);
                console.log('Successfully generated query:', parsedQuery);
                return parsedQuery;
            } else {
                console.error('Invalid Gemini API response:', response.data);
                throw new Error('Invalid response from Gemini API');
            }

        } catch (error) {
            console.error('Gemini API Error:', error.response?.data || error.message);
            
            // Provide more specific error messages
            if (error.response?.status === 400) {
                throw new Error('Invalid request to Gemini API - check API key and request format');
            } else if (error.response?.status === 403) {
                throw new Error('Gemini API access denied - check API key permissions');
            } else if (error.response?.status === 429) {
                throw new Error('Gemini API rate limit exceeded - try again later');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Gemini API request timed out - try again');
            } else {
                throw new Error(`Failed to generate query: ${error.message}`);
            }
        }
    }

    buildPrompt(naturalLanguage, schema) {
        let prompt = `You are a MongoDB query generator. Convert the following natural language request into a valid MongoDB query.

Natural Language Request: "${naturalLanguage}"

Requirements:
1. Return ONLY the MongoDB query in valid syntax compatible with Node.js MongoDB driver
2. Use proper MongoDB operators and syntax
3. If the request is unclear, make reasonable assumptions
4. For find operations, include appropriate filters
5. For updates, use $set operator appropriately
6. For inserts, create realistic document structures
7. Use proper data types (strings, numbers, dates, ObjectIds)
8. Format the output exactly as shown in examples below
9. NEVER use MongoDB shell-specific functions like getCollectionNames(), listCollections(), or similar
10. **CRITICAL: ALWAYS PREFER AGGREGATION PIPELINES OVER NESTED LOOPS**
11. **NEVER use nested find().map() or complex async loops - use aggregation with $lookup, $group, $match instead**
12. **For ANY multi-collection operations, bulk processing, or data transformation - use aggregation pipelines**
13. **db.collection.find().map() does NOT work in Node.js MongoDB driver - use aggregation instead**
14. **Complex operations requiring multiple steps should use single aggregation pipeline rather than multiple separate queries**

OUTPUT FORMAT:
Return ONLY the MongoDB query, no explanations, no markdown, no code blocks.

**FOR COMPLEX OPERATIONS**: Always generate a SINGLE aggregation pipeline rather than multiple separate operations.
**PERFORMANCE PRIORITY**: Aggregation pipelines are processed on the database server and are much faster than multiple round-trips.

Examples:

BASIC OPERATIONS:
- "Find all users" → db.users.find({})
- "Find active users" → db.users.find({"status": "active"})
- "Find users created this month" → db.users.find({"createdAt": {"$gte": new Date("2024-01-01")}})
- "Insert a new user" → db.users.insertOne({"name": "John Doe", "email": "john@example.com", "createdAt": new Date()})
- "Update user status to active" → db.users.updateOne({"_id": ObjectId("...")}, {"$set": {"status": "active"}})
- "Delete inactive users" → db.users.deleteMany({"status": "inactive"})
- "Find products with price greater than 100" → db.products.find({"price": {"$gt": 100}})
- "Count total users" → db.users.countDocuments({})
- "Find users and sort by name" → db.users.find({}).sort({"name": 1})

AGGREGATION PIPELINES:
- "Get total sales by category" → db.orders.aggregate([{"$group": {"_id": "$category", "totalSales": {"$sum": "$amount"}}}])
- "Find average order value" → db.orders.aggregate([{"$group": {"_id": null, "avgOrderValue": {"$avg": "$amount"}}}])
- "Get top 5 customers by order count" → db.orders.aggregate([{"$group": {"_id": "$customerId", "orderCount": {"$sum": 1}}}, {"$sort": {"orderCount": -1}}, {"$limit": 5}])
- "Find products with highest ratings" → db.products.aggregate([{"$match": {"rating": {"$exists": true}}}, {"$sort": {"rating": -1}}, {"$limit": 10}])
- "Get monthly sales report" → db.orders.aggregate([{"$group": {"_id": {"year": {"$year": "$date"}, "month": {"$month": "$date"}}, "totalSales": {"$sum": "$amount"}}}, {"$sort": {"_id": 1}}])
- "Find duplicate emails" → db.users.aggregate([{"$group": {"_id": "$email", "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}])
- "Get user statistics" → db.users.aggregate([{"$group": {"_id": null, "totalUsers": {"$sum": 1}, "activeUsers": {"$sum": {"$cond": [{"$eq": ["$status", "active"]}, 1, 0]}}, "avgAge": {"$avg": "$age"}}}])
- "Find products by price range" → db.products.aggregate([{"$bucket": {"groupBy": "$price", "boundaries": [0, 50, 100, 200, 500], "default": "500+", "output": {"count": {"$sum": 1}, "products": {"$push": "$name"}}}}])
- "Get customer purchase history" → db.orders.aggregate([{"$match": {"customerId": ObjectId("...")}}, {"$lookup": {"from": "products", "localField": "productId", "foreignField": "_id", "as": "product"}}, {"$unwind": "$product"}, {"$project": {"date": 1, "productName": "$product.name", "amount": 1}}])

PREFERRED: AGGREGATION PIPELINES (USE THESE PATTERNS):
- "Find orders with customer names" → db.orders.aggregate([{"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}}, {"$unwind": "$user"}, {"$project": {"orderDate": 1, "amount": 1, "customerName": "$user.name"}}])
- "Find saved queries of users without oauth" → db.savedqueries.aggregate([{"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}}, {"$match": {"user.oauthProvider": null}}, {"$project": {"query": 1, "description": 1, "userName": "$user.name", "userEmail": "$user.email"}}])
- "Find products with their category details" → db.products.aggregate([{"$lookup": {"from": "categories", "localField": "categoryId", "foreignField": "_id", "as": "category"}}, {"$unwind": "$category"}, {"$project": {"name": 1, "price": 1, "categoryName": "$category.name"}}])
- "Find users with their order count" → db.users.aggregate([{"$lookup": {"from": "orders", "localField": "_id", "foreignField": "userId", "as": "userOrders"}}, {"$project": {"name": 1, "email": 1, "orderCount": {"$size": "$userOrders"}}}])
- "Find posts with author information" → db.posts.aggregate([{"$lookup": {"from": "users", "localField": "authorId", "foreignField": "_id", "as": "author"}}, {"$unwind": "$author"}, {"$project": {"title": 1, "content": 1, "authorName": "$author.name", "publishDate": 1}}])

BULK OPERATIONS WITH AGGREGATION (ALWAYS PREFER THESE):
- "Reset daily usage for all Outlook users" → db.users.aggregate([{"$match": {"email": {"$regex": "@outlook\\.com$"}}}, {"$lookup": {"from": "userusages", "localField": "_id", "foreignField": "userId", "as": "usage"}}, {"$unwind": "$usage"}, {"$merge": {"into": "userusages", "on": "_id", "whenMatched": [{"$set": {"aiGeneration.daily.count": 0}}]}}])
- "Update all orders for specific users" → db.users.aggregate([{"$match": {"status": "premium"}}, {"$lookup": {"from": "orders", "localField": "_id", "foreignField": "userId", "as": "orders"}}, {"$unwind": "$orders"}, {"$merge": {"into": "orders", "on": "_id", "whenMatched": [{"$set": {"priority": "high"}}]}}])
- "Copy active users to new collection" → db.users.aggregate([{"$match": {"status": "active"}}, {"$project": {"name": 1, "email": 1, "joinDate": "$createdAt"}}, {"$out": "activeUsers"}])
- "Generate user statistics" → db.users.aggregate([{"$lookup": {"from": "orders", "localField": "_id", "foreignField": "userId", "as": "orders"}}, {"$addFields": {"orderCount": {"$size": "$orders"}, "totalSpent": {"$sum": "$orders.amount"}}}, {"$group": {"_id": null, "avgOrders": {"$avg": "$orderCount"}, "totalUsers": {"$sum": 1}, "totalRevenue": {"$sum": "$totalSpent"}}}])
- "Find and process related data" → db.products.aggregate([{"$lookup": {"from": "reviews", "localField": "_id", "foreignField": "productId", "as": "reviews"}}, {"$addFields": {"avgRating": {"$avg": "$reviews.rating"}, "reviewCount": {"$size": "$reviews"}}}, {"$match": {"avgRating": {"$gte": 4.0}}}, {"$sort": {"avgRating": -1}}])

ADVANCED AGGREGATION PATTERNS:
- "Complex data transformation" → db.orders.aggregate([{"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "customer"}}, {"$lookup": {"from": "products", "localField": "items.productId", "foreignField": "_id", "as": "products"}}, {"$unwind": "$customer"}, {"$addFields": {"totalValue": {"$sum": "$items.price"}, "customerName": "$customer.name"}}, {"$group": {"_id": "$customer.segment", "totalOrders": {"$sum": 1}, "avgOrderValue": {"$avg": "$totalValue"}}}, {"$sort": {"avgOrderValue": -1}}])
- "Multi-stage data processing" → db.events.aggregate([{"$match": {"date": {"$gte": new Date("2024-01-01")}}}, {"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}}, {"$unwind": "$user"}, {"$group": {"_id": {"userId": "$userId", "month": {"$month": "$date"}}, "eventCount": {"$sum": 1}, "userName": {"$first": "$user.name"}}}, {"$sort": {"eventCount": -1}}, {"$limit": 100}])
- "Conditional updates with aggregation" → db.products.aggregate([{"$match": {"category": "electronics"}}, {"$lookup": {"from": "inventory", "localField": "_id", "foreignField": "productId", "as": "stock"}}, {"$unwind": "$stock"}, {"$addFields": {"newPrice": {"$cond": [{"$lt": ["$stock.quantity", 10]}, {"$multiply": ["$price", 1.1]}, "$price"]}}}, {"$merge": {"into": "products", "on": "_id", "whenMatched": [{"$set": {"price": "$newPrice"}}]}}])

**WRONG PATTERNS TO AVOID**:
❌ NEVER USE: Multiple separate queries with async loops
❌ NEVER USE: db.collection.find().map() chains  
❌ NEVER USE: Complex nested Promise.all() with multiple collections
❌ NEVER USE: Sequential database calls when aggregation can do it in one operation

**ALWAYS USE INSTEAD**: Single aggregation pipeline with $lookup, $group, $match, $project, $merge, $out

**CRITICAL AGGREGATION RULES**:
- ⚠️  NEVER use nested db.collection.find().map() syntax - this will NOT work in Node.js
- ✅  ALWAYS use aggregation pipelines with $lookup for cross-collection queries
- ✅  Use $merge or $out for bulk updates instead of multiple updateMany calls
- ✅  Use $addFields and $group for complex calculations instead of JavaScript loops
- ✅  Use $match early in pipeline to reduce processing load
- ✅  Use $unwind after $lookup if you expect single matching documents
- ✅  Use $project to shape the final output and include fields from both collections
- ✅  For bulk operations on related data, start with the primary collection and $lookup related data
- ✅  Use $cond, $switch, and other aggregation operators for conditional logic instead of if/else in code

**SPECIFIC PATTERN FOR BULK USER OPERATIONS**:
- To update usage for users matching criteria → db.users.aggregate([{"$match": {criteria}}, {"$lookup": {"from": "userusages", ...}}, {"$merge": {...}}])
- To process orders for specific users → db.users.aggregate([{"$match": {criteria}}, {"$lookup": {"from": "orders", ...}}, {"$merge": {...}}])
- To generate reports across collections → db.primaryCollection.aggregate([{"$lookup": ...}, {"$group": ...}, {"$project": ...}])

INDEX OPERATIONS:
- "Create index on email field" → db.users.createIndex({"email": 1})
- "Create unique index on username" → db.users.createIndex({"username": 1}, {"unique": true})
- "Create compound index on category and price" → db.products.createIndex({"category": 1, "price": 1})
- "Create text index on product description" → db.products.createIndex({"description": "text"})
- "Create index with options" → db.users.createIndex({"createdAt": 1}, {"expireAfterSeconds": 86400})
- "List all indexes" → db.users.listIndexes()
- "Drop index" → db.users.dropIndex("email_1")

ADVANCED QUERIES:
- "Find users with complex conditions" → db.users.find({"$and": [{"age": {"$gte": 18}}, {"$or": [{"status": "active"}, {"vip": true}]}]})
- "Find products with array contains" → db.products.find({"tags": {"$in": ["electronics", "gadgets"]}})
- "Find documents with nested fields" → db.users.find({"address.city": "New York", "address.zipCode": {"$regex": "^100"}})
- "Find with regex pattern" → db.users.find({"email": {"$regex": "@gmail\\.com$"}})
- "Find with exists check" → db.users.find({"phoneNumber": {"$exists": true, "$ne": null}})
- "Find with size check" → db.users.find({"orders": {"$size": 0}})
- "Find with array element match" → db.products.find({"reviews": {"$elemMatch": {"rating": {"$gte": 4}, "verified": true}}})

IMPORTANT:
- Use the actual field names and types from the schema above when generating queries. 
- **CRITICAL FOR COLLECTIONS WITH DOTS**: If a collection name contains dots (.), spaces, or special characters, you MUST use db.getCollection("collection.name").operation() syntax
- Examples for collections with dots: 
  * db.getCollection("olddb.collection").find({})
  * db.getCollection("user.profiles").findOne({})
  * db.getCollection("temp.data").countDocuments({})
- For regular collection names without dots, use: db.collectionName.operation()
- Use double quotes for strings: "value" not 'value'
- Use proper MongoDB operators: $gt, $gte, $lt, $lte, $in, $nin, $exists, $and, $or, $not, $regex, $size, $elemMatch
- For ObjectIds, use: ObjectId("...")
- For dates, use: new Date("YYYY-MM-DD")
- For arrays, use: ["value1", "value2"]
- For nested objects, use: {"field": {"nested": "value"}}
- For aggregations, use proper pipeline syntax with array of stages
- For indexes, use proper index specification with options
- NEVER use shell functions: getCollectionNames(), listCollections(), forEach(), print(), etc.
- For multi-collection queries, use aggregation pipelines with $lookup or focus on a single collection
- If asked about "all collections", pick the most relevant collection from the schema context

`;

        // Add schema context if available
        if (schema && schema.collections && schema.collections.length > 0) {
            prompt += `\nDatabase Schema Context:\n`;
            prompt += `Database: ${schema.databaseName || 'Unknown'}\n\n`;
            
            // Check for collections with dots and add special warning
            const collectionsWithDots = schema.collections.filter(c => c.name.includes('.'));
            if (collectionsWithDots.length > 0) {
                prompt += `⚠️  IMPORTANT: The following collections contain dots in their names and MUST use db.getCollection() syntax:\n`;
                collectionsWithDots.forEach(c => {
                    prompt += `   - "${c.name}" → Use: db.getCollection("${c.name}").operation()\n`;
                });
                prompt += `\n`;
            }
            
            schema.collections.forEach(collection => {
                const needsGetCollection = collection.name.includes('.');
                prompt += `Collection: ${collection.name}${needsGetCollection ? ' (REQUIRES getCollection)' : ''}\n`;
                prompt += `Document Count: ${collection.documentCount || 'Unknown'}\n`;
                
                if (collection.fields && collection.fields.length > 0) {
                    prompt += `Fields:\n`;
                    collection.fields.forEach(field => {
                        prompt += `  - ${field.name} (${field.type})`;
                        if (field.examples && field.examples.length > 0) {
                            prompt += ` - Examples: ${field.examples.join(', ')}`;
                        }
                        prompt += `\n`;
                    });
                }
                
                if (collection.sampleDocuments && collection.sampleDocuments.length > 0) {
                    prompt += `Sample Documents:\n`;
                    collection.sampleDocuments.forEach((doc, index) => {
                        prompt += `  Document ${index + 1}: ${JSON.stringify(doc, null, 2)}\n`;
                    });
                }
                prompt += `\n`;
            });
            
            prompt += `\nIMPORTANT: Use the actual field names and types from the schema above when generating queries. `;
            prompt += `Pay attention to the sample documents to understand the data structure and field values. `;
            prompt += `Use realistic values based on the examples provided.\n\n`;
        }

        prompt += `
**REMINDER BEFORE GENERATING**:
- If the request involves finding users and then updating related records, use aggregation with $lookup and $merge
- If the request involves processing multiple collections, use a single aggregation pipeline
- If the request involves bulk operations based on criteria, start with $match and use $merge for updates
- NEVER generate db.collection.find().map() patterns - they will fail in Node.js environment

Generate the MongoDB query for: "${naturalLanguage}"

Query:`;

        return prompt;
    }

    parseGeminiResponse(response) {
        try {
            console.log('Raw Gemini response:', response);
            
            // Clean up the response
            let query = response.trim();
            
            // Remove markdown code blocks if present
            query = query.replace(/```(?:javascript|js|mongodb)?\s*\n?/g, '');
            query = query.replace(/```\s*\n?/g, '');
            
            // Remove any explanatory text and keep only the query
            const lines = query.split('\n');
            
            // Find the start of the actual query (line that starts with db.)
            let queryStartIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('db.')) {
                    queryStartIndex = i;
                    break;
                }
            }
            
            if (queryStartIndex === -1) {
                throw new Error('No MongoDB query found in response');
            }
            
            // For multi-line queries, we need to include all lines that are part of the query structure
            const queryLines = [];
            let inQuery = false;
            let bracketDepth = 0;
            let parenDepth = 0;
            
            for (let i = queryStartIndex; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Skip empty lines and comments within the query
                if (trimmedLine === '' || trimmedLine.startsWith('//')) {
                    if (inQuery) queryLines.push(line);
                    continue;
                }
                
                // If we haven't started the query yet and this line starts with db., start here
                if (!inQuery && trimmedLine.startsWith('db.')) {
                    inQuery = true;
                    queryLines.push(line);
                    
                    // Count brackets and parentheses in this line
                    for (const char of line) {
                        if (char === '[') bracketDepth++;
                        if (char === ']') bracketDepth--;
                        if (char === '(') parenDepth++;
                        if (char === ')') parenDepth--;
                    }
                    continue;
                }
                
                // If we're in a query, include lines that are part of the structure
                if (inQuery) {
                    // Count brackets and parentheses
                    for (const char of line) {
                        if (char === '[') bracketDepth++;
                        if (char === ']') bracketDepth--;
                        if (char === '(') parenDepth++;
                        if (char === ')') parenDepth--;
                    }
                    
                    queryLines.push(line);
                    
                    // If we've closed all brackets and parentheses, the query is complete
                    if (bracketDepth === 0 && parenDepth === 0) {
                        break;
                    }
                }
            }
            
            query = queryLines.join('\n').trim();
            
            // Remove any trailing semicolons
            query = query.replace(/;$/, '');
            
            // Check for shell-specific functions that won't work in Node.js
            const shellFunctions = ['getCollectionNames', 'listCollections', 'forEach', 'print', 'printjson', 'show'];
            const hasShellFunction = shellFunctions.some(func => query.includes(func));
            if (hasShellFunction) {
                console.error('Generated query contains shell-specific functions:', query);
                throw new Error('Generated query uses MongoDB shell functions not available in Node.js environment');
            }
            
            // Validate that it looks like a MongoDB query (improved to handle complex queries)
            const firstLine = query.split('\n')[0].trim();
            if (!firstLine.match(/^db\.[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z]+\(/) && !query.includes('db.')) {
                console.error('Generated response does not match MongoDB query pattern:', query);
                throw new Error('Generated response does not look like a valid MongoDB query');
            }
            
            // Additional validation for common issues (but allow null, which is valid in MongoDB)
            if (query.includes('undefined') || query.includes('NaN')) {
                throw new Error('Generated query contains invalid values');
            }
            
            console.log('Parsed query:', query);
            return query;
        } catch (error) {
            console.error('Error parsing Gemini response:', error);
            throw new Error('Failed to parse generated query');
        }
    }

    async explainQuery(query, naturalLanguage) {
        try {
            if (!this.apiKey) {
                throw new Error('GEMINI_API_KEY is not configured');
            }

            const prompt = `Explain this MongoDB query in simple terms:

Query: ${query}
Original Request: "${naturalLanguage}"

Provide a clear, concise, short explanation of what this query does, including:
1. What operation it performs (find, insert, update, delete)
2. What data it affects
3. Any filters or conditions applied
4. What the result will be

Keep the explanation simple, shorter, on-point, under 100 words compulsory, and user-friendly.`;

            const response = await axios.post(`${this.baseURL}?key=${this.apiKey}`, {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 512,
                }
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                return response.data.candidates[0].content.parts[0].text.trim();
            } else {
                throw new Error('Invalid response from Gemini API');
            }

        } catch (error) {
            console.error('Gemini API Error (explanation):', error.response?.data || error.message);
            return 'Unable to generate explanation at this time.';
        }
    }
}

module.exports = new GeminiAPI(); 