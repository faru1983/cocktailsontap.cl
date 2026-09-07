'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCLP } from '@/lib/adminStats';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from '@/components/admin/ui/EmptyState';

export type CategoryBarItem = {
    name: string;
    value: number;
    color?: string;
    suffix?: string;
};

type CategoryBarsProps = {
    items: CategoryBarItem[];
    height?: number;
    defaultColor?: string;
    formatValue?: (value: number, item: CategoryBarItem) => string;
};

export function CategoryBars({
    items,
    height,
    defaultColor = '#a78bfa',
    formatValue,
}: CategoryBarsProps) {
    if (!items.length) {
        return <EmptyState message="Sin datos suficientes." />;
    }

    const chartHeight = height ?? Math.max(180, items.length * 44);
    const data = items.map((item) => ({ ...item, label: item.name }));

    return (
        <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const val = Number(payload[0]?.value) || 0;
                            const item = items.find((i) => i.name === label);
                            const display = formatValue ? formatValue(val, item!) : formatCLP(val);
                            return (
                                <div className="rounded-xl border border-admin-border bg-admin-surface/95 backdrop-blur px-3 py-2 shadow-2xl text-xs">
                                    <div className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-1">{label}</div>
                                    <div className="text-white font-black">{display}</div>
                                </div>
                            );
                        }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                        {data.map((entry, index) => (
                            <Cell key={index} fill={entry.color || defaultColor} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
