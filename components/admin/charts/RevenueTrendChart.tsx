'use client';

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/adminStats';
import { formatCLP } from '@/lib/adminStats';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from '@/components/admin/ui/EmptyState';

type RevenueTrendChartProps = {
    data: TrendPoint[];
    height?: number;
    showLegend?: boolean;
};

const CHART_COLORS = {
    total: '#E2A049',
    event: '#34d399',
    direct: '#fb923c',
    expense: '#fb7185',
    prev: '#64748b',
};

export function RevenueTrendChart({ data, height = 320, showLegend = true }: RevenueTrendChartProps) {
    if (!data.length) {
        return <EmptyState message="Sin datos de tendencia para este periodo." />;
    }

    const chartData = data.map((d) => ({
        ...d,
        name: d.label,
        total: d.revenue,
    }));

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tickFormatter={(v) => formatCLP(v).replace('$', '$ ')}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {showLegend && (
                        <Legend
                            wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                            formatter={(value) => <span className="text-slate-400">{value}</span>}
                        />
                    )}
                    <Bar dataKey="event" name="Eventos" stackId="rev" fill={CHART_COLORS.event} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="direct" name="Directas" stackId="rev" fill={CHART_COLORS.direct} radius={[4, 4, 0, 0]} />
                    <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke={CHART_COLORS.total}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: CHART_COLORS.total }}
                    />
                    <Line
                        type="monotone"
                        dataKey="expenses"
                        name="Gastos"
                        stroke={CHART_COLORS.expense}
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="prevRevenue"
                        name="Año anterior"
                        stroke={CHART_COLORS.prev}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
