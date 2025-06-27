import React from 'react';
import { RefreshCw, FileText, ChevronDown, ChevronRight, Database, BarChart3 } from 'lucide-react';

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
    // Calculate database overview statistics
    const getDatabaseOverview = () => {
        if (!schema || !schema.collections) return null;
        
        const totalCollections = schema.collections.length;
        const totalDocuments = schema.collections.reduce((sum, collection) => sum + (collection.count || 0), 0);
        const totalSize = schema.collections.reduce((sum, collection) => sum + (collection.size || 0), 0);
        
        return {
            totalCollections,
            totalDocuments,
            totalSize
        };
    };

    const overview = getDatabaseOverview();

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
                    {/* Database Overview */}
                    {overview && (
                        <div className="bg-[#2d4c38] rounded-lg p-4 border border-gray-700">
                            <div className="text-gray-400 text-sm mb-1">
                                Database: <span className="text-white font-medium">{schema.databaseName}</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-[#243c2d] p-3 rounded border border-gray-700">
                                    <div className="text-gray-400 text-xs mb-1">Collections</div>
                                    <div className="text-white text-xl font-semibold">{formatNumber(overview.totalCollections)}</div>
                                </div>
                                
                                <div className="bg-[#243c2d] p-3 rounded border border-gray-700">
                                    <div className="text-gray-400 text-xs mb-1">Documents</div>
                                    <div className="text-white text-xl font-semibold">{formatNumber(overview.totalDocuments)}</div>
                                </div>
                                
                                <div className="bg-[#243c2d] p-3 rounded border border-gray-700">
                                    <div className="text-gray-400 text-xs mb-1">Total Size</div>
                                    <div className="text-white text-lg font-semibold">{formatBytes(overview.totalSize)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Collections List */}
                    <div>
                        <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-green-400" />
                            Collections ({schema.collections.length})
                        </h3>
                        
                        {schema.collections.map((collection) => (
                            <div key={collection.name} className="border border-gray-700 rounded-lg bg-[#2d4c38] mb-4">
                                <div 
                                    className="flex items-center justify-between p-4 cursor-pointer "
                                    onClick={() => toggleCollection(collection.name)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedCollections.has(collection.name) ? 
                                            <ChevronDown size={20} className="text-gray-400" /> : 
                                            <ChevronRight size={20} className="text-gray-400" />
                                        }
                                        <FileText size={20} className="text-green-400" />
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
                                                        <div key={index} className="border border-gray-700 rounded-lg p-3 bg-[#243c2d]">
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
                                                        <div key={idx} className="text-sm text-gray-300 bg-[#243c2d] p-2 rounded">
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
                            <p>Click "Refresh Schema" or "Reconnect to the Database" to explore your database structure</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default SchemaExplorer; 