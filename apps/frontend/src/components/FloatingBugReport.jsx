import React, { useState } from 'react';
import { Bug, MessageCircle, X } from 'lucide-react';
import BugReport from './BugReport';

const FloatingBugReport = ({ 
    page = 'unknown',
    connectionId = null,
    problematicQuery = '',
    collectionName = ''
}) => {
    const [showBugReportModal, setShowBugReportModal] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <>
            {/* Floating Action Button */}
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => setShowBugReportModal(true)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="group relative w-14 h-14 bg-brand-quaternary hover:bg-brand-quaternary/80 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105"
                    title="Report Bug or Issue"
                >
                    <Bug size={20} className="transition-transform duration-200 group-hover:scale-105" />
                    
                    {/* Tooltip */}
                    {isHovered && (
                        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap shadow-lg border border-gray-700 animate-in fade-in-0 slide-in-from-right-2 duration-200">
                            Report Bug/Issue
                            {/* Arrow pointing to button */}
                            <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-4 border-b-4 border-t-transparent border-b-transparent"></div>
                        </div>
                    )}
                </button>
            </div>

            {/* Bug Report Modal */}
            <BugReport 
                isOpen={showBugReportModal} 
                onClose={() => setShowBugReportModal(false)}
                page={page}
                connectionId={connectionId}
                problematicQuery={problematicQuery}
                collectionName={collectionName}
            />
        </>
    );
};

export default FloatingBugReport; 