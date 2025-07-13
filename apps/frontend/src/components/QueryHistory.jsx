import React, { useState } from 'react';
import { Clock, Play, Copy, Trash2, CheckCircle, XCircle, BookOpen, Save, Eye, EyeOff, Check } from 'lucide-react';
import InlineConfirmation from './InlineConfirmation';
import { analyzeDangerousOperation } from '../utils/dangerousOperations';
import { useSubscription } from '../hooks/useUser';
import UpgradePrompt from './UpgradePrompt';
import SnapXBadge from './SnapXBadge';

function QueryHistory({ 
    queryHistory, 
    savedQueries = [],
    executeHistoryQuery, 
    copyToQueryInput, 
    deleteHistoryItem,
    deleteSavedQuery,
    formatTimestamp,
    historyLoading = false,
    savedQueriesLoading = false,
    pagination = null
}) {
    const [activeHistoryTab, setActiveHistoryTab] = useState('history'); // 'history' or 'saved'
    const [expandedResults, setExpandedResults] = useState(new Set()); // Track which results are expanded
    const [copiedQueryId, setCopiedQueryId] = useState(null); // Track which query was just copied
    const [copiedResultId, setCopiedResultId] = useState(null); // Track which result was just copied
    // State for inline confirmation - track which item is showing confirmation
    const [confirmingItemId, setConfirmingItemId] = useState(null);
    const [pendingQuery, setPendingQuery] = useState(null);
    const [dangerousOperation, setDangerousOperation] = useState(null);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    
    // Subscription status
    const { features } = useSubscription();

    // Format result for display
    const formatResult = (result, status, documentsAffected, operation) => {
        if (status === 'error') {
            return 'Query failed';
        }
        
        if (Array.isArray(result)) {
            return `${result.length} document(s) returned`;
        }
        
        if (operation === 'insertOne' || operation === 'insertMany') {
            return `Document(s) inserted successfully`;
        }
        
        if (operation === 'updateOne' || operation === 'updateMany') {
            return `${documentsAffected || 0} document(s) modified`;
        }
        
        if (operation === 'deleteOne' || operation === 'deleteMany') {
            return `${documentsAffected || 0} document(s) deleted`;
        }
        
        if (operation === 'countDocuments' || operation === 'estimatedDocumentCount') {
            return `Count: ${result}`;
        }
        
        return 'Query executed successfully';
    };

    // Toggle result expansion
    const toggleResultExpansion = (itemId) => {
        const newExpanded = new Set(expandedResults);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedResults(newExpanded);
    };

    // Handle copy with feedback
    const handleCopyQuery = (query, itemId) => {
        // Copy query to clipboard
        navigator.clipboard.writeText(query).then(() => {
            // Show visual feedback
            setCopiedQueryId(itemId);
            setTimeout(() => {
                setCopiedQueryId(null);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy query to clipboard:', err);
        });
    };

    // Handle copying result with feedback
    const handleCopyResult = (result, itemId) => {
        const resultText = formatDetailedResult(result);
        navigator.clipboard.writeText(resultText).then(() => {
            // Show visual feedback
            setCopiedResultId(itemId);
            setTimeout(() => {
                setCopiedResultId(null);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy result to clipboard:', err);
        });
    };

    // Format result for detailed view
    const formatDetailedResult = (result) => {
        if (!result) return 'No result data available';
        
        try {
            return JSON.stringify(result, null, 2);
        } catch (error) {
            return String(result);
        }
    };

    // Handle executing query with confirmation check
    const handleExecuteWithConfirmation = (query, itemId) => {
        const dangerousOp = analyzeDangerousOperation(query);
        
        if (dangerousOp) {
            setDangerousOperation(dangerousOp);
            setPendingQuery(query);
            setConfirmingItemId(itemId);
            return;
        }
        
        // If not dangerous, execute directly
        executeHistoryQuery && executeHistoryQuery(query);
    };

    // Handle confirmation dialog
    const handleConfirmExecution = () => {
        setConfirmingItemId(null);
        if (pendingQuery && executeHistoryQuery) {
            executeHistoryQuery(pendingQuery);
        }
        setPendingQuery(null);
        setDangerousOperation(null);
    };

    const handleCancelExecution = () => {
        setConfirmingItemId(null);
        setPendingQuery(null);
        setDangerousOperation(null);
    };

    return (
        <div className='w-full'>
            <div className='flex items-center justify-between mb-6'>
                <h2 className='text-white text-2xl font-bold'>Query Management</h2>
                <div className="flex items-center gap-2 text-gray-400">
                    {activeHistoryTab === 'history' ? (
                        <>
                            <Clock size={20} />
                            <span className="text-sm">Execution history</span>
                        </>
                    ) : (
                        <>
                            <BookOpen size={20} />
                            <span className="text-sm">Saved queries</span>
                        </>
                    )}
                </div>
            </div>

            {/* History Type Tabs */}
            <div className='flex justify-center mb-6'>
                <div className='flex bg-brand-tertiary rounded-lg p-1 gap-1'>
                    <button
                        onClick={() => setActiveHistoryTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                            activeHistoryTab === 'history' 
                                ? 'bg-brand-quaternary text-white shadow-md' 
                                : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                        }`}
                    >
                        <Clock size={16} />
                        Execution History ({queryHistory.length})
                    </button>
                    
                    <button
                        onClick={() => {
                            if (!features.saveQueries) {
                                setShowUpgradePrompt(true);
                                return;
                            }
                            setActiveHistoryTab('saved');
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                            activeHistoryTab === 'saved' 
                                ? 'bg-brand-quaternary text-white shadow-md' 
                                : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                        }`}
                    >
                        <BookOpen size={16} />
                        Saved Queries ({features.saveQueries ? savedQueries.length : 0})
                        {!features.saveQueries && <SnapXBadge variant="small" className="ml-1" />}
                    </button>
                </div>
            </div>
            
            {/* Execution History Tab */}
            {activeHistoryTab === 'history' && (
                <>
                    {/* Show limit message for Snap users */}
                    {pagination && pagination.limited && (
                        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-400">
                                <Clock size={16} />
                                <span className="text-sm font-medium">{pagination.message}</span>
                            </div>
                        </div>
                    )}
                    
                    {historyLoading ? (
                        <div className="text-center py-12 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-quaternary mx-auto mb-4"></div>
                            <p className="text-sm">Loading query history...</p>
                        </div>
                    ) : queryHistory.length > 0 ? (
                        <div className='space-y-4'>
                            {queryHistory.map((item) => (
                                <div key={item._id} className="border border-gray-700 rounded-lg bg-[#2d4c38] p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-sm">
                                                {formatTimestamp ? formatTimestamp(item.createdAt) : new Date(item.createdAt).toLocaleString()}
                                            </span>
                                            {item.status === 'success' ? (
                                                <CheckCircle size={16} className="text-green-400" />
                                            ) : (
                                                <XCircle size={16} className="text-red-400" />
                                            )}
                                            {item.executionTime && (
                                                <span className="text-xs text-gray-500">
                                                    ({item.executionTime}ms)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleCopyQuery(item.query, item._id)}
                                                className={`p-1 text-gray-400 hover:text-white transition-colors cursor-pointer rounded ${
                                                    copiedQueryId === item._id ? 'bg-brand-quaternary text-white' : ''
                                                }`}
                                                title={copiedQueryId === item._id ? "Copied to clipboard!" : "Copy query to clipboard"}
                                            >
                                                {copiedQueryId === item._id ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                            <button
                                                onClick={() => handleExecuteWithConfirmation(item.query, item._id)}
                                                className="p-1 text-gray-400 hover:text-green-400 transition-colors cursor-pointer"
                                                title="Execute query"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteHistoryItem && deleteHistoryItem(item._id)}
                                                className="p-1 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Delete from history"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Show natural language if available */}
                                    {item.naturalLanguage && (
                                        <div className="mb-3 p-2 bg-[#1a2f24] rounded border-l-2 border-brand-quaternary">
                                            <span className="text-xs text-brand-quaternary font-medium">Natural Language:</span>
                                            <p className="text-sm text-gray-300 mt-1">{item.naturalLanguage}</p>
                                        </div>
                                    )}
                                    
                                    <div className="bg-[#243c2d] p-3 rounded mb-3">
                                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                                            {item.query}
                                        </pre>
                                    </div>
                                    
                                    {/* Inline Confirmation for this item */}
                                    {confirmingItemId === item._id && (
                                        <InlineConfirmation
                                            isVisible={true}
                                            onConfirm={handleConfirmExecution}
                                            onCancel={handleCancelExecution}
                                            title={dangerousOperation?.title || 'Dangerous Operation'}
                                            message={dangerousOperation?.message || 'This operation may be dangerous.'}
                                            operation={dangerousOperation?.operation}
                                            query={pendingQuery}
                                            dangerLevel={dangerousOperation?.level || 'medium'}
                                        />
                                    )}
                                    
                                    <div className="flex items-center justify-between">
                                        <div>
                                            {item.status === 'success' && (
                                                <div className="text-xs text-gray-400">
                                                    {formatResult(item.result, item.status, item.documentsAffected, item.operation)}
                                                </div>
                                            )}
                                            
                                            {item.status === 'error' && item.errorMessage && (
                                                <div className="text-xs text-red-400">
                                                    Error: {item.errorMessage}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Prominent View Results Button */}
                                        {item.result && (
                                            <button
                                                onClick={() => toggleResultExpansion(item._id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                                                    expandedResults.has(item._id)
                                                        ? 'bg-brand-quaternary text-white'
                                                        : 'bg-brand-tertiary text-gray-300 hover:bg-brand-quaternary hover:text-white'
                                                }`}
                                            >
                                                {expandedResults.has(item._id) ? (
                                                    <>
                                                        <EyeOff size={14} />
                                                        Hide Results
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye size={14} />
                                                        View Results
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded Results */}
                                    {expandedResults.has(item._id) && item.result && (
                                        <div className="mt-4 border-t border-gray-600 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-md font-semibold text-white">Query Results</h4>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleCopyResult(item.result, item._id)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 cursor-pointer ${
                                                            copiedResultId === item._id 
                                                                ? 'bg-green-600 text-white' 
                                                                : 'bg-brand-quaternary text-white hover:bg-opacity-80'
                                                        }`}
                                                        title="Copy result to clipboard"
                                                    >
                                                        {copiedResultId === item._id ? (
                                                            <>
                                                                <Check size={12} />
                                                                Copied!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={12} />
                                                                Copy Result
                                                            </>
                                                        )}
                                                    </button>
                                                    <span className="text-sm text-gray-400">
                                                        {item.status === 'success' ? (
                                                            <span className="text-green-400 flex items-center gap-1">
                                                                <CheckCircle size={14} />
                                                                Success
                                                            </span>
                                                        ) : (
                                                            <span className="text-red-400 flex items-center gap-1">
                                                                <XCircle size={14} />
                                                                Error
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-[#1a1a1a] border border-gray-700 rounded p-4 max-h-96 overflow-auto">
                                                {item.status === 'error' ? (
                                                    <div className="text-red-400">
                                                        {item.errorMessage || 'Query execution failed'}
                                                    </div>
                                                ) : (
                                                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                                                        {formatDetailedResult(item.result)}
                                                    </pre>
                                                )}
                                            </div>
                                            
                                            {item.executionTime && item.documentsAffected !== null && item.documentsAffected !== undefined && (
                                                <div className="flex items-center gap-4 text-sm text-gray-400 mt-3">
                                                    <span>Execution Time: {item.executionTime}ms</span>
                                                    <span>Documents Affected: {item.documentsAffected}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <Clock size={48} className="mx-auto mb-4 text-gray-500" />
                            <p className="text-lg mb-2">No execution history yet</p>
                            <p className="text-sm text-gray-500">
                                Execute some queries to see them appear here
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Saved Queries Tab */}
            {activeHistoryTab === 'saved' && (
                <>
                    {!features.saveQueries ? (
                        <UpgradePrompt
                            feature="saveQueries"
                            title="Unlock Query Management"
                            description="Save, organize, and reuse your MongoDB queries with SnapX."
                            benefits={[
                                'Save unlimited queries',
                                'Organize with tags and descriptions',
                                'Quick access to frequently used queries',
                                'Export and share query collections'
                            ]}
                            inline={true}
                        />
                    ) : savedQueriesLoading ? (
                        <div className="text-center py-12 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-quaternary mx-auto mb-4"></div>
                            <p className="text-sm">Loading saved queries...</p>
                        </div>
                    ) : savedQueries.length > 0 ? (
                        <div className='space-y-4'>
                            {savedQueries.map((item) => (
                                <div key={item._id} className="border border-gray-700 rounded-lg bg-[#2d4c38] p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            <Save size={14} className="text-brand-quaternary" />
                                            <span>Saved: {formatTimestamp ? formatTimestamp(item.createdAt) : new Date(item.createdAt).toLocaleDateString()}</span>
                                            {item.usageCount > 0 && (
                                                <span className="text-xs text-gray-500">
                                                    (Used {item.usageCount} times)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleCopyQuery(item.query, item._id)}
                                                className={`p-1 text-gray-400 hover:text-white transition-colors cursor-pointer rounded ${
                                                    copiedQueryId === item._id ? 'bg-brand-quaternary text-white' : ''
                                                }`}
                                                title={copiedQueryId === item._id ? "Copied to clipboard!" : "Copy query to clipboard"}
                                            >
                                                {copiedQueryId === item._id ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                            <button
                                                onClick={() => handleExecuteWithConfirmation(item.query, item._id)}
                                                className="p-1 text-gray-400 hover:text-green-400 transition-colors cursor-pointer"
                                                title="Execute query"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteSavedQuery && deleteSavedQuery(item._id)}
                                                className="p-1 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Delete saved query"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Show name and description if available */}
                                    {item.name && (
                                        <div className="mb-3">
                                            <span className="text-sm font-medium text-white">{item.name}</span>
                                            {item.description && (
                                                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Show natural language if available */}
                                    {item.naturalLanguage && (
                                        <div className="mb-3 p-2 bg-[#1a2f24] rounded border-l-2 border-brand-quaternary">
                                            <span className="text-xs text-brand-quaternary font-medium">Natural Language:</span>
                                            <p className="text-sm text-gray-300 mt-1">{item.naturalLanguage}</p>
                                        </div>
                                    )}
                                    
                                    <div className="bg-[#243c2d] p-3 rounded mb-3">
                                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                                            {item.query}
                                        </pre>
                                    </div>

                                    {/* Inline Confirmation for this item */}
                                    {confirmingItemId === item._id && (
                                        <InlineConfirmation
                                            isVisible={true}
                                            onConfirm={handleConfirmExecution}
                                            onCancel={handleCancelExecution}
                                            title={dangerousOperation?.title || 'Dangerous Operation'}
                                            message={dangerousOperation?.message || 'This operation may be dangerous.'}
                                            operation={dangerousOperation?.operation}
                                            query={pendingQuery}
                                            dangerLevel={dangerousOperation?.level || 'medium'}
                                        />
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div>
                                            {/* Show result summary if available */}
                                            {item.result && (
                                                <div className="text-xs text-gray-400">
                                                    Result saved: {formatResult(item.result, 'success', item.documentsAffected, item.operation)}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Prominent View Results Button */}
                                        {item.result && (
                                            <button
                                                onClick={() => toggleResultExpansion(item._id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                                                    expandedResults.has(item._id)
                                                        ? 'bg-brand-quaternary text-white'
                                                        : 'bg-brand-tertiary text-gray-300 hover:bg-brand-quaternary hover:text-white'
                                                }`}
                                            >
                                                {expandedResults.has(item._id) ? (
                                                    <>
                                                        <EyeOff size={14} />
                                                        Hide Results
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye size={14} />
                                                        View Results
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded Results */}
                                    {expandedResults.has(item._id) && item.result && (
                                        <div className="mt-4 border-t border-gray-600 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-md font-semibold text-white">Saved Results</h4>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleCopyResult(item.result, item._id)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 cursor-pointer ${
                                                            copiedResultId === item._id 
                                                                ? 'bg-green-600 text-white' 
                                                                : 'bg-brand-quaternary text-white hover:bg-opacity-80'
                                                        }`}
                                                        title="Copy result to clipboard"
                                                    >
                                                        {copiedResultId === item._id ? (
                                                            <>
                                                                <Check size={12} />
                                                                Copied!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={12} />
                                                                Copy Result
                                                            </>
                                                        )}
                                                    </button>
                                                    <span className="text-sm text-gray-400">
                                                        <span className="text-green-400 flex items-center gap-1">
                                                            <CheckCircle size={14} />
                                                            Success
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-[#1a1a1a] border border-gray-700 rounded p-4 max-h-96 overflow-auto">
                                                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                                                    {formatDetailedResult(item.result)}
                                                </pre>
                                            </div>
                                            
                                            {item.documentsAffected !== null && item.documentsAffected !== undefined && (
                                                <div className="flex items-center gap-4 text-sm text-gray-400 mt-3">
                                                    <span>Documents Affected: {item.documentsAffected}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <BookOpen size={48} className="mx-auto mb-4 text-gray-500" />
                            <p className="text-lg mb-2">No saved queries yet</p>
                            <p className="text-sm text-gray-500">
                                Save queries from the Query Interface to see them here
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Upgrade Prompt Modal */}
            {showUpgradePrompt && (
                <UpgradePrompt
                    feature="saveQueries"
                    title="Unlock Query Management"
                    description="Save, organize, and reuse your MongoDB queries with SnapX."
                    benefits={[
                        'Save unlimited queries',
                        'Organize with tags and descriptions',
                        'Quick access to frequently used queries',
                        'Export and share query collections'
                    ]}
                    onClose={() => setShowUpgradePrompt(false)}
                />
            )}
        </div>
    );
}

export default QueryHistory; 