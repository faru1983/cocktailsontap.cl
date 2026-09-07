import type { ReactNode } from 'react';
import { DeltaBadge } from './DeltaBadge';
import { SplitBar } from './SplitBar';

type StatCardProps = {
    label: string;
    value: string;
    icon: ReactNode;
    sub?: string;
    accent?: 'emerald' | 'rose' | 'sky' | 'amber' | 'orange' | 'blue' | 'pink' | 'primary';
    eventAmount?: number;
    directAmount?: number;
    prevDelta?: { label: string; delta: number; amount: number; invert?: boolean; positiveClass?: string };
    yoyDelta?: { label: string; delta: number; amount: number; invert?: boolean; positiveClass?: string };
    className?: string;
};

const accentStyles = {
    emerald: 'border-t-emerald-400 text-emerald-400',
    rose: 'border-t-rose-400 text-rose-400',
    sky: 'border-t-sky-400 text-sky-400',
    amber: 'border-t-amber-400 text-amber-400',
    orange: 'border-t-orange-400 text-orange-400',
    blue: 'border-t-blue-400 text-blue-400',
    pink: 'border-t-pink-400 text-pink-400',
    primary: 'border-t-primary text-primary',
};

export function StatCard({
    label,
    value,
    icon,
    sub,
    accent = 'primary',
    eventAmount,
    directAmount,
    prevDelta,
    yoyDelta,
    className = '',
}: StatCardProps) {
    const styles = accentStyles[accent];
    const [borderClass, iconClass] = styles.split(' ');

    return (
        <div
            className={`@container bg-admin-surface border border-admin-border border-t-4 ${borderClass} rounded-2xl p-4 @md:p-5 shadow-xl shadow-black/20 hover:border-primary/20 transition-colors ${className}`}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className={iconClass}>{icon}</div>
            </div>
            <div className="text-lg @sm:text-xl @md:text-2xl font-black text-white leading-tight mb-1 truncate" title={value}>
                {value}
            </div>
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest truncate">{label}</div>
            {sub && <div className="text-slate-600 text-[10px] mt-1 italic truncate">{sub}</div>}
            {eventAmount !== undefined && directAmount !== undefined && (
                <SplitBar event={eventAmount} direct={directAmount} className="mt-3" />
            )}
            <div className="mt-2 space-y-1">
                {prevDelta && (
                    <DeltaBadge
                        label={prevDelta.label}
                        delta={prevDelta.delta}
                        amount={prevDelta.amount}
                        invert={prevDelta.invert}
                        positiveClass={prevDelta.positiveClass}
                    />
                )}
                {yoyDelta && (
                    <DeltaBadge
                        label={yoyDelta.label}
                        delta={yoyDelta.delta}
                        amount={yoyDelta.amount}
                        invert={yoyDelta.invert}
                        positiveClass={yoyDelta.positiveClass || 'text-emerald-300/90'}
                    />
                )}
            </div>
        </div>
    );
}
