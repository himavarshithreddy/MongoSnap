const axios = require('axios');

class GeminiAPI {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
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
1. Return ONLY the MongoDB query in valid syntax
2. Use proper MongoDB operators and syntax
3. If the request is unclear, make reasonable assumptions
4. For find operations, include appropriate filters
5. For updates, use $set operator appropriately
6. For inserts, create realistic document structures
7. Use proper data types (strings, numbers, dates, ObjectIds)
8. Format the output exactly as shown in examples below

OUTPUT FORMAT:
Return ONLY the MongoDB query, no explanations, no markdown, no code blocks.

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
- Use double quotes for strings: "value" not 'value'
- Use proper MongoDB operators: $gt, $gte, $lt, $lte, $in, $nin, $exists, $and, $or, $not, $regex, $size, $elemMatch
- For ObjectIds, use: ObjectId("...")
- For dates, use: new Date("YYYY-MM-DD")
- For arrays, use: ["value1", "value2"]
- For nested objects, use: {"field": {"nested": "value"}}
- For aggregations, use proper pipeline syntax with array of stages
- For indexes, use proper index specification with options

`;

        // Add schema context if available
        if (schema && schema.collections && schema.collections.length > 0) {
            prompt += `\nDatabase Schema Context:\n`;
            prompt += `Database: ${schema.databaseName || 'Unknown'}\n\n`;
            
            schema.collections.forEach(collection => {
                prompt += `Collection: ${collection.name}\n`;
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

        prompt += `\nGenerate the MongoDB query for: "${naturalLanguage}"\n\nQuery:`;

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
            const queryLines = lines.filter(line => {
                const trimmedLine = line.trim();
                return trimmedLine.startsWith('db.') || 
                       trimmedLine.startsWith('//') ||
                       trimmedLine === '' ||
                       trimmedLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*[:=]/); // Handle variable assignments
            });
            
            query = queryLines.join('\n').trim();
            
            // Remove any trailing semicolons
            query = query.replace(/;$/, '');
            
            // Handle cases where Gemini might return multiple queries - take the first one
            if (query.includes('\n')) {
                const firstQuery = query.split('\n')[0].trim();
                if (firstQuery.match(/^db\.[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z]+\(/)) {
                    query = firstQuery;
                }
            }
            
            // Validate that it looks like a MongoDB query (improved to handle complex queries)
            if (!query.match(/^db\.[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z]+\(/) && !query.includes('db.')) {
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