'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SITE_URL } from '@/lib/config';
import SortSelect from '@/components/admin/SortSelect';
import { bulkUpdateQuoteStatus } from '@/app/actions/admin/adminActions';
import { Plus, Star, ChevronDown, Calendar, Package } from 'lucide-react';
import { sourceBadge, normalizeQuoteSource } from '@/lib/quoteSource';
import { isDirectSalePaymentPending, DIRECT_SALE_PAYMENT_PENDING_BADGE } from '@/lib/directSaleFulfillment';

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    in_delivery:  { label: 'En reparto',     color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

/** Venta directa confirmada sin pago registrado → chip rojo en pestaña Confirmadas. */
function getQuoteListBadge(q: {
    status?: string;
    service_type?: string | null;
    payments?: { amount: number }[] | null;
    total_price?: number | null;
}) {
    if (isDirectSalePaymentPending(q as Parameters<typeof isDirectSalePaymentPending>[0])) {
        return DIRECT_SALE_PAYMENT_PENDING_BADGE;
    }
    return statusBadge[q.status || 'draft'] || statusBadge.draft;
}

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

interface QuotesListClientProps {
    initialQuotes: any[];
    status: string;
    type: string;
    source: string;
    q?: string;
    sort: string;
    order: string;
    currentPage: number;
    totalPages: number;
    totalCount: number;
}

export default function QuotesListClient({ 
    initialQuotes, 
    status,
    type = 'all',
    source = 'all',
    q, 
    sort, 
    order,
    currentPage,
    totalPages,
    totalCount
}: QuotesListClientProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const newMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!newMenuOpen) return;
        const onPointerDown = (e: MouseEvent) => {
            if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
                setNewMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [newMenuOpen]);

    const toggleSelectAll = () => {
        if (selectedIds.length === initialQuotes.length) setSelectedIds([]);
        else setSelectedIds(initialQuotes.map(q => q.id));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkStatus = (newStatus: string) => {
        if (!selectedIds.length) return;
        if (!confirm(`¿Cambiar estado a ${statusBadge[newStatus]?.label} para ${selectedIds.length} cotizaciones?`)) return;

        startTransition(async () => {
            const res = await bulkUpdateQuoteStatus(selectedIds, newStatus);
            if (res.success) {
                setSelectedIds([]);
            } else {
                alert(res.error);
            }
        });
    };

    const buildQuotesUrl = (overrides: Record<string, string | undefined> = {}) => {
        const next = {
            status: status || 'all',
            type: type || 'all',
            source: source || 'all',
            q: q || '',
            sort,
            order,
            page: '1',
            ...overrides,
        };
        const params = new URLSearchParams();
        if (next.status) params.set('status', next.status);
        if (next.type && next.type !== 'all') params.set('type', next.type);
        if (next.source && next.source !== 'all') params.set('source', next.source);
        if (next.q) params.set('q', next.q);
        if (next.sort) params.set('sort', next.sort);
        if (next.order) params.set('order', next.order);
        if (next.page) params.set('page', next.page);
        return `/admin/quotes?${params.toString()}`;
    };

    const getSortLink = (field: string) => {
        const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
        return buildQuotesUrl({ sort: field, order: nextOrder, page: '1' });
    };

    const getPageLink = (p: number) => buildQuotesUrl({ page: p.toString() });

    const filterBase = (v: string) => buildQuotesUrl({ status: v, page: '1' });
    /** Toggle: si ya está activo, lo desactiva (all); si no, lo activa */
    const toggleType = (v: 'event' | 'direct') =>
        buildQuotesUrl({ type: (type || 'all') === v ? 'all' : v, page: '1' });

    const toggleSource = (v: 'web' | 'admin' | 'whatsapp') =>
        buildQuotesUrl({ source: (source || 'all') === v ? 'all' : v, page: '1' });

    const filters = [
        { value: 'all', label: 'Todas' },
        { value: 'draft', label: 'Borradores' },
        { value: 'confirmed', label: 'Confirmadas' },
        { value: 'in_delivery', label: 'En reparto' },
        { value: 'completed', label: 'Completadas' },
        { value: 'cancelled', label: 'Canceladas' },
    ];

    const typeToggles: { value: 'event' | 'direct'; label: string }[] = [
        { value: 'event', label: 'Eventos' },
        { value: 'direct', label: 'Desechables' },
    ];

    const sourceToggles: { value: 'web' | 'admin' | 'whatsapp'; label: string }[] = [
        { value: 'web', label: 'Web' },
        { value: 'admin', label: 'Admin' },
        { value: 'whatsapp', label: 'WhatsApp' },
    ];

    const sortFields = [
        { label: 'Cliente',       field: 'client_name' },
        { label: 'Email',         field: 'client_email' },
        { label: 'Fecha Evento',  field: 'event_date' },
        { label: 'Comuna',        field: 'comuna_name' },
        { label: 'Total',         field: 'total_price' },
        { label: 'Estado',        field: 'status' },
    ];

    return (
        <div>


            {/* Header */}
            <div className="flex justify-between items-start flex-wrap gap-3 mb-7">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>Cotizaciones</h1>
                        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{totalCount} coincidencias found</p>
                    </div>
                    <div ref={newMenuRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setNewMenuOpen(v => !v)}
                            style={{
                                padding: '10px 18px', borderRadius: '12px', background: '#E2A049', color: '#1a1a2e',
                                fontSize: '13px', fontWeight: 800, border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 15px rgba(226,160,73,0.3)', transition: 'all 0.15s'
                            }}
                        >
                            <Plus size={18} /> Nueva <ChevronDown size={16} style={{ opacity: 0.8, transform: newMenuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                        </button>
                        {newMenuOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 40,
                                minWidth: '240px', background: '#1e2433', border: '1px solid rgba(226,160,73,0.25)',
                                borderRadius: '14px', boxShadow: '0 16px 40px rgba(0,0,0,0.45)', padding: '6px',
                            }}>
                                <Link
                                    href="/admin/quotes/new?type=event"
                                    onClick={() => setNewMenuOpen(false)}
                                    className="flex items-center gap-3 p-3 sm:px-3.5 sm:py-3 rounded-[10px] no-underline text-slate-100 transition-colors hover:bg-[#E2A049]/12"
                                >
                                    <Calendar size={18} style={{ color: '#E2A049', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 800 }}>Reserva de Evento</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>Cotización / borrador</div>
                                    </div>
                                </Link>
                                <Link
                                    href="/admin/quotes/new?type=direct"
                                    onClick={() => setNewMenuOpen(false)}
                                    className="flex items-center gap-3 p-3 sm:px-3.5 sm:py-3 rounded-[10px] no-underline text-slate-100 transition-colors hover:bg-[#E2A049]/12"
                                >
                                    <Package size={18} style={{ color: '#E2A049', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 800 }}>Venta Desechables</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>Pedido directo</div>
                                    </div>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
                <form method="GET" action="/admin/quotes" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
                    {status && <input type="hidden" name="status" value={status} />}
                    {type && type !== 'all' && <input type="hidden" name="type" value={type} />}
                    {source && source !== 'all' && <input type="hidden" name="source" value={source} />}
                    <input name="q" defaultValue={q || ''} placeholder="Buscar por nombre o email…" className="w-full sm:w-[220px] border border-white/10 rounded-[10px] bg-[#1e2433] text-slate-100 px-3.5 py-2 text-sm outline-none transition-colors focus:border-[#E2A049]" />
                    <SortSelect name="sort_order" className="px-3 py-2 bg-[#1e2433] border border-white/10 rounded-[10px] text-slate-100 text-[13px] outline-none cursor-pointer" defaultValue={`${sort}-${order}`}>
                        <option value="event_date-asc">Evento (más antiguos)</option>
                        <option value="event_date-desc">Evento (más cercanos)</option>
                        <option value="created_at-desc">Recientes primero</option>
                        <option value="total_price-desc">Precio (Mayor)</option>
                        <option value="client_name-asc">Cliente (A-Z)</option>
                    </SortSelect>
                </form>
            </div>

            {/* Filters & Bulk Menu */}
            <div className="flex justify-between items-center mb-4.5 flex-wrap gap-3">
                <div className="flex gap-1.5 flex-wrap">
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
                    <span style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} aria-hidden />
                    {typeToggles.map(f => {
                        const active = (type || 'all') === f.value;
                        return (
                            <Link key={f.value} href={toggleType(f.value)} title={active ? 'Quitar filtro' : `Filtrar por ${f.label}`} style={{
                                padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                textDecoration: 'none',
                                color: active ? '#1a1a2e' : '#64748b',
                                background: active ? '#67e8f9' : 'rgba(255,255,255,0.05)',
                                border: '1px solid ' + (active ? '#67e8f9' : 'rgba(255,255,255,0.08)'),
                            }}>{f.label}</Link>
                        );
                    })}
                    <span style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} aria-hidden />
                    {sourceToggles.map(f => {
                        const active = (source || 'all') === f.value;
                        const sb = sourceBadge[f.value];
                        return (
                            <Link key={f.value} href={toggleSource(f.value)} title={active ? 'Quitar filtro' : `Origen ${f.label}`} style={{
                                padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                textDecoration: 'none',
                                color: active ? '#1a1a2e' : sb.color,
                                background: active ? sb.color : sb.bg,
                                border: '1px solid ' + (active ? sb.color : `${sb.color}40`),
                            }}>{f.label}</Link>
                        );
                    })}
                </div>

                {selectedIds.length > 0 && (
                    <div className="flex gap-2.5 items-center px-4 py-2.5 bg-[#E2A049]/10 border border-[#E2A049]/20 rounded-xl mb-3.5">
                        <span style={{ fontSize: '12px', color: '#E2A049', fontWeight: 800 }}>{selectedIds.length} seleccionadas</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleBulkStatus('completed')} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: '#a78bfa', color: '#2e1065' }}>Completar</button>
                            <button onClick={() => handleBulkStatus('cancelled')} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: '#f87171', color: '#450a0a' }}>Cancelar</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {initialQuotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No se encontraron cotizaciones.</div>
                ) : initialQuotes.map((q: any) => {
                    const badge = getQuoteListBadge(q);
                    const srcBadge = sourceBadge[normalizeQuoteSource(q.source)];
                    const isSelected = selectedIds.includes(q.id);
                    return (
                        <div key={q.id} className="bg-[#1e2433] border border-white/10 rounded-[14px] p-3.5 sm:p-4 relative transition-colors hover:border-[#E2A049]/30" style={{ borderLeft: isSelected ? '4px solid #E2A049' : '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
                                <input type="checkbox" className="w-[18px] h-[18px] accent-[#E2A049] cursor-pointer" checked={isSelected} onChange={() => toggleSelect(q.id)} />
                            </div>
                            <Link href={`/admin/quotes/${q.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingRight: '30px' }}>
                                    <span style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>
                                        {q.service_type === 'direct' && <span style={{ marginRight: '6px' }} title="Venta Directa">📦</span>}
                                        {q.client_name} {q.client_lastname || ''}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {q.review_email_sent && (
                                            <span title="Email de reseña enviado" style={{ display: 'inline-flex', color: '#a78bfa' }}>
                                                <Star size={14} fill="#a78bfa" />
                                            </span>
                                        )}
                                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: srcBadge.color, background: srcBadge.bg }}>{srcBadge.label}</span>
                                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.label}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Total</span>
                                        <span style={{ color: '#E2A049', fontSize: '15px', fontWeight: 900 }}>{formatCLP(Number(q.total_price))}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{q.service_type === 'direct' ? 'Entrega' : 'Fecha'}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Comuna</span>
                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{q.comuna_name === 'Otra' && q.comuna_other ? q.comuna_other : (q.comuna_name || '—')}</span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* ── DESKTOP: table ── */}
            <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/10 overflow-hidden">
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ padding: '13px 20px', width: '40px' }}>
                                <input type="checkbox" className="w-[18px] h-[18px] accent-[#E2A049] cursor-pointer" checked={selectedIds.length === initialQuotes.length && initialQuotes.length > 0} onChange={toggleSelectAll} />
                            </th>
                            {sortFields.map(h => (
                                <th key={h.field} align="left" style={{ padding: '13px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                                    <Link href={getSortLink(h.field)} style={{ textDecoration: 'none', color: sort === h.field ? '#E2A049' : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {h.label}{sort === h.field && (order === 'asc' ? ' 🔼' : ' 🔽')}
                                    </Link>
                                </th>
                            ))}
                            <th align="left" style={{ padding: '13px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Púb.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialQuotes.length === 0 ? (
                            <tr><td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: '#475569' }}>No se encontraron cotizaciones.</td></tr>
                        ) : initialQuotes.map((q: any) => {
                            const badge = getQuoteListBadge(q);
                            const srcBadge = sourceBadge[normalizeQuoteSource(q.source)];
                            const isSelected = selectedIds.includes(q.id);
                            return (
                                <tr key={q.id} className={`relative transition-colors border-t border-white/5 hover:bg-white/[0.02] ${isSelected ? 'bg-[#E2A049]/[0.04]' : ''}`}>
                                    <td style={{ padding: '14px 20px' }}>
                                        <input type="checkbox" className="w-[18px] h-[18px] accent-[#E2A049] cursor-pointer" checked={isSelected} onChange={() => toggleSelect(q.id)} />
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                                        <Link href={`/admin/quotes/${q.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                            {q.service_type === 'direct' && <span style={{ marginRight: '6px' }} title="Venta Directa">📦</span>}
                                            {q.client_name} {q.client_lastname || ''}
                                        </Link>
                                        <span style={{ display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, color: srcBadge.color, background: srcBadge.bg }}>{srcBadge.label}</span>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.client_email || '—'}</td>
                                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                        {q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{q.comuna_name === 'Otra' && q.comuna_other ? q.comuna_other : (q.comuna_name || '—')}</td>
                                    <td style={{ padding: '14px 20px', color: '#E2A049', fontSize: '14px', fontWeight: 700 }}>{formatCLP(Number(q.total_price))}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.label}</span>
                                            {q.review_email_sent && (
                                                <span title="Email de reseña enviado" style={{ display: 'inline-flex', color: '#a78bfa' }}>
                                                    <Star size={14} fill="#a78bfa" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        {q.token && (
                                            <a href={`${SITE_URL}/cotizar/${q.token}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', opacity: 0.6 }}>🔗</a>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6 pb-5">
                    <Link href={getPageLink(currentPage - 1)} className={`px-4 py-2 rounded-[10px] bg-[#1e2433] border border-white/10 text-slate-400 no-underline text-[13px] font-bold transition-all hover:border-[#E2A049] hover:text-[#E2A049] ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : ''}`}>
                        Anterior
                    </Link>
                    
                    <div style={{ color: '#475569', fontSize: '13px', fontWeight: 700, margin: '0 8px' }}>
                        Página {currentPage} de {totalPages}
                    </div>

                    <Link href={getPageLink(currentPage + 1)} className={`px-4 py-2 rounded-[10px] bg-[#1e2433] border border-white/10 text-slate-400 no-underline text-[13px] font-bold transition-all hover:border-[#E2A049] hover:text-[#E2A049] ${currentPage >= totalPages ? 'opacity-40 pointer-events-none' : ''}`}>
                        Siguiente
                    </Link>
                </div>
            )}
        </div>
    );
}
