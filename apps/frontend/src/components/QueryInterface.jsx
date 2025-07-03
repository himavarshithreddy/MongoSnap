import React, { useState } from 'react';
import { Save, Check, AlertCircle, MessageSquare, Code, Play, Sparkles, RefreshCw, Copy } from 'lucide-react';
import InlineConfirmation from './InlineConfirmation';
import { analyzeDangerousOperation } from '../utils/dangerousOperations';

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
    setQueryMode,
    onUsageUpdate
}) {
    const [generatedQuery, setGeneratedQuery] = useState('');
    const [queryExplanation, setQueryExplanation] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showGeneratedQuery, setShowGeneratedQuery] = useState(false);
    const [copiedResult, setCopiedResult] = useState(false);
    const [copiedGeneratedQuery, setCopiedGeneratedQuery] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [pendingQuery, setPendingQuery] = useState(null);
    const [dangerousOperation, setDangerousOperation] = useState(null);

    const handleSaveClick = () => {
        if (!queryInput.trim()) {
            return;
        }
        
        if (onSaveQuery) {
            onSaveQuery(queryInput);
        }
    };

    // Handle copying query results
    const handleCopyResult = async () => {
        if (!queryResult) return;
        
        try {
            const resultText = JSON.stringify(queryResult, null, 2);
            await navigator.clipboard.writeText(resultText);
            setCopiedResult(true);
            
            // Reset the copied state after 2 seconds
            setTimeout(() => {
                setCopiedResult(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy result to clipboard:', error);
        }
    };

    // Handle copying generated query
    const handleCopyGeneratedQuery = async () => {
        if (!generatedQuery) return;
        
        try {
            await navigator.clipboard.writeText(generatedQuery);
            setCopiedGeneratedQuery(true);
            
            // Reset the copied state after 2 seconds
            setTimeout(() => {
                setCopiedGeneratedQuery(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy generated query to clipboard:', error);
        }
    };

    // Check for dangerous operations and show confirmation if needed
    const checkDangerousOperation = (query, event, queryToExecute) => {
        const actualQuery = queryToExecute || query.trim();
        if (!actualQuery) return false;

        const dangerousOp = analyzeDangerousOperation(actualQuery);
        
        if (dangerousOp) {
            setDangerousOperation(dangerousOp);
            setPendingQuery({ event, queryToExecute, query: actualQuery });
            setShowConfirmation(true);
            return true;
        }
        
        return false;
    };

    // Handle confirmation dialog
    const handleConfirmExecution = () => {
        setShowConfirmation(false);
        if (pendingQuery) {
            // Execute the original query submission
            handleQuerySubmit(pendingQuery.event, pendingQuery.queryToExecute);
        }
        setPendingQuery(null);
        setDangerousOperation(null);
    };

    const handleCancelExecution = () => {
        setShowConfirmation(false);
        setPendingQuery(null);
        setDangerousOperation(null);
    };

    // Modified query submission handler
    const handleQuerySubmitWithConfirmation = (event, queryToExecute = null) => {
        // Check for dangerous operations first
        const actualQuery = queryToExecute || queryInput.trim();
        if (checkDangerousOperation(actualQuery, event, queryToExecute)) {
            return; // Stop execution, confirmation dialog will handle it
        }
        
        // If not dangerous, proceed with normal execution
        handleQuerySubmit(event, queryToExecute);
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

    // Function to render markdown-style bold text as JSX
    const renderFormattedText = (text) => {
        if (!text) return '';
        
        // Split text by **bold** markers and render accordingly
        const parts = text.split(/(\*\*.*?\*\*)/g);
        
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // Remove the ** markers and render as bold
                const boldText = part.slice(2, -2);
                return <strong key={index} className="font-bold text-white">{boldText}</strong>;
            }
            return part;
        });
    };

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
            // Get connection ID from URL or context
            const urlParams = new URLSearchParams(window.location.search);
            const connectionId = urlParams.get('connectionId');
            
            if (!connectionId) {
                throw new Error('No active connection found');
            }

            // Call Gemini API to generate query
            const response = await fetch(`/api/connection/${connectionId}/generate-query`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ naturalLanguage: queryInput })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setGeneratedQuery(data.data.query);
                    setQueryExplanation(data.data.explanation);
                    setShowGeneratedQuery(true);
                    
                    // Update usage stats after successful AI generation
                    if (onUsageUpdate) {
                        onUsageUpdate();
                    }
                } else {
                    throw new Error(data.message || 'Failed to generate query');
                }
            } else {
                const errorData = await response.json();
                
                // Handle usage limit errors (429 status)
                if (response.status === 429) {
                    let limitError = '🚫 AI Generation Limit Reached\n\n';
                    
                    if (errorData.limitType === 'daily_limit_exceeded') {
                        limitError += `You've reached your daily AI generation limit. Your limit will reset tomorrow.\n\n`;
                    } else if (errorData.limitType === 'monthly_limit_exceeded') {
                        limitError += `You've reached your monthly AI generation limit. Your limit will reset next month.\n\n`;
                    } else {
                        limitError += `${errorData.message}\n\n`;
                    }
                    
                    if (errorData.usage) {
                        limitError += `Current Usage:\n`;
                        limitError += `Daily: ${errorData.usage.daily.used}/${errorData.usage.daily.limit}\n`;
                        limitError += `Monthly: ${errorData.usage.monthly.used}/${errorData.usage.monthly.limit}`;
                    }
                    
                    throw new Error(limitError);
                }
                
                throw new Error(errorData.message || 'Failed to generate query');
            }
        } catch (error) {
            console.error('Error generating query:', error);
            setQueryError(error.message || 'Failed to generate query');
            
            // Update usage stats when there's an error (especially for usage limits)
            if (onUsageUpdate) {
                onUsageUpdate();
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // Handle execute for natural language mode
    const handleExecuteGeneratedQuery = () => {
        if (generatedQuery) {
            // Don't replace the natural language input, just execute the generated query
            // Create a custom event with the generated query
            const customEvent = {
                preventDefault: () => {},
                target: { value: generatedQuery }
            };
            handleQuerySubmitWithConfirmation(customEvent, generatedQuery);
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
                        <span className={`text-xs font-medium transition-colors cursor-pointer ${queryMode === 'natural' ? 'text-brand-quaternary' : 'text-gray-500'}`}
                              onClick={() => setQueryMode('natural')}>
                            AI Assistant
                        </span>
                        <button
                            onClick={() => setQueryMode(queryMode === 'natural' ? 'query' : 'natural')}
                            className={`cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-quaternary focus:ring-offset-2 focus:ring-offset-brand-secondary ${
                                queryMode === 'natural' ? 'bg-brand-quaternary' : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    queryMode === 'natural' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                        <span className={`text-xs font-medium transition-colors cursor-pointer ${queryMode === 'query' ? 'text-brand-quaternary' : 'text-gray-500'}`}
                              onClick={() => setQueryMode('query')}>
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
                                    onClick={handleCopyGeneratedQuery}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                                        copiedGeneratedQuery 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-brand-quaternary text-white hover:bg-opacity-80'
                                    }`}
                                    title="Copy generated query to clipboard"
                                >
                                    {copiedGeneratedQuery ? (
                                        <>
                                            <Check size={14} />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            Copy Query
                                        </>
                                    )}
                                </button>
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
                        <pre className="font-mono text-sm bg-[#1a2f24] p-3 rounded border border-gray-600 mb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-brand-quaternary scrollbar-track-gray-700 hover:scrollbar-thumb-brand-tertiary">{generatedQuery}</pre>
                        
                        {/* Query Explanation - More Prominent */}
                        {queryExplanation && (
                            <div className="mb-4 p-4 bg-[#1a2f24] rounded-lg border border-brand-quaternary">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-brand-quaternary text-lg">💡</span>
                                    <span className="text-brand-quaternary text-sm font-bold">How this query works:</span>
                                </div>
                                <p className="text-gray-200 text-sm leading-relaxed">{renderFormattedText(queryExplanation)}</p>
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
                    onClick={handleQuerySubmitWithConfirmation}
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
                    <div className="bg-red-900/80 border border-red-500 text-red-200 px-4 py-3 rounded">
                        <div className="whitespace-pre-line text-left">
                        {queryError}
                        </div>
                    </div>
                )}

                {showConfirmation && (
                    <InlineConfirmation
                        isVisible={showConfirmation}
                        onConfirm={handleConfirmExecution}
                        onCancel={handleCancelExecution}
                        title={dangerousOperation?.title || 'Dangerous Operation'}
                        message={dangerousOperation?.message || 'This operation may be dangerous.'}
                        operation={dangerousOperation?.operation}
                        query={pendingQuery?.query}
                        dangerLevel={dangerousOperation?.level || 'medium'}
                    />
                )}
            </div>

            {/* Query Results */}
            {queryResult && (
                <div className='w-full bg-[#2d4c38] text-white p-4 rounded-lg overflow-x-auto'>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-xs">Result:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">
                                {Array.isArray(queryResult) ? `${queryResult.length} document(s)` : 'Single result'}
                            </span>
                            <button
                                onClick={handleCopyResult}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 cursor-pointer ${
                                    copiedResult 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-brand-quaternary text-white hover:bg-opacity-80'
                                }`}
                                title="Copy result to clipboard"
                            >
                                {copiedResult ? (
                                    <>
                                        <Check size={12} />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={12} />
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <pre className="font-mono text-sm max-h-96 overflow-y-auto query-results-scroll">{JSON.stringify(queryResult, null, 2)}</pre>
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