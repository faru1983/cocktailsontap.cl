import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import SortSelect from '@/components/admin/SortSelect';
import { formatPhoneDisplay } from '@/lib/phone';
import { STAGE_LABELS, type ClientLifecycleStage } from '@/lib/services/clientLifecycleService';

const ITEMS_PER_PAGE = 30;

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
    curious: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    engaged: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    quoted: { color: '#E2A049', bg: 'rgba(226,160,73,0.15)' },
    customer: { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    lost: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

async function getStageCounts() {
    const db = createServerClient();
    const { data } = await db
        .from('clients')
        .select('lifecycle_stage')
        .is('merged_into_id', null);
    const counts: Record<string, number> = {};
    for (const row of data || []) {
        const s = row.lifecycle_stage || 'curious';
        counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
}

async function getClients(
    search?: string,
    sort = 'created_at',
    order = 'desc',
    page = 1,
    stage?: string
) {
    const db = createServerClient();
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = db
        .from('clients')
        .select(
            'id, first_name, last_name, email, phone, google_contact_id, possible_duplicate, merged_into_id, lifecycle_stage, intent, last_activity_at, created_at',
            { count: 'exact' }
        )
        .is('merged_into_id', null);

    if (search) {
        query = query.or(
            `first_name.ilike.%${search}%,email.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
    }
    if (stage && stage !== 'all') {
        query = query.eq('lifecycle_stage', stage);
    }

    const allowedSort = new Set([
        'created_at',
        'first_name',
        'last_name',
        'email',
        'phone',
        'google_contact_id',
        'lifecycle_stage',
        'last_activity_at',
    ]);
    const sortField = allowedSort.has(sort) ? sort : 'created_at';

    query = query.order(sortField, { ascending: order === 'asc' });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) console.error('Error fetching clients:', error);

    return {
        clients: data || [],
        totalCount: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
    };
}

type SearchParams = Promise<{
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
    stage?: string;
    sort_order?: string;
}>;

function StageBadge({ stage }: { stage: string }) {
    const style = STAGE_COLORS[stage] || STAGE_COLORS.curious;
    const label = STAGE_LABELS[stage as ClientLifecycleStage] || stage;
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                color: style.color,
                background: style.bg,
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </span>
    );
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
    const rawParams = await searchParams;
    let { q, sort = 'created_at', order = 'desc', sort_order, page = '1', stage = 'all' } =
        rawParams as any;
    const currentPage = parseInt(page) || 1;

    if (sort_order) {
        const [s, o] = sort_order.split('-');
        sort = s;
        order = o;
    }

    const [{ clients, totalCount, totalPages }, stageCounts] = await Promise.all([
        getClients(q, sort, order, currentPage, stage),
        getStageCounts(),
    ]);

    const sortFields = [
        { label: 'Nombre', field: 'first_name' },
        { label: 'Apellido', field: 'last_name' },
        { label: 'Email', field: 'email' },
        { label: 'Teléfono', field: 'phone' },
        { label: 'Etapa', field: 'lifecycle_stage' },
        { label: 'Google Sync', field: 'google_contact_id' },
        { label: 'Creación', field: 'created_at' },
    ];

    const stageTabs: { key: string; label: string }[] = [
        { key: 'all', label: 'Todos' },
        { key: 'curious', label: 'Curiosos' },
        { key: 'engaged', label: 'Engaged' },
        { key: 'quoted', label: 'Cotizaron' },
        { key: 'customer', label: 'Clientes' },
        { key: 'lost', label: 'Perdidos' },
    ];

    const getSortLink = (field: string) => {
        const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (stage && stage !== 'all') params.set('stage', stage);
        params.set('sort', field);
        params.set('order', nextOrder);
        params.set('page', '1');
        return `/admin/clients?${params.toString()}`;
    };

    const getPageLink = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (stage && stage !== 'all') params.set('stage', stage);
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);
        params.set('page', p.toString());
        return `/admin/clients?${params.toString()}`;
    };

    const getStageLink = (s: string) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (s !== 'all') params.set('stage', s);
        params.set('sort', sort);
        params.set('order', order);
        params.set('page', '1');
        return `/admin/clients?${params.toString()}`;
    };

    return (
        <div>
            <style>{`
                .cp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
                .cp-search { width: 100%; }
                @media(min-width: 600px) { .cp-search { width: 220px; } }
                .cp-sort-select { padding: 9px 12px; background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #f1f5f9; font-size: 13px; outline: none; cursor: pointer; }
                .cp-stage-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
                .cp-stage-tab { padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: #1e2433; color: #94a3b8; font-size: 12px; font-weight: 700; text-decoration: none; }
                .cp-stage-tab.active { border-color: rgba(226,160,73,0.45); color: #E2A049; background: rgba(226,160,73,0.1); }
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
                .cp-table-wrap { display: none; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                @media(min-width: 768px) { .cp-cards { display: none; } .cp-table-wrap { display: block; } }
                .cp-table-wrap table { border-collapse: collapse; width: 100%; }
                .cp-row { position: relative; transition: background 0.15s; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.04); }
                .cp-row:hover { background: rgba(255,255,255,0.02) !important; }
                .cp-row-link { color: inherit; text-decoration: none; }
                .cp-row-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
                .pagination-wrap { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 24px; }
                .page-link { padding: 8px 16px; border-radius: 10px; background: #1e2433; border: 1px solid rgba(255,255,255,0.06); color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 700; transition: all 0.2s; }
                .page-link:hover { border-color: #E2A049; color: #E2A049; }
                .page-link.active { background: #E2A049; color: #1a1b26; border-color: #E2A049; }
                .page-link.disabled { opacity: 0.4; pointer-events: none; }
            `}</style>

            <div className="cp-header">
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>
                        Clientes
                    </h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                        {totalCount} en esta vista · CRM por etapa
                    </p>
                </div>
                <form
                    method="GET"
                    action="/admin/clients"
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}
                >
                    {stage && stage !== 'all' && <input type="hidden" name="stage" value={stage} />}
                    <input
                        name="q"
                        defaultValue={q || ''}
                        placeholder="Buscar cliente…"
                        className="cp-search"
                        style={{
                            padding: '9px 14px',
                            background: '#1e2433',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                            outline: 'none',
                            fontFamily: 'inherit',
                        }}
                    />
                    <SortSelect name="sort_order" className="cp-sort-select" defaultValue={`${sort}-${order}`}>
                        <option value="created_at-desc">Recientes primero</option>
                        <option value="last_activity_at-desc">Última actividad</option>
                        <option value="first_name-asc">Nombre (A-Z)</option>
                        <option value="lifecycle_stage-asc">Etapa</option>
                        <option value="email-asc">Email (A-Z)</option>
                    </SortSelect>
                </form>
            </div>

            <div className="cp-stage-tabs">
                {stageTabs.map((tab) => {
                    const count =
                        tab.key === 'all'
                            ? Object.values(stageCounts).reduce((a, b) => a + b, 0)
                            : stageCounts[tab.key] || 0;
                    const active = (stage || 'all') === tab.key;
                    return (
                        <Link
                            key={tab.key}
                            href={getStageLink(tab.key)}
                            className={`cp-stage-tab${active ? ' active' : ''}`}
                        >
                            {tab.label} ({count})
                        </Link>
                    );
                })}
            </div>

            <div className="cp-cards">
                {clients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                        No hay resultados.
                    </div>
                ) : (
                    clients.map((c: any) => (
                        <Link key={c.id} href={`/admin/clients/${c.id}`} className="cp-card">
                            <div className="cp-avatar">{c.first_name?.[0]?.toUpperCase()}</div>
                            <div className="cp-card-body">
                                <div className="cp-card-name">
                                    {c.first_name} {c.last_name || ''}
                                </div>
                                <div className="cp-card-email">{c.email || 'Sin email'}</div>
                                <div className="cp-card-footer">
                                    <StageBadge stage={c.lifecycle_stage || 'curious'} />
                                    <span
                                        className="cp-sync-badge"
                                        style={{ color: c.google_contact_id ? '#34d399' : '#475569' }}
                                    >
                                        {c.google_contact_id ? 'Sync' : 'Sin sync'}
                                    </span>
                                    {c.phone && (
                                        <span className="cp-card-phone">{formatPhoneDisplay(c.phone)}</span>
                                    )}
                                </div>
                            </div>
                            <span className="cp-chevron">›</span>
                        </Link>
                    ))
                )}
            </div>

            <div className="cp-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '14px 20px' }}></th>
                                {sortFields.map((h) => (
                                    <th
                                        key={h.field}
                                        align="left"
                                        style={{
                                            padding: '14px 20px',
                                            color: '#475569',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.8px',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <Link
                                            href={getSortLink(h.field)}
                                            style={{
                                                textDecoration: 'none',
                                                color: sort === h.field ? '#E2A049' : 'inherit',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            {h.label}
                                            {sort === h.field && (order === 'asc' ? ' ↑' : ' ↓')}
                                        </Link>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c: any) => (
                                <tr key={c.id} className="cp-row">
                                    <td style={{ padding: '14px 20px' }}>
                                        <div
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #E2A049, #c8872e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#1a1a2e',
                                                fontWeight: 900,
                                                fontSize: '14px',
                                            }}
                                        >
                                            {c.first_name?.[0]?.toUpperCase()}
                                        </div>
                                    </td>
                                    <td
                                        style={{
                                            padding: '14px 20px',
                                            color: '#f1f5f9',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <Link
                                            href={`/admin/clients/${c.id}`}
                                            className="cp-row-link"
                                            aria-label={`Ver cliente ${c.first_name} ${c.last_name || ''}`.trim()}
                                        >
                                            {c.first_name}
                                        </Link>
                                    </td>
                                    <td
                                        style={{
                                            padding: '14px 20px',
                                            color: '#f1f5f9',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {c.last_name || '—'}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>
                                        {c.email || '—'}
                                        {c.possible_duplicate && (
                                            <span
                                                style={{
                                                    marginLeft: 8,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: '#fbbf24',
                                                }}
                                            >
                                                DUP?
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            padding: '14px 20px',
                                            color: '#64748b',
                                            fontSize: '13px',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {c.phone ? formatPhoneDisplay(c.phone) : '—'}
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <StageBadge stage={c.lifecycle_stage || 'curious'} />
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                color: c.google_contact_id ? '#34d399' : '#94a3b8',
                                            }}
                                        >
                                            {c.google_contact_id ? 'Sincronizado' : '— Sin sync'}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: '14px 20px',
                                            color: '#64748b',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {new Date(c.created_at).toLocaleDateString('es-CL')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="pagination-wrap">
                    <Link
                        href={getPageLink(currentPage - 1)}
                        className={`page-link ${currentPage <= 1 ? 'disabled' : ''}`}
                    >
                        Anterior
                    </Link>
                    <div style={{ color: '#475569', fontSize: '13px', fontWeight: 700, margin: '0 8px' }}>
                        Página {currentPage} de {totalPages}
                    </div>
                    <Link
                        href={getPageLink(currentPage + 1)}
                        className={`page-link ${currentPage >= totalPages ? 'disabled' : ''}`}
                    >
                        Siguiente
                    </Link>
                </div>
            )}
        </div>
    );
}
