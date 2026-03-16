'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
    updateQuoteStatus, markDepositPaid, sendDirectEmail, sendReviewEmail, updateQuoteAdmin
} from '@/app/actions/admin/adminActions';

const statusFlow = ['draft', 'confirmed', 'deposit_paid', 'completed', 'cancelled'];
const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    deposit_paid: { label: 'Abono Recibido', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};
const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default function QuoteDetailClient({ quote: initial }: { quote: any }) {
    const [quote, setQuote] = useState(initial);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [tab, setTab] = useState<'info' | 'email' | 'review'>('info');
    const [emailForm, setEmailForm] = useState({ subject: '', body: '' });

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const handleStatusChange = (newStatus: string) => {
        if (!confirm(`¿Cambiar estado a "${statusBadge[newStatus]?.label}"?`)) return;
        startTransition(async () => {
            const res = await updateQuoteStatus(quote.id, newStatus);
            if (res.success) { setQuote((q: any) => ({ ...q, status: newStatus })); showToast('Estado actualizado'); }
            else showToast(res.error || 'Error', false);
        });
    };

    const handleSendEmail = (formData: FormData) => {
        startTransition(async () => {
            const res = await sendDirectEmail(quote.id, formData);
            if (res.success) { showToast('Email enviado correctamente ✉️'); setEmailForm({ subject: '', body: '' }); }
            else showToast(res.error || 'Error al enviar', false);
        });
    };

    const handleReview = () => {
        startTransition(async () => {
            const res = await sendReviewEmail(quote.id);
            if (res.success) { setQuote((q: any) => ({ ...q, review_email_sent: true })); showToast('Email de review enviado ⭐'); }
            else showToast(res.error || 'Error', false);
        });
    };

    const badge = statusBadge[quote.status] || statusBadge.draft;

    return (
        <div style={{ position: 'relative' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
                    padding: '14px 20px', borderRadius: '12px',
                    background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                    border: `1px solid ${toast.ok ? '#34d399' : '#f87171'}`,
                    color: toast.ok ? '#34d399' : '#f87171',
                    fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                    {toast.ok ? '✅' : '⚠️'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
                <Link href="/admin/quotes" style={{ color: '#E2A049', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>← Cotizaciones</Link>
                <h1 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 900, margin: 0 }}>
                    {quote.client_name} {quote.client_lastname || ''}
                </h1>
                <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, color: badge.color, background: badge.bg }}>
                    {badge.label}
                </span>
            </div>

            {/* Status Actions */}
            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', marginBottom: '24px' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 700, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Cambiar Estado</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {statusFlow.filter(s => s !== quote.status).map(s => (
                        <button key={s} onClick={() => handleStatusChange(s)} disabled={isPending} style={{
                            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            background: statusBadge[s]?.bg, border: `1px solid ${statusBadge[s]?.color}40`,
                            color: statusBadge[s]?.color, transition: 'all 0.15s', opacity: isPending ? 0.5 : 1,
                        }}>
                            → {statusBadge[s]?.label}
                        </button>
                    ))}
                </div>

                {/* Review button */}
                {quote.status === 'completed' && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button onClick={handleReview} disabled={isPending || quote.review_email_sent} style={{
                            padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: quote.review_email_sent ? 'not-allowed' : 'pointer',
                            background: quote.review_email_sent ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)',
                            border: `1px solid ${quote.review_email_sent ? 'rgba(255,255,255,0.1)' : '#a78bfa40'}`,
                            color: quote.review_email_sent ? '#475569' : '#a78bfa', fontFamily: 'inherit',
                        }}>
                            {quote.review_email_sent ? '✅ Review ya enviado' : '⭐ Enviar email de Review'}
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                {(['info', 'email', 'review'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                        background: tab === t ? '#E2A049' : 'rgba(255,255,255,0.05)',
                        color: tab === t ? '#1a1a2e' : '#64748b',
                    }}>
                        {t === 'info' ? '📋 Detalle' : t === 'email' ? '✉️ Email Directo' : '📊 Cotización'}
                    </button>
                ))}
            </div>

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                {tab === 'info' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {[
                            { label: 'Nombre', key: 'client_name', value: quote.client_name },
                            { label: 'Apellido', key: 'client_lastname', value: quote.client_lastname },
                            { label: 'Email', key: 'client_email', value: quote.client_email },
                            { label: 'Teléfono', key: 'client_phone', value: quote.client_phone },
                            { label: 'Dirección', key: 'client_address', value: quote.client_address },
                            { label: 'Comuna', key: 'comuna_name', value: quote.comuna_name },
                            { label: 'Fecha Evento', key: 'event_date', value: quote.event_date },
                            { label: 'Hora Inicio', key: 'start_time', value: quote.start_time },
                            { label: 'Fecha Retiro', key: 'pickup_date', value: quote.pickup_date },
                            { label: 'Horario Retiro', key: 'pickup_time', value: quote.pickup_time },
                            { label: 'Invitados', key: 'guests', value: quote.guests },
                        ].map(field => (
                            <div key={field.key}>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                                    {field.label}
                                </label>
                                <input
                                    defaultValue={field.value || ''}
                                    onBlur={async (e) => {
                                        if (e.target.value !== (field.value || '')) {
                                            const res = await updateQuoteAdmin(quote.id, { [field.key]: e.target.value });
                                            if (res.success) showToast('Guardado'); else showToast(res.error || 'Error', false);
                                        }
                                    }}
                                    style={{
                                        width: '100%', padding: '10px 12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', color: '#f1f5f9',
                                        fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'email' && (
                    <div>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>
                            Enviar email directo a <strong style={{ color: '#f1f5f9' }}>{quote.client_email || 'Sin email'}</strong>
                        </p>
                        <form action={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Asunto</label>
                                <input name="subject" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                                    required style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Mensaje</label>
                                <textarea name="body" value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                                    required rows={6} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            <button type="submit" disabled={isPending} style={{ alignSelf: 'flex-start', padding: '10px 20px', background: 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                {isPending ? 'Enviando…' : '✉️ Enviar Email'}
                            </button>
                        </form>
                    </div>
                )}

                {tab === 'review' && (
                    <div>
                        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Resumen de la cotización</p>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {(quote.quote_items || []).map((item: any) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                    <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{item.product_name} <span style={{ color: '#64748b' }}>({item.size})</span> x{item.quantity}</span>
                                    <span style={{ color: '#E2A049', fontWeight: 700, fontSize: '13px' }}>{formatCLP(item.offer_price_at_time * item.quantity)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 700 }}>TOTAL</span>
                                <span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 900 }}>{formatCLP(Number(quote.total_price))}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
