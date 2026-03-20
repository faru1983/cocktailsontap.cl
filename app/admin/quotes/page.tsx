import { createServerClient } from '@/lib/supabaseServer';
import { SITE_URL } from '@/lib/config';
import Link from 'next/link';

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

type SearchParams = Promise<{ status?: string; q?: string; sort?: string; order?: string }>;

async function getQuotes(status?: string, search?: string, sort = 'created_at', order = 'desc') {
    const db = createServerClient();
    let query = db.from('quotes')
        .select('id, token, status, client_name, client_lastname, client_email, event_date, total_price, created_at, comuna_name');
    if (status && status !== 'all') query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_lastname.ilike.%${search}%`);
    query = query.order(sort, { ascending: order === 'asc' });
    const { data } = await query;
    return data || [];
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
    const { status = 'confirmed', q, sort = 'created_at', order = 'desc' } = await searchParams;
    const quotes = await getQuotes(status, q, sort, order);

    const filters = [
        { value: 'all', label: 'Todas' },
        { value: 'draft', label: 'Borradores' },
        { value: 'confirmed', label: 'Confirmadas' },
        { value: 'completed', label: 'Completadas' },
        { value: 'cancelled', label: 'Canceladas' },
    ];

    const sortFields = [
        { label: 'Cliente',       field: 'client_name' },
        { label: 'Email',         field: 'client_email' },
        { label: 'Fecha Evento',  field: 'event_date' },
        { label: 'Creación',      field: 'created_at' },
        { label: 'Comuna',        field: 'comuna_name' },
        { label: 'Total',         field: 'total_price' },
        { label: 'Estado',        field: 'status' },
    ];

    const getSortLink = (field: string) => {
        const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (q) params.set('q', q);
        params.set('sort', field);
        params.set('order', nextOrder);
        return `/admin/quotes?${params.toString()}`;
    };

    const filterBase = (v: string) =>
        `/admin/quotes?status=${v}${q ? `&q=${q}` : ''}${sort ? `&sort=${sort}` : ''}${order ? `&order=${order}` : ''}`;

    return (
        <div>
            <style>{`
                /* ── Header & search ── */
                .qp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
                .qp-search { width: 100%; }
                @media(min-width: 600px) { .qp-search { width: 220px; } }

                /* ── Filters ── */
                .qp-filters { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 18px; }

                /* ── Mobile cards ── */
                .qp-cards { display: flex; flex-direction: column; gap: 10px; }
                .qp-card {
                    background: #1e2433;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 14px;
                    padding: 14px 16px;
                    text-decoration: none;
                    display: block;
                    transition: border-color 0.15s;
                }
                .qp-card:hover { border-color: rgba(226,160,73,0.35); }
                .qp-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px; }
                .qp-card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
                .qp-card-meta-row { display: flex; justify-content: space-between; align-items: flex-end; }
                .qp-card-name { color: #f1f5f9; font-size: 15px; font-weight: 700; }
                .qp-card-meta { display: flex; gap: 14px; flex-wrap: wrap; }
                .qp-card-meta-item { display: flex; flex-direction: column; gap: 1px; }
                .qp-card-meta-label { color: #475569; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
                .qp-card-meta-value { color: #94a3b8; font-size: 13px; }
                .qp-card-price { color: #E2A049; font-size: 16px; font-weight: 900; }

                /* ── Desktop table ── */
                .qp-table-wrap { display: none; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                @media(min-width: 768px) {
                    .qp-cards    { display: none; }
                    .qp-table-wrap { display: block; }
                }
                .qp-row { position: relative; transition: background 0.15s; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.04); }
                .qp-row:hover { background: rgba(255,255,255,0.02) !important; }
                .qp-row-link::after {
                    position: absolute;
                    top: 0; right: 0; bottom: 0; left: 0;
                    z-index: 1;
                    content: "";
                }
                .qp-public-link {
                    position: relative;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    color: #60a5fa;
                    font-size: 12px;
                    text-decoration: none;
                    font-weight: 700;
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(96,165,250,0.25);
                    transition: all 0.15s;
                }
                .qp-public-link:hover {
                    background: rgba(96,165,250,0.1);
                    border-color: rgba(96,165,250,0.4);
                }
                .qp-table-wrap table { border-collapse: collapse; width: 100%; }
                .qp-table-wrap th, .qp-table-wrap td { white-space: nowrap; }
            `}</style>

            {/* Header */}
            <div className="qp-header">
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>Cotizaciones</h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{quotes.length} resultado(s)</p>
                </div>
                <form method="GET" action="/admin/quotes">
                    {status && <input type="hidden" name="status" value={status} />}
                    {sort && <input type="hidden" name="sort" value={sort} />}
                    {order && <input type="hidden" name="order" value={order} />}
                    <input name="q" defaultValue={q || ''} placeholder="Buscar cliente o email…" className="qp-search"
                        style={{ padding: '9px 14px', background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                </form>
            </div>

            {/* Filters */}
            <div className="qp-filters">
                {filters.map(f => {
                    const active = (status || 'all') === f.value;
                    return (
                        <Link key={f.value} href={filterBase(f.value)} style={{
                            padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                            textDecoration: 'none',
                            color: active ? '#1a1a2e' : '#64748b',
                            background: active ? '#E2A049' : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (active ? '#E2A049' : 'rgba(255,255,255,0.08)'),
                        }}>{f.label}</Link>
                    );
                })}
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="qp-cards">
                {quotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No se encontraron cotizaciones.</div>
                ) : quotes.map((q: any) => {
                    const badge = statusBadge[q.status] || statusBadge.draft;
                    return (
                        <div key={q.id} className="qp-card" style={{ position: 'relative' }}>
                            <Link href={`/admin/quotes/${q.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                <div className="qp-card-top">
                                    <span className="qp-card-name">{q.client_name} {q.client_lastname || ''}</span>
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, flexShrink: 0 }}>
                                        {badge.label}
                                    </span>
                                </div>
                                <div className="qp-card-meta-row">
                                    <div className="qp-card-meta">
                                        <div className="qp-card-meta-item">
                                            <span className="qp-card-meta-label">Total</span>
                                            <span className="qp-card-price">{formatCLP(Number(q.total_price))}</span>
                                        </div>
                                        <div className="qp-card-meta-item">
                                            <span className="qp-card-meta-label">Evento</span>
                                            <span className="qp-card-meta-value">{q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}</span>
                                        </div>
                                        <div className="qp-card-meta-item">
                                            <span className="qp-card-meta-label">Comuna</span>
                                            <span className="qp-card-meta-value">{q.comuna_name || '—'}</span>
                                        </div>
                                        <div className="qp-card-meta-item">
                                            <span className="qp-card-meta-label">Creación</span>
                                            <span className="qp-card-meta-value">{new Date(q.created_at).toLocaleDateString('es-CL')}</span>
                                        </div>
                                    </div>
                                    {/* Placeholder to reserve space in the layout */}
                                    <div style={{ width: '24px', flexShrink: 0 }} />
                                </div>
                            </Link>

                            {/* Public Link - Outside the main Link to avoid <a> inside <a> error */}
                            {q.token && (
                                <a href={`${SITE_URL}/cotizar/${q.token}`} target="_blank" rel="noopener noreferrer"
                                    style={{ 
                                        position: 'absolute', 
                                        right: '16px', 
                                        bottom: '14px',
                                        fontSize: '18px', 
                                        textDecoration: 'none', 
                                        opacity: 0.55, 
                                        zIndex: 5,
                                        padding: '4px' 
                                    }}
                                    title="Ver cotización pública">
                                    🔗
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── DESKTOP: table ── */}
            <div className="qp-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {sortFields.map(h => (
                                    <th key={h.field} align="left" style={{ padding: '13px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <Link href={getSortLink(h.field)} style={{ textDecoration: 'none', color: sort === h.field ? '#E2A049' : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {h.label}{sort === h.field && (order === 'asc' ? ' 🔼' : ' 🔽')}
                                        </Link>
                                    </th>
                                ))}
                                <th align="left" style={{ padding: '13px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Púb.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotes.length === 0 ? (
                                <tr><td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>No se encontraron cotizaciones.</td></tr>
                            ) : quotes.map((q: any) => {
                                const badge = statusBadge[q.status] || statusBadge.draft;
                                return (
                                    <tr key={q.id} className="qp-row">
                                        <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                                            <Link href={`/admin/quotes/${q.id}`} className="qp-row-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                                                {q.client_name} {q.client_lastname || ''}
                                            </Link>
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.client_email || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                            {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>{new Date(q.created_at).toLocaleDateString('es-CL')}</td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.comuna_name || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700 }}>{formatCLP(Number(q.total_price))}</td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.label}</span>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {q.token && (
                                                <a href={`${SITE_URL}/cotizar/${q.token}`} target="_blank" rel="noopener noreferrer"
                                                    className="qp-public-link" title="Ver cotización pública">
                                                    🔗
                                                </a>
                                            )}
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
