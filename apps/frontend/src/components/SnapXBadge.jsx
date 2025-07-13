import React from 'react';
import { Zap, Sparkles } from 'lucide-react';

const SnapXBadge = ({ 
    variant = 'default', // 'default', 'small', 'inline'
    showText = true,
    className = ''
}) => {
    const variants = {
        default: {
            container: 'inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-md',
            icon: 'w-3 h-3 text-white',
            text: 'text-xs font-semibold text-white'
        },
        small: {
            container: 'inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded',
            icon: 'w-2.5 h-2.5 text-white',
            text: 'text-[10px] font-semibold text-white'
        },
        inline: {
            container: 'inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded',
            icon: 'w-2.5 h-2.5 text-purple-400',
            text: 'text-[10px] font-medium text-purple-300'
        }
    };

    const style = variants[variant];

    return (
        <div className={`${style.container} ${className}`}>
            <Zap className={style.icon} />
            {showText && (
                <span className={style.text}>
                    SnapX
                </span>
            )}
        </div>
    );
};

export default SnapXBadge; 