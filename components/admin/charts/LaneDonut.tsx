'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCLP } from '@/lib/adminStats';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from '@/components/admin/ui/EmptyState';

type LaneDonutProps = {
    event: number;
    direct: number;
    height?: number;
    centerLabel?: string;
};

const COLORS = ['#34d399', '#fb923c'];

export function LaneDonut({ event, direct, height = 240, centerLabel = 'Total' }: LaneDonutProps) {
    const total = event + direct;
    if (total <= 0) {
        return <EmptyState message="Sin ventas registradas en este periodo." />;
    }

    const data = [
        { name: 'Eventos', value: event },
        { name: 'Directas', value: direct },
    ];

    return (
        <div className="relative w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{centerLabel}</span>
                <span className="text-white text-lg @md:text-xl font-black">{formatCLP(total)}</span>
            </div>
        </div>
    );
}

type SimpleDonutProps = {
    data: { name: string; value: number; color: string }[];
    height?: number;
    centerLabel?: string;
    centerValue?: string;
};

export function SimpleDonut({ data, height = 240, centerLabel, centerValue }: SimpleDonutProps) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return <EmptyState message="Sin datos para mostrar." />;

    return (
        <div className="relative w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                </PieChart>
            </ResponsiveContainer>
            {(centerLabel || centerValue) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {centerLabel && (
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{centerLabel}</span>
                    )}
                    {centerValue && <span className="text-white text-lg font-black">{centerValue}</span>}
                </div>
            )}
        </div>
    );
}
