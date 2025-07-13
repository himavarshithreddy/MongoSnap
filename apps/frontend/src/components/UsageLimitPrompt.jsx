import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Clock, BarChart3, TrendingUp } from 'lucide-react';

const UsageLimitPrompt = ({ 
    limitType,
    usage,
    title,
    description,
    onClose,
    inline = false
}) => {
    const navigate = useNavigate();

    const handleUpgrade = () => {
        navigate('/pricing');
        if (onClose) onClose();
    };

    const getLimitIcon = () => {
        switch (limitType) {
            case 'daily_limit_exceeded':
                return <Clock size={20} className="text-orange-400" />;
            case 'monthly_limit_exceeded':
                return <BarChart3 size={20} className="text-red-400" />;
            default:
                return <TrendingUp size={20} className="text-yellow-400" />;
        }
    };

    const getLimitColor = () => {
        switch (limitType) {
            case 'daily_limit_exceeded':
                return 'from-orange-500/10 to-yellow-500/10 border-orange-500/20';
            case 'monthly_limit_exceeded':
                return 'from-red-500/10 to-orange-500/10 border-red-500/20';
            default:
                return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20';
        }
    };

    if (inline) {
        return (
            <div className={`bg-gradient-to-r ${getLimitColor()} rounded-lg p-4 border`}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        {getLimitIcon()}
                    </div>
                    <div className="flex-1">
                        <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
                        <p className="text-gray-300 text-xs mb-2">{description}</p>
                        
                        {usage && (
                            <div className="text-xs text-gray-400 mb-3">
                                <div className="flex items-center justify-between">
                                    <span>Daily: {usage.daily?.used || 0}/{usage.daily?.limit || 0}</span>
                                    <span>Monthly: {usage.monthly?.used || 0}/{usage.monthly?.limit || 0}</span>
                                </div>
                            </div>
                        )}
                        
                        <button
                            onClick={handleUpgrade}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all duration-200 text-xs font-medium cursor-pointer"
                        >
                            <Sparkles size={12} />
                            Upgrade for Unlimited
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
                    <div className="w-16 h-16 bg-orange-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        {getLimitIcon()}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-300 mb-4">{description}</p>
                    
                    {usage && (
                        <div className="bg-brand-tertiary/50 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-semibold text-white mb-2">Current Usage</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-gray-400">Daily</div>
                                    <div className="text-white font-medium">
                                        {usage.daily?.used || 0}/{usage.daily?.limit || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Monthly</div>
                                    <div className="text-white font-medium">
                                        {usage.monthly?.used || 0}/{usage.monthly?.limit || 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-white mb-2">With SnapX:</h4>
                        <ul className="text-left space-y-1 text-sm text-gray-300">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                Unlimited daily & monthly usage
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                Enhanced AI generations (100/day)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                Save & organize queries
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                Export & upload databases
                            </li>
                        </ul>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                            I'll Wait
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

export default UsageLimitPrompt; 