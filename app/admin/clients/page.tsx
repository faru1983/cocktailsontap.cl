import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import SortSelect from '@/components/admin/SortSelect';
import { formatPhoneDisplay } from '@/lib/phone';

const ITEMS_PER_PAGE = 30;

async function getClients(search?: string, sort = 'created_at', order = 'desc', page = 1) {
    const db = createServerClient();
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = db
        .from('clients')
        .select('id, first_name, last_name, email, phone, google_contact_id, possible_duplicate, merged_into_id, created_at', { count: 'exact' })
        .is('merged_into_id', null);

    if (search) {
        query = query.or(`first_name.ilike.%${search}%,email.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    query = query.order(sort, { ascending: order === 'asc' });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) console.error('Error fetching clients:', error);

    return { 
        clients: data || [], 
        totalCount: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
    };
}

type SearchParams = Promise<{ q?: string; sort?: string; order?: string; page?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
    const rawParams = await searchParams;
    let { q, sort = 'created_at', order = 'desc', sort_order, page = '1' } = rawParams as any;
    const currentPage = parseInt(page) || 1;

    if (sort_order) {
        const [s, o] = sort_order.split('-');
        sort = s;
        order = o;
    }

    const { clients, totalCount, totalPages } = await getClients(q, sort, order, currentPage);

    const sortFields = [
        { label: 'Nombre',      field: 'first_name' },
        { label: 'Apellido',    field: 'last_name' },
        { label: 'Email',       field: 'email' },
        { label: 'Teléfono',    field: 'phone' },
        { label: 'Google Sync', field: 'google_contact_id' },
        { label: 'Creación',    field: 'created_at' },
    ];

    const getSortLink = (field: string) => {
        const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        params.set('sort', field);
        params.set('order', nextOrder);
        params.set('page', '1'); // Reset to page 1 on sort change
        return `/admin/clients?${params.toString()}`;
    };

    const getPageLink = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);
        params.set('page', p.toString());
        return `/admin/clients?${params.toString()}`;
    };

    return (
        <div>
            <style>{`
                /* ── Header ── */
                .cp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
                .cp-search { width: 100%; }
                @media(min-width: 600px) { .cp-search { width: 220px; } }
                .cp-sort-select { padding: 9px 12px; background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #f1f5f9; font-size: 13px; outline: none; cursor: pointer; }

                /* ── Mobile cards ── */
                .cp-cards { display: flex; flex-direction: column; gap: 10px; }
                .cp-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px 16px; text-decoration: none; display: flex; align-items: center; gap: 14px; transition: border-color 0.15s; }
                .cp-card:hover { border-color: rgba(226,160,73,0.35); }
                .cp-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg, #E2A049, #c8872e); display: flex; align-items: center; justify-content: center; color: #1a1a2e; font-weight: 900; font-size: 16px; }
                .cp-card-body { flex: 1; min-width: 0; }
                .cp-card-name { color: #f1f5f9; font-size: 15px; font-weight: 700; margin-bottom: 3px; }
                .cp-card-email { color: #64748b; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
                .cp-card-footer { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
                .cp-sync-badge { font-size: 11px; font-weight: 600; }
                .cp-card-phone { color: #475569; font-size: 12px; }
                .cp-chevron { color: #E2A049; font-size: 18px; flex-shrink: 0; }

                /* ── Desktop table ── */
                .cp-table-wrap { display: none; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                @media(min-width: 768px) { .cp-cards { display: none; } .cp-table-wrap { display: block; } }
                .cp-table-wrap table { border-collapse: collapse; width: 100%; }
                .cp-row { position: relative; transition: background 0.15s; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.04); }
                .cp-row:hover { background: rgba(255,255,255,0.02) !important; }
                .cp-row-link { color: inherit; text-decoration: none; }
                .cp-row-link::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                }

                /* ── Pagination ── */
                .pagination-wrap { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 24px; }
                .page-link { 
                    padding: 8px 16px; border-radius: 10px; background: #1e2433; border: 1px solid rgba(255,255,255,0.06); 
                    color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 700; transition: all 0.2s; 
                }
                .page-link:hover { border-color: #E2A049; color: #E2A049; }
                .page-link.active { background: #E2A049; color: #1a1b26; border-color: #E2A049; }
                .page-link.disabled { opacity: 0.4; pointer-events: none; }
            `}</style>

            {/* Header */}
            <div className="cp-header">
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>Clientes</h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{totalCount} registrados en CRM</p>
                </div>
                <form method="GET" action="/admin/clients" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
                    <input name="q" defaultValue={q || ''} placeholder="Buscar cliente…" className="cp-search"
                        style={{ padding: '9px 14px', background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                    <SortSelect name="sort_order" className="cp-sort-select" defaultValue={`${sort}-${order}`}>
                        <option value="created_at-desc">Recientes primero</option>
                        <option value="first_name-asc">Nombre (A-Z)</option>
                        <option value="last_name-asc">Apellido (A-Z)</option>
                        <option value="email-asc">Email (A-Z)</option>
                    </SortSelect>
                </form>
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="cp-cards">
                {clients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No hay resultados.</div>
                ) : clients.map((c: any) => (
                    <Link key={c.id} href={`/admin/clients/${c.id}`} className="cp-card">
                        <div className="cp-avatar">{c.first_name?.[0]?.toUpperCase()}</div>
                        <div className="cp-card-body">
                            <div className="cp-card-name">{c.first_name} {c.last_name || ''}</div>
                            <div className="cp-card-email">{c.email}</div>
                            <div className="cp-card-footer">
                                <span className="cp-sync-badge" style={{ color: c.google_contact_id ? '#34d399' : '#475569' }}>
                                    {c.google_contact_id ? 'Sync' : 'Sin sync'}
                                </span>
                                {c.possible_duplicate && (
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>Posible dup</span>
                                )}
                                {c.merged_into_id && (
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>Fusionado</span>
                                )}
                                {c.phone && <span className="cp-card-phone">{formatPhoneDisplay(c.phone)}</span>}
                                <span style={{ color: '#334155', fontSize: '11px', marginLeft: 'auto' }}>
                                    {new Date(c.created_at).toLocaleDateString('es-CL')}
                                </span>
                            </div>
                        </div>
                        <span className="cp-chevron">›</span>
                    </Link>
                ))}
            </div>

            {/* ── DESKTOP: table ── */}
            <div className="cp-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '14px 20px' }}></th>
                                {sortFields.map(h => (
                                    <th key={h.field} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
                                        <Link href={getSortLink(h.field)} style={{ textDecoration: 'none', color: sort === h.field ? '#E2A049' : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {h.label}{sort === h.field && (order === 'asc' ? ' 🔼' : ' 🔽')}
                                        </Link>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c: any) => (
                                <tr key={c.id} className="cp-row">
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #E2A049, #c8872e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a2e', fontWeight: 900, fontSize: '14px' }}>
                                            {c.first_name?.[0]?.toUpperCase()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        <Link href={`/admin/clients/${c.id}`} className="cp-row-link" aria-label={`Ver cliente ${c.first_name} ${c.last_name || ''}`.trim()}>
                                            {c.first_name}
                                        </Link>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.last_name || '—'}</td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>
                                        {c.email || '—'}
                                        {c.possible_duplicate && (
                                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>DUP?</span>
                                        )}
                                        {c.merged_into_id && (
                                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>MERGED</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>{c.phone ? formatPhoneDisplay(c.phone) : '—'}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{ fontSize: '12px', color: c.google_contact_id ? '#34d399' : '#94a3b8' }}>
                                            {c.google_contact_id ? 'Sincronizado' : '— Sin sync'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('es-CL')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
                <div className="pagination-wrap">
                    <Link href={getPageLink(currentPage - 1)} className={`page-link ${currentPage <= 1 ? 'disabled' : ''}`}>
                        Anterior
                    </Link>
                    
                    <div style={{ color: '#475569', fontSize: '13px', fontWeight: 700, margin: '0 8px' }}>
                        Página {currentPage} de {totalPages}
                    </div>

                    <Link href={getPageLink(currentPage + 1)} className={`page-link ${currentPage >= totalPages ? 'disabled' : ''}`}>
                        Siguiente
                    </Link>
                </div>
            )}
        </div>
    );
}
