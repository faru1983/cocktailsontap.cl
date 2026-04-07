'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { SITE_URL } from '@/lib/config';
import SortSelect from '@/components/admin/SortSelect';
import { bulkUpdateQuoteStatus } from '@/app/actions/admin/adminActions';

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

interface QuotesListClientProps {
    initialQuotes: any[];
    status: string;
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
    q, 
    sort, 
    order,
    currentPage,
    totalPages,
    totalCount
}: QuotesListClientProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

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

    const getSortLink = (field: string) => {
        const nextOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (q) params.set('q', q);
        params.set('sort', field);
        params.set('order', nextOrder);
        params.set('page', '1');
        return `/admin/quotes?${params.toString()}`;
    };

    const getPageLink = (p: number) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (q) params.set('q', q);
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);
        params.set('page', p.toString());
        return `/admin/quotes?${params.toString()}`;
    };

    const filterBase = (v: string) =>
        `/admin/quotes?status=${v}${q ? `&q=${q}` : ''}${sort ? `&sort=${sort}` : ''}${order ? `&order=${order}` : ''}&page=1`;

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

    return (
        <div>
            <style>{`
                .qp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
                .qp-search { width: 100%; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; background: #1e2433; color: #f1f5f9; padding: 9px 14px; outline: none; transition: border-color 0.15s; }
                .qp-search:focus { border-color: #E2A049; }
                @media(min-width: 600px) { .qp-search { width: 220px; } }
                .qp-sort-select { padding: 9px 12px; background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #f1f5f9; fontSize: 13px; outline: none; cursor: pointer; }

                .qp-filters-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
                .qp-filters { display: flex; gap: 7px; flex-wrap: wrap; }

                .qp-bulk-bar {
                    display: flex; gap: 10px; align-items: center; padding: 10px 16px; background: rgba(226,160,73,0.1);
                    border: 1px solid rgba(226,160,73,0.2); border-radius: 12px; margin-bottom: 15px; animation: slideDown 0.2s ease-out;
                }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

                .qp-cards { display: flex; flex-direction: column; gap: 10px; }
                .qp-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px 16px; position: relative; transition: border-color 0.15s; }
                .qp-card:hover { border-color: rgba(226,160,73,0.3); }

                .qp-table-wrap { display: none; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                @media(min-width: 768px) { .qp-cards { display: none; } .qp-table-wrap { display: block; } }
                .qp-row { position: relative; transition: background 0.15s; border-top: 1px solid rgba(255,255,255,0.04); }
                .qp-row:hover { background: rgba(255,255,255,0.02); }
                .qp-row.selected { background: rgba(226,160,73,0.04); }

                .checkbox { width: 18px; height: 18px; accent-color: #E2A049; cursor: pointer; }
                .bulk-btn { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
                .bulk-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* ── Pagination ── */
                .pagination-wrap { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 24px; padding-bottom: 20px; }
                .page-link { 
                    padding: 8px 16px; border-radius: 10px; background: #1e2433; border: 1px solid rgba(255,255,255,0.06); 
                    color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 700; transition: all 0.2s; 
                }
                .page-link:hover { border-color: #E2A049; color: #E2A049; }
                .page-link.active { background: #E2A049; color: #1a1b26; border-color: #E2A049; }
                .page-link.disabled { opacity: 0.4; pointer-events: none; }
            `}</style>

            {/* Header */}
            <div className="qp-header">
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>Cotizaciones</h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{totalCount} coincidencias found</p>
                </div>
                <form method="GET" action="/admin/quotes" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
                    {status && <input type="hidden" name="status" value={status} />}
                    <input name="q" defaultValue={q || ''} placeholder="Buscar por nombre o email…" className="qp-search" />
                    <SortSelect name="sort_order" className="qp-sort-select" defaultValue={`${sort}-${order}`}>
                        <option value="event_date-asc">Evento (más antiguos)</option>
                        <option value="event_date-desc">Evento (más cercanos)</option>
                        <option value="created_at-desc">Recientes primero</option>
                        <option value="total_price-desc">Precio (Mayor)</option>
                        <option value="client_name-asc">Cliente (A-Z)</option>
                    </SortSelect>
                </form>
            </div>

            {/* Filters & Bulk Menu */}
            <div className="qp-filters-row">
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

                {selectedIds.length > 0 && (
                    <div className="qp-bulk-bar">
                        <span style={{ fontSize: '12px', color: '#E2A049', fontWeight: 800 }}>{selectedIds.length} seleccionadas</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleBulkStatus('confirmed')} className="bulk-btn" style={{ background: '#34d399', color: '#064e3b' }}>Confirmar</button>
                            <button onClick={() => handleBulkStatus('completed')} className="bulk-btn" style={{ background: '#a78bfa', color: '#2e1065' }}>Completar</button>
                            <button onClick={() => handleBulkStatus('cancelled')} className="bulk-btn" style={{ background: '#f87171', color: '#450a0a' }}>Cancelar</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="qp-cards">
                {initialQuotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No se encontraron cotizaciones.</div>
                ) : initialQuotes.map((q: any) => {
                    const badge = statusBadge[q.status] || statusBadge.draft;
                    const isSelected = selectedIds.includes(q.id);
                    return (
                        <div key={q.id} className="qp-card" style={{ borderLeft: isSelected ? '4px solid #E2A049' : '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
                                <input type="checkbox" className="checkbox" checked={isSelected} onChange={() => toggleSelect(q.id)} />
                            </div>
                            <Link href={`/admin/quotes/${q.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingRight: '30px' }}>
                                    <span style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>{q.client_name} {q.client_lastname || ''}</span>
                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>{badge.label}</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Total</span>
                                        <span style={{ color: '#E2A049', fontSize: '15px', fontWeight: 900 }}>{formatCLP(Number(q.total_price))}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Fecha</span>
                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{q.event_date ? new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Comuna</span>
                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{q.comuna_name || '—'}</span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* ── DESKTOP: table ── */}
            <div className="qp-table-wrap">
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <th style={{ padding: '13px 20px', width: '40px' }}>
                                <input type="checkbox" className="checkbox" checked={selectedIds.length === initialQuotes.length && initialQuotes.length > 0} onChange={toggleSelectAll} />
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
                            <tr><td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: '#475569' }}>No se encontraron cotizaciones.</td></tr>
                        ) : initialQuotes.map((q: any) => {
                            const badge = statusBadge[q.status] || statusBadge.draft;
                            const isSelected = selectedIds.includes(q.id);
                            return (
                                <tr key={q.id} className={`qp-row ${isSelected ? 'selected' : ''}`}>
                                    <td style={{ padding: '14px 20px' }}>
                                        <input type="checkbox" className="checkbox" checked={isSelected} onChange={() => toggleSelect(q.id)} />
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                                        <Link href={`/admin/quotes/${q.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
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
