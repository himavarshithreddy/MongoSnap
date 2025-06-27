import React, { useState } from 'react';
import { Save, Check, AlertCircle, MessageSquare, Code, Play, Sparkles, RefreshCw } from 'lucide-react';

function QueryInterface({ 
    queryInput, 
    setQueryInput, 
    queryLoading, 
    queryError, 
    setQueryError,
    queryResult, 
    handleQuerySubmit,
    onSaveQuery,
    saveMessage,
    queryMode,
    setQueryMode
}) {
    const [generatedQuery, setGeneratedQuery] = useState('');
    const [queryExplanation, setQueryExplanation] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showGeneratedQuery, setShowGeneratedQuery] = useState(false);

    const handleSaveClick = () => {
        if (!queryInput.trim()) {
            return;
        }
        
        if (onSaveQuery) {
            onSaveQuery(queryInput);
        }
    };

    // Determine button state based on saveMessage
    const getSaveButtonState = () => {
        if (!saveMessage) {
            return {
                text: 'Save',
                icon: <Save size={14} />,
                className: 'bg-[#35c56a69] hover:bg-[#35c56a69]'
            };
        }
        
        if (saveMessage.includes('already')) {
            return {
                text: 'Already Saved',
                icon: <AlertCircle size={14} />,
                className: 'bg-yellow-600 hover:bg-yellow-500'
            };
        }
        
        return {
            text: 'Saved!',
            icon: <Check size={14} />,
            className: 'bg-green-600 hover:bg-green-500'
        };
    };

    const buttonState = getSaveButtonState();

    const getPlaceholder = () => {
        if (queryMode === 'natural') {
            return "Tell me what you want to do with your database...";
        }
        return "db.collection.find({})";
    };

    const getHelperText = () => {
        if (queryMode === 'natural') {
            return "Try: 'Find all users who signed up this month', 'Insert a new product with name and price', 'Update user status to active'";
        }
        return "Use MongoDB syntax like: db.collection.find({}), db.collection.insertOne({...}), etc.";
    };

    // Handle natural language generation
    const handleGenerateQuery = async () => {
        if (!queryInput.trim()) return;
        
        setIsGenerating(true);
        setQueryError('');
        
        try {
            // Simulate API call to generate query
            const response = await fetch('/api/generate-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ naturalLanguage: queryInput })
            });
            
            if (response.ok) {
                const data = await response.json();
                setGeneratedQuery(data.query);
                setQueryExplanation(data.explanation);
                setShowGeneratedQuery(true);
            } else {
                throw new Error('Failed to generate query');
            }
        } catch {
            // Fallback to local generation for demo
            const { query, explanation } = generateQueryLocally(queryInput);
            setGeneratedQuery(query);
            setQueryExplanation(explanation);
            setShowGeneratedQuery(true);
        } finally {
            setIsGenerating(false);
        }
    };

    // Local query generation for demo purposes
    const generateQueryLocally = (naturalLanguage) => {
        const lowerText = naturalLanguage.toLowerCase();
        
        // Find operations
        if (lowerText.includes('find') || lowerText.includes('get') || lowerText.includes('show') || lowerText.includes('list')) {
            const collectionMatch = naturalLanguage.match(/(?:find|get|show|list)\s+(?:all\s+)?(\w+)/i);
            if (collectionMatch) {
                const collection = collectionMatch[1];
                
                if (lowerText.includes('active') || lowerText.includes('status')) {
                    return {
                        query: `db.${collection}.find({"status": "active"})`,
                        explanation: `This query searches the '${collection}' collection for all documents where the 'status' field equals 'active'. It will return all active ${collection} from the database.`
                    };
                }
                if (lowerText.includes('this month') || lowerText.includes('current month')) {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
                    return {
                        query: `db.${collection}.find({"createdAt": {"$gte": new Date("${startOfMonth.toISOString()}")}})`,
                        explanation: `This query finds all ${collection} created from the beginning of the current month until now. It uses the '$gte' (greater than or equal) operator to filter documents with 'createdAt' dates on or after the first day of this month.`
                    };
                }
                if (lowerText.includes('recent') || lowerText.includes('latest')) {
                    return {
                        query: `db.${collection}.find({}).sort({"createdAt": -1}).limit(10)`,
                        explanation: `This query retrieves the 10 most recent ${collection} from the database. It sorts all documents by 'createdAt' in descending order (-1) and limits the result to 10 documents.`
                    };
                }
                
                return {
                    query: `db.${collection}.find({})`,
                    explanation: `This query retrieves all documents from the '${collection}' collection. The empty object {} means no filters are applied, so it will return every document in the collection.`
                };
            }
        }
        
        // Insert operations
        if (lowerText.includes('insert') || lowerText.includes('add') || lowerText.includes('create')) {
            const collectionMatch = naturalLanguage.match(/(?:insert|add|create)\s+(?:a\s+)?(\w+)/i);
            if (collectionMatch) {
                const collection = collectionMatch[1];
                return {
                    query: `db.${collection}.insertOne({"name": "example", "createdAt": new Date()})`,
                    explanation: `This query inserts a new document into the '${collection}' collection. The document contains a 'name' field with value 'example' and a 'createdAt' field with the current timestamp. You can modify the field values as needed.`
                };
            }
        }
        
        // Update operations
        if (lowerText.includes('update') || lowerText.includes('modify') || lowerText.includes('change')) {
            const collectionMatch = naturalLanguage.match(/(?:update|modify|change)\s+(\w+)/i);
            if (collectionMatch) {
                const collection = collectionMatch[1];
                if (lowerText.includes('status')) {
                    return {
                        query: `db.${collection}.updateOne({"_id": ObjectId("...")}, {"$set": {"status": "active"}})`,
                        explanation: `This query updates a single document in the '${collection}' collection. It finds a document by its '_id' and sets the 'status' field to 'active'. You'll need to replace the ObjectId with the actual document ID you want to update.`
                    };
                }
                return {
                    query: `db.${collection}.updateOne({"_id": ObjectId("...")}, {"$set": {"field": "value"}})`,
                    explanation: `This query updates a single document in the '${collection}' collection. It finds a document by its '_id' and sets a field to a new value. You'll need to replace the ObjectId and field values as needed.`
                };
            }
        }
        
        // Delete operations
        if (lowerText.includes('delete') || lowerText.includes('remove')) {
            const collectionMatch = naturalLanguage.match(/(?:delete|remove)\s+(\w+)/i);
            if (collectionMatch) {
                const collection = collectionMatch[1];
                return {
                    query: `db.${collection}.deleteOne({"_id": ObjectId("...")})`,
                    explanation: `This query deletes a single document from the '${collection}' collection. It finds the document by its '_id' and removes it from the database. You'll need to replace the ObjectId with the actual document ID you want to delete.`
                };
            }
        }
        
        // Default fallback
        return {
            query: `db.collection.find({})`,
            explanation: `This is a basic query that retrieves all documents from a collection. Replace 'collection' with your actual collection name and add filters as needed.`
        };
    };

    // Handle execute for natural language mode
    const handleExecuteGeneratedQuery = () => {
        if (generatedQuery) {
            setQueryInput(generatedQuery);
            handleQuerySubmit(new Event('submit'));
        }
    };

    // Reset generated query when switching modes or changing input
    React.useEffect(() => {
        setShowGeneratedQuery(false);
        setGeneratedQuery('');
        setQueryExplanation('');
    }, [queryMode]);

    // Clear generated query when user starts typing new input
    const handleInputChange = (e) => {
        setQueryInput(e.target.value);
        if (queryMode === 'natural' && showGeneratedQuery) {
            setShowGeneratedQuery(false);
            setGeneratedQuery('');
            setQueryExplanation('');
        }
    };

    return (
        <>
            {/* Query Interface */}
            <div className='w-full flex flex-col gap-4'>
                {/* Mode Toggle */}
                <div className='flex items-center justify-between'>
                    <label className='text-gray-400 text-md font-semibold'>
                        {queryMode === 'natural' ? 'Natural Language Query' : 'MongoDB Query'}
                    </label>
                    
                    {/* Toggle Switch */}
                    <div className='flex items-center gap-3'>
                        <span className={`text-xs font-medium transition-colors ${queryMode === 'natural' ? 'text-brand-quaternary' : 'text-gray-500'}`}>
                            AI Assistant
                        </span>
                        <button
                            onClick={() => setQueryMode(queryMode === 'natural' ? 'query' : 'natural')}
                            className={` cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-quaternary focus:ring-offset-2 focus:ring-offset-brand-secondary ${
                                queryMode === 'natural' ? 'bg-brand-quaternary' : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    queryMode === 'natural' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                        <span className={`text-xs font-medium transition-colors ${queryMode === 'query' ? 'text-brand-quaternary' : 'text-gray-500'}`}>
                            Write Query
                        </span>
                    </div>
                </div>
                
                <div className="relative">
                    <textarea 
                        className="w-full px-3 py-2 pr-20 rounded bg-[#2d4c38] text-white border border-brand-tertiary font-mono text-md h-32 resize-none cursor-text" 
                        value={queryInput} 
                        onChange={handleInputChange} 
                        placeholder={getPlaceholder()}
                        required 
                    />
                    {/* Only show save button in manual mode or when no generated query is shown */}
                    {queryMode === 'query' && (
                    <button 
                        onClick={handleSaveClick}
                        disabled={queryLoading || !queryInput.trim()}
                        className={`absolute bottom-4 right-2 px-3 py-1.5 rounded-md text-white text-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${buttonState.className} ${(!queryInput.trim() || queryLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
                        title="Save Query"
                    >
                        {buttonState.icon}
                        {buttonState.text}
                    </button>
                    )}
                </div>
                
                <p className='text-xs text-gray-500'>
                    {getHelperText()}
                </p>
                
                {/* Natural Language Mode - Generate Button */}
                {queryMode === 'natural' && !showGeneratedQuery && (
                    <button 
                        onClick={handleGenerateQuery}
                        disabled={isGenerating || !queryInput.trim()}
                        className={`w-full h-12 rounded-md bg-brand-quaternary text-white text-md font-bold uppercase hover:bg-opacity-80 hover:scale-102 transition-all duration-300 cursor-pointer ${(isGenerating || !queryInput.trim()) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {isGenerating ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Generating Query...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Sparkles size={16} />
                                <span>Generate Query</span>
                            </div>
                        )}
                    </button>
                )}

                {/* Generated Query Display */}
                {queryMode === 'natural' && showGeneratedQuery && generatedQuery && (
                    <div className='w-full bg-[#2d4c38] text-white p-4 rounded-lg border border-brand-tertiary'>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-brand-quaternary text-sm font-medium">Generated MongoDB Query:</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleSaveClick}
                                    disabled={queryLoading || !generatedQuery.trim()}
                                    className={`flex items-center gap-2 px-3 py-1.5 bg-brand-quaternary text-white rounded-md text-sm font-medium hover:bg-opacity-80 transition-all duration-200 cursor-pointer ${(!generatedQuery.trim() || queryLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Save Query"
                                >
                                    {buttonState.icon}
                                    {buttonState.text}
                                </button>
                                <button
                                    onClick={() => setShowGeneratedQuery(false)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-quaternary text-white rounded-md text-sm font-medium hover:bg-opacity-80 transition-all duration-200 cursor-pointer"
                                >
                                    <RefreshCw size={14} />
                                    Regenerate
                                </button>
                            </div>
                        </div>
                        <pre className="font-mono text-sm bg-[#1a2f24] p-3 rounded border border-gray-600 mb-4 overflow-x-auto">{generatedQuery}</pre>
                        
                        {/* Query Explanation - More Prominent */}
                        {queryExplanation && (
                            <div className="mb-4 p-4 bg-[#1a2f24] rounded-lg border border-brand-quaternary">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-brand-quaternary text-lg">💡</span>
                                    <span className="text-brand-quaternary text-sm font-bold">How this query works:</span>
                                </div>
                                <p className="text-gray-200 text-sm leading-relaxed">{queryExplanation}</p>
                            </div>
                        )}
                        
                        {/* Execute Button */}
                        <button 
                            onClick={handleExecuteGeneratedQuery}
                            disabled={queryLoading}
                            className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${queryLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {queryLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Executing Query...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <Play size={16} />
                                    <span>Execute Query</span>
                                </div>
                            )}
                        </button>
                    </div>
                )}
                
                {/* Query Mode - Direct Execute Button */}
                {queryMode === 'query' && (
                <button 
                    onClick={handleQuerySubmit}
                    disabled={queryLoading}
                    className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${queryLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {queryLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Executing Query...</span>
                        </div>
                    ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Code size={16} />
                                <span>Execute Query</span>
                            </div>
                    )}
                </button>
                )}
                
                {queryError && (
                    <div className="bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded text-center">
                        {queryError}
                    </div>
                )}
            </div>

            {/* Query Results */}
            {queryResult && (
                <div className='w-full bg-[#2d4c38] text-white p-4 rounded-lg overflow-x-auto'>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-xs">Result:</span>
                        <span className="text-gray-400 text-xs">
                            {Array.isArray(queryResult) ? `${queryResult.length} document(s)` : 'Single result'}
                        </span>
                    </div>
                    <pre className="font-mono text-sm max-h-96 overflow-y-auto">{JSON.stringify(queryResult, null, 2)}</pre>
                </div>
            )}

            <p className='text-gray-400 text-sm text-center mt-2'>
                {queryMode === 'natural' 
                    ? 'Describe your query in plain English and let AI generate the MongoDB query for you.'
                    : 'Execute MongoDB queries safely in this playground environment.'
                }
            </p>
        </>
    );
}

export default QueryInterface; 