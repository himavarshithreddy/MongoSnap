import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

const ErrorNotification = ({ 
    message, 
    onDismiss, 
    autoDismiss = false, 
    autoDismissTime = 5000,
    className = '',
    showDismissButton = true 
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (autoDismiss && message) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                if (onDismiss) onDismiss();
            }, autoDismissTime);

            return () => clearTimeout(timer);
        }
    }, [autoDismiss, autoDismissTime, message, onDismiss]);

    const handleDismiss = () => {
        setIsVisible(false);
        if (onDismiss) onDismiss();
    };

    if (!isVisible || !message) return null;

    return (
        <div className={`bg-red-500/20 border border-red-500/50 rounded-lg p-4 animate-in fade-in-50 duration-200 ${className}`}>
            <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={16} className="text-red-400" />
                </div>
                <div className="flex-1">
                    <h4 className="text-red-200 text-sm font-medium mb-1">Error</h4>
                    <p className="text-red-300 text-sm leading-relaxed">{message}</p>
                </div>
                {showDismissButton && (
                    <button
                        onClick={handleDismiss}
                        className="text-xs bg-brand-tertiary text-gray-300 px-3 py-1.5 rounded-md hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer flex-shrink-0"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ErrorNotification; 