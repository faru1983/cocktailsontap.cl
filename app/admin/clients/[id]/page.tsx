import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

type Params = Promise<{ id: string }>;

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default async function ClientDetailPage({ params }: { params: Params }) {
    const { id } = await params;
    const db = createServerClient();

    const [clientRes, quotesRes] = await Promise.all([
        db.from('clients').select('*').eq('id', id).single(),
        db.from('quotes')
            .select('id, token, status, event_date, total_price, created_at')
            .eq('client_id', id)
            .order('created_at', { ascending: false }),
    ]);

    if (!clientRes.data) return <div style={{ color: '#f1f5f9', padding: '20px' }}>Cliente no encontrado.</div>;

    const client = clientRes.data;
    const quotes = quotesRes.data || [];
    const totalSpent = quotes
        .filter((q: any) => ['confirmed', 'completed'].includes(q.status))
        .reduce((s: number, q: any) => s + Number(q.total_price), 0);

    return (
        <div>
            <style>{`
                /* ── Layout grid ── */
                .cd-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                @media (min-width: 768px) {
                    .cd-grid {
                        grid-template-columns: 280px 1fr;
                        gap: 24px;
                    }
                }

                /* ── Profile card ── */
                .cd-profile {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    padding: 24px;
                }
                /* On mobile: avatar + name side by side */
                .cd-profile-top {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                @media (min-width: 768px) {
                    .cd-profile-top {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0;
                    }
                    .cd-profile-top .cd-avatar { margin-bottom: 14px; }
                    .cd-profile-top .cd-name-block { margin: 0; }
                }
                .cd-avatar {
                    width: 52px; height: 52px; flex-shrink: 0;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #E2A049, #c8872e);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 20px; font-weight: 900; color: #1a1a2e;
                }
                .cd-name-block h2 {
                    color: #f1f5f9; font-size: 17px; font-weight: 800; margin: 0 0 2px;
                }
                .cd-name-block p {
                    color: #475569; font-size: 12px; margin: 0;
                    word-break: break-all;
                }

                /* ── Meta items ── */
                .cd-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 20px;
                    padding-top: 14px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                /* ── Action buttons: row on mobile, column on desktop ── */
                .cd-actions {
                    display: flex;
                    gap: 8px;
                }
                @media (min-width: 768px) {
                    .cd-actions { flex-direction: column; }
                }

                /* ── Stats row (mobile) ── */
                .cd-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .cd-stat-box {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    padding: 12px;
                    text-align: center;
                }
                @media (min-width: 768px) {
                    .cd-stats { display: none; }
                }

                /* ── Quote history ── */
                .cd-quotes {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    overflow: hidden;
                }

                /* Mobile: quote cards */
                .cd-quote-cards { display: flex; flex-direction: column; }
                .cd-quote-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 14px 16px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    text-decoration: none;
                    gap: 12px;
                }
                .cd-quote-card:first-child { border-top: none; }
                .cd-quote-card:hover { background: rgba(255,255,255,0.02); }

                /* Desktop: table */
                .cd-quote-table { display: none; }
                @media (min-width: 600px) {
                    .cd-quote-cards { display: none; }
                    .cd-quote-table { display: block; overflow-x: auto; }
                    .cd-quote-table table { border-collapse: collapse; width: 100%; }
                }
            `}</style>

            {/* Back */}
            <div style={{ marginBottom: '20px' }}>
                <Link href="/admin/clients" style={{ color: '#E2A049', fontSize: '13px', textDecoration: 'none' }}>← Volver a Clientes</Link>
            </div>

            {/* Stats row (mobile only) */}
            <div className="cd-stats">
                <div className="cd-stat-box">
                    <div style={{ color: '#34d399', fontSize: '16px', fontWeight: 900 }}>{formatCLP(totalSpent)}</div>
                    <div style={{ color: '#475569', fontSize: '10px', marginTop: '3px' }}>Gastado</div>
                </div>
                <div className="cd-stat-box">
                    <div style={{ color: '#E2A049', fontSize: '18px', fontWeight: 900 }}>{quotes.length}</div>
                    <div style={{ color: '#475569', fontSize: '10px', marginTop: '3px' }}>Cotizaciones</div>
                </div>
                <div className="cd-stat-box">
                    <div style={{ fontSize: '14px', fontWeight: 700, color: client.google_contact_id ? '#34d399' : '#94a3b8' }}>
                        {client.google_contact_id ? '✅' : '—'}
                    </div>
                    <div style={{ color: '#475569', fontSize: '10px', marginTop: '3px' }}>Google Sync</div>
                </div>
            </div>

            {/* Main grid */}
            <div className="cd-grid">
                {/* ── Profile card ── */}
                <div className="cd-profile">
                    <div className="cd-profile-top">
                        <div className="cd-avatar">{client.first_name?.[0]?.toUpperCase()}</div>
                        <div className="cd-name-block">
                            <h2>{client.first_name} {client.last_name || ''}</h2>
                            <p>{client.email}</p>
                        </div>
                    </div>

                    <div className="cd-meta">
                        {client.phone && (
                            <div style={{ color: '#94a3b8', fontSize: '13px' }}>📞 {client.phone}</div>
                        )}
                        <div style={{ color: '#475569', fontSize: '12px' }}>
                            Google: {client.google_contact_id ? '✅ Sincronizado' : '⚠️ Sin sync'}
                        </div>
                        <div style={{ color: '#334155', fontSize: '11px' }}>
                            Registro: {new Date(client.created_at).toLocaleDateString('es-CL')}
                        </div>
                        {/* Desktop stats */}
                        <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                            <div style={{ color: '#34d399', fontSize: '18px', fontWeight: 900 }}>{formatCLP(totalSpent)}</div>
                            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>Total gastado (confirmadas)</div>
                        </div>
                    </div>

                    <div className="cd-actions">
                        {client.phone && (
                            <a href={`https://wa.me/${client.phone.replace(/\D/g, '').startsWith('56') ? client.phone.replace(/\D/g, '') : '56' + client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                                style={{ flex: 1, display: 'block', padding: '10px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '10px', color: '#4ade80', fontSize: '13px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                                💬 WhatsApp
                            </a>
                        )}
                        <a href={`mailto:${client.email}`}
                            style={{ flex: 1, display: 'block', padding: '10px', background: 'rgba(226,160,73,0.1)', border: '1px solid rgba(226,160,73,0.3)', borderRadius: '10px', color: '#E2A049', fontSize: '13px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            ✉️ Email
                        </a>
                    </div>
                </div>

                {/* ── Quote history ── */}
                <div className="cd-quotes">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                            Historial de Cotizaciones ({quotes.length})
                        </h3>
                    </div>

                    {quotes.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>Sin cotizaciones registradas.</div>
                    ) : (
                        <>
                            {/* Mobile cards */}
                            <div className="cd-quote-cards">
                                {quotes.map((q: any) => {
                                    const badge = statusBadge[q.status] || statusBadge.draft;
                                    return (
                                        <Link key={q.id} href={`/admin/quotes/${q.id}`} className="cd-quote-card">
                                            <div>
                                                <div style={{ color: '#E2A049', fontWeight: 700, fontSize: '15px', marginBottom: '3px' }}>
                                                    {formatCLP(Number(q.total_price))}
                                                </div>
                                                <div style={{ color: '#64748b', fontSize: '12px' }}>
                                                    {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                                </div>
                                            </div>
                                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, flexShrink: 0 }}>
                                                {badge.label}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Desktop table */}
                            <div className="cd-quote-table">
                                <table>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            {['Fecha Evento', 'Creación', 'Total', 'Estado', ''].map(h => (
                                                <th key={h} align="left" style={{ padding: '12px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quotes.map((q: any) => {
                                            const badge = statusBadge[q.status] || statusBadge.draft;
                                            return (
                                                <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                        {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                        {new Date(q.created_at).toLocaleDateString('es-CL')}
                                                    </td>
                                                    <td style={{ padding: '14px 20px', color: '#E2A049', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                        {formatCLP(Number(q.total_price))}
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, whiteSpace: 'nowrap' }}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <Link href={`/admin/quotes/${q.id}`} style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver →</Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
