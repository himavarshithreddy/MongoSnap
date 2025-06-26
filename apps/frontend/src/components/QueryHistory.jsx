import React from 'react';
import { Clock, Play, Copy, Trash2, CheckCircle, XCircle } from 'lucide-react';

function QueryHistory({ 
    queryHistory, 
    executeHistoryQuery, 
    copyToQueryInput, 
    deleteHistoryItem,
    formatTimestamp 
}) {
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
                <h2 className='text-white text-2xl font-bold'>Query History</h2>
                <div className="flex items-center gap-2 text-gray-400">
                    <Clock size={20} />
                    <span className="text-sm">Recent queries</span>
                </div>
            </div>
            
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
                    <p className="text-lg mb-2">No query history yet</p>
                    <p className="text-sm text-gray-500">
                        Execute some queries to see them appear here
                    </p>
                </div>
            )}
        </div>
    );
}

export default QueryHistory; 