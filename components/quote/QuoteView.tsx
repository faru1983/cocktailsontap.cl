'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { formatEventDate } from '@/lib/wizardLogic';
import { confirmQuote } from '@/app/actions/confirmQuote';
import type { Quote, QuoteItem } from '@/lib/types';
import {
    CheckCircle, Clock, XCircle, AlertCircle, ShoppingCart,
    Calendar, Users, MapPin, User, Mail, Phone, MessageSquare, Loader2, Lock
} from 'lucide-react';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
}

const STATUS_CONFIG = {
    draft: { label: 'Borrador', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
    completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
};

export default function QuoteView({ quote }: Props) {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [phone, setPhone] = useState(quote.client_phone ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmed, setConfirmed] = useState(quote.status === 'confirmed');

    const statusCfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft;
    const StatusIcon = statusCfg.icon;

    const comunaDisplay = quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name;
    const eventTypeDisplay = quote.event_type_id === 'Otro' ? quote.event_type_other : quote.event_type_id;
    const halfAmount = quote.total_price / 2;

    const handleConfirm = async () => {
        setIsConfirming(true);
        setConfirmError('');
        const result = await confirmQuote({
            token: quote.token,
            client_phone: phone || undefined,
            client_address: address || undefined,
        });
        setIsConfirming(false);
        if (result.success) {
            setConfirmed(true);
            setShowConfirmModal(false);
        } else {
            setConfirmError(result.error ?? 'Error al confirmar. Intenta nuevamente.');
        }
    };

    // ─── Pantalla de éxito post-confirmación ──────────────────────────────────

    if (confirmed && quote.status !== 'confirmed') {
        return (
            <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-black text-brand-text mb-3">¡Reserva confirmada!</h1>
                <p className="text-brand-text-muted text-[1rem] mb-6 max-w-md mx-auto">
                    Te enviamos un email con todos los detalles y las instrucciones de pago.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-sm mx-auto text-left">
                    <p className="text-green-800 font-bold text-center mb-4">Monto a depositar (50%)</p>
                    <p className="text-green-600 font-black text-3xl text-center mb-4">{formatCurrency(halfAmount)}</p>
                    <div className="text-[0.85rem] text-green-800 space-y-1">
                        <p><strong>Banco:</strong> Mercado Pago</p>
                        <p><strong>Cuenta Vista:</strong> 1098081647</p>
                        <p><strong>Nombre:</strong> Felipe Ramírez</p>
                        <p><strong>RUT:</strong> 15.332.189-2</p>
                        <p><strong>Email:</strong> contacto@cocktailsontap.cl</p>
                    </div>
                    <p className="text-[0.8rem] text-green-700 mt-3 italic">El 50% restante se paga el día del montaje.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.75rem] font-black border uppercase tracking-wider ${statusCfg.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusCfg.label}
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-brand-text">Cotización de {quote.client_name}</h1>
                    <p className="text-brand-text-muted text-[0.9rem]">Creada el {new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {quote.status === 'draft' && !confirmed && (
                    <button
                        type="button"
                        onClick={() => setShowConfirmModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-[0.95rem] shadow-[0_4px_15px_rgba(226,160,73,0.35)] hover:bg-primary-dark transition-all active:scale-95 whitespace-nowrap"
                    >
                        <CheckCircle className="w-5 h-5" /> Confirmar Reserva
                    </button>
                )}

                {(quote.status === 'confirmed' || confirmed) && (
                    <div className="flex items-center gap-2 text-green-700 font-bold text-[0.9rem]">
                        <Lock className="w-4 h-4" /> Reserva bloqueada – no editable
                    </div>
                )}
            </div>

            {/* Datos del evento */}
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm">
                <h2 className="text-[0.7rem] font-black text-primary uppercase tracking-widest mb-4">Detalles del Evento</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { icon: Calendar, label: 'Fecha', value: formatEventDate(quote.event_date) },
                        { icon: Clock, label: 'Hora inicio', value: quote.start_time },
                        { icon: Users, label: 'Invitados', value: `${quote.guests} personas` },
                        { icon: MapPin, label: 'Comuna', value: comunaDisplay },
                        { icon: MapPin, label: 'Dirección', value: quote.client_address },
                        { icon: MessageSquare, label: 'Temática', value: eventTypeDisplay },
                    ].filter((item) => item.value).map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                            <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[0.75rem] text-brand-text-muted font-bold">{label}</p>
                                <p className="text-[0.9rem] text-brand-text font-semibold">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Datos de contacto */}
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm">
                <h2 className="text-[0.7rem] font-black text-primary uppercase tracking-widest mb-4">Datos de Contacto</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { icon: User, label: 'Nombre', value: quote.client_name },
                        { icon: Mail, label: 'Email', value: quote.client_email },
                        { icon: Phone, label: 'Teléfono', value: quote.client_phone },
                    ].filter((item) => item.value).map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                            <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[0.75rem] text-brand-text-muted font-bold">{label}</p>
                                <p className="text-[0.9rem] text-brand-text font-semibold">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
                {quote.comments && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-brand-border">
                        <p className="text-[0.75rem] text-brand-text-muted font-bold mb-1">Comentarios</p>
                        <p className="text-[0.9rem] text-brand-text italic">&ldquo;{quote.comments}&rdquo;</p>
                    </div>
                )}
            </div>

            {/* Productos */}
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    <h2 className="text-[0.7rem] font-black text-primary uppercase tracking-widest">Productos Seleccionados</h2>
                </div>
                <div className="flex flex-col gap-3">
                    {quote.quote_items.map((item) => {
                        const hasOffer = item.price_at_time > item.offer_price_at_time;
                        return (
                            <div key={item.id} className="flex justify-between items-center py-3 border-b border-brand-border last:border-0">
                                <div>
                                    <p className="font-bold text-brand-text text-[0.95rem]">{item.product_name}</p>
                                    <p className="text-[0.8rem] text-brand-text-muted">{item.size} × {item.quantity}</p>
                                </div>
                                <div className="text-right">
                                    {hasOffer && <p className="text-[0.8rem] text-brand-text-muted line-through">{formatCurrency(item.price_at_time * item.quantity)}</p>}
                                    <p className="font-bold text-[#059669]">{formatCurrency(item.offer_price_at_time * item.quantity)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Totales */}
                <div className="mt-4 pt-4 border-t-2 border-primary space-y-1">
                    {quote.total_normal_price > quote.total_offer_price && (
                        <div className="flex justify-between text-[0.85rem] text-brand-text-muted">
                            <span>Subtotal</span><span className="line-through">{formatCurrency(quote.total_normal_price)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[0.85rem] text-brand-text-muted">
                        <span>Transporte</span>
                        <span className={quote.shipping_cost === 0 ? 'text-primary font-bold' : ''}>{quote.shipping_cost === 0 ? '¡Gratis!' : formatCurrency(quote.shipping_cost)}</span>
                    </div>
                    {quote.installation_cost > 0 && (
                        <div className="flex justify-between text-[0.85rem] text-brand-text-muted">
                            <span>{quote.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'}</span>
                            <span>{formatCurrency(quote.installation_cost)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                        <span className="font-black text-brand-text">TOTAL</span>
                        <span className="text-2xl font-black text-primary">{formatCurrency(quote.total_price)}</span>
                    </div>
                </div>
            </div>

            {/* Botón flotante en modo draft */}
            {quote.status === 'draft' && !confirmed && (
                <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full py-4 rounded-2xl bg-primary text-white font-black text-[1.05rem] shadow-[0_4px_20px_rgba(226,160,73,0.4)] hover:bg-primary-dark transition-all active:scale-95"
                >
                    ✅ Confirmar Reserva – {formatCurrency(quote.total_price)}
                </button>
            )}

            {/* Modal de confirmación */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
                    <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-black text-brand-text mb-2">Confirmar Reserva</h2>
                        <p className="text-brand-text-muted text-[0.9rem] mb-6">Al confirmar, deberás abonar el <strong>50% del total</strong> para asegurar la fecha.</p>

                        {/* Monto a pagar */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center mb-6">
                            <p className="text-amber-800 text-[0.8rem] font-bold uppercase tracking-wide">Abono para confirmar (50%)</p>
                            <p className="text-primary font-black text-3xl mt-1">{formatCurrency(halfAmount)}</p>
                            <p className="text-amber-700 text-[0.75rem] mt-1">El resto ({formatCurrency(halfAmount)}) se paga el día del montaje.</p>
                        </div>

                        {/* Datos bancarios */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-[0.85rem] space-y-1 border border-brand-border">
                            <p className="font-black text-brand-text mb-2">📲 Datos de pago</p>
                            <p><span className="text-brand-text-muted">Banco:</span> <strong>Mercado Pago</strong></p>
                            <p><span className="text-brand-text-muted">Cuenta Vista:</span> <strong>1098081647</strong></p>
                            <p><span className="text-brand-text-muted">Nombre:</span> <strong>Felipe Ramírez</strong></p>
                            <p><span className="text-brand-text-muted">RUT:</span> <strong>15.332.189-2</strong></p>
                            <p><span className="text-brand-text-muted">Email:</span> <strong>contacto@cocktailsontap.cl</strong></p>
                        </div>

                        {/* Completar datos si faltan */}
                        {!quote.client_phone && (
                            <div className="mb-4">
                                <label className="block text-[0.85rem] font-bold text-brand-text mb-1">Teléfono de contacto</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+569 XXXX XXXX"
                                    className="w-full p-3 border-2 border-brand-border rounded-xl text-[0.95rem] focus:outline-none focus:border-primary"
                                />
                            </div>
                        )}
                        {!quote.client_address && (
                            <div className="mb-4">
                                <label className="block text-[0.85rem] font-bold text-brand-text mb-1">Dirección del evento</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Calle 123, Depto 4"
                                    className="w-full p-3 border-2 border-brand-border rounded-xl text-[0.95rem] focus:outline-none focus:border-primary"
                                />
                            </div>
                        )}

                        {confirmError && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-[0.85rem]">
                                <AlertCircle className="w-4 h-4 shrink-0" />{confirmError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 rounded-xl border-2 border-brand-border text-brand-text-muted font-bold hover:border-primary hover:text-primary transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isConfirming}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isConfirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</> : '✅ Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
