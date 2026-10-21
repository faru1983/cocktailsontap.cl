import { createServerClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminAuth';
import Link from 'next/link';
import SortSelect from '@/components/admin/SortSelect';
import { formatPhoneDisplay } from '@/lib/phone';
import { formatDateCL, getAvatarInitial, sanitizePostgrestSearch } from '@/lib/utils';
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
    const stages = ['curious', 'engaged', 'quoted', 'customer', 'lost'] as const;
    const results = await Promise.all(
        stages.map((stage) =>
            db
                .from('clients')
                .select('*', { count: 'exact', head: true })
                .is('merged_into_id', null)
                .eq('lifecycle_stage', stage)
        )
    );
    const counts: Record<string, number> = {};
    stages.forEach((stage, idx) => {
        counts[stage] = results[idx].count || 0;
    });
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

    const cleanSearch = sanitizePostgrestSearch(search);
    if (cleanSearch) {
        query = query.or(
            `first_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%`
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
    await requireAdmin();
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
        { key: 'engaged', label: 'Interesados' },
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


            <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
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
                        className="w-full sm:w-[220px]"
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
                    <SortSelect name="sort_order" className="px-3 py-2 bg-[#1e2433] border border-white/10 rounded-[10px] text-slate-100 text-[13px] outline-none cursor-pointer" defaultValue={`${sort}-${order}`}>
                        <option value="created_at-desc">Recientes primero</option>
                        <option value="last_activity_at-desc">Última actividad</option>
                        <option value="first_name-asc">Nombre (A-Z)</option>
                        <option value="lifecycle_stage-asc">Etapa</option>
                        <option value="email-asc">Email (A-Z)</option>
                    </SortSelect>
                </form>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
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
                            className={`px-3 py-1.5 rounded-full border text-xs font-bold no-underline transition-colors ${active ? 'border-amber-500/45 text-[#E2A049] bg-[#E2A049]/10' : 'border-white/[0.08] bg-[#1e2433] text-slate-400 hover:text-slate-200'}`}
                        >
                            {tab.label} ({count})
                        </Link>
                    );
                })}
            </div>

            <div className="flex flex-col gap-2.5 md:hidden">
                {clients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                        No hay resultados.
                    </div>
                ) : (
                    clients.map((c: any) => (
                        <Link key={c.id} href={`/admin/clients/${c.id}`} className="bg-[#1e2433] border border-white/[0.06] rounded-[14px] p-3.5 sm:p-4 no-underline flex items-center gap-3.5 transition-colors hover:border-[#E2A049]/35">
                            <div className="w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-[#E2A049] to-[#c8872e] flex items-center justify-center text-[#1a1a2e] font-black text-base">{getAvatarInitial(c.first_name)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-slate-100 text-[15px] font-bold mb-0.5">
                                    {c.first_name} {c.last_name || ''}
                                </div>
                                <div className="text-slate-500 text-[13px] truncate mb-1">{c.email || 'Sin email'}</div>
                                <div className="flex gap-3 items-center flex-wrap">
                                    <StageBadge stage={c.lifecycle_stage || 'curious'} />
                                    <span
                                        className="text-[11px] font-semibold"
                                        style={{ color: c.google_contact_id ? '#34d399' : '#475569' }}
                                    >
                                        {c.google_contact_id ? 'Sync' : 'Sin sync'}
                                    </span>
                                    {c.phone && (
                                        <span className="text-slate-600 text-xs">{formatPhoneDisplay(c.phone)}</span>
                                    )}
                                </div>
                            </div>
                            <span className="text-[#E2A049] text-lg shrink-0">›</span>
                        </Link>
                    ))
                )}
            </div>

            <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/[0.06] overflow-hidden">
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
                                <tr key={c.id} className="relative transition-colors cursor-pointer border-t border-white/[0.04] hover:bg-white/[0.02]">
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
                                            {getAvatarInitial(c.first_name)}
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
                                            className="text-inherit no-underline after:content-[''] after:absolute after:inset-0 after:z-1"
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
                                        {formatDateCL(c.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                    <Link
                        href={getPageLink(currentPage - 1)}
                        className={`px-4 py-2 rounded-[10px] bg-[#1e2433] border border-white/[0.06] text-slate-400 no-underline text-[13px] font-bold transition-all hover:border-[#E2A049] hover:text-[#E2A049] ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                        Anterior
                    </Link>
                    <div style={{ color: '#475569', fontSize: '13px', fontWeight: 700, margin: '0 8px' }}>
                        Página {currentPage} de {totalPages}
                    </div>
                    <Link
                        href={getPageLink(currentPage + 1)}
                        className={`px-4 py-2 rounded-[10px] bg-[#1e2433] border border-white/[0.06] text-slate-400 no-underline text-[13px] font-bold transition-all hover:border-[#E2A049] hover:text-[#E2A049] ${currentPage >= totalPages ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                        Siguiente
                    </Link>
                </div>
            )}
        </div>
    );
}
