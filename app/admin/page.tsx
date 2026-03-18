import { DashboardRow } from './DashboardRow';
import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import type { Quote } from '@/lib/types';

async function getDashboardData() {
    const db = createServerClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startOfMonthISO = startOfMonth.toISOString();
    const startOfMonthSQL = startOfMonth.toISOString().split('T')[0];
    const endOfMonthSQL = endOfMonth.toISOString().split('T')[0];

    const [confirmed, drafts, allClients, recentQuotes, upcomingEvents] = await Promise.all([
        db.from('quotes')
            .select('total_price, created_at')
            .in('status', ['confirmed', 'completed'])
            .gte('created_at', startOfMonthISO),
        db.from('quotes')
            .select('total_price')
            .eq('status', 'draft')
            .gte('created_at', startOfMonthISO),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes')
            .select('id, token, status, client_name, client_lastname, event_date, total_price, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        db.from('quotes')
            .select('id, client_name, client_lastname, event_date, start_time, total_price, guests, status')
            .in('status', ['confirmed', 'completed'])
            .gte('event_date', startOfMonthSQL)
            .lte('event_date', endOfMonthSQL)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true })
    ]);

    const monthlyRevenue = (confirmed.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const projectedRevenue = (drafts.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const conversionRate = ((confirmed.data?.length || 0) + (drafts.data?.length || 0)) > 0
        ? Math.round(((confirmed.data?.length || 0) / ((confirmed.data?.length || 0) + (drafts.data?.length || 0))) * 100)
        : 0;

    return {
        monthlyRevenue,
        projectedRevenue,
        confirmedCount: confirmed.data?.length || 0,
        draftCount: drafts.data?.length || 0,
        totalClients: allClients.count || 0,
        conversionRate,
        recentQuotes: recentQuotes.data || [],
        upcomingEvents: upcomingEvents.data || [],
        currentMonthName: now.toLocaleDateString('es-CL', { month: 'long' }),
    };
}

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

export default async function AdminDashboardPage() {
    const data = await getDashboardData();

    const kpis = [
        { label: 'Ingresos del Mes',       value: formatCLP(data.monthlyRevenue),   icon: '💰', sub: `${data.confirmedCount} reservas confirmadas`, color: '#34d399' },
        { label: 'Proyección (Borradores)', value: formatCLP(data.projectedRevenue), icon: '🔮', sub: `${data.draftCount} cotizaciones pendientes`,  color: '#60a5fa' },
        { label: 'Tasa de Conversión',      value: `${data.conversionRate}%`,        icon: '📈', sub: 'Draft → Confirmada',                           color: '#E2A049' },
        { label: 'Total Clientes',          value: data.totalClients.toString(),     icon: '👥', sub: 'Registrados en CRM',                           color: '#a78bfa' },
    ];

    return (
        <div>
            {/* ── Responsive styles ── */}
            <style>{`
                .admin-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 28px;
                }
                @media (min-width: 900px) {
                    .admin-kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
                }
                .admin-kpi-card {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 14px;
                    padding: 16px;
                }
                .admin-kpi-value {
                    font-size: 20px;
                    font-weight: 900;
                    margin-bottom: 2px;
                    word-break: break-all;
                }
                @media (min-width: 480px) {
                    .admin-kpi-value { font-size: 26px; }
                }

                /* ── Recent Quotes Dual View ── */
                .admin-recent-wrap { background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                .admin-recent-table-view { display: none; }
                .admin-recent-cards-view { display: flex; flex-direction: column; }
                
                @media (min-width: 768px) {
                    .admin-recent-table-view { display: block; overflow-x: auto; }
                    .admin-recent-cards-view { display: none; }
                }

                .dashboard-quote-card {
                    padding: 14px 16px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    text-decoration: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                .dashboard-quote-card:first-child { border-top: none; }
                .dashboard-quote-card:hover { background: rgba(255,255,255,0.02); }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>
                    Dashboard
                </h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* KPIs */}
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

            {/* Upcoming Events of the Month */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ background: '#34d399', width: '4px', height: '20px', borderRadius: '4px' }}></div>
                    <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 800, margin: 0, textTransform: 'capitalize' }}>
                        Próximos Eventos de {data.currentMonthName}
                    </h2>
                </div>

                <div className="admin-recent-wrap">
                    {data.upcomingEvents.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                            No hay eventos confirmados para este mes todavía.
                        </div>
                    ) : (
                        <>
                            {/* ── MOBILE: Cards ── */}
                            <div className="admin-recent-cards-view">
                                {data.upcomingEvents.map((event: any) => (
                                    <Link key={event.id} href={`/admin/quotes/${event.id}`} className="dashboard-quote-card">
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {event.client_name} {event.client_lastname || ''}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <span style={{ color: '#34d399', fontWeight: 700, fontSize: '12px' }}>{event.event_date ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}</span>
                                                <span style={{ color: '#475569', fontSize: '11px' }}>{event.guests} pax • {event.start_time || '--:--'}</span>
                                            </div>
                                        </div>
                                        <div style={{ color: '#E2A049', fontWeight: 700, fontSize: '13px' }}>{formatCLP(Number(event.total_price))}</div>
                                    </Link>
                                ))}
                            </div>

                            {/* ── DESKTOP: Table ── */}
                            <div className="admin-recent-table-view">
                                <table width="100%" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(52,211,153,0.03)' }}>
                                            {['Fecha', 'Cliente', 'Hora', 'Invitados', 'Total'].map(h => (
                                                <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.upcomingEvents.map((event: any) => (
                                            <DashboardRow 
                                                key={event.id} 
                                                href={`/admin/quotes/${event.id}`}
                                                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                                                className="dashboard-row-hover"
                                            >
                                                <td style={{ padding: '14px 20px', color: '#34d399', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {event.event_date ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long' }) : '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                                                        {event.client_name} {event.client_lastname || ''} →
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                    {event.start_time || '—'}
                                                </td>
                                                <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                    {event.guests} pax
                                                </td>
                                                <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {formatCLP(Number(event.total_price))}
                                                </td>
                                            </DashboardRow>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .dashboard-row-hover:hover { background: rgba(255,255,255,0.03) !important; }
            `}</style>

            {/* Recent Quotes */}
            <div className="admin-recent-wrap">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        Cotizaciones Recientes
                    </h2>
                    <Link href="/admin/quotes" style={{ color: '#E2A049', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                        Ver todas →
                    </Link>
                </div>

                {/* ── MOBILE: Cards ── */}
                <div className="admin-recent-cards-view">
                    {data.recentQuotes.map((q: any) => {
                        const badge = statusBadge[q.status] || statusBadge.draft;
                        return (
                            <Link key={q.id} href={`/admin/quotes/${q.id}`} className="dashboard-quote-card">
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {q.client_name} {q.client_lastname || ''}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span style={{ color: '#E2A049', fontWeight: 700, fontSize: '13px' }}>{formatCLP(Number(q.total_price))}</span>
                                        <span style={{ color: '#475569', fontSize: '11px' }}>{q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}</span>
                                    </div>
                                </div>
                                <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, color: badge.color, background: badge.bg, flexShrink: 0 }}>
                                    {badge.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* ── DESKTOP: Table ── */}
                <div className="admin-recent-table-view">
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['Cliente', 'Fecha Evento', 'Total', 'Estado'].map(h => (
                                    <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentQuotes.map((q: any) => {
                                const badge = statusBadge[q.status] || statusBadge.draft;
                                return (
                                    <DashboardRow 
                                        key={q.id} 
                                        href={`/admin/quotes/${q.id}`}
                                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                                        className="dashboard-row-hover"
                                    >
                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                            <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                                                {q.client_name} {q.client_lastname || ''} →
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {formatCLP(Number(q.total_price))}
                                        </td>
                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </DashboardRow>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
