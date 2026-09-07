'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Activity,
    ArrowLeft,
    ArrowRight,
    Award,
    CalendarDays,
    ChevronRight,
    DollarSign,
    GlassWater,
    Package,
    PieChart,
    TrendingDown,
} from 'lucide-react';
import { Panel } from '@/components/admin/ui/Panel';
import { StatCard } from '@/components/admin/ui/StatCard';
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl';
import { SplitBar } from '@/components/admin/ui/SplitBar';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import { RevenueTrendChart } from '@/components/admin/charts/RevenueTrendChart';
import { SimpleDonut } from '@/components/admin/charts/LaneDonut';
import { CategoryBars } from '@/components/admin/charts/CategoryBars';
import {
    MONTH_OPTIONS,
    formatCLP,
    formatPctDelta,
    pctDelta,
    type LaneFilter,
} from '@/lib/adminStats';
import type { StatsPeriodBundle } from '@/lib/adminStatsServer';

type StatsClientProps = {
    bundles: Record<LaneFilter, StatsPeriodBundle>;
    laneComparison: {
        event: number;
        direct: number;
        eventCount: number;
        directCount: number;
        yoyEvent: number;
        yoyDirect: number;
    };
    operations: {
        service: { event: number; direct: number };
        dispenser: { muro: number; portatil: number };
        comunas: { name: string; value: number }[];
        sizes: { name: string; value: number }[];
    };
    selectedMonth: string;
    currentMonth: string;
    monthLabel: string;
    previousMonth: string;
    nextMonth: string;
    initialTab: string;
    initialLane: LaneFilter;
    lastYear: number;
};

const LANE_OPTIONS: { value: LaneFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'event', label: 'Eventos' },
    { value: 'direct', label: 'Directas' },
];

export default function StatsClient({
    bundles,
    laneComparison,
    operations,
    selectedMonth,
    currentMonth,
    monthLabel,
    previousMonth,
    nextMonth,
    initialTab,
    initialLane,
    lastYear,
}: StatsClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<'mensual' | 'anual' | 'operaciones'>(
        initialTab === 'anual' ? 'anual' : initialTab === 'operaciones' ? 'operaciones' : 'mensual'
    );
    const [lane, setLane] = useState<LaneFilter>(initialLane);

    useEffect(() => {
        const currentTab = searchParams.get('tab') || 'mensual';
        if (currentTab !== tab && (currentTab === 'mensual' || currentTab === 'anual' || currentTab === 'operaciones')) {
            setTab(currentTab as 'mensual' | 'anual' | 'operaciones');
        }
        const currentLane = searchParams.get('lane') as LaneFilter;
        if (currentLane && currentLane !== lane && LANE_OPTIONS.some((o) => o.value === currentLane)) {
            setLane(currentLane);
        }
    }, [searchParams, tab, lane]);

    const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
    const currentYear = Number(currentMonth.split('-')[0]);
    const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));

    const bundle = bundles[lane];
    const { metrics, prevMetrics, yoyMetrics, trend, expenseCategories, topProducts, topClients, topComunas, alerts } =
        bundle;

    const revenueDelta = pctDelta(metrics.revenue, prevMetrics.revenue);
    const expensesDelta = pctDelta(metrics.expenses, prevMetrics.expenses);
    const profitDelta = pctDelta(metrics.profit, prevMetrics.profit);
    const yoyRevenueDelta = pctDelta(metrics.revenue, yoyMetrics.revenue);
    const yoyExpensesDelta = pctDelta(metrics.expenses, yoyMetrics.expenses);
    const yoyProfitDelta = pctDelta(metrics.profit, yoyMetrics.profit);
    const costRatio = metrics.revenue > 0 ? (metrics.expenses / metrics.revenue) * 100 : 0;

    const prevPeriodLabel = tab === 'anual' ? 'año anterior' : 'periodo anterior';
    const yoyLabel = tab === 'anual' ? `vs ${lastYear}` : `vs ${lastYear} mismo mes`;

    const navigate = (patch: { month?: string; tab?: string; lane?: LaneFilter }) => {
        const params = new URLSearchParams(searchParams);
        if (patch.month) params.set('month', patch.month);
        if (patch.tab) params.set('tab', patch.tab);
        if (patch.lane) params.set('lane', patch.lane);
        router.replace(`/admin/estadisticas?${params.toString()}`, { scroll: false });
    };

    const handleTabChange = (newTab: 'mensual' | 'anual' | 'operaciones') => {
        setTab(newTab);
        navigate({ tab: newTab });
    };

    const handleLaneChange = (newLane: LaneFilter) => {
        setLane(newLane);
        navigate({ lane: newLane });
    };

    const laneEventYoY = pctDelta(laneComparison.event, laneComparison.yoyEvent);
    const laneDirectYoY = pctDelta(laneComparison.direct, laneComparison.yoyDirect);

    const expenseChartItems = useMemo(
        () =>
            expenseCategories.map((c, i) => ({
                name: c.name,
                value: c.value,
                color: ['#fb7185', '#f472b6', '#c084fc', '#818cf8', '#38bdf8'][i % 5],
            })),
        [expenseCategories]
    );

    return (
        <div className="pb-16 w-full space-y-6 md:space-y-8">
            <header className="space-y-1">
                <h1 className="text-white text-2xl md:text-3xl font-black">Estadísticas</h1>
                <p className="text-slate-500 text-sm">Análisis financiero y rendimiento comercial del periodo seleccionado</p>
            </header>

            <Panel
                title="Controles"
                subtitle="Periodo, carril de venta y vista"
                accent="primary"
                bodyClassName="p-4 @md:p-5 space-y-4"
                actions={
                    tab !== 'operaciones' ? (
                        <SegmentedControl
                            value={lane}
                            options={LANE_OPTIONS}
                            onChange={handleLaneChange}
                            ariaLabel="Filtro de carril"
                            size="sm"
                        />
                    ) : undefined
                }
            >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Periodo activo</div>
                            <div className="text-white font-black text-lg capitalize">
                                {tab === 'operaciones' ? 'Histórico completo' : tab === 'anual' ? selectedYear : monthLabel}
                            </div>
                        </div>
                    </div>
                    {tab !== 'operaciones' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate({
                                            month:
                                                tab === 'anual'
                                                    ? `${Number(selectedYear) - 1}-${selectedMonthNum}`
                                                    : previousMonth,
                                        })
                                    }
                                    className="px-3 py-2 bg-black/20 border border-admin-border rounded-xl text-slate-400 hover:text-white hover:border-primary/40 transition-colors flex items-center justify-center cursor-pointer"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate({ month: currentMonth })}
                                    className="px-3 py-2 bg-black/20 border border-admin-border rounded-xl text-slate-300 hover:text-primary hover:border-primary/40 transition-colors text-xs font-black cursor-pointer"
                                >
                                    {tab === 'anual' ? 'Este año' : 'Este mes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate({
                                            month:
                                                tab === 'anual'
                                                    ? `${Number(selectedYear) + 1}-${selectedMonthNum}`
                                                    : nextMonth,
                                        })
                                    }
                                    className="px-3 py-2 bg-black/20 border border-admin-border rounded-xl text-slate-400 hover:text-white hover:border-primary/40 transition-colors flex items-center justify-center cursor-pointer"
                                >
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                            <div className={`grid gap-2 ${tab === 'anual' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => navigate({ month: `${e.target.value}-${selectedMonthNum}` })}
                                    className="bg-black/20 border border-admin-border rounded-xl px-3 py-2 text-white outline-none focus:border-primary transition-colors text-sm"
                                >
                                    {yearOptions.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                                {tab === 'mensual' && (
                                    <select
                                        value={selectedMonthNum}
                                        onChange={(e) => navigate({ month: `${selectedYear}-${e.target.value}` })}
                                        className="bg-black/20 border border-admin-border rounded-xl px-3 py-2 text-white outline-none focus:border-primary transition-colors text-sm"
                                    >
                                        {MONTH_OPTIONS.map((month) => (
                                            <option key={month.value} value={month.value}>
                                                {month.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <SegmentedControl
                    value={tab}
                    options={[
                        { value: 'mensual', label: 'Mensual' },
                        { value: 'anual', label: 'Anual' },
                        { value: 'operaciones', label: 'Operaciones' },
                    ]}
                    onChange={(v) => handleTabChange(v as 'mensual' | 'anual' | 'operaciones')}
                    ariaLabel="Tipo de estadística"
                />
            </Panel>

            {tab !== 'operaciones' && (
                <>
                    <Panel
                        title="Ventas del periodo"
                        subtitle="Total primero, luego composición eventos vs directas"
                        accent="direct"
                        bodyClassName="p-4 @md:p-6"
                    >
                        <div className="rounded-xl border border-admin-border bg-black/10 p-4 mb-5">
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                                <div>
                                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ventas totales</div>
                                    <div className="text-white text-2xl font-black">
                                        {formatCLP(laneComparison.event + laneComparison.direct)}
                                    </div>
                                    <div className="text-slate-500 text-xs mt-1">
                                        {laneComparison.eventCount + laneComparison.directCount} pedidos
                                    </div>
                                </div>
                                <div className={`text-[11px] font-bold ${pctDelta(laneComparison.event + laneComparison.direct, laneComparison.yoyEvent + laneComparison.yoyDirect) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {yoyLabel}{' '}
                                    {formatPctDelta(
                                        pctDelta(
                                            laneComparison.event + laneComparison.direct,
                                            laneComparison.yoyEvent + laneComparison.yoyDirect
                                        )
                                    )}{' '}
                                    ({formatCLP(laneComparison.yoyEvent + laneComparison.yoyDirect)})
                                </div>
                            </div>
                            <SplitBar event={laneComparison.event} direct={laneComparison.direct} className="mt-4" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-admin-border bg-black/10 p-4">
                                <div className="text-chart-event text-[10px] font-black uppercase tracking-widest mb-1">Eventos</div>
                                <div className="text-white text-xl font-black">{formatCLP(laneComparison.event)}</div>
                                <div className="text-slate-500 text-xs mt-1">{laneComparison.eventCount} pedidos</div>
                                <div className={`text-[11px] font-bold mt-2 ${laneEventYoY >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {yoyLabel} {formatPctDelta(laneEventYoY)} ({formatCLP(laneComparison.yoyEvent)})
                                </div>
                            </div>
                            <div className="rounded-xl border border-admin-border bg-black/10 p-4">
                                <div className="text-chart-direct text-[10px] font-black uppercase tracking-widest mb-1">Ventas directas</div>
                                <div className="text-white text-xl font-black">{formatCLP(laneComparison.direct)}</div>
                                <div className="text-slate-500 text-xs mt-1">{laneComparison.directCount} pedidos</div>
                                <div className={`text-[11px] font-bold mt-2 ${laneDirectYoY >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {yoyLabel} {formatPctDelta(laneDirectYoY)} ({formatCLP(laneComparison.yoyDirect)})
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                        <StatCard
                            label="Ingresos totales"
                            value={formatCLP(metrics.revenue)}
                            icon={<DollarSign size={18} />}
                            sub={`${metrics.orderCount} pedidos`}
                            accent="emerald"
                            prevDelta={{
                                label: `vs ${prevPeriodLabel}`,
                                delta: revenueDelta,
                                amount: prevMetrics.revenue,
                            }}
                            yoyDelta={{ label: yoyLabel, delta: yoyRevenueDelta, amount: yoyMetrics.revenue }}
                        />
                        {lane === 'all' && (
                            <>
                                <StatCard
                                    label="Eventos"
                                    value={formatCLP(metrics.eventRevenue)}
                                    icon={<CalendarDays size={18} />}
                                    sub={`${metrics.eventCount} pedidos`}
                                    accent="blue"
                                    yoyDelta={{
                                        label: yoyLabel,
                                        delta: pctDelta(metrics.eventRevenue, yoyMetrics.eventRevenue),
                                        amount: yoyMetrics.eventRevenue,
                                    }}
                                />
                                <StatCard
                                    label="Ventas directas"
                                    value={formatCLP(metrics.directRevenue)}
                                    icon={<Package size={18} />}
                                    sub={`${metrics.directCount} pedidos`}
                                    accent="orange"
                                    yoyDelta={{
                                        label: yoyLabel,
                                        delta: pctDelta(metrics.directRevenue, yoyMetrics.directRevenue),
                                        amount: yoyMetrics.directRevenue,
                                    }}
                                />
                            </>
                        )}
                        <StatCard
                            label="Egresos"
                            value={formatCLP(metrics.expenses)}
                            icon={<TrendingDown size={18} />}
                            accent="rose"
                            prevDelta={{
                                label: `vs ${prevPeriodLabel}`,
                                delta: expensesDelta,
                                amount: prevMetrics.expenses,
                                invert: true,
                            }}
                            yoyDelta={{
                                label: yoyLabel,
                                delta: yoyExpensesDelta,
                                amount: yoyMetrics.expenses,
                                invert: true,
                            }}
                        />
                        <StatCard
                            label="Utilidad neta"
                            value={formatCLP(metrics.profit)}
                            icon={<Activity size={18} />}
                            sub={`Margen ${metrics.margin.toFixed(1)}%`}
                            accent="sky"
                            prevDelta={{
                                label: `vs ${prevPeriodLabel}`,
                                delta: profitDelta,
                                amount: prevMetrics.profit,
                                positiveClass: 'text-sky-300',
                            }}
                            yoyDelta={{
                                label: yoyLabel,
                                delta: yoyProfitDelta,
                                amount: yoyMetrics.profit,
                                positiveClass: 'text-sky-300',
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                        <StatCard label="Pedidos" value={String(metrics.orderCount)} icon={<Award size={18} />} accent="blue" />
                        <StatCard label="Ticket promedio" value={formatCLP(metrics.ticketAvg)} icon={<DollarSign size={18} />} accent="primary" />
                        <StatCard
                            label="Costo / ingreso"
                            value={`${costRatio.toFixed(1)}%`}
                            icon={<TrendingDown size={18} />}
                            accent={costRatio > 65 ? 'rose' : 'emerald'}
                        />
                    </div>

                    <Panel
                        title={tab === 'anual' ? 'Tendencia mensual' : 'Tendencia semanal'}
                        subtitle="Total, eventos, directas, gastos y comparativa año anterior"
                        accent="primary"
                        bodyClassName="p-4 @md:p-6"
                    >
                        <RevenueTrendChart data={trend} height={320} />
                    </Panel>

                    {alerts.length > 0 && (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 md:p-5">
                            <div className="text-rose-400 text-xs font-black uppercase tracking-widest mb-2">Alertas del periodo</div>
                            <div className="space-y-1">
                                {alerts.map((alert) => (
                                    <p key={alert} className="text-slate-300 text-sm">
                                        {alert}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                        <Panel title="Desglose de gastos" accent="expense" bodyClassName="p-4 @md:p-6">
                            {expenseChartItems.length === 0 ? (
                                <EmptyState message="Sin movimientos registrados." icon={PieChart} />
                            ) : (
                                <CategoryBars items={expenseChartItems} defaultColor="#fb7185" />
                            )}
                        </Panel>
                        <Panel title="Catálogo destacado" accent="neutral" bodyClassName="p-4 @md:p-6">
                            {topProducts.length === 0 ? (
                                <EmptyState message="Sin datos de venta suficientes." icon={GlassWater} />
                            ) : (
                                <CategoryBars
                                    items={topProducts.map((p, i) => ({
                                        name: p.name,
                                        value: p.value,
                                        color: ['#a78bfa', '#818cf8', '#6366f1', '#8b5cf6', '#c084fc'][i % 5],
                                    }))}
                                    defaultColor="#a78bfa"
                                />
                            )}
                        </Panel>
                    </div>

                    <Panel title="Ranking clientes y comunas" accent="primary" bodyClassName="p-4 @md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div>
                                <h3 className="text-primary text-[10px] font-black uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                    <Award size={14} /> Top compradores
                                </h3>
                                {topClients.length === 0 ? (
                                    <EmptyState message="Sin registros de clientes." />
                                ) : (
                                    <div className="space-y-3">
                                        {topClients.map((c) => (
                                            <div key={c.name} className="flex justify-between items-center gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-slate-200 text-xs font-bold truncate">{c.name}</div>
                                                    <div className="text-slate-600 text-[10px]">{c.count} servicios</div>
                                                </div>
                                                <span className="text-primary text-xs font-black shrink-0">{formatCLP(c.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-chart-profit text-[10px] font-black uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                    <ChevronRight size={14} /> Top comunas
                                </h3>
                                {topComunas.length === 0 ? (
                                    <EmptyState message="Sin registros de comunas." />
                                ) : (
                                    <CategoryBars
                                        items={topComunas.map((c) => ({ name: c.name, value: c.value, color: '#818cf8' }))}
                                        formatValue={(v) => `${v} pedidos`}
                                        defaultColor="#818cf8"
                                    />
                                )}
                            </div>
                        </div>
                    </Panel>
                </>
            )}

            {tab === 'operaciones' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <Panel title="Tipos de servicio" accent="event" bodyClassName="p-4 @md:p-6">
                        <SimpleDonut
                            data={[
                                { name: 'Eventos', value: operations.service.event, color: '#34d399' },
                                { name: 'Directas', value: operations.service.direct, color: '#fb923c' },
                            ]}
                            height={220}
                            centerLabel="Total"
                            centerValue={String(operations.service.event + operations.service.direct)}
                        />
                    </Panel>
                    <Panel title="Equipamiento" accent="primary" bodyClassName="p-4 @md:p-6">
                        <SimpleDonut
                            data={[
                                { name: 'Portátil', value: operations.dispenser.portatil, color: '#E2A049' },
                                { name: 'Muro', value: operations.dispenser.muro, color: '#f472b6' },
                            ]}
                            height={220}
                            centerLabel="Total"
                            centerValue={String(operations.dispenser.portatil + operations.dispenser.muro)}
                        />
                    </Panel>
                    <Panel title="Top comunas (histórico)" accent="profit" bodyClassName="p-4 @md:p-6">
                        <CategoryBars
                            items={operations.comunas.map((c) => ({ name: c.name, value: c.value, color: '#818cf8' }))}
                            formatValue={(v) => `${v} pedidos`}
                        />
                    </Panel>
                    <Panel title="Rotación de formatos" accent="direct" bodyClassName="p-4 @md:p-6">
                        <CategoryBars
                            items={operations.sizes.map((s) => ({
                                name: `${s.name}L`,
                                value: s.value,
                                color: '#fb923c',
                            }))}
                            formatValue={(v) => `${v} unid`}
                        />
                    </Panel>
                </div>
            )}
        </div>
    );
}
