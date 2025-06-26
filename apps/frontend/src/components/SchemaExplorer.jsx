import React from 'react';
import { RefreshCw, FileText, ChevronDown, ChevronRight } from 'lucide-react';

function SchemaExplorer({ 
    schema, 
    schemaLoading, 
    expandedCollections, 
    toggleCollection, 
    insertCollectionName, 
    fetchSchema,
    getTypeIcon,
    formatPercentage,
    formatFieldStats,
    formatNumber,
    formatBytes
}) {
    return (
        <div className='w-full'>
            <div className='flex items-center justify-between mb-6'>
                <h2 className='text-white text-2xl font-bold'>Database Schema</h2>
                <button
                    onClick={fetchSchema}
                    disabled={schemaLoading}
                    className="flex items-center cursor-pointer gap-2 px-4 py-2 bg-brand-quaternary text-white rounded-md hover:bg-opacity-80 transition-all duration-200"
                >
                    <RefreshCw size={16} className={schemaLoading ? 'animate-spin' : ''} />
                    {schemaLoading ? 'Loading...' : 'Refresh Schema'}
                </button>
            </div>
            
            {schema ? (
                <div className='space-y-6'>
                    <div className="text-gray-400 text-lg mb-6">
                        Database: <span className="text-white font-medium text-xl">{schema.databaseName}</span>
                    </div>
                    
                    {schema.collections.map((collection) => (
                        <div key={collection.name} className="border border-gray-700 rounded-lg bg-gray-800">
                            <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700"
                                onClick={() => toggleCollection(collection.name)}
                            >
                                <div className="flex items-center gap-3">
                                    {expandedCollections.has(collection.name) ? 
                                        <ChevronDown size={20} className="text-gray-400" /> : 
                                        <ChevronRight size={20} className="text-gray-400" />
                                    }
                                    <FileText size={20} className="text-blue-400" />
                                    <span 
                                        className="text-white text-lg font-medium hover:text-brand-quaternary cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            insertCollectionName(collection.name);
                                        }}
                                    >
                                        {collection.name}
                                    </span>
                                </div>
                                <div className="text-gray-400 text-sm">
                                    {formatNumber(collection.count)} documents
                                </div>
                            </div>
                            
                            {expandedCollections.has(collection.name) && (
                                <div className="px-6 pb-4 space-y-4">
                                    <div className="text-sm text-gray-400 grid grid-cols-2 gap-4">
                                        <div>Size: {formatBytes(collection.size)}</div>
                                        <div>Average Object Size: {formatBytes(collection.avgObjSize)}</div>
                                    </div>
                                    
                                    {collection.fields.length > 0 && (
                                        <div>
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                Fields:
                                                {collection.hasSchemaAnalysis && (
                                                    <span className="text-green-400 text-sm bg-green-900/20 px-2 py-1 rounded">
                                                        AI Analyzed
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {collection.fields.map((field, index) => (
                                                    <div key={index} className="border border-gray-700 rounded-lg p-3 bg-gray-900">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-xl">{getTypeIcon(field.type)}</span>
                                                            <span className="text-gray-300 font-medium text-base">{field.name}</span>
                                                            <span className="text-gray-500 text-sm">({field.type})</span>
                                                        </div>
                                                        
                                                        {/* Show type distribution if available */}
                                                        {field.types && field.types.length > 1 && (
                                                            <div className="text-gray-400 text-sm mb-2">
                                                                Types: {field.types.map(t => 
                                                                    `${t.type} (${formatPercentage(t.percentage)})`
                                                                ).join(', ')}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Show field statistics */}
                                                        {field.totalCount !== undefined && (
                                                            <div className="text-gray-400 text-sm mb-2">
                                                                {formatFieldStats(field)}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Show value ranges for numeric fields */}
                                                        {field.minValue !== undefined && field.maxValue !== undefined && (
                                                            <div className="text-gray-400 text-sm mb-2">
                                                                Range: {field.minValue} - {field.maxValue}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Show length ranges for string fields */}
                                                        {field.minLength !== undefined && field.maxLength !== undefined && (
                                                            <div className="text-gray-400 text-sm">
                                                                Length: {field.minLength} - {field.maxLength}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {collection.indexes.length > 0 && (
                                        <div>
                                            <div className="text-sm text-gray-400 mb-3">Indexes:</div>
                                            <div className="space-y-2">
                                                {collection.indexes.map((index, idx) => (
                                                    <div key={idx} className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
                                                        {index.name} {index.unique && <span className="text-green-400">(unique)</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-400 text-lg">
                    {schemaLoading ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-quaternary"></div>
                            <p>Loading database schema...</p>
                            <p className="text-sm text-gray-500">This may take a few moments</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <FileText size={48} className="text-gray-500" />
                            <p>Click "Refresh Schema" to explore your database structure</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default SchemaExplorer; 