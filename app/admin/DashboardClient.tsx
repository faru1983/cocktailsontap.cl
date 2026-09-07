'use client';

import Link from 'next/link';
import {
    CalendarDays,
    CircleDollarSign,
    Gem,
    Package,
    Receipt,
    Sparkles,
} from 'lucide-react';
import { Panel } from '@/components/admin/ui/Panel';
import { StatCard } from '@/components/admin/ui/StatCard';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import { SplitBar } from '@/components/admin/ui/SplitBar';
import { RevenueTrendChart } from '@/components/admin/charts/RevenueTrendChart';
import { LaneDonut } from '@/components/admin/charts/LaneDonut';
import { formatCLP, formatListDate, type TrendPoint } from '@/lib/adminStats';
import { DashboardRow } from '@/app/admin/DashboardRow';

export type DashboardListQuote = {
    id: string;
    client_name: string;
    client_lastname: string | null;
    event_date: string;
    comuna_name: string | null;
    comuna_other: string | null;
};

type DashboardClientProps = {
    monthLabel: string;
    nextMonthLabel: string;
    lastYear: number;
    kpis: {
        monthlyRevenue: number;
        monthlyEventRevenue: number;
        monthlyDirectRevenue: number;
        monthlyEventCount: number;
        monthlyDirectCount: number;
        monthlyExpenses: number;
        monthlyProfit: number;
        monthlyMargin: number;
        monthlyOrderCount: number;
        lastYearMonthlyRevenue: number;
        lastYearMonthlyExpenses: number;
        lastYearMonthlyProfit: number;
        lastYearMonthlyEventRevenue: number;
        lastYearMonthlyDirectRevenue: number;
        yoyRevenueDelta: number;
        yoyEventDelta: number;
        yoyDirectDelta: number;
        yoyExpensesDelta: number;
        yoyProfitDelta: number;
        projectedRevenue: number;
        ytdEventRevenue: number;
        ytdDirectRevenue: number;
        ytdEventCount: number;
        ytdDirectCount: number;
        ytdRevenue: number;
        ytdOrderCount: number;
        ytdPrevRevenue: number;
        ytdRevenueDelta: number;
        ytdEventPrev: number;
        ytdDirectPrev: number;
        ytdEventDelta: number;
        ytdDirectDelta: number;
    };
    trendSeries: TrendPoint[];
    upcomingEvents: DashboardListQuote[];
    upcomingDirectSales: DashboardListQuote[];
    nextMonthEvents: DashboardListQuote[];
    nextMonthDirectSales: DashboardListQuote[];
    recentQuotes: {
        id: string;
        client_name: string;
        client_lastname: string | null;
        created_at: string;
        status: string;
        total_price: number;
    }[];
};

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    confirmed: { label: 'Confirmada', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    in_delivery: { label: 'En reparto', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    completed: { label: 'Completada', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    cancelled: { label: 'Cancelada', color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

function QuoteTable({
    items,
    empty,
    dateClassName,
}: {
    items: DashboardListQuote[];
    empty: string;
    dateClassName: string;
}) {
    if (!items.length) return <EmptyState message={empty} />;

    return (
        <table className="w-full border-collapse">
            <tbody>
                {items.map((q) => (
                    <DashboardRow key={q.id} href={`/admin/quotes/${q.id}`} className="group hover:bg-white/[0.02]">
                        <td className={`py-3 px-4 @md:px-6 ${dateClassName} font-bold text-[11px] @md:text-xs whitespace-nowrap`}>
                            {formatListDate(q.event_date)}
                        </td>
                        <td className="py-3 px-4 @md:px-6 text-slate-200 text-xs font-semibold">
                            {q.client_name} {q.client_lastname}
                        </td>
                        <td className="py-3 px-4 @md:px-6 text-slate-500 text-[10px] @md:text-[11px] truncate max-w-[90px] @md:max-w-none">
                            {q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name}
                        </td>
                    </DashboardRow>
                ))}
            </tbody>
        </table>
    );
}

export function DashboardClient({
    monthLabel,
    nextMonthLabel,
    lastYear,
    kpis,
    trendSeries,
    upcomingEvents,
    upcomingDirectSales,
    nextMonthEvents,
    nextMonthDirectSales,
    recentQuotes,
}: DashboardClientProps) {
    return (
        <div className="pb-16 space-y-8">
            <header className="space-y-1">
                <h1 className="text-white text-2xl md:text-3xl font-black">Panel de control</h1>
                <p className="text-slate-500 text-sm capitalize">
                    {new Date().toLocaleDateString('es-CL', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/Santiago',
                    })}
                </p>
                <p className="text-slate-600 text-xs">
                    Resumen de {monthLabel}: ventas totales, eventos vs directas y comparativa con {lastYear}.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                <StatCard
                    label="Ventas del mes"
                    value={formatCLP(kpis.monthlyRevenue)}
                    icon={<CircleDollarSign size={20} />}
                    sub={`${kpis.monthlyOrderCount} pedidos confirmados`}
                    accent="emerald"
                    yoyDelta={{
                        label: `vs ${lastYear}`,
                        delta: kpis.yoyRevenueDelta,
                        amount: kpis.lastYearMonthlyRevenue,
                    }}
                />
                <StatCard
                    label="Eventos"
                    value={formatCLP(kpis.monthlyEventRevenue)}
                    icon={<CalendarDays size={20} />}
                    sub={`${kpis.monthlyEventCount} pedidos`}
                    accent="blue"
                    yoyDelta={{
                        label: `vs ${lastYear}`,
                        delta: kpis.yoyEventDelta,
                        amount: kpis.lastYearMonthlyEventRevenue,
                    }}
                />
                <StatCard
                    label="Ventas directas"
                    value={formatCLP(kpis.monthlyDirectRevenue)}
                    icon={<Package size={20} />}
                    sub={`${kpis.monthlyDirectCount} pedidos`}
                    accent="orange"
                    yoyDelta={{
                        label: `vs ${lastYear}`,
                        delta: kpis.yoyDirectDelta,
                        amount: kpis.lastYearMonthlyDirectRevenue,
                    }}
                />
                <StatCard
                    label="Gastos del mes"
                    value={formatCLP(kpis.monthlyExpenses)}
                    icon={<Receipt size={20} />}
                    sub="Egresos registrados"
                    accent="rose"
                    yoyDelta={{
                        label: `vs ${lastYear}`,
                        delta: kpis.yoyExpensesDelta,
                        amount: kpis.lastYearMonthlyExpenses,
                        invert: true,
                    }}
                />
                <StatCard
                    label="Utilidad del mes"
                    value={formatCLP(kpis.monthlyProfit)}
                    icon={<Gem size={20} />}
                    sub={`Margen ${kpis.monthlyMargin.toFixed(1)}%`}
                    accent="sky"
                    yoyDelta={{
                        label: `vs ${lastYear}`,
                        delta: kpis.yoyProfitDelta,
                        amount: kpis.lastYearMonthlyProfit,
                        positiveClass: 'text-sky-300',
                    }}
                />
                <StatCard
                    label="Proyección"
                    value={formatCLP(kpis.projectedRevenue)}
                    icon={<Sparkles size={20} />}
                    sub="Borradores del mes"
                    accent="pink"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
                <Panel
                    title="Tendencia 12 meses"
                    subtitle="Total, eventos, directas, gastos y año anterior"
                    accent="primary"
                    className="xl:col-span-2"
                    bodyClassName="p-4 @md:p-6"
                >
                    <RevenueTrendChart data={trendSeries} height={300} />
                </Panel>

                <Panel
                    title={`Mix ${monthLabel}`}
                    subtitle="Total del mes y composición por carril"
                    accent="direct"
                    bodyClassName="p-4 @md:p-6 space-y-4"
                >
                    <div className="rounded-xl border border-admin-border bg-black/10 p-4 text-center">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ventas totales</div>
                        <div className="text-white text-2xl font-black">{formatCLP(kpis.monthlyRevenue)}</div>
                        <div className="text-slate-500 text-xs mt-1">{kpis.monthlyOrderCount} pedidos</div>
                        <SplitBar event={kpis.monthlyEventRevenue} direct={kpis.monthlyDirectRevenue} className="mt-3" />
                    </div>
                    <LaneDonut event={kpis.monthlyEventRevenue} direct={kpis.monthlyDirectRevenue} height={180} centerLabel="Mes" />
                    <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-xl border border-admin-border bg-black/10 p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Año a la fecha</div>
                            <div className="text-white text-lg font-black">{formatCLP(kpis.ytdRevenue)}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">{kpis.ytdOrderCount} pedidos · vs {lastYear} YTD</div>
                            <SplitBar event={kpis.ytdEventRevenue} direct={kpis.ytdDirectRevenue} className="mt-2" />
                            <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                                <div>
                                    <div className="text-chart-event font-bold">Eventos</div>
                                    <div className="text-white font-black">{formatCLP(kpis.ytdEventRevenue)}</div>
                                    <div className="text-slate-500">{kpis.ytdEventCount} pedidos</div>
                                </div>
                                <div>
                                    <div className="text-chart-direct font-bold">Directas</div>
                                    <div className="text-white font-black">{formatCLP(kpis.ytdDirectRevenue)}</div>
                                    <div className="text-slate-500">{kpis.ytdDirectCount} pedidos</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <Panel title={`Eventos · ${monthLabel}`} accent="event" scroll bodyClassName="p-0">
                    <QuoteTable items={upcomingEvents} empty="Sin eventos próximos este mes." dateClassName="text-chart-event" />
                </Panel>
                <Panel title={`Ventas directas · ${monthLabel}`} accent="direct" scroll bodyClassName="p-0">
                    <QuoteTable items={upcomingDirectSales} empty="Sin entregas de barriles desechables este mes." dateClassName="text-chart-direct" />
                </Panel>
                <Panel title={`Eventos · ${nextMonthLabel}`} accent="profit" scroll bodyClassName="p-0">
                    <QuoteTable items={nextMonthEvents} empty={`Sin reservas aún para ${nextMonthLabel}.`} dateClassName="text-chart-profit" />
                </Panel>
                <Panel title={`Ventas directas · ${nextMonthLabel}`} accent="direct" scroll bodyClassName="p-0">
                    <QuoteTable items={nextMonthDirectSales} empty={`Sin ventas directas aún para ${nextMonthLabel}.`} dateClassName="text-orange-400" />
                </Panel>
            </div>

            <Panel title="Últimas cotizaciones" accent="neutral" bodyClassName="divide-y divide-admin-border">
                {recentQuotes.length === 0 ? (
                    <EmptyState message="Sin cotizaciones recientes." />
                ) : (
                    recentQuotes.map((q) => (
                        <Link
                            key={q.id}
                            href={`/admin/quotes#${q.id}`}
                            className="flex items-center justify-between p-4 md:px-6 hover:bg-white/[0.02] transition-colors no-underline group"
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="text-slate-200 text-xs font-bold truncate">
                                    {q.client_name} {q.client_lastname}
                                </span>
                                <span className="text-slate-600 text-[10px]">{new Date(q.created_at).toLocaleDateString('es-CL')}</span>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-1 ${
                                        statusBadge[q.status]?.bg + ' ' + statusBadge[q.status]?.color
                                    }`}
                                >
                                    {statusBadge[q.status]?.label.toUpperCase()}
                                </span>
                                <span className="text-white text-xs font-black group-hover:text-primary transition-colors">
                                    {formatCLP(q.total_price)}
                                </span>
                            </div>
                        </Link>
                    ))
                )}
            </Panel>
        </div>
    );
}
