import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Zap, Star } from 'lucide-react';

const UpgradePrompt = ({ 
    feature, 
    title, 
    description, 
    benefits = [],
    inline = false,
    onClose,
    showIcon = true 
}) => {
    const navigate = useNavigate();

    const handleUpgrade = () => {
        navigate('/pricing');
        if (onClose) onClose();
    };

    if (inline) {
        return (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    {showIcon && (
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                            <Zap size={16} className="text-white" />
                        </div>
                    )}
                    <div className="flex-1">
                        <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
                        <p className="text-gray-300 text-xs mb-3">{description}</p>
                        <button
                            onClick={handleUpgrade}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all duration-200 text-xs font-medium cursor-pointer"
                        >
                            <Sparkles size={12} />
                            Upgrade to SnapX
                            <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-brand-secondary border border-brand-tertiary rounded-2xl p-6 max-w-md w-full">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap size={24} className="text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-300 mb-4">{description}</p>
                    
                    {benefits.length > 0 && (
                        <div className="text-left mb-6">
                            <p className="text-sm font-semibold text-white mb-2">SnapX includes:</p>
                            <ul className="space-y-1">
                                {benefits.map((benefit, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                                        <Star size={12} className="text-purple-400 flex-shrink-0" />
                                        {benefit}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                            Maybe Later
                        </button>
                        <button
                            onClick={handleUpgrade}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center gap-2 font-semibold cursor-pointer"
                        >
                            <Sparkles size={16} />
                            Upgrade Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpgradePrompt; 