'use client';

import React, { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    GlassWater,
    Activity,
    DollarSign,
    TrendingDown,
    PieChart,
    Award,
    ChevronRight,
    CalendarDays,
    ArrowLeft,
    ArrowRight
} from 'lucide-react';

type Quote = {
    id: string;
    status: string;
    total_price: number;
    event_date: string;
    created_at: string;
    client_id: string;
    client_name: string;
    client_lastname: string;
    comuna_name: string;
    comuna_other: string;
};

type Expense = {
    id: string;
    amount: number;
    expense_date: string;
    category_name: string;
    subcategory_name: string;
};

type QuoteItem = {
    quote_id: string;
    product_name: string;
    quantity: number;
    offer_price_at_time: number;
    size: string;
};

interface StatsClientProps {
    allQuotes: Quote[];
    allQuoteItems: QuoteItem[];
    allExpenses: Expense[];
    selectedMonth: string;
    currentMonth: string;
    monthLabel: string;
    previousMonth: string;
    nextMonth: string;
}

const MONTH_OPTIONS = [
    { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
];

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
const pctDelta = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : 0;
const formatPctDelta = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export default function StatsClient({ allQuotes, allQuoteItems, allExpenses, selectedMonth, currentMonth, monthLabel, previousMonth, nextMonth }: StatsClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
    const currentYear = Number(currentMonth.split('-')[0]);
    const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));

    const [startDate, endDate] = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const start = `${selectedMonth}-01`;
        const end = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
        return [start, end];
    }, [selectedMonth]);
    const [prevStartDate, prevEndDate] = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const prev = new Date(Date.UTC(year, month - 2, 1));
        const prevMonthKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
        const start = `${prevMonthKey}-01`;
        const end = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0)).toISOString().split('T')[0];
        return [start, end];
    }, [selectedMonth]);
    const [yoyStartDate, yoyEndDate] = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const start = `${year - 1}-${String(month).padStart(2, '0')}-01`;
        const end = new Date(Date.UTC(year - 1, month, 0)).toISOString().split('T')[0];
        return [start, end];
    }, [selectedMonth]);

    const filteredQuotes = useMemo(() => allQuotes.filter(q => q.event_date >= startDate && q.event_date <= endDate), [allQuotes, startDate, endDate]);
    const filteredExpenses = useMemo(() => allExpenses.filter(e => e.expense_date >= startDate && e.expense_date <= endDate), [allExpenses, startDate, endDate]);
    const confirmedQuotes = useMemo(() => filteredQuotes.filter(q => q.status === 'confirmed' || q.status === 'completed'), [filteredQuotes]);
    const prevConfirmedQuotes = useMemo(
        () => allQuotes.filter(q => (q.status === 'confirmed' || q.status === 'completed') && q.event_date >= prevStartDate && q.event_date <= prevEndDate),
        [allQuotes, prevStartDate, prevEndDate]
    );
    const prevExpenses = useMemo(
        () => allExpenses.filter(e => e.expense_date >= prevStartDate && e.expense_date <= prevEndDate),
        [allExpenses, prevStartDate, prevEndDate]
    );
    const yoyConfirmedQuotes = useMemo(
        () => allQuotes.filter(q => (q.status === 'confirmed' || q.status === 'completed') && q.event_date >= yoyStartDate && q.event_date <= yoyEndDate),
        [allQuotes, yoyStartDate, yoyEndDate]
    );
    const yoyExpenses = useMemo(
        () => allExpenses.filter(e => e.expense_date >= yoyStartDate && e.expense_date <= yoyEndDate),
        [allExpenses, yoyStartDate, yoyEndDate]
    );

    const totalRevenue = confirmedQuotes.reduce((sum, q) => sum + Number(q.total_price), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const prevRevenue = prevConfirmedQuotes.reduce((sum, q) => sum + Number(q.total_price), 0);
    const prevExpensesTotal = prevExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const revenueDelta = pctDelta(totalRevenue, prevRevenue);
    const expensesDelta = pctDelta(totalExpenses, prevExpensesTotal);
    const netProfitDelta = pctDelta(netProfit, prevRevenue - prevExpensesTotal);
    const yoyRevenue = yoyConfirmedQuotes.reduce((sum, q) => sum + Number(q.total_price), 0);
    const yoyExpensesTotal = yoyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const yoyProfit = yoyRevenue - yoyExpensesTotal;
    const yoyRevenueDelta = pctDelta(totalRevenue, yoyRevenue);
    const yoyExpensesDelta = pctDelta(totalExpenses, yoyExpensesTotal);
    const yoyProfitDelta = pctDelta(netProfit, yoyProfit);
    const ticketAvg = confirmedQuotes.length ? totalRevenue / confirmedQuotes.length : 0;
    const costRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    const confirmedIds = useMemo(() => new Set(confirmedQuotes.map(q => q.id)), [confirmedQuotes]);
    const confirmedItems = useMemo(() => allQuoteItems.filter(item => confirmedIds.has(item.quote_id)), [allQuoteItems, confirmedIds]);

    const productStats = useMemo(() => {
        const stats: Record<string, { qty: number; revenue: number }> = {};
        confirmedItems.forEach(item => {
            if (!stats[item.product_name]) stats[item.product_name] = { qty: 0, revenue: 0 };
            stats[item.product_name].qty += item.quantity;
            stats[item.product_name].revenue += item.offer_price_at_time * item.quantity;
        });
        return Object.entries(stats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
    }, [confirmedItems]);

    const expenseByCategory = useMemo(() => {
        const stats: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            stats[e.category_name] = (stats[e.category_name] || 0) + Number(e.amount);
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [filteredExpenses]);

    const topClients = useMemo(() => {
        const stats: Record<string, { name: string; total: number; count: number }> = {};
        confirmedQuotes.forEach(q => {
            const key = q.client_id || q.client_name;
            if (!stats[key]) stats[key] = { name: `${q.client_name} ${q.client_lastname || ''}`, total: 0, count: 0 };
            stats[key].total += Number(q.total_price);
            stats[key].count += 1;
        });
        return Object.values(stats).sort((a, b) => b.total - a.total).slice(0, 5);
    }, [confirmedQuotes]);

    const topProductsQuantity = useMemo(() => {
        const stats: Record<string, number> = {};
        confirmedItems.forEach(item => {
            stats[item.product_name] = (stats[item.product_name] || 0) + item.quantity;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [confirmedItems]);
    const weeklyTrend = useMemo(() => {
        const weekMap: Record<string, { revenue: number; expenses: number; label: string }> = {};
        confirmedQuotes.forEach(q => {
            const d = new Date(`${q.event_date}T12:00:00`);
            const day = d.getUTCDate();
            const bucket = Math.min(Math.floor((day - 1) / 7) + 1, 5);
            const key = `S${bucket}`;
            if (!weekMap[key]) weekMap[key] = { revenue: 0, expenses: 0, label: `Sem ${bucket}` };
            weekMap[key].revenue += Number(q.total_price);
        });
        filteredExpenses.forEach(e => {
            const d = new Date(`${e.expense_date}T12:00:00`);
            const day = d.getUTCDate();
            const bucket = Math.min(Math.floor((day - 1) / 7) + 1, 5);
            const key = `S${bucket}`;
            if (!weekMap[key]) weekMap[key] = { revenue: 0, expenses: 0, label: `Sem ${bucket}` };
            weekMap[key].expenses += Number(e.amount);
        });
        return ['S1', 'S2', 'S3', 'S4', 'S5']
            .filter(key => weekMap[key])
            .map(key => ({ key, ...weekMap[key] }));
    }, [confirmedQuotes, filteredExpenses]);
    const alerts = useMemo(() => {
        const rows: string[] = [];
        if (profitMargin < 25) rows.push(`Margen bajo: ${profitMargin.toFixed(1)}%`);
        if (costRatio > 65) rows.push(`Costo sobre ingreso alto: ${costRatio.toFixed(1)}%`);
        if (expenseByCategory[0] && totalExpenses > 0) {
            const leadShare = (expenseByCategory[0][1] / totalExpenses) * 100;
            if (leadShare > 45) rows.push(`Concentracion alta en ${expenseByCategory[0][0]} (${leadShare.toFixed(1)}%)`);
        }
        return rows;
    }, [profitMargin, costRatio, expenseByCategory, totalExpenses]);

    const navigateToMonth = (month: string) => {
        if (!month) return;
        const params = new URLSearchParams(searchParams);
        params.set('month', month);
        router.replace(`/admin/estadisticas?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="pb-16 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1">Estadisticas</h1>
                    <p className="text-slate-500 text-sm">Analisis financiero y rendimiento comercial del periodo seleccionado</p>
                </div>
            </div>

            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-4 md:p-5 mb-6 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#E2A049]/10 rounded-xl text-[#E2A049]"><CalendarDays size={20} /></div>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Periodo activo</div>
                            <div className="text-white font-black text-lg capitalize">{monthLabel}</div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => navigateToMonth(previousMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-[#E2A049]/40 transition-colors flex items-center justify-center cursor-pointer" title="Mes anterior"><ArrowLeft size={16} /></button>
                            <button onClick={() => navigateToMonth(currentMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-300 hover:text-[#E2A049] hover:border-[#E2A049]/40 transition-colors text-xs font-black cursor-pointer">Este mes</button>
                            <button onClick={() => navigateToMonth(nextMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-[#E2A049]/40 transition-colors flex items-center justify-center cursor-pointer" title="Mes siguiente"><ArrowRight size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select value={selectedYear} onChange={e => navigateToMonth(`${e.target.value}-${selectedMonthNum}`)} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#E2A049] transition-colors text-sm">
                                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <select value={selectedMonthNum} onChange={e => navigateToMonth(`${selectedYear}-${e.target.value}`)} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#E2A049] transition-colors text-sm">
                                {MONTH_OPTIONS.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-emerald-400 p-6 flex flex-col gap-2 shadow-xl">
                    <div className="flex justify-between items-center"><DollarSign size={18} className="text-emerald-400"/><span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Ingresos</span></div>
                    <div className="text-3xl font-black text-white tracking-tight">{formatCLP(totalRevenue)}</div>
                    <div className={`text-xs font-bold ${revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>vs mes anterior {formatPctDelta(revenueDelta)} ({formatCLP(prevRevenue)})</div>
                    <div className={`text-[11px] font-bold ${yoyRevenueDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>vs mismo mes año anterior {formatPctDelta(yoyRevenueDelta)} ({formatCLP(yoyRevenue)})</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-rose-400 p-6 flex flex-col gap-2 shadow-xl">
                    <div className="flex justify-between items-center"><TrendingDown size={18} className="text-rose-400"/><span className="text-[10px] font-black tracking-widest text-rose-400 uppercase">Egresos</span></div>
                    <div className="text-3xl font-black text-white tracking-tight">{formatCLP(totalExpenses)}</div>
                    <div className={`text-xs font-bold ${expensesDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>vs mes anterior {formatPctDelta(expensesDelta)} ({formatCLP(prevExpensesTotal)})</div>
                    <div className={`text-[11px] font-bold ${yoyExpensesDelta <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>vs mismo mes año anterior {formatPctDelta(yoyExpensesDelta)} ({formatCLP(yoyExpensesTotal)})</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-sky-400 p-6 flex flex-col gap-2 shadow-xl sm:col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-center"><Activity size={18} className="text-sky-400"/><span className="text-[10px] font-black tracking-widest text-sky-400 uppercase">Utilidad Neta</span></div>
                    <div className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>{formatCLP(netProfit)}</div>
                    <div className={`text-xs font-bold ${netProfitDelta >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>vs mes anterior {formatPctDelta(netProfitDelta)} ({formatCLP(prevRevenue - prevExpensesTotal)})</div>
                    <div className={`text-[11px] font-bold ${yoyProfitDelta >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>vs mismo mes año anterior {formatPctDelta(yoyProfitDelta)} ({formatCLP(yoyProfit)})</div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-xl">
                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Eventos confirmados</div>
                    <div className="text-white text-2xl font-black">{confirmedQuotes.length}</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-xl">
                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Ticket promedio</div>
                    <div className="text-white text-2xl font-black">{formatCLP(ticketAvg)}</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-xl">
                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Costo / Ingreso</div>
                    <div className={`text-2xl font-black ${costRatio > 65 ? 'text-rose-400' : 'text-emerald-400'}`}>{costRatio.toFixed(1)}%</div>
                </div>
            </div>

            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 shadow-xl mb-8">
                <h3 className="text-white text-base font-black mb-6">Tendencia Semanal</h3>
                {weeklyTrend.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin datos semanales.</p> : (
                    <div className="space-y-4">
                        {weeklyTrend.map((w) => {
                            const maxValue = Math.max(...weeklyTrend.map(x => Math.max(x.revenue, x.expenses)), 1);
                            const revPct = (w.revenue / maxValue) * 100;
                            const expPct = (w.expenses / maxValue) * 100;
                            return (
                                <div key={w.key}>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-300 font-bold">{w.label}</span>
                                        <span className="text-slate-500">Ing {formatCLP(w.revenue)} | Gas {formatCLP(w.expenses)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${revPct}%` }}></div></div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-rose-400" style={{ width: `${expPct}%` }}></div></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {alerts.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 mb-8">
                    <div className="text-rose-400 text-xs font-black uppercase tracking-widest mb-2">Alertas del periodo</div>
                    <div className="space-y-1">
                        {alerts.map((alert) => <p key={alert} className="text-slate-300 text-sm">{alert}</p>)}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 shadow-xl">
                    <h3 className="text-white text-base font-black mb-6 flex items-center gap-3">
                        <PieChart size={18} className="text-pink-400" /> Desglose de Gastos
                    </h3>
                    {expenseByCategory.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin movimientos registrados.</p> : (
                        <div className="flex flex-col gap-5">
                            {expenseByCategory.map(([name, amount]) => {
                                const pct = totalExpenses ? (amount / totalExpenses) * 100 : 0;
                                return (
                                    <div key={name}>
                                        <div className="flex justify-between items-baseline text-sm mb-2">
                                            <span className="text-white font-bold">{name}</span>
                                            <span className="text-slate-400 font-black">{formatCLP(amount)} <span className="text-[10px] font-bold">({pct.toFixed(1)}%)</span></span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-pink-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 shadow-xl">
                    <h3 className="text-white text-base font-black mb-6 flex items-center gap-3">
                        <GlassWater size={18} className="text-purple-400" /> Catalogo Destacado
                    </h3>
                    {productStats.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin datos de venta suficientes.</p> : (
                        <div className="flex flex-col gap-5">
                            {productStats.map(([name, stat]) => {
                                const maxRev = productStats[0][1].revenue;
                                const pct = maxRev ? (stat.revenue / maxRev) * 100 : 0;
                                return (
                                    <div key={name}>
                                        <div className="flex justify-between items-baseline text-sm mb-2">
                                            <span className="text-white font-bold truncate max-w-[200px] sm:max-w-[300px] shrink-0">{name}</span>
                                            <span className="text-[#E2A049] font-black">{formatCLP(stat.revenue)}</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 mb-8">
                <div className="flex items-center gap-3 mb-5 px-1">
                    <div className="bg-amber-500 w-1 h-5 rounded-full" />
                    <h2 className="text-white text-lg font-extrabold">Ranking Clientes & Productos</h2>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-[#E2A049] text-[10px] font-black uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                <Award size={14}/> Top Compradores
                            </h3>
                            <div className="space-y-4">
                                {topClients.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin registros de clientes.</p> : topClients.map((c, index) => (
                                    <div key={index} className="flex justify-between items-center group">
                                        <div className="flex flex-col">
                                            <span className="text-slate-200 text-xs font-bold group-hover:text-white transition-colors">{c.name}</span>
                                            <span className="text-slate-600 text-[10px]">{c.count} servicios</span>
                                        </div>
                                        <span className="text-[#E2A049] text-xs font-black">{formatCLP(c.total)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sky-400 text-[10px] font-black uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                <ChevronRight size={14}/> Estrellas del Bar
                            </h3>
                            <div className="space-y-4">
                                {topProductsQuantity.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin registros de productos.</p> : topProductsQuantity.map(([name, qty], index) => (
                                    <div key={index} className="flex justify-between items-center group">
                                        <span className="text-slate-400 text-xs font-bold truncate max-w-[200px] shrink-0 group-hover:text-slate-200 transition-colors">{name}</span>
                                        <span className="bg-sky-500/10 text-sky-400 text-[10px] font-black px-2 py-0.5 rounded-full">{qty} unid</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
