'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { 
    updateQuoteStatus, sendDirectEmail, sendReviewEmail, updateQuoteAdmin, resendOrderEmail,
    addQuotePayment, deleteQuotePayment
} from '@/app/actions/admin/adminActions';
import { SITE_URL } from '@/lib/config';

const statusFlow = ['draft', 'confirmed', 'completed', 'cancelled'];
const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:     { label: 'Borrador',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    confirmed: { label: 'Confirmada', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    completed: { label: 'Completada', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    cancelled: { label: 'Cancelada',  color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};
const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default function QuoteDetailClient({ quote: initial }: { quote: any }) {
    const [quote, setQuote] = useState(initial);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [tab, setTab] = useState<'info' | 'email' | 'review' | 'payments'>('info');
    const [emailForm, setEmailForm] = useState({ subject: '', body: '' });

    // Payment Modal State
    const [showPayModal, setShowPayModal] = useState(false);

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

    const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const p = {
            date: fd.get('date') as string,
            amount: Number(fd.get('amount')),
            note: fd.get('note') as string,
        };
        if (!p.amount || !p.date) return;

        startTransition(async () => {
            const res = await addQuotePayment(quote.id, p);
            if (res.success) {
                const updatedPayments = [...(quote.payments || []), p];
                setQuote((q: any) => ({ ...q, payments: updatedPayments }));
                setShowPayModal(false);
                showToast('Pago registrado y sincronizado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleDeletePayment = (index: number) => {
        if (!confirm('¿Eliminar este registro de pago?')) return;
        startTransition(async () => {
            const res = await deleteQuotePayment(quote.id, index);
            if (res.success) {
                const updatedPayments = [...(quote.payments || [])];
                updatedPayments.splice(index, 1);
                setQuote((q: any) => ({ ...q, payments: updatedPayments }));
                showToast('Pago eliminado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const totalPaid = (quote.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const balance = Number(quote.total_price) - totalPaid;

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

            <style>{`
                .q-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
                .q-tab {
                    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s;
                    background: rgba(255,255,255,0.05); color: #64748b; font-family: inherit;
                }
                .q-tab:hover { background: rgba(255,255,255,0.08); }
                .q-tab-active { background: #E2A049 !important; color: #1a1a2e !important; box-shadow: 0 4px 15px rgba(226,160,73,0.3); }
                
                .q-tab-text { display: inline; }
                @media(max-width: 767px) {
                    .q-tab-text { display: none; }
                    .q-tab { padding: 12px; flex: initial; width: 48px; }
                }

                .q-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 20px; }
                .q-modal { background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; max-width: 450px; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                .q-form-group { margin-bottom: 16px; }
                .q-label { display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
                .q-input { width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; outline: none; box-sizing: border-box; font-family: inherit; }
            `}</style>

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

            {/* New Tabs Design */}
            <div className="q-tabs">
                {[
                    { id: 'info', name: 'Detalle', icon: '📋' },
                    { id: 'review', name: 'Items', icon: '📊' },
                    { id: 'payments', name: 'Pagos', icon: '💰' },
                    { id: 'email', name: 'Email', icon: '✉️' },
                ].map(t => (
                    <button key={t.id} className={`q-tab ${tab === t.id ? 'q-tab-active' : ''}`} onClick={() => setTab(t.id as any)}>
                        <span style={{ fontSize: '16px' }}>{t.icon}</span>
                        <span className="q-tab-text">{t.name}</span>
                    </button>
                ))}
                
                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                    {(() => {
                        const phone = quote.client_phone?.replace(/\D/g, '');
                        const waUrl = phone ? `https://wa.me/${phone.startsWith('56') ? phone : '56' + phone}` : null;
                        return (
                            <a href={waUrl || '#'} target={waUrl ? "_blank" : "_self"} rel="noopener noreferrer" 
                                style={{
                                    padding: '8px 12px', borderRadius: '12px', background: waUrl ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.03)', 
                                    color: waUrl ? '#25D366' : '#475569', display: 'flex', alignItems: 'center', opacity: waUrl ? 1 : 0.4, border: '1px solid rgba(37,211,102,0.1)'
                                }} title="WhatsApp">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.038 3.284l-.569 2.1c-.123.454.28.855.73.726l2.124-.609c1.048.589 2.123.915 3.313.915 3.14-.04 5.77-2.612 5.77-5.77 0-3.18-2.587-5.761-5.767-5.761zm3.336 8.356c-.113.318-.654.582-.911.62-.257.038-.501.066-1.556-.35a5.53 5.53 0 0 1-2.42-2.128c-.066-.094-.523-.695-.523-1.327 0-.632.33-.941.449-1.065.118-.124.257-.156.344-.156s.174.001.249.005c.08.004.188-.03.294.223.113.272.387.942.422 1.012.035.071.058.151.011.246-.046.094-.07.151-.139.231-.07.081-.144.179-.211.24-.075.071-.154.146-.064.301.091.156.401.66.862 1.07.593.527 1.091.69 1.246.763.156.075.246.061.34-.046.094-.108.401-.468.509-.627.108-.159.217-.133.363-.078.146.056.923.435 1.083.514.16.08.267.118.305.18.038.061.038.353-.075.671z"/></svg>
                            </a>
                        );
                    })()}
                    {quote.token && (
                        <a href={`${SITE_URL}/cotizar/${quote.token}`} target="_blank" rel="noopener noreferrer" 
                            style={{ padding: '8px 12px', borderRadius: '12px', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', border: '1px solid rgba(96,165,250,0.1)' }} title="Público">
                            🔗
                        </a>
                    )}
                </div>
            </div>

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                {tab === 'info' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
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
                                <label className="q-label">{field.label}</label>
                                <input defaultValue={field.value || ''} onBlur={async (e) => {
                                    if (e.target.value !== (field.value || '')) {
                                        const res = await updateQuoteAdmin(quote.id, { [field.key]: e.target.value });
                                        if (res.success) showToast('Guardado'); else showToast(res.error || 'Error', false);
                                    }
                                }} className="q-input" />
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'review' && (
                    <div>
                        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Resumen de productos</p>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {(quote.quote_items || []).map((item: any) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>{item.product_name}</span>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>{item.size} x {item.quantity}</span>
                                    </div>
                                    <span style={{ color: '#E2A049', fontWeight: 800, fontSize: '15px' }}>{formatCLP(item.offer_price_at_time * item.quantity)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 4px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 800 }}>TOTAL</span>
                                <span style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 900 }}>{formatCLP(Number(quote.total_price))}</span>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'payments' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="q-label">Total Cotizado</div>
                                <div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 900 }}>{formatCLP(quote.total_price)}</div>
                            </div>
                            <div style={{ background: 'rgba(52,211,153,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(52,211,153,0.1)' }}>
                                <div className="q-label" style={{ color: '#34d399' }}>Total Pagado</div>
                                <div style={{ color: '#34d399', fontSize: '18px', fontWeight: 900 }}>{formatCLP(totalPaid)}</div>
                            </div>
                            <div style={{ background: balance > 0 ? 'rgba(251,191,36,0.05)' : 'rgba(96,165,250,0.05)', padding: '16px', borderRadius: '16px', border: `1px solid ${balance > 0 ? '#fbbf2440' : '#60a5fa40'}` }}>
                                <div className="q-label" style={{ color: balance > 0 ? '#fbbf24' : '#60a5fa' }}>{balance > 0 ? 'Saldo Pendiente' : 'Pagado 👌'}</div>
                                <div style={{ color: balance > 0 ? '#fbbf24' : '#60a5fa', fontSize: '18px', fontWeight: 900 }}>{formatCLP(Math.max(0, balance))}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ color: '#f1f5f9', fontSize: '14px', margin: 0 }}>Historial de Pagos</h3>
                            <button onClick={() => setShowPayModal(true)} style={{ padding: '8px 16px', background: '#34d399', color: '#1a1a2e', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>+ Registrar Pago</button>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                            {(!quote.payments || quote.payments.length === 0) ? (
                                <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No hay pagos registrados.</p>
                            ) : quote.payments.map((p: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', fontWeight: 900 }}>$</div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>{formatCLP(p.amount)}</span>
                                            <span style={{ color: '#64748b', fontSize: '11px' }}>{new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL')} — {p.note}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeletePayment(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '16px' }}>🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'email' && (
                    <div>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Enviar email directo a <strong style={{ color: '#f1f5f9' }}>{quote.client_email || 'Sin email'}</strong></p>
                        <form action={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="q-form-group">
                                <label className="q-label">Asunto</label>
                                <input name="subject" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} required className="q-input" />
                            </div>
                            <div className="q-form-group">
                                <label className="q-label">Mensaje</label>
                                <textarea name="body" value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))} required rows={6} className="q-input" style={{ resize: 'vertical' }} />
                            </div>
                            <button type="submit" disabled={isPending} style={{ alignSelf: 'flex-start', padding: '10px 24px', background: 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                                {isPending ? 'Enviando…' : '✉️ Enviar Email'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Modal de Pago */}
            {showPayModal && (
                <div className="q-modal-overlay">
                    <form className="q-modal" onSubmit={handleAddPayment}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 20px' }}>Registrar Pago</h2>
                        <div className="q-form-group">
                            <label className="q-label">Monto (CLP)</label>
                            <input name="amount" type="number" required className="q-input" placeholder="Ej: 50000" autoFocus />
                        </div>
                        <div className="q-form-group">
                            <label className="q-label">Fecha</label>
                            <input name="date" type="date" required className="q-input" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="q-form-group">
                            <label className="q-label">Glosa / Tipo</label>
                            <input name="note" className="q-input" placeholder="Abono inicial, Saldo, etc." />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button type="button" className="q-tab" style={{ flex: 1 }} onClick={() => setShowPayModal(false)}>Cancelar</button>
                            <button type="submit" disabled={isPending} className="q-tab q-tab-active" style={{ flex: 1 }}>{isPending ? 'Guardando...' : 'Guardar Pago'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
