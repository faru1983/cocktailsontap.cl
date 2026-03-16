import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:       { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:   { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    deposit_paid:{ label: 'Abono Recibido', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    completed:   { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled:   { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

type SearchParams = Promise<{ status?: string; q?: string; sort?: string; order?: string }>;

async function getQuotes(status?: string, search?: string, sort: string = 'created_at', order: string = 'desc') {
    const db = createServerClient();
    let query = db
        .from('quotes')
        .select('id, token, status, client_name, client_lastname, client_email, event_date, total_price, created_at, comuna_name');

    if (status && status !== 'all') query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_lastname.ilike.%${search}%`);

    query = query.order(sort, { ascending: order === 'asc' });

    const { data } = await query;
    return data || [];
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
    const { status, q, sort = 'created_at', order = 'desc' } = await searchParams;
    const quotes = await getQuotes(status, q, sort, order);

    const filters = [
        { value: 'all', label: 'Todas' },
        { value: 'draft', label: 'Borradores' },
        { value: 'confirmed', label: 'Confirmadas' },
        { value: 'deposit_paid', label: 'Abono Recibido' },
        { value: 'completed', label: 'Completadas' },
        { value: 'cancelled', label: 'Cancelada' },
    ];

    const sortFields = [
        { label: 'Cliente', field: 'client_name' },
        { label: 'Email', field: 'client_email' },
        { label: 'Fecha Evento', field: 'event_date' },
        { label: 'Creación', field: 'created_at' },
        { label: 'Comuna', field: 'comuna_name' },
        { label: 'Total', field: 'total_price' },
        { label: 'Estado', field: 'status' },
    ];

    const getSortLink = (field: string) => {
        const isCurrent = sort === field;
        const nextOrder = isCurrent && order === 'desc' ? 'asc' : 'desc';
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (q) params.set('q', q);
        params.set('sort', field);
        params.set('order', nextOrder);
        return `/admin/quotes?${params.toString()}`;
    };

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Cotizaciones</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{quotes.length} resultado(s)</p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {filters.map(f => {
                    const active = (status || 'all') === f.value;
                    return (
                        <Link key={f.value} href={`/admin/quotes?status=${f.value}${q ? `&q=${q}` : ''}${sort ? `&sort=${sort}` : ''}${order ? `&order=${order}` : ''}`} style={{
                            padding: '7px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            color: active ? '#1a1a2e' : '#64748b',
                            background: active ? '#E2A049' : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (active ? '#E2A049' : 'rgba(255,255,255,0.08)'),
                            transition: 'all 0.15s',
                        }}>{f.label}</Link>
                    );
                })}
                <form method="GET" action="/admin/quotes" style={{ marginLeft: 'auto' }}>
                    {status && <input type="hidden" name="status" value={status} />}
                    {sort && <input type="hidden" name="sort" value={sort} />}
                    {order && <input type="hidden" name="order" value={order} />}
                    <input
                        name="q"
                        defaultValue={q || ''}
                        placeholder="Buscar cliente o email…"
                        style={{
                            padding: '8px 14px',
                            background: '#1e2433',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                            outline: 'none',
                            fontFamily: 'inherit',
                            width: '220px',
                        }}
                    />
                </form>
            </div>

            {/* Table */}
            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {sortFields.map((h) => (
                                    <th key={h.field} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
                                        <Link href={getSortLink(h.field)} style={{ textDecoration: 'none', color: sort === h.field ? '#E2A049' : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {h.label}
                                            {sort === h.field && (order === 'asc' ? ' 🔼' : ' 🔽')}
                                        </Link>
                                    </th>
                                ))}
                                <th style={{ padding: '14px 20px' }}></th>
                                <th align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                                        No se encontraron cotizaciones.
                                    </td>
                                </tr>
                            ) : quotes.map((q: any) => {
                                const badge = statusBadge[q.status] || statusBadge.draft;
                                return (
                                    <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                                        <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {q.client_name} {q.client_lastname || ''}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.client_email || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            {new Date(q.created_at).toLocaleDateString('es-CL')}
                                        </td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.comuna_name || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {formatCLP(Number(q.total_price))}
                                        </td>
                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
                                                fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg,
                                            }}>{badge.label}</span>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <Link href={`/admin/quotes/${q.id}`} style={{
                                                color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700,
                                                padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(226,160,73,0.3)',
                                                whiteSpace: 'nowrap',
                                            }}>Ver / Editar →</Link>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            {q.token && (
                                                <a href={`https://cocktailsontap.cl/cotizar/${q.token}`} target="_blank" rel="noopener noreferrer" title="Abrir cotización pública" style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    color: '#60a5fa', fontSize: '12px', textDecoration: 'none', fontWeight: 700,
                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(96,165,250,0.25)',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    🔗 Ver
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
