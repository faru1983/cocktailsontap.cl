'use client';

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, CalendarDays, Users, MapPin, 
  GlassWater, Filter, Activity, CheckCircle, 
  XCircle, FilterX, DollarSign, ArrowRight
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
}

export default function StatsClient({ allQuotes, allQuoteItems }: StatsClientProps) {
    const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'last_year' | 'all' | 'custom' | 'specific_month'>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [specMonth, setSpecMonth] = useState(new Date().getMonth() + 1);
    const [specYear, setSpecYear] = useState(new Date().getFullYear());
    const [clientSortBy, setClientSortBy] = useState<'total' | 'events'>('total');
    
    // 1. Date Filtering
    const { startDate, endDate } = useMemo(() => {
        if (dateRange === 'custom') {
            return { 
                startDate: customStart || '2000-01-01', 
                endDate: customEnd || '2099-12-31' 
            };
        }

        const now = new Date();

        if (dateRange === 'specific_month') {
            const start = new Date(specYear, specMonth - 1, 1);
            const end = new Date(specYear, specMonth, 0);
            return { 
                startDate: start.toISOString().split('T')[0], 
                endDate: end.toISOString().split('T')[0] 
            };
        }

        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        switch (dateRange) {
            case 'this_month':
                return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
            case 'last_month':
                const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                return { startDate: lmStart.toISOString().split('T')[0], endDate: lmEnd.toISOString().split('T')[0] };
            case 'last_3_months':
                const l3mStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                return { startDate: l3mStart.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
            case 'this_year':
                return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` };
            case 'last_year':
                return { startDate: `${now.getFullYear() - 1}-01-01`, endDate: `${now.getFullYear() - 1}-12-31` };
            case 'all':
            default:
                return { startDate: '2000-01-01', endDate: '2099-12-31' };
        }
    }, [dateRange, customStart, customEnd, specMonth, specYear]);

    // 2. Filter Quotes
    const filteredQuotes = useMemo(() => {
        return allQuotes.filter(q => q.event_date >= startDate && q.event_date <= endDate);
    }, [allQuotes, startDate, endDate]);

    const createdQuotes = useMemo(() => {
        return allQuotes.filter(q => {
            const created = q.created_at.split('T')[0];
            return created >= startDate && created <= endDate;
        });
    }, [allQuotes, startDate, endDate]);

    const confirmedQuotes = filteredQuotes.filter(q => q.status === 'confirmed' || q.status === 'completed');
    const cancelledQuotes = filteredQuotes.filter(q => q.status === 'cancelled');

    // 3. Financial KPIs
    const totalRevenue = confirmedQuotes.reduce((sum, q) => sum + Number(q.total_price), 0);
    const avgTicket = confirmedQuotes.length > 0 ? totalRevenue / confirmedQuotes.length : 0;
    const conversionRate = createdQuotes.length > 0 
        ? Math.round((createdQuotes.filter(q => q.status === 'confirmed' || q.status === 'completed').length / createdQuotes.length) * 100) 
        : 0;

    // 4. Products Analysis (Only from confirmed)
    const confirmedIds = new Set(confirmedQuotes.map(q => q.id));
    const confirmedItems = allQuoteItems.filter(item => confirmedIds.has(item.quote_id));

    const productStats = useMemo(() => {
        const stats: Record<string, { qty: number, revenue: number }> = {};
        confirmedItems.forEach(item => {
            if (!stats[item.product_name]) stats[item.product_name] = { qty: 0, revenue: 0 };
            stats[item.product_name].qty += item.quantity;
            stats[item.product_name].revenue += item.offer_price_at_time * item.quantity;
        });
        return Object.entries(stats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 15);
    }, [confirmedItems]);

    // 5. Client & Comuna Analysis
    const clientStats = useMemo(() => {
        const stats: Record<string, { id: string, name: string, total: number, events: number }> = {};
        confirmedQuotes.forEach(q => {
            const key = q.client_id;
            if (!stats[key]) stats[key] = { id: q.client_id, name: `${q.client_name} ${q.client_lastname}`, total: 0, events: 0 };
            stats[key].total += Number(q.total_price);
            stats[key].events += 1;
        });
        return stats;
    }, [confirmedQuotes]);

    const topSpenders = useMemo(() => {
        const list = Object.values(clientStats);
        if (clientSortBy === 'events') {
            return list.sort((a, b) => b.events - a.events || b.total - a.total).slice(0, 20);
        } else {
            return list.sort((a, b) => b.total - a.total || b.events - a.events).slice(0, 20);
        }
    }, [clientStats, clientSortBy]);

    const comunaStats = useMemo(() => {
        const stats: Record<string, { revenue: number, events: number }> = {};
        confirmedQuotes.forEach(q => {
            const com = q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name;
            if (!com) return;
            if (!stats[com]) stats[com] = { revenue: 0, events: 0 };
            stats[com].revenue += Number(q.total_price);
            stats[com].events += 1;
        });
        return Object.entries(stats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 15);
    }, [confirmedQuotes]);

    // Helpers
    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Header & Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={28} color="#E2A049" />
                        Centro de Estadísticas
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0' }}>Analiza el rendimiento de tu negocio en detalle.</p>
                </div>

                {/* Filter Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }} className="hide-scrollbar">
                        {[
                            { id: 'this_month', label: 'Este Mes' },
                            { id: 'last_month', label: 'Mes Pasado' },
                            { id: 'last_3_months', label: 'Últimos 3 Meses' },
                            { id: 'this_year', label: 'Este Año' },
                            { id: 'last_year', label: 'Año Pasado' },
                            { id: 'all', label: 'Todo el Historial' },
                            { id: 'specific_month', label: 'Mes Específico' },
                            { id: 'custom', label: 'Rango Manual' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setDateRange(f.id as any)}
                                style={{
                                    whiteSpace: 'nowrap',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: dateRange === f.id ? '1px solid #E2A049' : '1px solid rgba(255,255,255,0.1)',
                                    background: dateRange === f.id ? 'rgba(226,160,73,0.15)' : 'transparent',
                                    color: dateRange === f.id ? '#E2A049' : '#94a3b8'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {dateRange === 'specific_month' && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', animation: 'fadeIn 0.3s ease-out' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Mes</span>
                                <select 
                                    value={specMonth} 
                                    onChange={(e) => setSpecMonth(Number(e.target.value))}
                                    style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                                >
                                    {[
                                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                                    ].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Año</span>
                                <select 
                                    value={specYear} 
                                    onChange={(e) => setSpecYear(Number(e.target.value))}
                                    style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {dateRange === 'custom' && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', animation: 'fadeIn 0.3s ease-out' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Desde</span>
                                <input 
                                    type="date" 
                                    value={customStart} 
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Hasta</span>
                                <input 
                                    type="date" 
                                    value={customEnd} 
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={16} /> Ingresos Generados</div>
                    <div style={{ color: '#E2A049', fontSize: '28px', fontWeight: 800 }}>{formatCLP(totalRevenue)}</div>
                </div>
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} /> Ticket Promedio</div>
                    <div style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 800 }}>{formatCLP(avgTicket)}</div>
                </div>
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16} /> Eventos Confirmados</div>
                    <div style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 800 }}>{confirmedQuotes.length}</div>
                </div>
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Filter size={16} /> Tasa Cierre (Funnel)</div>
                    <div style={{ color: '#10b981', fontSize: '28px', fontWeight: 800 }}>{conversionRate}%</div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
                
                {/* Top Cocktails */}
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#f1f5f9', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GlassWater size={18} color="#c084fc" />
                        Top Mixología por Ingresos
                    </h3>
                    {productStats.length === 0 ? <p style={{ color: '#475569', fontSize: '13px' }}>Sin datos en este periodo.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {productStats.map(([name, stat], i) => {
                                const maxRev = productStats[0][1].revenue;
                                const pct = (stat.revenue / maxRev) * 100;
                                return (
                                    <div key={name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{i + 1}. {name}</span>
                                            <span style={{ color: '#94a3b8' }}>{formatCLP(stat.revenue)} <span style={{fontSize:'11px'}}>({stat.qty} un)</span></span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: '#c084fc', borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Comunas */}
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#f1f5f9', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={18} color="#f43f5e" />
                        Rentabilidad por Comuna
                    </h3>
                    {comunaStats.length === 0 ? <p style={{ color: '#475569', fontSize: '13px' }}>Sin datos en este periodo.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {comunaStats.map(([name, stat], i) => {
                                const maxRev = comunaStats[0][1].revenue;
                                const pct = (stat.revenue / maxRev) * 100;
                                return (
                                    <div key={name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{i + 1}. {name}</span>
                                            <span style={{ color: '#94a3b8' }}>{formatCLP(stat.revenue)} <span style={{fontSize:'11px'}}>({stat.events} ev)</span></span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: '#f43f5e', borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top VIP Clients */}
                <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', gridColumn: '1 / -1' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#f1f5f9', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} color="#3b82f6" />
                        Mejores Clientes (Periodo Seleccionado)
                    </h3>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>#</th>
                                    <th style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Cliente</th>
                                    <th onClick={() => setClientSortBy('events')} style={{ padding: '12px 10px', color: clientSortBy === 'events' ? '#E2A049' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s', userSelect: 'none' }}>Eventos {clientSortBy === 'events' ? '↓' : ''}</th>
                                    <th onClick={() => setClientSortBy('total')} style={{ padding: '12px 10px', color: clientSortBy === 'total' ? '#E2A049' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s', userSelect: 'none' }}>Monto Invertido {clientSortBy === 'total' ? '↓' : ''}</th>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topSpenders.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '20px 0', color: '#475569', fontSize: '13px', textAlign: 'center' }}>No hay datos.</td></tr>
                                ) : (
                                    topSpenders.map((client, i) => (
                                        <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px 0', color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{i + 1}</td>
                                            <td style={{ padding: '12px 10px', color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{client.name}</td>
                                            <td style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '13px' }}>{client.events}</td>
                                            <td style={{ padding: '12px 10px', color: '#E2A049', fontSize: '13px', fontWeight: 700 }}>{formatCLP(client.total)}</td>
                                            <td style={{ padding: '12px 0', textAlign: 'right' }}>
                                                <Link href={`/admin/clients/${client.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                                                    Ver Perfil <ArrowRight size={12} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            
            <style>{`
                .stats-grid { 
                    display: grid; 
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                }
                @media (max-width: 768px) {
                    .stats-grid { grid-template-columns: 1fr !important; }
                    .hide-scrollbar::-webkit-scrollbar { display: none; }
                    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                }
            `}</style>
        </div>
    );
}
