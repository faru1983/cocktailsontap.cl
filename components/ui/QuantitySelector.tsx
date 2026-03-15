import React from 'react';

interface QuantitySelectorProps {
    value: number;
    onChange: (delta: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    compact?: boolean; // Determines the size / padding
}

export default function QuantitySelector({
    value,
    onChange,
    min = 0,
    max,
    step = 1,
    className = '',
    compact = false,
}: QuantitySelectorProps) {

    const sizeClasses = compact 
        ? "w-[28px] h-[28px] text-[0.95rem] rounded-md" 
        : "w-14 h-14 text-2xl font-black rounded-none";
    
    const containerClasses = compact
        ? "flex items-center gap-1 border border-brand-border rounded-lg p-0.5 bg-[#f8fafc]"
        : "flex items-center bg-white border-2 border-brand-border rounded-2xl max-w-[240px] overflow-hidden";
        
    const btnBase = "flex items-center justify-center bg-white text-brand-text shadow-sm cursor-pointer transition-colors hover:bg-primary hover:text-white hover:border-primary";
    
    const btnClasses = compact
        ? `${sizeClasses} ${btnBase} border border-brand-border font-bold`
        : `${sizeClasses} flex items-center justify-center bg-slate-50 text-brand-text hover:bg-primary/10 hover:text-primary transition-colors font-black text-2xl`;

    const btnClassesLeft = compact ? btnClasses : `${btnClasses} border-r-2 border-brand-border`;
    const btnClassesRight = compact ? btnClasses : `${btnClasses} border-l-2 border-brand-border`;

    const inputClasses = compact
        ? "w-8 text-center bg-transparent border-none text-brand-text font-bold text-[0.95rem] outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        : "flex-1 w-full text-center font-black text-2xl text-brand-text bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const handleMinus = () => {
        if (value - step >= min) {
            onChange(-step);
        }
    };

    const handlePlus = () => {
        if (max === undefined || value + step <= max) {
            onChange(step);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === '' ? min : parseInt(e.target.value);
        if (!isNaN(val)) {
             // Calculate the delta to reach the target value
             const delta = val - value;
             onChange(delta);
        }
    };

    return (
        <div className={`${containerClasses} ${className}`}>
            <button
                type="button"
                className={btnClassesLeft}
                onClick={handleMinus}
            >
                −
            </button>
            <input
                type="number"
                min={min}
                max={max}
                className={inputClasses}
                value={value || ''}
                onChange={handleInputChange}
            />
            <button
                type="button"
                className={btnClassesRight}
                onClick={handlePlus}
            >
                +
            </button>
        </div>
    );
}
