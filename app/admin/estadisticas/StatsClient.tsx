'use client';

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, MapPin, 
  GlassWater, Filter, Activity, CheckCircle, 
  DollarSign, ArrowRight,
  TrendingDown, PieChart, Award, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

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
}

export default function StatsClient({ allQuotes, allQuoteItems, allExpenses }: StatsClientProps) {
    const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all' | 'custom' | 'specific_month'>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [specMonth, setSpecMonth] = useState(new Date().getMonth() + 1);
    const [specYear, setSpecYear] = useState(new Date().getFullYear());
    const [clientSortBy, setClientSortBy] = useState<'total' | 'events'>('total');
    
    // 1. Date Filtering
    const { startDate, endDate } = useMemo(() => {
        if (dateRange === 'custom') {
            return { startDate: customStart || '2000-01-01', endDate: customEnd || '2099-12-31' };
        }
        const now = new Date();
        if (dateRange === 'specific_month') {
            const start = new Date(specYear, specMonth - 1, 1);
            const end = new Date(specYear, specMonth, 0);
            return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
        }
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        switch (dateRange) {
            case 'this_month': return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
            case 'last_month':
                const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                return { startDate: lmStart.toISOString().split('T')[0], endDate: lmEnd.toISOString().split('T')[0] };
            case 'last_3_months':
                const l3mStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                return { startDate: l3mStart.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
            case 'this_year': return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` };
            case 'all':
            default: return { startDate: '2000-01-01', endDate: '2099-12-31' };
        }
    }, [dateRange, customStart, customEnd, specMonth, specYear]);

    // 2. Filter Data
    const filteredQuotes = useMemo(() => allQuotes.filter(q => q.event_date >= startDate && q.event_date <= endDate), [allQuotes, startDate, endDate]);
    const filteredExpenses = useMemo(() => allExpenses.filter(e => e.expense_date >= startDate && e.expense_date <= endDate), [allExpenses, startDate, endDate]);
    const confirmedQuotes = filteredQuotes.filter(q => q.status === 'confirmed' || q.status === 'completed');

    // 3. Financial KPIs
    const totalRevenue = confirmedQuotes.reduce((sum, q) => sum + Number(q.total_price), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 4. BI Analysis
    const confirmedIds = new Set(confirmedQuotes.map(q => q.id));
    const confirmedItems = allQuoteItems.filter(item => confirmedIds.has(item.quote_id));
    
    const productStats = useMemo(() => {
        const stats: Record<string, { qty: number, revenue: number }> = {};
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
        const stats: Record<string, { name: string, total: number, count: number }> = {};
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

    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

    return (
        <div className="pb-16 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h1 className="text-white text-2xl font-black mb-1 capitalize">Estadísticas</h1>
            </div>

            <div className="flex gap-1.5 border-b border-white/5 mb-8 pb-3 overflow-x-auto scrollbar-none">
                {[
                    { id: 'this_month', label: 'Este Mes' },
                    { id: 'last_month', label: 'Mes Pasado' },
                    { id: 'this_year', label: 'Este Año' },
                    { id: 'all', label: 'Historial Total' },
                ].map((f: any) => (
                    <button 
                        key={f.id} 
                        onClick={() => setDateRange(f.id)} 
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            dateRange === f.id ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-emerald-400 p-6 flex flex-col gap-2 shadow-xl">
                    <div className="flex justify-between items-center"><DollarSign size={18} className="text-emerald-400"/><span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Ingresos</span></div>
                    <div className="text-3xl font-black text-white tracking-tight">{formatCLP(totalRevenue)}</div>
                    <div className="text-xs font-bold text-slate-500">{confirmedQuotes.length} eventos confirmados</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-rose-400 p-6 flex flex-col gap-2 shadow-xl">
                    <div className="flex justify-between items-center"><TrendingDown size={18} className="text-rose-400"/><span className="text-[10px] font-black tracking-widest text-rose-400 uppercase">Egresos</span></div>
                    <div className="text-3xl font-black text-white tracking-tight">{formatCLP(totalExpenses)}</div>
                    <div className="text-xs font-bold text-slate-500">{filteredExpenses.length} cargos registrados</div>
                </div>
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-4 border-t-sky-400 p-6 flex flex-col gap-2 shadow-xl sm:col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-center"><Activity size={18} className="text-sky-400"/><span className="text-[10px] font-black tracking-widest text-sky-400 uppercase">Utilidad Neta</span></div>
                    <div className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>{formatCLP(netProfit)}</div>
                    <div className="text-xs font-bold text-slate-500">Margen operativo {profitMargin.toFixed(1)}%</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 shadow-xl">
                    <h3 className="text-white text-base font-black mb-6 flex items-center gap-3">
                        <PieChart size={18} className="text-pink-400" /> Desglose de Gastos
                    </h3>
                    {expenseByCategory.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin movimientos registrados.</p> : (
                        <div className="flex flex-col gap-5">
                            {expenseByCategory.map(([name, amount]) => {
                                const pct = (amount / totalExpenses) * 100;
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
                        <GlassWater size={18} className="text-purple-400" /> Catálogo Destacado
                    </h3>
                    {productStats.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin datos de venta suficientes.</p> : (
                        <div className="flex flex-col gap-5">
                            {productStats.map(([name, stat]) => {
                                const maxRev = productStats[0][1].revenue;
                                const pct = (stat.revenue / maxRev) * 100;
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

            {/* Ranking Segment Migrated from Dashboard */}
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
                                {topClients.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin registros de clientes.</p> : topClients.map((c: any, index) => (
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
                                {topProductsQuantity.length === 0 ? <p className="text-slate-500 text-sm font-bold italic">Sin registros de productos.</p> : topProductsQuantity.map(([name, qty]: any, index) => (
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
