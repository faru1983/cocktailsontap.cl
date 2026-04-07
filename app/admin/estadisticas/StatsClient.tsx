'use client';

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, MapPin, 
  GlassWater, Filter, Activity, CheckCircle, 
  DollarSign, ArrowRight,
  TrendingDown, PieChart
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

    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

    return (
        <div style={{ paddingBottom: '40px' }}>
            <style>{`
                .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 900px) { .stats-grid { grid-template-columns: 1fr; } }
                .kpi-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 8px; border-top-width: 4px; }
                .simple-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; }
                .progress-bg { background: rgba(255,255,255,0.03); height: 8px; border-radius: 4px; overflow: hidden; margin-top: 8px; }
                .progress-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
            `}</style>

            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={32} color="#E2A049" /> Auditoría & Rentabilidad
                </h1>
                <p style={{ color: '#475569', fontSize: '14px', marginTop: '6px' }}>Visión completa de ingresos, gastos y utilidad real.</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px' }}>
                {[
                    { id: 'this_month', label: 'Este Mes' },
                    { id: 'last_month', label: 'Mes Pasado' },
                    { id: 'this_year', label: 'Este Año' },
                    { id: 'all', label: 'Historial Total' },
                ].map(f => (
                    <button key={f.id} onClick={() => setDateRange(f.id as any)} 
                        style={{ whiteSpace: 'nowrap', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.08)', background: dateRange === f.id ? '#E2A049' : 'rgba(255,255,255,0.02)',
                        color: dateRange === f.id ? '#1a1b26' : '#94a3b8', transition: '0.2s' }}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="kpi-card" style={{ borderTopColor: '#34d399' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><DollarSign size={18} color="#34d399"/><span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399' }}>INGRESOS</span></div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#f1f5f9' }}>{formatCLP(totalRevenue)}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>{confirmedQuotes.length} eventos confirmados</div>
                </div>
                <div className="kpi-card" style={{ borderTopColor: '#f87171' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><TrendingDown size={18} color="#f87171"/><span style={{ fontSize: '11px', fontWeight: 800, color: '#f87171' }}>EGRESOS</span></div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#f1f5f9' }}>{formatCLP(totalExpenses)}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>{filteredExpenses.length} cargos registrados</div>
                </div>
                <div className="kpi-card" style={{ borderTopColor: '#38bdf8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Activity size={18} color="#38bdf8"/><span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>UTILIDAD NETTA</span></div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: netProfit >= 0 ? '#38bdf8' : '#f87171' }}>{formatCLP(netProfit)}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>Margen real de {profitMargin.toFixed(1)}%</div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="simple-card">
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PieChart size={18} color="#f472b6" /> Distribución de Gastos
                    </h3>
                    {expenseByCategory.length === 0 ? <p style={{ color: '#475569', fontSize: '13px' }}>Sin gastos en este periodo.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {expenseByCategory.map(([name, amount]) => {
                                const pct = (amount / totalExpenses) * 100;
                                return (
                                    <div key={name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{name}</span>
                                            <span style={{ color: '#94a3b8' }}>{formatCLP(amount)} <span style={{fontSize:'11px'}}>({pct.toFixed(1)}%)</span></span>
                                        </div>
                                        <div className="progress-bg"><div className="progress-bar" style={{ width: `${pct}%`, background: '#f472b6' }}></div></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="simple-card">
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <GlassWater size={18} color="#c084fc" /> Top Mixología
                    </h3>
                    {productStats.length === 0 ? <p style={{ color: '#475569', fontSize: '13px' }}>Sin ventas confirmadas.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {productStats.map(([name, stat]) => {
                                const maxRev = productStats[0][1].revenue;
                                const pct = (stat.revenue / maxRev) * 100;
                                return (
                                    <div key={name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{name}</span>
                                            <span style={{ color: '#E2A049', fontWeight: 800 }}>{formatCLP(stat.revenue)}</span>
                                        </div>
                                        <div className="progress-bg"><div className="progress-bar" style={{ width: `${pct}%`, background: '#c084fc' }}></div></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
