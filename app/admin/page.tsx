import { DashboardRow } from './DashboardRow';
import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import type { Quote } from '@/lib/types';

async function getDashboardData() {
    const db = createServerClient();
    const now = new Date();
    
    // 1. Date Calculations
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfMonthSQL = startOfMonth.toISOString().split('T')[0];
    const todaySQL = now.toISOString().split('T')[0];
    const endOfMonthSQL = endOfMonth.toISOString().split('T')[0];

    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const startOfNextMonthSQL = startOfNextMonth.toISOString().split('T')[0];
    const endOfNextMonthSQL = endOfNextMonth.toISOString().split('T')[0];

    const startOfYearSQL = `${now.getFullYear()}-01-01`;
    const endOfYearSQL = `${now.getFullYear()}-12-31`;
    const startOfLastYearSQL = `${now.getFullYear() - 1}-01-01`;
    const endOfLastYearSQL = `${now.getFullYear() - 1}-12-31`;

    // 2. Fetch Data in Parallel (Selecting only necessary columns for performance)
    const [
        monthlyResults, 
        monthlyDrafts, 
        allClients, 
        recentQuotes, 
        upcomingEvents, 
        historicalRevData, 
        yearlyResults, 
        lastYearResults,
        topQuoteItems,
        nextMonthResults,
        monthlyExpensesRes
    ] = await Promise.all([
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfMonthSQL).lte('event_date', endOfMonthSQL),
        db.from('quotes').select('total_price').eq('status', 'draft').gte('event_date', startOfMonthSQL).lte('event_date', endOfMonthSQL),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes').select('id, token, status, client_name, client_lastname, event_date, total_price, created_at').order('created_at', { ascending: false }).limit(5),
        db.from('quotes').select('id, client_name, client_lastname, event_date, start_time, total_price, guests, status, comuna_name, comuna_other').in('status', ['confirmed', 'completed']).gte('event_date', todaySQL).lte('event_date', endOfMonthSQL).order('event_date', { ascending: true }).limit(8),
        // Limit historical BI data to keep performance as the DB grows
        db.from('quotes').select('total_price, client_id, client_name, client_lastname, comuna_name, comuna_other').in('status', ['confirmed', 'completed']),
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfYearSQL).lte('event_date', endOfYearSQL),
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfLastYearSQL).lte('event_date', endOfLastYearSQL),
        db.from('quote_items').select('product_name, quantity').order('quantity', { ascending: false }).limit(150),
        db.from('quotes').select('id, client_name, client_lastname, event_date, start_time, total_price, guests, status, comuna_name, comuna_other').in('status', ['confirmed', 'completed']).gte('event_date', startOfNextMonthSQL).lte('event_date', endOfNextMonthSQL).order('event_date', { ascending: true }).limit(8),
        db.from('expenses').select('amount').gte('expense_date', startOfMonthSQL).lte('expense_date', endOfMonthSQL)
    ]);

    // 3. Simple Sums
    const monthlyRevenue = (monthlyResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const monthlyExpenses = (monthlyExpensesRes.data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const monthlyProfit = monthlyRevenue - monthlyExpenses;

    const projectedRevenue = (monthlyDrafts.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const historicalRevenue = (historicalRevData.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const yearlyRevenue = (yearlyResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const lastYearRevenue = (lastYearResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const conversionRate = (monthlyResults.data?.length || 0) + (monthlyDrafts.data?.length || 0) > 0
        ? Math.round(((monthlyResults.data?.length || 0) / ((monthlyResults.data?.length || 0) + (monthlyDrafts.data?.length || 0))) * 100)
        : 0;

    // 4. BI Aggregations
    const clientStats: Record<string, { id: string; name: string; total: number; count: number }> = {};
    const comunaStats: Record<string, number> = {};
    (historicalRevData.data || []).forEach((q: any) => {
        const key = q.client_id || q.client_name;
        if (!clientStats[key]) clientStats[key] = { id: q.client_id, name: `${q.client_name} ${q.client_lastname || ''}`, total: 0, count: 0 };
        clientStats[key].total += Number(q.total_price);
        clientStats[key].count += 1;
        const com = q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name;
        if (com) comunaStats[com] = (comunaStats[com] || 0) + 1;
    });
    
    const productStats: Record<string, number> = {};
    (topQuoteItems.data || []).forEach((item: any) => {
        productStats[item.product_name] = (productStats[item.product_name] || 0) + (item.quantity || 0);
    });

    const topClients = Object.values(clientStats).sort((a, b) => b.total - a.total).slice(0, 5);
    const topProducts = Object.entries(productStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topComunas = Object.entries(comunaStats).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
        monthlyRevenue,
        monthlyExpenses,
        monthlyProfit,
        projectedRevenue,
        historicalRevenue,
        yearlyRevenue,
        lastYearRevenue,
        confirmedCount: monthlyResults.data?.length || 0,
        draftCount: monthlyDrafts.data?.length || 0,
        totalHistoricalCount: historicalRevData.data?.length || 0,
        totalClients: allClients.count || 0,
        conversionRate,
        recentQuotes: recentQuotes.data || [],
        upcomingEvents: upcomingEvents.data || [],
        nextMonthEvents: nextMonthResults.data || [],
        topClients,
        topProducts,
        topComunas,
        currentMonthName: now.toLocaleDateString('es-CL', { month: 'long' }),
        nextMonthName: startOfNextMonth.toLocaleDateString('es-CL', { month: 'long' }),
        currentYear: now.getFullYear(),
        lastYear: now.getFullYear() - 1
    };
}

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed: { label: 'Confirmada', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    completed: { label: 'Completada', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled: { label: 'Cancelada', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

export default async function AdminDashboardPage() {
    const data = await getDashboardData();

    const kpis = [
        { label: 'Ingresos del Mes',       value: formatCLP(data.monthlyRevenue),   icon: '💰', sub: `${data.confirmedCount} confirmadas`, color: '#34d399' },
        { label: 'Gastos del Mes',         value: formatCLP(data.monthlyExpenses),  icon: '💸', sub: 'Egresos registrados',                     color: '#f87171' },
        { label: 'Utilidad Real',          value: formatCLP(data.monthlyProfit),    icon: '💎', sub: 'Ingresos - Egresos',                      color: '#38bdf8' },
        { label: `Ventas ${data.currentYear}`, value: formatCLP(data.yearlyRevenue), icon: '📈', sub: 'Eventos del año actual', color: '#60a5fa' },
        { label: 'Ingresos Históricos',     value: formatCLP(data.historicalRevenue), icon: '🏆', sub: `${data.totalHistoricalCount} ventas`, color: '#FFD700' },
        { label: 'Proyección',              value: formatCLP(data.projectedRevenue), icon: '🔮', sub: 'Potencial borradores',             color: '#f472bc' },
    ];

    return (
        <div style={{ paddingBottom: '60px' }}>
            <style>{`
                .admin-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 32px; }
                @media (min-width: 900px) { .admin-kpi-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
                
                .admin-kpi-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 16px; transition: border-color 0.2s; }
                .admin-kpi-card:hover { border-color: rgba(226,160,73,0.3); }
                .admin-kpi-value { font-size: 20px; font-weight: 900; margin-bottom: 2px; word-break: break-all; }
                @media (min-width: 480px) { .admin-kpi-value { font-size: 24px; } }

                .dashboard-section-title { color: #f1f5f9; fontSize: 18px; fontWeight: 800; margin: 0; text-transform: capitalize; }
                .dashboard-section-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; margin-top: 40px; }
                .dashboard-accent { background: #34d399; width: 4px; height: 20px; borderRadius: 4px; }

                .admin-recent-wrap { background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                .admin-recent-table-view { display: none; }
                .admin-recent-cards-view { display: flex; flex-direction: column; }
                @media (min-width: 768px) {
                    .admin-recent-table-view { display: block; overflow-x: auto; }
                    .admin-recent-cards-view { display: none; }
                }

                .dashboard-quote-card { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.05); text-decoration: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
                .dashboard-quote-card:first-child { border-top: none; }
                .dashboard-quote-card:hover { background: rgba(255,255,255,0.02); }
                .dashboard-row-hover:hover { background: rgba(255,255,255,0.03) !important; }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 900, margin: '0 0 4px' }}>Cocktails Dashboard</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0, textTransform: 'capitalize' }}>
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* KPIs with Profit Calculation */}
            <div className="admin-kpi-grid">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="admin-kpi-card" style={{ borderTop: `3px solid ${kpi.color}` }}>
                        <div style={{ fontSize: '20px', marginBottom: '8px' }}>{kpi.icon}</div>
                        <div className="admin-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                        <div style={{ color: '#f1f5f9', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>{kpi.label}</div>
                        <div style={{ color: '#475569', fontSize: '11px' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Upcoming Events */}
            <div className="dashboard-section-wrap">
                <div className="dashboard-accent"></div>
                <h2 className="dashboard-section-title">Próximos Eventos de {data.currentMonthName}</h2>
            </div>
            <div className="admin-recent-wrap">
                {data.upcomingEvents.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>No hay eventos próximos confirmados.</div>
                ) : (
                    <>
                        <div className="admin-recent-table-view">
                            <table width="100%" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(52,211,153,0.03)' }}>
                                        {['Fecha', 'Cliente', 'Comuna', 'Invitados', 'Monto'].map(h => (
                                            <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.upcomingEvents.map((event: any) => (
                                        <DashboardRow key={event.id} href={`/admin/quotes/${event.id}`} className="dashboard-row-hover" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '14px 20px', color: '#34d399', fontSize: '13px', fontWeight: 700 }}>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</td>
                                            <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '13px' }}>{event.client_name} {event.client_lastname}</td>
                                            <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>{event.comuna_name === 'Otra' ? event.comuna_other : event.comuna_name}</td>
                                            <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>{event.guests} pax</td>
                                            <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '13px', fontWeight: 700 }}>{formatCLP(Number(event.total_price))}</td>
                                        </DashboardRow>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="admin-recent-cards-view">
                            {data.upcomingEvents.map((event: any) => (
                                <Link key={event.id} href={`/admin/quotes/${event.id}`} className="dashboard-quote-card">
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {event.client_name} {event.client_lastname || ''}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <span style={{ color: '#34d399', fontWeight: 700, fontSize: '12px' }}>{event.event_date ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}</span>
                                            <span style={{ color: '#475569', fontSize: '11px' }}>{event.guests} pax • {event.comuna_name === 'Otra' ? event.comuna_other : event.comuna_name}</span>
                                        </div>
                                    </div>
                                    <div style={{ color: '#E2A049', fontWeight: 700, fontSize: '13px' }}>{formatCLP(Number(event.total_price))}</div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* 3. SECCION: PROXIMO MES */}
            <div className="dashboard-section-wrap" style={{ marginTop: '50px' }}>
                <div className="dashboard-accent" style={{ background: '#a78bfa' }}></div>
                <h2 className="dashboard-section-title">Próximos Eventos de {data.nextMonthName}</h2>
            </div>
            <div className="admin-recent-wrap">
                {data.nextMonthEvents.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>No hay eventos confirmados para el próximo mes todavía.</div>
                ) : (
                    <>
                        <div className="admin-recent-table-view">
                            <table width="100%" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(167,139,250,0.03)' }}>
                                        {['Fecha', 'Cliente', 'Comuna', 'Invitados', 'Monto'].map(h => (
                                            <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.nextMonthEvents.map((event: any) => (
                                        <DashboardRow key={event.id} href={`/admin/quotes/${event.id}`} className="dashboard-row-hover" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '14px 20px', color: '#a78bfa', fontSize: '13px', fontWeight: 700 }}>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</td>
                                            <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '13px' }}>{event.client_name} {event.client_lastname}</td>
                                            <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>{event.comuna_name === 'Otra' ? event.comuna_other : event.comuna_name}</td>
                                            <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>{event.guests} pax</td>
                                            <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '13px', fontWeight: 700 }}>{formatCLP(Number(event.total_price))}</td>
                                        </DashboardRow>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="admin-recent-cards-view">
                            {data.nextMonthEvents.map((event: any) => (
                                <Link key={event.id} href={`/admin/quotes/${event.id}`} className="dashboard-quote-card">
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {event.client_name} {event.client_lastname || ''}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '12px' }}>{event.event_date ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}</span>
                                            <span style={{ color: '#475569', fontSize: '11px' }}>{event.guests} pax • {event.comuna_name === 'Otra' ? event.comuna_other : event.comuna_name}</span>
                                        </div>
                                    </div>
                                    <div style={{ color: '#E2A049', fontWeight: 700, fontSize: '13px' }}>{formatCLP(Number(event.total_price))}</div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
