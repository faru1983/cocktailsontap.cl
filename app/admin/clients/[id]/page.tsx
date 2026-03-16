import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

type Params = Promise<{ id: string }>;

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

    if (!clientRes.data) return <div style={{ color: '#f1f5f9' }}>Cliente no encontrado.</div>;
    const client = clientRes.data;
    const quotes = quotesRes.data || [];

    const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
        draft:       { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
        confirmed:   { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        deposit_paid:{ label: 'Abono Recibido', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
        completed:   { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
        cancelled:   { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    };
    const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <Link href="/admin/clients" style={{ color: '#E2A049', fontSize: '13px', textDecoration: 'none' }}>← Volver a Clientes</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
                {/* Client Card */}
                <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #E2A049, #c8872e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '16px' }}>
                        {client.first_name?.[0]?.toUpperCase()}
                    </div>
                    <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
                        {client.first_name} {client.last_name || ''}
                    </h2>
                    <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 20px' }}>{client.email}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {client.phone && (
                            <div style={{ color: '#94a3b8', fontSize: '13px' }}>📞 {client.phone}</div>
                        )}
                        <div style={{ color: '#475569', fontSize: '11px' }}>
                            ID Google: {client.google_contact_id ? '✅ Sincronizado' : '⚠️ Sin sync'}
                        </div>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {client.phone && (
                            <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ display: 'block', padding: '10px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '10px', color: '#4ade80', fontSize: '13px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                                💬 WhatsApp
                            </a>
                        )}
                        <a href={`mailto:${client.email}`} style={{ display: 'block', padding: '10px', background: 'rgba(226,160,73,0.1)', border: '1px solid rgba(226,160,73,0.3)', borderRadius: '10px', color: '#E2A049', fontSize: '13px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            ✉️ Enviar Email
                        </a>
                    </div>
                </div>

                {/* Quote History */}
                <div>
                    <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                                Historial de Cotizaciones ({quotes.length})
                            </h3>
                        </div>
                        <table width="100%" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    {['Fecha Evento', 'Total', 'Estado', ''].map(h => (
                                        <th key={h} align="left" style={{ padding: '12px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((q: any) => {
                                    const badge = statusBadge[q.status] || statusBadge.draft;
                                    return (
                                        <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                                {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                            </td>
                                            <td style={{ padding: '14px 20px', color: '#E2A049', fontWeight: 700, fontSize: '14px' }}>
                                                {formatCLP(Number(q.total_price))}
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.label}</span>
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <Link href={`/admin/quotes/${q.id}`} style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700 }}>Ver →</Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
