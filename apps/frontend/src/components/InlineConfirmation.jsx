import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Play, X } from 'lucide-react';

function InlineConfirmation({ 
    isVisible,
    onConfirm, 
    onCancel, 
    title, 
    message, 
    operation, 
    query,
    dangerLevel = 'medium',
    className = ''
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand when first shown
    useEffect(() => {
        if (isVisible) {
            setIsExpanded(true);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    const getDangerStyles = () => {
        switch (dangerLevel) {
            case 'high':
                return {
                    border: 'border-red-400/40',
                    background: 'bg-red-500/10',
                    button: 'bg-red-500 hover:bg-red-600',
                    icon: 'text-red-400',
                    accent: 'border-l-red-400'
                };
            case 'medium':
                return {
                    border: 'border-yellow-400/40',
                    background: 'bg-yellow-500/10',
                    button: 'bg-yellow-500 hover:bg-yellow-600',
                    icon: 'text-yellow-400',
                    accent: 'border-l-yellow-400'
                };
            default:
                return {
                    border: 'border-orange-400/40',
                    background: 'bg-orange-500/10',
                    button: 'bg-orange-500 hover:bg-orange-600',
                    icon: 'text-orange-400',
                    accent: 'border-l-orange-400'
                };
        }
    };

    const styles = getDangerStyles();

    return (
        <div className={`border ${styles.border} ${styles.background} rounded-lg border-l-4 ${styles.accent} mb-4 ${className}`}>
            {/* Collapsed Header */}
            <div className="p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className={styles.icon} />
                        <span className="text-sm font-medium text-white">{title}</span>
                        {operation && (
                            <code className="text-xs bg-gray-700/50 px-1.5 py-0.5 rounded text-gray-300">
                                {operation}
                            </code>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
                            title="Cancel operation"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Quick message when collapsed */}
                {!isExpanded && (
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-300">{message}</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onCancel}
                                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`px-2 py-1 text-xs text-white rounded transition-colors flex items-center gap-1 cursor-pointer ${styles.button}`}
                            >
                                <Play size={12} />
                                Execute
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-600/30 pt-3">
                    <p className="text-sm text-gray-300 mb-3">{message}</p>
                    
                    {query && (
                        <div className="mb-3">
                            <span className="text-xs font-medium text-gray-400 block mb-1">Query:</span>
                            <div className="bg-[#2d4c38] rounded px-2 py-1.5 max-h-24 overflow-y-auto">
                                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{query}</pre>
                            </div>
                        </div>
                    )}

                    <div className={`p-2 rounded border ${styles.border} ${styles.background} mb-3`}>
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={12} className={`${styles.icon} mt-0.5 flex-shrink-0`} />
                            <div className="text-xs text-gray-200">
                                This operation cannot be undone.
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-3 py-1.5 text-sm text-white rounded transition-colors flex items-center gap-1 cursor-pointer ${styles.button}`}
                        >
                            <Play size={14} />
                            Execute Operation
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InlineConfirmation; 