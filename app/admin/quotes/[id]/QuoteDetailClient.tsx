'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
    updateQuoteStatus, markDepositPaid, sendDirectEmail, sendReviewEmail, updateQuoteAdmin, resendOrderEmail
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

    const handleResendOrder = () => {
        if (!confirm('¿Deseas reenviar el correo oficial de cotización al cliente?')) return;
        startTransition(async () => {
            const res = await resendOrderEmail(quote.id);
            if (res.success) showToast('Orden reenviada correctamente ✉️');
            else showToast(res.error || 'Error al reenviar', false);
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
                    <Link href={`/admin/clients/${quote.client_id}`} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.15s' }} 
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(226,160,73,0.5)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                        {quote.client_name} {quote.client_lastname || ''}
                    </Link>
                </h1>
                <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, color: badge.color, background: badge.bg }}>
                    {badge.label}
                </span>
                <button onClick={handleResendOrder} disabled={isPending} style={{
                    marginLeft: 'auto', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    opacity: isPending ? 0.5 : 1,
                }}>
                    ✉️ Reenvío Orden
                </button>
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

            {/* Tabs & Quick Actions */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Main Content Tabs */}
                <button onClick={() => setTab('info')} style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: tab === 'info' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'info' ? '#1a1a2e' : '#64748b',
                }}>📋 Detalle</button>
                
                <button onClick={() => setTab('review')} style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: tab === 'review' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'review' ? '#1a1a2e' : '#64748b',
                }}>📊 Cotización</button>

                {/* Icon-only Email Tab */}
                <button onClick={() => setTab('email')} title="Enviar Email" style={{
                    padding: '8px 12px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', border: 'none',
                    background: tab === 'email' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'email' ? '#1a1a2e' : '#64748b',
                }}>✉️</button>

                {/* WhatsApp Link - Direct Action */}
                {(() => {
                    const phone = quote.client_phone?.replace(/\D/g, '');
                    const waUrl = phone ? `https://wa.me/${phone.startsWith('56') ? phone : '56' + phone}` : null;
                    return (
                        <a href={waUrl || '#'} target={waUrl ? "_blank" : "_self"} rel="noopener noreferrer" 
                            style={{
                                padding: '8px 12px', borderRadius: '8px', fontSize: '16px', cursor: waUrl ? 'pointer' : 'not-allowed', textDecoration: 'none',
                                background: waUrl ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.03)', 
                                border: `1px solid ${waUrl ? 'rgba(37,211,102,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                color: waUrl ? '#25D366' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: waUrl ? 1 : 0.4
                            }} title={waUrl ? "Chat por WhatsApp" : "Sin teléfono registrado"}>
                            {/* Simple WhatsApp-colored icon or emoji */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.038 3.284l-.569 2.1c-.123.454.28.855.73.726l2.124-.609c1.048.589 2.123.915 3.313.915 3.14-.04 5.77-2.612 5.77-5.77 0-3.18-2.587-5.761-5.767-5.761zm3.336 8.356c-.113.318-.654.582-.911.62-.257.038-.501.066-1.556-.35a5.53 5.53 0 0 1-2.42-2.128c-.066-.094-.523-.695-.523-1.327 0-.632.33-.941.449-1.065.118-.124.257-.156.344-.156s.174.001.249.005c.08.004.188-.03.294.223.113.272.387.942.422 1.012.035.071.058.151.011.246-.046.094-.07.151-.139.231-.07.081-.144.179-.211.24-.075.071-.154.146-.064.301.091.156.401.66.862 1.07.593.527 1.091.69 1.246.763.156.075.246.061.34-.046.094-.108.401-.468.509-.627.108-.159.217-.133.363-.078.146.056.923.435 1.083.514.16.08.267.118.305.18.038.061.038.353-.075.671z"/></svg>
                        </a>
                    );
                })()}

                {/* Public Link - Direct Action */}
                {quote.token && (
                    <a href={`https://cocktailsontap.cl/cotizar/${quote.token}`} target="_blank" rel="noopener noreferrer" style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', textDecoration: 'none',
                        background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }} title="Ver cotización pública">
                        🔗
                    </a>
                )}
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
