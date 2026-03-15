import React from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
    message: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export default function InfoTooltip({
    message,
    position = 'top',
    className = ''
}: InfoTooltipProps) {
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    const arrowClasses = {
        top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-[#333] border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-[#333] border-l-transparent border-r-transparent border-t-transparent',
        left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-[#333] border-t-transparent border-b-transparent border-r-transparent',
        right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-[#333] border-t-transparent border-b-transparent border-l-transparent'
    };

    return (
        <div className={`group relative inline-flex items-center justify-center cursor-help ${className}`}>
            <Info className="w-4 h-4 text-slate-400 hover:text-primary transition-colors" />
            
            {/* Tooltip text */}
            <div className={`
                absolute z-50 invisible opacity-0 
                group-hover:visible group-hover:opacity-100 
                transition-all duration-300 
                bg-[#333] text-white text-[0.8rem] font-medium 
                px-3 py-2 rounded-lg whitespace-normal min-w-[200px] text-center
                shadow-xl
                ${positionClasses[position]}
            `}>
                {message}
                {/* Arrow */}
                <div className={`absolute border-[6px] w-0 h-0 ${arrowClasses[position]}`}></div>
            </div>
        </div>
    );
}
