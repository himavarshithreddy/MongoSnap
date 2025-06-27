import React from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';

function QueryInterface({ 
    queryInput, 
    setQueryInput, 
    queryLoading, 
    queryError, 
    queryResult, 
    handleQuerySubmit,
    onSaveQuery,
    saveMessage 
}) {
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
                className: 'bg-[#35c56a69] hover:bg-[#35c56a7e]'
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

    return (
        <>
            {/* Query Interface */}
            <div className='w-full flex flex-col gap-4'>
                <div className='flex items-center justify-between'>
                    <label className='text-gray-400 text-md font-semibold'>MongoDB Query</label>
                </div>
                
                <div className="relative">
                    <textarea 
                        className="w-full px-3 py-2 pr-20 rounded bg-[#2d4c38] text-white border border-brand-tertiary font-mono text-sm h-32 resize-none cursor-text" 
                        value={queryInput} 
                        onChange={e => setQueryInput(e.target.value)} 
                        placeholder="db.collection.find({})"
                        required 
                    />
                    <button 
                        onClick={handleSaveClick}
                        disabled={queryLoading || !queryInput.trim()}
                        className={`absolute bottom-4 right-2 px-3 py-1.5 rounded-md text-white text-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${buttonState.className} ${(!queryInput.trim() || queryLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
                        title="Save Query"
                    >
                        {buttonState.icon}
                        {buttonState.text}
                    </button>
                </div>
                <p className='text-xs text-gray-500'>
                    Use MongoDB syntax like: db.collection.find(&#123;&#125;), db.collection.insertOne(&#123;...&#125;), etc.
                </p>
                
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
                        'Execute Query'
                    )}
                </button>
                
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
                Execute MongoDB queries safely in this playground environment.
            </p>
        </>
    );
}

export default QueryInterface; 