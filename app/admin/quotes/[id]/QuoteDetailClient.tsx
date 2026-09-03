'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import {
    updateQuoteStatus,
    sendDirectEmail,
    sendReviewEmail,
    updateQuoteAdmin,
    addQuotePayment,
    deleteQuotePayment,
    updateQuoteItemsAdmin,
    sendQuoteEmailAdmin,
    syncQuoteToCalendarAdmin,
    deleteQuotePermanent,
    markDirectSaleInDelivery,
} from '@/app/actions/admin/adminActions';
import { SITE_URL } from '@/lib/config';
import type { QuoteItem, Product, Quote, QuoteStatus } from '@/lib/types';
import type { Comuna, Region } from '@/lib/types';
import { toWhatsAppDigits } from '@/lib/phone';
import {
    getQuoteBalance,
    isDirectSaleQuote,
    isDirectSalePaymentPending,
    DIRECT_SALE_PAYMENT_PENDING_BADGE,
    PAYMENT_NOTE_FULL,
    PAYMENT_NOTE_PARTIAL,
    BLUE_EXPRESS_CARRIER,
    buildBlueExpressTrackingUrl,
} from '@/lib/directSaleFulfillment';
import {
    Mail,
    Send,
    Link as LinkIcon,
    Trash2,
    Star,
    ArrowLeft,
    Calendar,
    Package,
} from 'lucide-react';
import { sourceBadge, normalizeQuoteSource } from '@/lib/quoteSource';
import QuoteOperationalSummary from './QuoteOperationalSummary';

type QuoteDetail = Quote & {
    review_email_sent?: boolean | null;
    event_types?: { name: string } | null;
};

type QuotePayment = NonNullable<Quote['payments']>[number];

const statusFlow = ['draft', 'confirmed', 'in_delivery', 'completed', 'cancelled'];
const statusBadge: Record<string, { label: string; shortLabel: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', shortLabel: 'Borrador', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    confirmed: { label: 'Confirmada', shortLabel: 'Confirm.', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    in_delivery: { label: 'En reparto', shortLabel: 'Reparto', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
    completed: { label: 'Completada', shortLabel: 'Completa', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    cancelled: { label: 'Cancelada', shortLabel: 'Cancelar', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};

const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const formatDateWithDashes = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

const actionBtnStyle = (variant: 'primary' | 'secondary' | 'ghost' = 'secondary'): React.CSSProperties => {
    if (variant === 'primary') {
        return {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            background: '#E2A049',
            color: '#1a1a2e',
        };
    }
    if (variant === 'ghost') {
        return {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#f1f5f9',
        };
    }
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '9px 14px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        border: '1px solid rgba(226,160,73,0.25)',
        background: 'rgba(226,160,73,0.1)',
        color: '#E2A049',
    };
};

export default function QuoteDetailClient({
    quote: initial,
    allProducts,
    eventTypes,
    comunas,
    regions,
}: {
    quote: QuoteDetail;
    allProducts: Product[];
    eventTypes: { id: string; name: string }[];
    comunas: Comuna[];
    regions: Region[];
}) {
    const [quote, setQuote] = useState<QuoteDetail>(initial);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editInfo, setEditInfo] = useState<Record<string, unknown>>({});
    const [editItems, setEditItems] = useState<QuoteItem[]>([]);
    const [editCosts, setEditCosts] = useState({
        manual_discount: Number(initial.manual_discount) || 0,
        shipping_cost: Number(initial.shipping_cost) || 0,
        installation_cost: Number(initial.installation_cost) || 0,
        dispenser: String(initial.dispenser || 'portatil'),
    });
    const [editShippingPorPagar, setEditShippingPorPagar] = useState(initial.shipping_label === 'Por Pagar');
    const [searchTerm, setSearchTerm] = useState('');

    const [showPayModal, setShowPayModal] = useState(false);
    const [payNoteType, setPayNoteType] = useState<'full' | 'partial' | 'custom'>('partial');
    const [payCustomNote, setPayCustomNote] = useState('');

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: '', body: '' });

    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [dispatchKind, setDispatchKind] = useState<'own' | 'carrier'>('own');
    const [carrierPreset, setCarrierPreset] = useState<'blue_express' | 'custom'>('blue_express');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [customCarrierName, setCustomCarrierName] = useState('');
    const [customTrackingUrl, setCustomTrackingUrl] = useState('');

    const isDirectSale = isDirectSaleQuote(quote);
    const balance = getQuoteBalance(quote);
    const canMarkInDelivery = isDirectSale && quote.status === 'confirmed' && balance <= 0;

    const statusActions = [
        ...statusFlow.filter((s) => s !== quote.status && s !== 'in_delivery'),
        ...(canMarkInDelivery ? (['in_delivery'] as const) : []),
    ];

    const badge = isDirectSalePaymentPending(quote)
        ? DIRECT_SALE_PAYMENT_PENDING_BADGE
        : statusBadge[String(quote.status)] || statusBadge.draft;
    const srcBadge = sourceBadge[normalizeQuoteSource(quote.source)];

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const handleStatusChange = (newStatus: string) => {
        if (!confirm(`¿Cambiar estado a "${statusBadge[newStatus]?.label}"?`)) return;
        startTransition(async () => {
            const res = await updateQuoteStatus(String(quote.id), newStatus);
            if (res.success) {
                setQuote((q) => ({ ...q, status: newStatus as QuoteStatus }));
                showToast('Estado actualizado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleDeleteQuote = () => {
        if (
            !confirm(
                '¿ESTÁS SEGURO? Esta acción eliminará permanentemente la cotización y todos sus registros asociados. No se puede deshacer.'
            )
        )
            return;
        setIsDeleting(true);
        startTransition(async () => {
            try {
                const res = await deleteQuotePermanent(String(quote.id));
                if (res && !res.success) {
                    setIsDeleting(false);
                    showToast(res.error || 'Error al eliminar', false);
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.message !== 'NEXT_REDIRECT') {
                    setIsDeleting(false);
                    console.error('Error delete:', err);
                }
            }
        });
    };

    const handleSendComposeEmail = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await sendDirectEmail(String(quote.id), fd);
            if (res.success) {
                showToast('Email enviado correctamente');
                setEmailForm({ subject: '', body: '' });
                setShowEmailModal(false);
            } else showToast(res.error || 'Error al enviar', false);
        });
    };

    const handleReview = () => {
        startTransition(async () => {
            const res = await sendReviewEmail(String(quote.id));
            if (res.success) {
                setQuote((q) => ({ ...q, review_email_sent: true }));
                showToast('Email de review enviado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleManualEmail = () => {
        const type =
            quote.status === 'confirmed' || quote.service_type === 'direct' ? 'confirmation' : 'draft';
        const msg =
            type === 'confirmation'
                ? '¿Enviar email de CONFIRMACIÓN?'
                : '¿Enviar email de COTIZACIÓN (Borrador)?';
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await sendQuoteEmailAdmin(String(quote.id), type);
            if (res.success) showToast('Email enviado correctamente');
            else showToast(res.error || 'Error al enviar', false);
        });
    };

    const handleManualCalendar = () => {
        if (!confirm('¿Sincronizar con Google Calendar? (Se crearán/actualizarán los eventos)')) return;
        startTransition(async () => {
            const res = await syncQuoteToCalendarAdmin(String(quote.id));
            if (res.success) showToast('Google Calendar sincronizado');
            else showToast(res.error || 'Error al sincronizar', false);
        });
    };

    const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const note =
            payNoteType === 'full'
                ? PAYMENT_NOTE_FULL
                : payNoteType === 'partial'
                  ? PAYMENT_NOTE_PARTIAL
                  : payCustomNote.trim() || PAYMENT_NOTE_PARTIAL;
        const p = { date: fd.get('date') as string, amount: Number(fd.get('amount')), note };
        if (!p.amount || !p.date) return;

        startTransition(async () => {
            const res = await addQuotePayment(String(quote.id), p);
            if (res.success) {
                const updatedPayments: QuotePayment[] = [...(quote.payments || []), p];
                setQuote((q) => ({ ...q, payments: updatedPayments }));
                setShowPayModal(false);
                setPayNoteType('partial');
                setPayCustomNote('');
                if (res.emailWarning) showToast(`Pago registrado (email: ${res.emailWarning})`, false);
                else showToast('Pago registrado y email enviado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleQuickFullPayment = () => {
        if (balance <= 0) return;
        if (!confirm(`¿Registrar transferencia total por ${formatCLP(balance)} y enviar email al cliente?`)) return;
        const p = {
            date: new Date().toISOString().split('T')[0],
            amount: balance,
            note: PAYMENT_NOTE_FULL,
        };
        startTransition(async () => {
            const res = await addQuotePayment(String(quote.id), p);
            if (res.success) {
                const updatedPayments: QuotePayment[] = [...(quote.payments || []), p];
                setQuote((q) => ({ ...q, payments: updatedPayments }));
                if (res.emailWarning) showToast(`Pago registrado (email: ${res.emailWarning})`, false);
                else showToast('Transferencia total registrada y email enviado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleMarkInDelivery = () => {
        startTransition(async () => {
            let input: Parameters<typeof markDirectSaleInDelivery>[1];
            if (dispatchKind === 'own') {
                input = { mode: 'own' };
            } else if (carrierPreset === 'blue_express') {
                input = { mode: 'carrier', carrierPreset: 'blue_express', trackingNumber };
            } else {
                input = {
                    mode: 'carrier',
                    carrierPreset: 'custom',
                    carrierName: customCarrierName,
                    trackingUrl: customTrackingUrl,
                    trackingNumber,
                };
            }
            const res = await markDirectSaleInDelivery(String(quote.id), input);
            if (res.success) {
                setQuote((q) => ({
                    ...q,
                    status: 'in_delivery',
                    dispatch_mode: dispatchKind === 'own' ? 'own' : 'carrier',
                    dispatch_carrier_name:
                        dispatchKind === 'own'
                            ? null
                            : carrierPreset === 'blue_express'
                              ? BLUE_EXPRESS_CARRIER.name
                              : customCarrierName,
                    dispatch_tracking_url:
                        dispatchKind === 'own'
                            ? null
                            : carrierPreset === 'blue_express'
                              ? buildBlueExpressTrackingUrl(trackingNumber)
                              : customTrackingUrl,
                    dispatch_tracking_number: dispatchKind === 'own' ? null : trackingNumber,
                }));
                setShowDispatchModal(false);
                setTrackingNumber('');
                setCustomCarrierName('');
                setCustomTrackingUrl('');
                if (res.emailWarning) showToast(`En reparto (email: ${res.emailWarning})`, false);
                else showToast('Marcado en reparto y email enviado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleEditStart = () => {
        const info = { ...quote };
        if (!info.event_type_id && info.event_type_other) info.event_type_id = 'Otro';
        if (!info.comuna_name && info.comuna_other) info.comuna_name = 'Otra';
        setEditInfo(info);
        setEditItems([...((quote.quote_items as QuoteItem[]) || [])]);
        setEditCosts({
            manual_discount: Number(quote.manual_discount) || 0,
            shipping_cost: Number(quote.shipping_cost) || 0,
            installation_cost: Number(quote.installation_cost) || 0,
            dispenser: String(quote.dispenser || 'portatil'),
        });
        setEditShippingPorPagar(quote.shipping_label === 'Por Pagar');
        setSearchTerm('');
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setSearchTerm('');
    };

    const handleEditSave = () => {
        if (editItems.length === 0) {
            alert('La cotización no puede quedar sin productos.');
            return;
        }
        startTransition(async () => {
            const infoToSave = { ...editInfo };
            if (infoToSave.event_type_id !== 'Otro') infoToSave.event_type_other = null;
            if (infoToSave.comuna_name !== 'Otra') infoToSave.comuna_other = null;

            const infoRes = await updateQuoteAdmin(String(quote.id), infoToSave);
            if (!infoRes.success) {
                showToast(infoRes.error || 'Error al guardar datos', false);
                return;
            }

            const itemsRes = await updateQuoteItemsAdmin(String(quote.id), {
                items: editItems,
                manual_discount: Number(editCosts.manual_discount),
                shipping_cost: editShippingPorPagar ? 0 : Number(editCosts.shipping_cost),
                installation_cost: Number(editCosts.installation_cost),
                dispenser: editCosts.dispenser as 'portatil' | 'muro' | 'desechable',
                shipping_label: editShippingPorPagar ? 'Por Pagar' : null,
            });

            if (!itemsRes.success) {
                showToast(itemsRes.error || 'Error al guardar productos', false);
                return;
            }

            window.location.reload();
        });
    };

    const handleAddItem = (p: Product, size: string, price: number, offer: number) => {
        setEditItems((prev) => [
            ...prev,
            {
                product_id: p.id,
                product_name: p.name,
                size,
                quantity: 1,
                price_at_time: price,
                offer_price_at_time: offer,
            } as QuoteItem,
        ]);
        setSearchTerm('');
    };

    const handleRemoveItem = (idx: number) => {
        setEditItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const updateItem = (idx: number, field: keyof QuoteItem, val: unknown) => {
        setEditItems((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: val };
            return copy;
        });
    };

    const handleDeletePayment = (index: number) => {
        if (!confirm('¿Eliminar este registro de pago?')) return;
        startTransition(async () => {
            const res = await deleteQuotePayment(String(quote.id), index);
            if (res.success) {
                const updatedPayments: QuotePayment[] = [...(quote.payments || [])];
                updatedPayments.splice(index, 1);
                setQuote((q) => ({ ...q, payments: updatedPayments }));
                showToast('Pago eliminado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const phone = quote.client_phone ? toWhatsAppDigits(String(quote.client_phone)) : '';
    const waUrl = phone ? `https://wa.me/${phone}` : null;
    const emailTypeLabel =
        quote.status === 'confirmed' || quote.service_type === 'direct' ? 'Confirmación' : 'Cotización';

    if (isDeleting) {
        return (
            <div
                style={{
                    height: '60vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    color: '#94a3b8',
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(226,160,73,0.1)',
                        borderTopColor: '#E2A049',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }}
                />
                <p style={{ fontSize: '16px', fontWeight: 600 }}>Eliminando cotización y redirigiendo…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        top: '24px',
                        right: '24px',
                        zIndex: 9999,
                        padding: '14px 20px',
                        borderRadius: '12px',
                        background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                        border: `1px solid ${toast.ok ? '#34d399' : '#f87171'}`,
                        color: toast.ok ? '#34d399' : '#f87171',
                        fontSize: '14px',
                        fontWeight: 700,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                >
                    {toast.msg}
                </div>
            )}

            <style>{`
                .q-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 20px; }
                .q-modal { background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; max-width: 450px; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                .q-form-group { margin-bottom: 16px; }
                .q-label { display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
                .q-input { width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; outline: none; box-sizing: border-box; font-family: inherit; }
                .q-action-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; font-family: inherit; }
                .q-action-btn-primary { background: #E2A049; color: #1a1a2e; }
                .q-action-btn-secondary { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
                .q-status-chip { padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; border: none; white-space: nowrap; }
                .q-status-chip-label-short { display: none; }
                .q-status-chip:disabled { opacity: 0.5; cursor: not-allowed; }
                @media(max-width: 767px) {
                    .q-status-scroll { display: grid; grid-template-columns: repeat(var(--status-cols, 4), minmax(0, 1fr)); gap: 6px; }
                    .q-status-chip { width: 100%; padding: 8px 3px; font-size: clamp(9px, 2.35vw, 11px); white-space: normal; text-align: center; }
                    .q-status-chip-label { display: none; }
                    .q-status-chip-label-short { display: inline; }
                }
            `}</style>

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <Link
                        href="/admin/quotes"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#E2A049',
                            fontSize: '13px',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <ArrowLeft size={16} /> Cotizaciones
                    </Link>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h1 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 900, margin: 0 }}>
                            {quote.service_type === 'direct' && (
                                <Package
                                    size={18}
                                    style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#60a5fa' }}
                                />
                            )}
                            <Link
                                href={`/admin/clients/${quote.client_id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                                {String(quote.client_name)} {String(quote.client_lastname || '')}
                            </Link>
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                                ({formatDateWithDashes(String(quote.created_at))})
                            </span>
                            <span
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: badge.color,
                                    background: badge.bg,
                                }}
                            >
                                {badge.label}
                            </span>
                            <span
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: srcBadge.color,
                                    background: srcBadge.bg,
                                }}
                            >
                                {srcBadge.label}
                            </span>
                            <span
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: quote.service_type === 'direct' ? '#60a5fa' : '#a78bfa',
                                    background:
                                        quote.service_type === 'direct'
                                            ? 'rgba(96,165,250,0.1)'
                                            : 'rgba(167,139,250,0.1)',
                                }}
                            >
                                {quote.service_type === 'direct' ? 'Venta Directa' : 'Servicio de Barra'}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                        href={waUrl || '#'}
                        target={waUrl ? '_blank' : '_self'}
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: waUrl ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.03)',
                            color: waUrl ? '#25D366' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: waUrl ? 1 : 0.4,
                            border: '1px solid rgba(37,211,102,0.15)',
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.038 3.284l-.569 2.1c-.123.454.28.855.73.726l2.124-.609c1.048.589 2.123.915 3.313.915 3.14-.04 5.77-2.612 5.77-5.77 0-3.18-2.587-5.761-5.767-5.761zm3.336 8.356c-.113.318-.654.582-.911.62-.257.038-.501.066-1.556-.35a5.53 5.53 0 0 1-2.42-2.128c-.066-.094-.523-.695-.523-1.327 0-.632.33-.941.449-1.065.118-.124.257-.156.344-.156s.174.001.249.005c.08.004.188-.03.294.223.113.272.387.942.422 1.012.035.071.058.151.011.246-.046.094-.07.151-.139.231-.07.081-.144.179-.211.24-.075.071-.154.146-.064.301.091.156.401.66.862 1.07.593.527 1.091.69 1.246.763.156.075.246.061.34-.046.094-.108.401-.468.509-.627.108-.159.217-.133.363-.078.146.056.923.435 1.083.514.16.08.267.118.305.18.038.061.038.353-.075.671z" />
                        </svg>
                    </a>
                    {quote.token && (
                        <a
                            href={`${SITE_URL}/cotizar/${quote.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Link público"
                            style={{
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(96,165,250,0.12)',
                                color: '#60a5fa',
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid rgba(96,165,250,0.15)',
                            }}
                        >
                            <LinkIcon size={16} />
                        </a>
                    )}
                </div>
            </div>

            {/* Barra de acciones unificada */}
            <div
                style={{
                    background: '#1e2433',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '18px 20px',
                    marginBottom: '20px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                    }}
                >
                    <h3
                        style={{
                            color: '#f1f5f9',
                            fontSize: '12px',
                            fontWeight: 800,
                            margin: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}
                    >
                        Acciones
                    </h3>
                    <button
                        type="button"
                        onClick={handleDeleteQuote}
                        disabled={isPending || isEditing}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444',
                            opacity: isPending || isEditing ? 0.5 : 1,
                        }}
                    >
                        <Trash2 size={14} />
                        Eliminar
                    </button>
                </div>

                <div
                    className="q-status-scroll"
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', '--status-cols': statusActions.length } as CSSProperties}
                >
                    {statusActions.map((s) => {
                        const sb = statusBadge[s];
                        const isDispatch = s === 'in_delivery';
                        return (
                            <button
                                key={s}
                                type="button"
                                onClick={() => (isDispatch ? setShowDispatchModal(true) : handleStatusChange(s))}
                                disabled={isPending || isEditing}
                                className="q-status-chip"
                                style={{
                                    background: sb.bg,
                                    border: `1px solid ${sb.color}40`,
                                    color: sb.color,
                                }}
                            >
                                <span className="q-status-chip-label">{sb.label}</span>
                                <span className="q-status-chip-label-short">{sb.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={handleManualEmail}
                        disabled={isPending || isEditing}
                        style={{ ...actionBtnStyle('primary'), opacity: isPending || isEditing ? 0.5 : 1 }}
                    >
                        <Mail size={14} />
                        Email {emailTypeLabel}
                    </button>
                    <button
                        type="button"
                        onClick={handleManualCalendar}
                        disabled={isPending || isEditing}
                        style={{ ...actionBtnStyle('ghost'), opacity: isPending || isEditing ? 0.5 : 1 }}
                    >
                        <Calendar size={14} />
                        {quote.google_event_id ? 'Actualizar Calendar' : 'Sincronizar Calendar'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowEmailModal(true)}
                        disabled={isPending || isEditing}
                        style={{ ...actionBtnStyle('secondary'), opacity: isPending || isEditing ? 0.5 : 1 }}
                    >
                        <Send size={14} />
                        Redactar email
                    </button>
                    {quote.status === 'completed' && (
                        <button
                            type="button"
                            onClick={handleReview}
                            disabled={isPending || isEditing || Boolean(quote.review_email_sent)}
                            style={{
                                ...actionBtnStyle('secondary'),
                                color: quote.review_email_sent ? '#475569' : '#a78bfa',
                                borderColor: quote.review_email_sent ? 'rgba(255,255,255,0.1)' : 'rgba(167,139,250,0.3)',
                                opacity: isPending || isEditing ? 0.5 : 1,
                            }}
                        >
                            <Star size={14} />
                            {quote.review_email_sent ? 'Review enviado' : 'Email review'}
                        </button>
                    )}
                </div>
            </div>

            {/* Ficha unificada */}
            <QuoteOperationalSummary
                quote={quote}
                isDirectSale={isDirectSale}
                balance={balance}
                isEditing={isEditing}
                isPending={isPending}
                onCopied={(msg) => showToast(msg)}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                editInfo={editInfo}
                setEditInfo={setEditInfo}
                editItems={editItems}
                editCosts={editCosts}
                setEditCosts={setEditCosts}
                editShippingPorPagar={editShippingPorPagar}
                setEditShippingPorPagar={setEditShippingPorPagar}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                allProducts={allProducts}
                eventTypes={eventTypes}
                comunas={comunas}
                regions={regions}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onUpdateItem={updateItem}
                onRegisterPayment={() => setShowPayModal(true)}
                onQuickFullPayment={handleQuickFullPayment}
                onDeletePayment={handleDeletePayment}
            />

            {/* Modal pago */}
            {showPayModal && (
                <div className="q-modal-overlay">
                    <form className="q-modal" onSubmit={handleAddPayment}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 20px' }}>Registrar pago</h2>
                        <div className="q-form-group">
                            <label className="q-label">Monto (CLP)</label>
                            <input name="amount" type="number" required className="q-input" placeholder="Ej: 50000" autoFocus />
                        </div>
                        <div className="q-form-group">
                            <label className="q-label">Fecha</label>
                            <input
                                name="date"
                                type="date"
                                required
                                className="q-input"
                                defaultValue={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="q-form-group">
                            <label className="q-label">Glosa / Tipo</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px' }}>
                                    <input type="radio" checked={payNoteType === 'full'} onChange={() => setPayNoteType('full')} />
                                    Transferencia total
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px' }}>
                                    <input type="radio" checked={payNoteType === 'partial'} onChange={() => setPayNoteType('partial')} />
                                    Abono transferencia
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px' }}>
                                    <input type="radio" checked={payNoteType === 'custom'} onChange={() => setPayNoteType('custom')} />
                                    Otro
                                </label>
                                {payNoteType === 'custom' && (
                                    <input
                                        className="q-input"
                                        value={payCustomNote}
                                        onChange={(e) => setPayCustomNote(e.target.value)}
                                        placeholder="Texto libre"
                                    />
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button type="button" className="q-action-btn q-action-btn-secondary" style={{ flex: 1 }} onClick={() => setShowPayModal(false)}>
                                Cancelar
                            </button>
                            <button type="submit" disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ flex: 1 }}>
                                {isPending ? '...' : 'Guardar pago'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal redactar email */}
            {showEmailModal && (
                <div className="q-modal-overlay">
                    <form className="q-modal" onSubmit={handleSendComposeEmail} style={{ maxWidth: '520px' }}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 8px' }}>Redactar email</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>
                            Para: <strong style={{ color: '#f1f5f9' }}>{String(quote.client_email || 'Sin email')}</strong>
                        </p>
                        <div className="q-form-group">
                            <label className="q-label">Asunto</label>
                            <input
                                name="subject"
                                value={emailForm.subject}
                                onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                                required
                                className="q-input"
                            />
                        </div>
                        <div className="q-form-group">
                            <label className="q-label">Mensaje</label>
                            <textarea
                                name="body"
                                value={emailForm.body}
                                onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))}
                                required
                                rows={6}
                                className="q-input"
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button type="button" className="q-action-btn q-action-btn-secondary" style={{ flex: 1 }} onClick={() => setShowEmailModal(false)}>
                                Cancelar
                            </button>
                            <button type="submit" disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ flex: 1 }}>
                                {isPending ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal despacho */}
            {showDispatchModal && (
                <div className="q-modal-overlay">
                    <div className="q-modal">
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 20px' }}>En reparto</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px', cursor: 'pointer' }}>
                                <input type="radio" checked={dispatchKind === 'own'} onChange={() => setDispatchKind('own')} />
                                Reparto propio (entrega durante el día)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px', cursor: 'pointer' }}>
                                <input type="radio" checked={dispatchKind === 'carrier'} onChange={() => setDispatchKind('carrier')} />
                                Despacho por tercero
                            </label>
                        </div>
                        {dispatchKind === 'carrier' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px', cursor: 'pointer' }}>
                                    <input type="radio" checked={carrierPreset === 'blue_express'} onChange={() => setCarrierPreset('blue_express')} />
                                    Blue Express
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontSize: '13px', cursor: 'pointer' }}>
                                    <input type="radio" checked={carrierPreset === 'custom'} onChange={() => setCarrierPreset('custom')} />
                                    Otra empresa
                                </label>
                                {carrierPreset === 'custom' && (
                                    <>
                                        <input className="q-input" placeholder="Nombre empresa" value={customCarrierName} onChange={(e) => setCustomCarrierName(e.target.value)} />
                                        <input className="q-input" placeholder="URL de seguimiento" value={customTrackingUrl} onChange={(e) => setCustomTrackingUrl(e.target.value)} />
                                    </>
                                )}
                                <input
                                    className="q-input"
                                    placeholder="Número de seguimiento *"
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button type="button" className="q-action-btn q-action-btn-secondary" style={{ flex: 1 }} onClick={() => setShowDispatchModal(false)}>
                                Cancelar
                            </button>
                            <button type="button" disabled={isPending} className="q-action-btn q-action-btn-primary" style={{ flex: 1 }} onClick={handleMarkInDelivery}>
                                {isPending ? '...' : 'Confirmar y enviar email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
