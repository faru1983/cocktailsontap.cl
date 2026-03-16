import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

async function getDashboardData() {
    const db = createServerClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [confirmed, drafts, allClients, recentQuotes] = await Promise.all([
        db.from('quotes')
            .select('total_price, created_at')
            .in('status', ['confirmed', 'deposit_paid', 'completed'])
            .gte('created_at', startOfMonth),
        db.from('quotes')
            .select('total_price')
            .eq('status', 'draft')
            .gte('created_at', startOfMonth),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes')
            .select('id, token, status, client_name, client_lastname, event_date, total_price, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
    ]);

    const monthlyRevenue = (confirmed.data || []).reduce((s, q) => s + Number(q.total_price), 0);
    const projectedRevenue = (drafts.data || []).reduce((s, q) => s + Number(q.total_price), 0);
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
    };
}

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    deposit_paid: { label: 'Abono Recibido', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
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
                    gap: 14px;
                    margin-bottom: 32px;
                }
                @media (min-width: 640px) {
                    .admin-kpi-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (min-width: 900px) {
                    .admin-kpi-grid { grid-template-columns: repeat(4, 1fr); }
                }
                .admin-kpi-card {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 14px;
                    padding: 18px;
                }
                .admin-kpi-value {
                    font-size: 22px;
                    font-weight: 900;
                    margin-bottom: 2px;
                    word-break: break-all;
                }
                @media (min-width: 480px) {
                    .admin-kpi-value { font-size: 26px; }
                }
                .admin-recent-table th, .admin-recent-table td {
                    padding: 12px 14px;
                }
                @media (min-width: 640px) {
                    .admin-recent-table th, .admin-recent-table td {
                        padding: 14px 20px;
                    }
                }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
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
                        <div style={{ fontSize: '22px', marginBottom: '10px' }}>{kpi.icon}</div>
                        <div className="admin-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{kpi.label}</div>
                        <div style={{ color: '#475569', fontSize: '12px' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Recent Quotes */}
            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <h2 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        Cotizaciones Recientes
                    </h2>
                    <Link href="/admin/quotes" style={{ color: '#E2A049', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                        Ver todas →
                    </Link>
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="admin-recent-table" width="100%" style={{ borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['Cliente', 'Fecha Evento', 'Total', 'Estado', ''].map(h => (
                                    <th key={h} align="left" style={{ padding: '12px 14px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentQuotes.map((q: any) => {
                                const badge = statusBadge[q.status] || statusBadge.draft;
                                return (
                                    <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '13px 14px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {q.client_name} {q.client_lastname || ''}
                                        </td>
                                        <td style={{ padding: '13px 14px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td style={{ padding: '13px 14px', color: '#E2A049', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {formatCLP(Number(q.total_price))}
                                        </td>
                                        <td style={{ padding: '13px 14px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
                                                fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg,
                                                whiteSpace: 'nowrap',
                                            }}>{badge.label}</span>
                                        </td>
                                        <td style={{ padding: '13px 14px' }}>
                                            <Link href={`/admin/quotes/${q.id}`} style={{
                                                color: '#64748b', fontSize: '12px', textDecoration: 'none',
                                                padding: '5px 10px', borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap',
                                            }}>Ver →</Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
