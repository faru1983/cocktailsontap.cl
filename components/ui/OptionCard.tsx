import React from 'react';
import { Check } from 'lucide-react';

interface OptionCardProps {
    id: string;
    label: string;
    icon?: React.ReactNode;
    description?: string;
    isSelected: boolean;
    onClick: (id: string) => void;
    className?: string;
}

export default function OptionCard({
    id,
    label,
    icon,
    description,
    isSelected,
    onClick,
    className = ''
}: OptionCardProps) {
    return (
        <div
            className={`group relative border-2 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-2 transition-all duration-300 overflow-hidden
                ${isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'bg-white border-brand-border text-brand-text-muted hover:border-primary/40 hover:bg-slate-50'
                }
                ${className}`}
            onClick={() => onClick(id)}
        >
            {isSelected && (
                <div className="absolute top-2.5 right-2.5 text-primary">
                    <Check className="w-4 h-4" />
                </div>
            )}
            {icon && (
                <div className={`transition-all duration-300 ${isSelected ? 'text-primary scale-110' : 'text-slate-400 group-hover:text-primary/70'}`}>
                    {icon}
                </div>
            )}
            <span className={`font-bold text-[0.9rem] leading-tight ${isSelected ? 'text-brand-text' : ''}`}>
                {label}
            </span>
            {description && (
                <span className="text-[0.8rem] font-medium leading-tight mt-1">
                    {description}
                </span>
            )}
        </div>
    );
}
