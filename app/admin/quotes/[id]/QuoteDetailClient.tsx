'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    updateQuoteStatus, sendDirectEmail, sendReviewEmail, updateQuoteAdmin, resendOrderEmail,
    addQuotePayment, deleteQuotePayment, updateQuoteItemsAdmin,
    sendQuoteEmailAdmin, syncQuoteToCalendarAdmin, deleteQuotePermanent
} from '@/app/actions/admin/adminActions';
import { SITE_URL } from '@/lib/config';
import type { QuoteItem, Product } from '@/lib/types';
import { formatPhoneNumber } from '@/lib/utils';
import { 
    FileText, ShoppingBag, CreditCard, Mail, Edit2, Save, Send,
    Link as LinkIcon, Trash2, ArrowRight, MessageCircle, Star, ArrowLeft, X,
    Calendar
} from 'lucide-react';
import type { Comuna } from '@/lib/types';

const statusFlow = ['draft', 'confirmed', 'completed', 'cancelled'];
const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:     { label: 'Borrador',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    confirmed: { label: 'Confirmada', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    completed: { label: 'Completada', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    cancelled: { label: 'Cancelada',  color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};
const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const formatDateWithDashes = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

export default function QuoteDetailClient({ quote: initial, allProducts, eventTypes, comunas }: { quote: any, allProducts: Product[], eventTypes: any[], comunas: Comuna[] }) {
    const router = useRouter();
    const [quote, setQuote] = useState(initial);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [tab, setTab] = useState<'info' | 'email' | 'review' | 'payments'>('info');
    const [emailForm, setEmailForm] = useState({ subject: '', body: '' });

    // Item Editing State
    const [isEditingItems, setIsEditingItems] = useState(false);
    const [editItems, setEditItems] = useState<QuoteItem[]>([]);
    const [editCosts, setEditCosts] = useState({ 
        manual_discount: initial.manual_discount || 0,
        shipping_cost: initial.shipping_cost || 0,
        installation_cost: initial.installation_cost || 0,
        dispenser: initial.dispenser || 'portatil'
    });
    const [searchTerm, setSearchTerm] = useState('');

    // Info Editing State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editInfo, setEditInfo] = useState<any>({});

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

    const handleDeleteQuote = () => {
        if (!confirm('🚨 ¿ESTÁS SEGURO? Esta acción eliminará permanentemente la cotización y todos sus registros asociados de la base de datos (items, logs, pagos). No se puede deshacer.')) return;
        
        setIsDeleting(true);

        startTransition(async () => {
            try {
                const res = await deleteQuotePermanent(quote.id);
                // Si llegamos aquí y hay un error (no es redirect), lo mostramos
                if (res && !res.success) {
                    setIsDeleting(false);
                    showToast(res.error || 'Error al eliminar', false);
                }
            } catch (err: any) {
                // Next.js usa errores para el redirect, si no es un error de redirect, es un error real
                if (err.message !== 'NEXT_REDIRECT') {
                    setIsDeleting(false);
                    console.error('Error delete:', err);
                }
            }
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

    const handleManualEmail = () => {
        const type = quote.status === 'confirmed' || quote.service_type === 'direct' ? 'confirmation' : 'draft';
        const msg = type === 'confirmation' ? '¿Enviar email de CONFIRMACIÓN?' : '¿Enviar email de COTIZACIÓN (Borrador)?';
        if (!confirm(msg)) return;
        
        startTransition(async () => {
            const res = await sendQuoteEmailAdmin(quote.id, type);
            if (res.success) showToast('Email enviado correctamente ✉️');
            else showToast(res.error || 'Error al enviar', false);
        });
    };

    const handleManualCalendar = () => {
        if (!confirm('¿Sincronizar con Google Calendar? (Se crearán/actualizarán los eventos)')) return;
        startTransition(async () => {
            const res = await syncQuoteToCalendarAdmin(quote.id);
            if (res.success) showToast('Google Calendar sincronizado 📅');
            else showToast(res.error || 'Error al sincronizar', false);
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

    const handleEditItemsStart = () => {
        setEditItems([...(quote.quote_items || [])]);
        setEditCosts({
            manual_discount: quote.manual_discount || 0,
            shipping_cost: quote.shipping_cost || 0,
            installation_cost: quote.installation_cost || 0,
            dispenser: quote.dispenser || 'portatil'
        });
        setIsEditingItems(true);
    };

    const handleEditInfoStart = () => {
        setEditInfo({ ...quote });
        setIsEditingInfo(true);
    };

    const handleEditInfoSave = () => {
        startTransition(async () => {
            const res = await updateQuoteAdmin(quote.id, editInfo);
            if (res.success) {
                const updatedInfo = { ...editInfo };
                if (updatedInfo.event_type_id) {
                    const foundTheme = eventTypes.find((t: any) => t.id === updatedInfo.event_type_id);
                    if (foundTheme) {
                        updatedInfo.event_types = { ...quote.event_types, name: foundTheme.name };
                    }
                }
                setQuote((q: any) => ({ ...q, ...updatedInfo }));
                showToast('Información actualizada');
                setIsEditingInfo(false);
            } else {
                showToast(res.error || 'Error al guardar', false);
            }
        });
    };

    const handleEditItemsSave = () => {
        if (editItems.length === 0) return alert('La cotización no puede quedar sin productos.');
        
        startTransition(async () => {
            const res = await updateQuoteItemsAdmin(quote.id, {
                items: editItems,
                manual_discount: Number(editCosts.manual_discount),
                shipping_cost: Number(editCosts.shipping_cost),
                installation_cost: Number(editCosts.installation_cost),
                dispenser: editCosts.dispenser
            });

            if (res.success) {
                window.location.reload(); 
                showToast('Pedido actualizado y sincronizado');
                setIsEditingItems(false);
            } else {
                showToast(res.error || 'Error al guardar cambios', false);
            }
        });
    };

    const handleAddItem = (p: Product, size: string, price: number, offer: number) => {
        const newItem: any = {
            product_id: p.id,
            product_name: p.name,
            size: size,
            quantity: 1,
            price_at_time: price,
            offer_price_at_time: offer
        };
        setEditItems(prev => [...prev, newItem]);
        setSearchTerm('');
    };

    const handleRemoveItem = (idx: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== idx));
    };

    const updateItem = (idx: number, field: keyof QuoteItem, val: any) => {
        setEditItems(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: val };
            return copy;
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

    if (isDeleting) {
        return (
            <div style={{ 
                height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
                color: '#94a3b8', textAlign: 'center'
            }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(226,160,73,0.1)', borderTopColor: '#E2A049', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>Eliminando cotización y redirigiendo...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

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

                .q-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
                .q-btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
                
                .q-action-btn {
                    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; 
                    transition: all 0.2s; white-space: nowrap; font-family: inherit;
                }
                .q-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .q-action-btn-primary { background: #E2A049; color: #1a1a2e; box-shadow: 0 4px 15px rgba(226,160,73,0.3); }
                .q-action-btn-primary:hover { background: #f0b05b; transform: translateY(-1px); }
                .q-action-btn-secondary { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
                .q-action-btn-secondary:hover { background: rgba(255,255,255,0.08); color: #f1f5f9; }
                .q-action-btn-outline { background: rgba(226,160,73,0.1); color: #E2A049; border: 1px solid rgba(226,160,73,0.2); }
                .q-action-btn-outline:hover { background: rgba(226,160,73,0.15); border-color: rgba(226,160,73,0.4); }

                @media(max-width: 640px) {
                    .q-section-header { flex-direction: column; align-items: stretch; gap: 16px; }
                    .q-btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                    .q-btn-group-single { display: block; }
                    .q-action-btn { width: 100%; padding: 12px; font-size: 14px; }
                    .q-btn-group-edit { grid-template-columns: 1fr 1fr; }
                }

                .q-item-row {
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 14px 18px; background: rgba(255,255,255,0.04); 
                    border-radius: 16px; border: 1px solid rgba(255,255,255,0.02);
                    gap: 12px;
                }
                .q-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
                .q-item-controls { display: flex; gap: 12px; align-items: center; }
                .q-input-group { display: flex; align-items: center; gap: 6px; }
                
                .q-cost-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }

                @media(max-width: 640px) {
                    .q-item-row { flex-direction: column; align-items: stretch; gap: 16px; }
                    .q-item-controls { flex-wrap: wrap; justify-content: space-between; width: 100%; }
                    .q-input-group { flex: 1; }
                    .q-input-group .q-input { width: 100% !important; }
                    
                    .q-cost-row { flex-direction: column; align-items: stretch; gap: 8px; }
                    .q-cost-row .q-input { width: 100% !important; text-align: left !important; }
                    .q-cost-row select.q-input { width: 100% !important; }
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
                <Link href="/admin/quotes" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#E2A049', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}><ArrowLeft size={16}/> Cotizaciones</Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h1 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 900, margin: 0 }}>
                        {quote.service_type === 'direct' && <span style={{ marginRight: '10px' }} title="Venta Directa">📦</span>}
                        <Link href={`/admin/clients/${quote.client_id}`} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.15s' }} 
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(226,160,73,0.5)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                            {quote.client_name} {quote.client_lastname || ''}
                        </Link>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>({formatDateWithDashes(quote.created_at)})</span>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg }}>
                            {badge.label}
                        </span>
                        {quote.service_type === 'direct' ? (
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.1)' }}>
                                Venta Directa
                            </span>
                        ) : (
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}>
                                Servicio de Barra
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={handleResendOrder} disabled={isPending} style={{
                    marginLeft: 'auto', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    opacity: isPending ? 0.5 : 1,
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Send size={14}/> Reenvío Orden</span>
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

                    <button onClick={handleDeleteQuote} disabled={isPending} style={{
                        marginLeft: 'auto', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', transition: 'all 0.15s', opacity: isPending ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <Trash2 size={14}/> Eliminar Cotización
                    </button>
                </div>

                {quote.status === 'completed' && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button onClick={handleReview} disabled={isPending || quote.review_email_sent} style={{
                            padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: quote.review_email_sent ? 'not-allowed' : 'pointer',
                            background: quote.review_email_sent ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)',
                            border: `1px solid ${quote.review_email_sent ? 'rgba(255,255,255,0.1)' : '#a78bfa40'}`,
                            color: quote.review_email_sent ? '#475569' : '#a78bfa', fontFamily: 'inherit',
                        }}>
                            {quote.review_email_sent ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Star size={14}/> Review ya enviado</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Star size={14}/> Enviar email de Review</span>}
                        </button>
                    </div>
                )}
            </div>

            {/* Manual Triggers Section */}
            <div style={{ 
                background: 'rgba(226,160,73,0.05)', 
                borderRadius: '16px', 
                border: '1px solid rgba(226,160,73,0.15)', 
                padding: '20px 24px', 
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
            }}>
                <h3 style={{ color: '#E2A049', fontSize: '13px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Disparadores Manuales</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={handleManualEmail} disabled={isPending} style={{
                        flex: 1, minWidth: '200px', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                        background: '#E2A049', color: '#1a1a2e', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isPending ? 0.6 : 1
                    }}>
                        <Mail size={16}/> Enviar Email de {quote.status === 'confirmed' || quote.service_type === 'direct' ? 'Confirmación' : 'Cotización'}
                    </button>
                    
                    <button onClick={handleManualCalendar} disabled={isPending} style={{
                        flex: 1, minWidth: '200px', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                        background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', 
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isPending ? 0.6 : 1
                    }}>
                        <Calendar size={16}/> {quote.google_event_id ? 'Actualizar en Calendar' : 'Sincronizar con Calendar'}
                    </button>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    * Las automatizaciones automáticas están desactivadas para creaciones desde el Admin. Usa estos botones para dispararlas.
                </p>
            </div>

            {/* New Tabs Design */}
            <div className="q-tabs">
                {[
                    { id: 'info', name: 'Detalle', icon: <FileText size={16}/> },
                    { id: 'review', name: 'Items', icon: <ShoppingBag size={16}/> },
                    { id: 'payments', name: 'Pagos', icon: <CreditCard size={16}/> },
                    { id: 'email', name: 'Email', icon: <Mail size={16}/> },
                ].map(t => (
                    <button key={t.id} className={`q-tab ${tab === t.id ? 'q-tab-active' : ''}`} onClick={() => setTab(t.id as any)}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
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
                            <LinkIcon size={16}/>
                        </a>
                    )}
                </div>
            </div>

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                {tab === 'info' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                        <div className="q-section-header">
                            <div>
                                <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 800, margin: 0 }}>Detalles de la Cotización</h3>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Gestión de datos del cliente y logística del evento</p>
                            </div>
                            <div className="q-btn-group">
                                {!isEditingInfo ? (
                                    <div className="q-btn-group q-btn-group-single">
                                        <button onClick={handleEditInfoStart} className="q-action-btn q-action-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Edit2 size={14}/> Editar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="q-btn-group q-btn-group-edit">
                                        <button onClick={() => setIsEditingInfo(false)} className="q-action-btn q-action-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14}/> Cancelar</button>
                                        <button onClick={handleEditInfoSave} disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {isPending ? '...' : <><Save size={14}/> Guardar</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN CLIENTE */}
                        <div>
                            <h4 style={{ color: '#E2A049', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '24px', height: '1px', background: 'rgba(226,160,73,0.3)' }}></span>
                                Cliente
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '24px 32px' }}>
                                <style>{`
                                    .q-details-grid { display: grid; gap: 24px 32px; grid-template-columns: repeat(1, 1fr); }
                                    @media(min-width: 640px) { .q-details-grid { grid-template-columns: repeat(2, 1fr); } }
                                    @media(min-width: 1024px) { .q-details-grid { grid-template-columns: repeat(4, 1fr); } }
                                `}</style>
                                <div className="q-details-grid">
                                    {[
                                        { label: 'Nombre', key: 'client_name' },
                                        { label: 'Apellido', key: 'client_lastname' },
                                        { label: 'Email', key: 'client_email' },
                                        { label: 'Celular', key: 'client_phone' },
                                    ].map(field => (
                                        <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label className="q-label" style={{ color: '#64748b', fontSize: '11px' }}>{field.label}</label>
                                            {isEditingInfo ? (
                                                <input 
                                                    value={editInfo[field.key] || ''} 
                                                    onChange={(e) => {
                                                        const val = field.key === 'client_phone' ? formatPhoneNumber(e.target.value) : e.target.value;
                                                        setEditInfo((prev: any) => ({ ...prev, [field.key]: val }));
                                                    }}
                                                    className="q-input" 
                                                />
                                            ) : (
                                                <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {quote[field.key] || '—'}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SECCIONES: EVENTO Y LOGÍSTICA */}
                        {[
                            {
                                title: 'Detalles del Evento',
                                fields: [
                                    { label: 'Dirección', key: 'client_address' },
                                    { label: 'Comuna', key: 'comuna_name', special: 'comuna' },
                                    { label: 'Temática', key: 'event_type_id', special: 'theme' },
                                    { label: 'N° Invitados', key: 'guests', type: 'number' },
                                ]
                            },
                            {
                                title: 'Logística y Horarios',
                                fields: [
                                    { label: 'Fecha Evento', key: 'event_date', type: 'date' },
                                    { label: 'Hora Inicio', key: 'start_time', type: 'time' },
                                    { label: 'Fecha Retiro', key: 'pickup_date', type: 'date' },
                                    { label: 'Horario Retiro', key: 'pickup_time', special: 'pickup_time' },
                                ]
                            }
                        ].map((section, sidx) => (
                            <div key={sidx} style={{ marginBottom: sidx === 0 ? '40px' : '0' }}>
                                <h4 style={{ color: '#E2A049', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '24px', height: '1px', background: 'rgba(226,160,73,0.3)' }}></span>
                                    {section.title}
                                </h4>
                                <div className="q-details-grid">
                                    {section.fields.map(field => (
                                        <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label className="q-label" style={{ color: '#64748b', fontSize: '11px' }}>{field.label}</label>
                                            {isEditingInfo ? (
                                                field.special === 'theme' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <select 
                                                            value={editInfo.event_type_id || ''} 
                                                            onChange={(e) => setEditInfo((prev: any) => ({ ...prev, event_type_id: e.target.value }))}
                                                            className="q-input"
                                                        >
                                                            <option value="">Selecciona temática...</option>
                                                            {eventTypes.map((et: any) => (
                                                                <option key={et.id} value={et.id}>{et.name}</option>
                                                            ))}
                                                        </select>
                                                        {editInfo.event_type_id === 'Otro' && (
                                                            <input 
                                                                placeholder="Especificar temática si es 'Otro'..."
                                                                value={editInfo.event_type_other || ''} 
                                                                onChange={(e) => setEditInfo((prev: any) => ({ ...prev, event_type_other: e.target.value }))}
                                                                className="q-input" 
                                                            />
                                                        )}
                                                    </div>
                                                ) : field.special === 'comuna' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <select 
                                                            value={editInfo.comuna_name || ''} 
                                                            onChange={(e) => setEditInfo((prev: any) => ({ ...prev, comuna_name: e.target.value }))}
                                                            className="q-input"
                                                        >
                                                            <option value="">Selecciona comuna...</option>
                                                            {comunas.map((c: any) => (
                                                                <option key={c.name} value={c.name}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                        {editInfo.comuna_name === 'Otra' && (
                                                            <input 
                                                                placeholder="Especificar comuna..."
                                                                value={editInfo.comuna_other || ''} 
                                                                onChange={(e) => setEditInfo((prev: any) => ({ ...prev, comuna_other: e.target.value }))}
                                                                className="q-input animate-in slide-in-from-top-1 duration-200" 
                                                            />
                                                        )}
                                                    </div>
                                                ) : field.special === 'pickup_time' ? (() => {
                                                    const val = editInfo.pickup_time || '';
                                                    const isAllDay = val === '--:--';
                                                    const isRange = val.includes(' a ');
                                                    const startVal = isRange ? val.split(' a ')[0] : (isAllDay ? '' : val);
                                                    const endVal = isRange ? val.split(' a ')[1] : '';

                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#f1f5f9', cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isAllDay} onChange={(e) => {
                                                                    setEditInfo((prev: any) => ({ ...prev, pickup_time: e.target.checked ? '--:--' : '' }));
                                                                }} />
                                                                <span style={{ paddingTop: '1px' }}>Todo el día</span>
                                                            </label>
                                                            {!isAllDay && (
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Inicio</span>
                                                                        <input type="time" value={startVal} onChange={e => {
                                                                            let s = e.target.value;
                                                                            let eVal = endVal;
                                                                            if (eVal && s && eVal < s) eVal = s;
                                                                            setEditInfo((prev: any) => ({ ...prev, pickup_time: (s && eVal) ? `${s} a ${eVal}` : (s || eVal || '') }));
                                                                        }} className="q-input" style={{ padding: '8px' }} />
                                                                    </div>
                                                                    <span style={{ color: '#64748b', alignSelf: 'flex-end', paddingBottom: '8px' }}>-</span>
                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Fin</span>
                                                                        <input type="time" value={endVal} min={startVal} onChange={e => {
                                                                            let eVal = e.target.value;
                                                                            let s = startVal;
                                                                            if (eVal && s && eVal < s) eVal = s;
                                                                            setEditInfo((prev: any) => ({ ...prev, pickup_time: (s && eVal) ? `${s} a ${eVal}` : (eVal || s || '') }));
                                                                        }} className="q-input" style={{ padding: '8px' }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })() : (
                                                    <input 
                                                        type={field.type || 'text'}
                                                        value={editInfo[field.key] || ''} 
                                                        onChange={(e) => setEditInfo((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                                                        className="q-input" 
                                                    />
                                                )
                                            ) : (
                                                <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {field.special === 'theme' ? (() => {
                                                        const type = quote.event_types?.name;
                                                        const other = quote.event_type_other;
                                                        if (!type && !other) return '—';
                                                        if (type && other) return `${type} (${other})`;
                                                        return type || other;
                                                    })() : field.special === 'comuna' ? (() => {
                                                        const c = quote.comuna_name;
                                                        const o = quote.comuna_other;
                                                        return c === 'Otra' && o ? `${c} (${o})` : (c || '—');
                                                    })() : field.special === 'pickup_time' ? (() => {
                                                        const p = quote.pickup_time;
                                                        if (p === '--:--') return 'Todo el día';
                                                        return p || '—';
                                                    })() : (quote[field.key] || '—')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* SECCIÓN COMENTARIOS */}
                        <div>
                            <h4 style={{ color: '#E2A049', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '24px', height: '1px', background: 'rgba(226,160,73,0.3)' }}></span>
                                Comentarios
                            </h4>
                            {isEditingInfo ? (
                                <textarea 
                                    value={editInfo.comments || ''} 
                                    onChange={(e) => setEditInfo((prev: any) => ({ ...prev, comments: e.target.value }))}
                                    className="q-input" 
                                    rows={4}
                                    style={{ resize: 'vertical' }}
                                />
                            ) : (
                                <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', minHeight: '60px' }}>
                                    {quote.comments || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sin comentarios adicionales</span>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'review' && (
                    <div>
                        <div className="q-section-header">
                            <div>
                                <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Gestión de Productos</h3>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Edición manual de ítems y costos</p>
                            </div>
                            <div className="q-btn-group">
                                {!isEditingItems ? (
                                    <div className="q-btn-group q-btn-group-single">
                                        <button onClick={handleEditItemsStart} className="q-action-btn q-action-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Edit2 size={14}/> Editar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="q-btn-group q-btn-group-edit">
                                        <button onClick={() => setIsEditingItems(false)} className="q-action-btn q-action-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14}/> Cancelar</button>
                                        <button onClick={handleEditItemsSave} disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {isPending ? '...' : <><Save size={14}/> Guardar</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isEditingItems && (
                            <div style={{ marginBottom: '20px', position: 'relative' }}>
                                <label className="q-label">Añadir Producto</label>
                                <input 
                                    className="q-input" 
                                    placeholder="Buscar producto por nombre..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm.length > 1 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', zIndex: 10, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                                        {allProducts
                                            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map(p => (
                                                <div key={p.id} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{p.name}</div>
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                        {p.sizes.map(s => (
                                                            <button key={s.size} onClick={() => handleAddItem(p, s.size, s.price, s.offerPrice)} style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(226,160,73,0.1)', color: '#E2A049', border: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>
                                                                + {s.size} ({formatCLP(s.offerPrice)})
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'grid', gap: '12px' }}>
                            {(!isEditingItems ? (quote.quote_items || []) : editItems).map((item: any, idx: number) => (
                                <div key={item.id || idx} className="q-item-row">
                                    <div className="q-item-info">
                                        <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, wordBreak: 'break-word' }}>{item.product_name}</span>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>{item.size}</span>
                                    </div>
                                    
                                    <div className="q-item-controls">
                                        {isEditingItems ? (
                                            <>
                                                <div className="q-input-group">
                                                    <label className="q-label" style={{ margin: 0 }}>Cant.</label>
                                                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="q-input" style={{ width: '60px', padding: '6px' }} />
                                                </div>
                                                <div className="q-input-group">
                                                    <label className="q-label" style={{ margin: 0 }}>Precio</label>
                                                    <input type="number" value={item.offer_price_at_time} onChange={e => updateItem(idx, 'offer_price_at_time', Number(e.target.value))} className="q-input" style={{ width: '90px', padding: '6px' }} />
                                                </div>
                                                <button onClick={() => handleRemoveItem(idx)} style={{ background: 'rgba(248,113,113,0.1)', border: 'none', color: '#f87171', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16}/></button>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: '#E2A049', fontWeight: 800, fontSize: '15px' }}>{formatCLP(item.offer_price_at_time * item.quantity)}</div>
                                                <div style={{ color: '#475569', fontSize: '11px' }}>{item.quantity} un. x {formatCLP(item.offer_price_at_time)}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Additional Costs Section */}
                            <div style={{ marginTop: '12px', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '12px' }}>
                                <div className="q-cost-row">
                                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Transporte</span>
                                    {isEditingItems ? (
                                        <input type="number" value={editCosts.shipping_cost} onChange={e => setEditCosts(prev => ({ ...prev, shipping_cost: Number(e.target.value) }))} className="q-input" style={{ width: '120px', textAlign: 'right' }} />
                                    ) : (
                                        <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{formatCLP(quote.shipping_cost)}</span>
                                    )}
                                </div>
                                <div className="q-cost-row">
                                    {isEditingItems ? (
                                        <>
                                            <select 
                                                value={editCosts.dispenser} 
                                                onChange={e => {
                                                    const d = e.target.value as any;
                                                    setEditCosts(prev => ({ 
                                                        ...prev, 
                                                        dispenser: d,
                                                        installation_cost: d === 'muro' ? (prev.installation_cost || 50000) : 0
                                                    }));
                                                }}
                                                className="q-input"
                                                style={{ width: 'auto', fontSize: '13px', padding: '6px 10px' }}
                                            >
                                                <option value="portatil">Dispensador Portátil</option>
                                                <option value="muro">Muro de Cócteleria</option>
                                                <option value="desechable">Barril Desechable</option>
                                            </select>
                                            <input type="number" value={editCosts.installation_cost} onChange={e => setEditCosts(prev => ({ ...prev, installation_cost: Number(e.target.value) }))} className="q-input" style={{ width: '120px', textAlign: 'right' }} />
                                        </>
                                    ) : (
                                        <>
                                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                                                {quote.dispenser === 'muro' ? 'Muro de Cócteleria' : (quote.service_type === 'direct' ? 'Barril Desechable' : 'Dispensador Portátil')}
                                            </span>
                                            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{formatCLP(quote.installation_cost)}</span>
                                        </>
                                    )}
                                </div>
                                <div className="q-cost-row">
                                    <span style={{ color: '#f87171', fontSize: '13px', fontWeight: 700 }}>Descuento Extra</span>
                                    {isEditingItems ? (
                                        <input type="number" value={editCosts.manual_discount} onChange={e => setEditCosts(prev => ({ ...prev, manual_discount: Number(e.target.value) }))} className="q-input" style={{ width: '120px', textAlign: 'right', color: '#f87171' }} />
                                    ) : (
                                        <span style={{ color: '#f87171', fontWeight: 700 }}>-{formatCLP(quote.manual_discount || 0)}</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                                    <span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 900 }}>TOTAL FINAL</span>
                                    <span style={{ color: '#E2A049', fontSize: '22px', fontWeight: 900 }}>
                                        {formatCLP(isEditingItems 
                                            ? editItems.reduce((s, i) => s + (i.offer_price_at_time * i.quantity), 0) + editCosts.shipping_cost + editCosts.installation_cost - editCosts.manual_discount
                                            : Number(quote.total_price)
                                        )}
                                    </span>
                                </div>
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
                                    <button onClick={() => handleDeletePayment(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16}/></button>
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
                            <button type="submit" disabled={isPending} style={{ alignSelf: 'flex-start', padding: '10px 24px', background: 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', opacity: isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isPending ? 'Enviando…' : <><Send size={16}/> Enviar Email</>}
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
                            <button type="button" className="q-action-btn q-action-btn-secondary" style={{ flex: 1 }} onClick={() => setShowPayModal(false)}>Cancelar</button>
                            <button type="submit" disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ flex: 1 }}>{isPending ? '...' : 'Guardar Pago'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
