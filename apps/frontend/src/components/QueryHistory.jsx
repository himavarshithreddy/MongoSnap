import React, { useState } from 'react';
import { Clock, Play, Copy, Trash2, CheckCircle, XCircle, BookOpen, Save } from 'lucide-react';

function QueryHistory({ 
    queryHistory, 
    savedQueries = [],
    executeHistoryQuery, 
    copyToQueryInput, 
    deleteHistoryItem,
    deleteSavedQuery,
    formatTimestamp 
}) {
    const [activeHistoryTab, setActiveHistoryTab] = useState('history'); // 'history' or 'saved'

    // Mock query history data - this should be moved to the parent component
    const mockQueryHistory = [
        {
            id: 1,
            query: 'db.users.find({"status": "active"})',
            result: '5 documents returned',
            timestamp: '2024-01-15T10:30:00Z',
            status: 'success'
        },
        {
            id: 2,
            query: 'db.products.insertOne({"name": "New Product", "price": 29.99})',
            result: 'Document inserted successfully',
            timestamp: '2024-01-15T10:25:00Z',
            status: 'success'
        },
        {
            id: 3,
            query: 'db.users.updateOne({"_id": ObjectId("...")}, {"$set": {"lastLogin": new Date()}})',
            result: '1 document modified',
            timestamp: '2024-01-15T10:20:00Z',
            status: 'success'
        },
        {
            id: 4,
            query: 'db.invalid_collection.find({})',
            result: 'Collection not found',
            timestamp: '2024-01-15T10:15:00Z',
            status: 'error'
        },
        {
            id: 5,
            query: 'db.orders.aggregate([{"$match": {"status": "pending"}}, {"$group": {"_id": "$customerId", "total": {"$sum": "$amount"}}}])',
            result: '3 documents returned',
            timestamp: '2024-01-15T10:10:00Z',
            status: 'success'
        }
    ];

    // Use provided queryHistory or fall back to mock data
    const historyData = queryHistory || mockQueryHistory;

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
                        Execution History ({historyData.length})
                    </button>
                    
                    <button
                        onClick={() => setActiveHistoryTab('saved')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                            activeHistoryTab === 'saved' 
                                ? 'bg-brand-quaternary text-white shadow-md' 
                                : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                        }`}
                    >
                        <BookOpen size={16} />
                        Saved Queries ({savedQueries.length})
                    </button>
                </div>
            </div>
            
            {/* Execution History Tab */}
            {activeHistoryTab === 'history' && (
                <>
                    {historyData.length > 0 ? (
                        <div className='space-y-4'>
                            {historyData.map((item, index) => (
                                <div key={item.id || index} className="border border-gray-700 rounded-lg bg-[#2d4c38] p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-sm">
                                                {formatTimestamp ? formatTimestamp(item.timestamp) : new Date(item.timestamp).toLocaleString()}
                                            </span>
                                            {item.status === 'success' ? (
                                                <CheckCircle size={16} className="text-green-400" />
                                            ) : (
                                                <XCircle size={16} className="text-red-400" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyToQueryInput && copyToQueryInput(item.query)}
                                                className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                title="Copy to query input"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={() => executeHistoryQuery && executeHistoryQuery(item.query)}
                                                className="p-1 text-gray-400 hover:text-green-400 transition-colors cursor-pointer"
                                                title="Execute query"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteHistoryItem && deleteHistoryItem(index)}
                                                className="p-1 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Delete from history"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-[#243c2d] p-3 rounded mb-3">
                                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                                            {item.query}
                                        </pre>
                                    </div>
                                    
                                    {item.status === 'success' && item.result && (
                                        <div className="text-xs text-gray-400">
                                            {item.result}
                                        </div>
                                    )}
                                    
                                    {item.status === 'error' && item.result && (
                                        <div className="text-xs text-red-400">
                                            Error: {item.result}
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
                    {savedQueries.length > 0 ? (
                        <div className='space-y-4'>
                            {savedQueries.map((item, index) => (
                                <div key={item.id || index} className="border border-gray-700 rounded-lg bg-[#2d4c38] p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            <Save size={14} className="text-brand-quaternary" />
                                            <span>Saved: {formatTimestamp ? formatTimestamp(item.timestamp) : new Date(item.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyToQueryInput && copyToQueryInput(item.query)}
                                                className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                title="Copy to query input"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={() => executeHistoryQuery && executeHistoryQuery(item.query)}
                                                className="p-1 text-gray-400 hover:text-green-400 transition-colors cursor-pointer"
                                                title="Execute query"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteSavedQuery && deleteSavedQuery(index)}
                                                className="p-1 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Delete saved query"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-[#243c2d] p-3 rounded">
                                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                                            {item.query}
                                        </pre>
                                    </div>
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
        </div>
    );
}

export default QueryHistory; 