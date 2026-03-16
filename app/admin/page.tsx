import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

async function getDashboardData() {
    const db = createServerClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

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
    draft:       { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:   { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    deposit_paid:{ label: 'Abono Recibido', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    completed:   { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled:   { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

export default async function AdminDashboardPage() {
    const data = await getDashboardData();

    const kpis = [
        { label: 'Ingresos del Mes', value: formatCLP(data.monthlyRevenue), icon: '💰', sub: `${data.confirmedCount} reservas confirmadas`, color: '#34d399' },
        { label: 'Proyección (Borradores)', value: formatCLP(data.projectedRevenue), icon: '🔮', sub: `${data.draftCount} cotizaciones pendientes`, color: '#60a5fa' },
        { label: 'Tasa de Conversión', value: `${data.conversionRate}%`, icon: '📈', sub: 'Draft → Confirmada', color: '#E2A049' },
        { label: 'Total Clientes', value: data.totalClients.toString(), icon: '👥', sub: 'Registrados en CRM', color: '#a78bfa' },
    ];

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '26px', fontWeight: 900, margin: '0 0 4px' }}>
                    Dashboard
                </h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
                {kpis.map((kpi) => (
                    <div key={kpi.label} style={{
                        background: '#1e2433',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '16px',
                        padding: '24px',
                        borderTop: `3px solid ${kpi.color}`,
                    }}>
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>{kpi.icon}</div>
                        <div style={{ color: kpi.color, fontSize: '26px', fontWeight: 900, marginBottom: '2px' }}>
                            {kpi.value}
                        </div>
                        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                            {kpi.label}
                        </div>
                        <div style={{ color: '#475569', fontSize: '12px' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Recent Quotes */}
            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                        Cotizaciones Recientes
                    </h2>
                    <Link href="/admin/quotes" style={{ color: '#E2A049', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                        Ver todas →
                    </Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['Cliente', 'Fecha Evento', 'Total', 'Estado', ''].map(h => (
                                    <th key={h} align="left" style={{ padding: '12px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentQuotes.map((q: any) => {
                                const badge = statusBadge[q.status] || statusBadge.draft;
                                return (
                                    <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                                            {q.client_name} {q.client_lastname || ''}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                            {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700 }}>
                                            {formatCLP(Number(q.total_price))}
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: badge.color,
                                                background: badge.bg,
                                            }}>{badge.label}</span>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <Link href={`/admin/quotes/${q.id}`} style={{
                                                color: '#64748b',
                                                fontSize: '12px',
                                                textDecoration: 'none',
                                                padding: '5px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                transition: 'all 0.15s',
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
