import type { ReactNode } from 'react';
import { formatCLP, formatPctDelta } from '@/lib/adminStats';

type DeltaBadgeProps = {
    label: string;
    delta: number;
    amount: number;
    invert?: boolean;
    positiveClass?: string;
    className?: string;
};

export function DeltaBadge({
    label,
    delta,
    amount,
    invert = false,
    positiveClass = 'text-emerald-300',
    className = '',
}: DeltaBadgeProps) {
    const positive = invert ? delta <= 0 : delta >= 0;
    return (
        <div className={`text-[10px] font-bold leading-snug ${positive ? positiveClass : 'text-rose-300'} ${className}`}>
            {label}: {formatPctDelta(delta)} ({formatCLP(amount)})
        </div>
    );
}

type DeltaChipProps = {
    children: ReactNode;
    positive?: boolean;
};

export function DeltaChip({ children, positive = true }: DeltaChipProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${
                positive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
            }`}
        >
            {children}
        </span>
    );
}
