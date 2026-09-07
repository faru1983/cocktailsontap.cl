import type { ReactNode } from 'react';

type PanelProps = {
    title: string;
    subtitle?: string;
    accent?: 'primary' | 'event' | 'direct' | 'profit' | 'expense' | 'neutral';
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    scroll?: boolean;
};

const accentMap = {
    primary: 'bg-primary',
    event: 'bg-chart-event',
    direct: 'bg-chart-direct',
    profit: 'bg-chart-profit',
    expense: 'bg-chart-expense',
    neutral: 'bg-slate-500',
};

export function Panel({
    title,
    subtitle,
    accent = 'neutral',
    actions,
    children,
    className = '',
    bodyClassName = '',
    scroll = false,
}: PanelProps) {
    return (
        <section className={`@container bg-admin-surface rounded-2xl border border-admin-border shadow-xl shadow-black/20 overflow-hidden ${className}`}>
            <div className="flex flex-col @sm:flex-row @sm:items-start @sm:justify-between gap-3 px-4 py-4 @md:px-6 border-b border-admin-border">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-1 h-5 rounded-full shrink-0 mt-1 ${accentMap[accent]}`} />
                    <div className="min-w-0">
                        <h2 className="text-white text-base @md:text-lg font-extrabold capitalize truncate">{title}</h2>
                        {subtitle && <p className="text-slate-500 text-xs @md:text-sm mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>
            <div className={`${scroll ? 'max-h-[420px] overflow-y-auto hide-scrollbar' : ''} ${bodyClassName}`}>
                {children}
            </div>
        </section>
    );
}
