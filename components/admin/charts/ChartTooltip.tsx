'use client';

import { formatCLP } from '@/lib/adminStats';

type TooltipPayloadItem = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
};

type ChartTooltipProps = {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
};

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-admin-border bg-admin-surface/95 backdrop-blur px-3 py-2 shadow-2xl">
            {label && <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">{label}</div>}
            <div className="space-y-1">
                {payload.map((item) => (
                    <div key={`${item.dataKey}-${item.name}`} className="flex items-center justify-between gap-4 text-xs">
                        <span className="flex items-center gap-2 text-slate-300 font-semibold">
                            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            {item.name}
                        </span>
                        <span className="text-white font-black">{formatCLP(Number(item.value) || 0)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
