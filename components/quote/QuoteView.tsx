'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatPhoneNumber } from '@/lib/utils';
import { formatEventDate, calculateMaxPickupDate, getTodayString } from '@/lib/wizardLogic';
import { confirmQuote } from '@/app/actions/confirmQuote';
import { MURO_INSTALLATION_COST } from '@/lib/config';
import {
    CheckCircle, Clock, XCircle, AlertCircle, ShoppingCart,
    Calendar, Users, MapPin, User, Mail, Phone, MessageSquare, Loader2, Lock,
    Plus, Search, ChevronRight, Tag, Info, Copy, ExternalLink, CreditCard, FileText
} from 'lucide-react';
import type { Quote, QuoteItem, Comuna, CocktailForWizard, EventType, Product, ICart } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import QuoteSummaryProducts, { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';
import QuoteSummaryReservation, { QuoteSummaryReservationData } from '@/components/quote/QuoteSummaryReservation';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
    comunas: Comuna[];
    availableCocktails: CocktailForWizard[];
    categories: string[];
    eventTypes: EventType[];
}

const STATUS_CONFIG = {
    draft: { label: 'Borrador', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
    completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
};

export default function QuoteView({ quote, comunas, availableCocktails, categories, eventTypes }: Props) {
    const router = useRouter();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Todos');

    // State para datos editables
    const [phone, setPhone] = useState(quote.client_phone ?? '');
    const [lastName, setLastName] = useState(quote.client_lastname ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [startTime, setStartTime] = useState(quote.start_time ?? '');
    const [pickupDate, setPickupDate] = useState(quote.pickup_date ?? '');
    const [pickupTime, setPickupTime] = useState(quote.pickup_time ?? '');
    const [comments, setComments] = useState(quote.comments ?? '');
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [guests, setGuests] = useState(quote.guests);
    const [eventType, setEventType] = useState(quote.event_type_id ?? (quote.event_type_other ? 'Otro' : ''));
    const [otherType, setOtherType] = useState(quote.event_type_other ?? '');
    const [items, setItems] = useState<QuoteItem[]>(quote.quote_items);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro' | 'desechable'>(quote.dispenser as any || 'portatil');

    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmed, setConfirmed] = useState(quote.status === 'confirmed');
    const [showSuccessScreen, setShowSuccessScreen] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

    const isDraft = quote.status === 'draft' && !confirmed;

    const statusCfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft;
    const StatusIcon = statusCfg.icon;

    // Bloquear scroll cuando hay modal abierto
    useEffect(() => {
        if (showCatalog || showConfirmModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showCatalog, showConfirmModal]);

    // Lógica de Muro de Coctelería
    const canHaveMuro = useMemo(() => {
        const totalLiters = items.reduce((acc, item) => acc + (getSizeLiters(item.size) * item.quantity), 0);
        const has5L = items.some(item => item.size.includes('5L') && item.quantity > 0);
        return totalLiters >= 30 && !has5L;
    }, [items]);

    // Auto-ajuste de dispensador (Solo en borrador para validación del cliente)
    useEffect(() => {
        if (isDraft && !canHaveMuro && dispenser === 'muro') {
            setDispenser('portatil');
        }
    }, [canHaveMuro, dispenser, isDraft]);

    // ─── Cálculos dinámicos ──────────────────────────────────────────────────

    const calculateTotals = () => {
        let totalNormal = 0;
        let totalOffer = 0;
        let totalLiters = 0;

        items.forEach(item => {
            totalNormal += item.price_at_time * item.quantity;
            totalOffer += item.offer_price_at_time * item.quantity;
            totalLiters += getSizeLiters(item.size) * item.quantity;
        });

        // Recalcular envío dinámicamente
        let shipping = quote.shipping_cost;
        const selectedComuna = comunas.find(c => c.name === comuna);
        
        if (selectedComuna && selectedComuna.name !== 'Otra') {
            const qualifiesForFree = selectedComuna.freeFrom !== null && totalLiters >= selectedComuna.freeFrom;
            
            if (qualifiesForFree) {
                shipping = 0;
            } else if (comuna !== quote.comuna_name) {
                // Si el usuario cambia la comuna, aplicamos el costo estándar de la nueva comuna
                shipping = selectedComuna.cost || 0;
            } else {
                // Es la misma comuna original. 
                // Si el costo en BD es 0 pero ya no califica para envío gratis, volvemos al costo base.
                // De lo contrario, respetamos el valor guardado (que puede ser un override manual del admin).
                if (quote.shipping_cost === 0 && !qualifiesForFree) {
                    shipping = selectedComuna.cost || 0;
                } else {
                    shipping = quote.shipping_cost;
                }
            }
        }

        const installationCost = dispenser === 'muro' ? MURO_INSTALLATION_COST : 0;
        const totalFinal = totalOffer + shipping + (isDraft ? installationCost : quote.installation_cost) - (quote.manual_discount || 0);
        const totalDiscount = totalNormal - totalOffer;

        return { totalNormal, totalOffer, totalFinal, totalLiters, shipping, totalDiscount, installationCost };
    };

    const totals = calculateTotals();
    const totalPaid = (quote.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const balance = totals.totalFinal - totalPaid;
    const halfAmount = totals.totalFinal / 2;
    const isSameDayPickup = pickupDate === eventDate;

    const validateAllFields = () => {
        const errors: Record<string, boolean> = {};
        
        if (phone.trim().length < 8) errors.phone = true;
        if (address.trim().length < 5) errors.address = true;
        if (!comuna || comuna === '...') errors.comuna = true;
        if (comuna === 'Otra' && !comunaOther.trim()) errors.comunaOther = true;
        if (!eventDate) errors.eventDate = true;
        if (!startTime) errors.startTime = true;
        if (!pickupDate) errors.pickupDate = true;
        if (!isSameDayPickup && !pickupTime) errors.pickupTime = true;
        if (guests <= 0) errors.guests = true;
        if (!eventType) errors.eventType = true;
        if (eventType === 'Otro' && !otherType.trim()) errors.otherType = true;
        if (!items.some(i => i.quantity > 0)) errors.items = true;

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handlePreConfirm = () => {
        const isValid = validateAllFields();
        if (isValid) {
            setAcceptedTerms(false);
            setShowConfirmModal(true);
            setConfirmError('');
        } else {
            // Scroll al primer error
            const firstErrorField = Object.keys(validationErrors)[0] || 'phone';
            const element = document.getElementById(`field-${firstErrorField}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const updateQuantity = (id: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const onSummaryUpdateQuantity = (id: string, size: string, delta: number) => {
        setItems(prev => {
            return prev.map(item => {
                if (item.id === id) {
                    return { ...item, quantity: item.quantity + delta };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const summaryData: QuoteSummaryData = useMemo(() => {
        return {
            items: items.map(i => ({
                id: i.id!, // quote item id
                name: i.product_name,
                selectedSize: i.size,
                quantity: i.quantity,
                totalNormalPrice: i.price_at_time * i.quantity,
                totalOfferPrice: i.offer_price_at_time * i.quantity
            })),
            totalLiters: totals.totalLiters,
            totalNormalPrice: totals.totalNormal,
            totalOfferPrice: totals.totalOffer,
            totalDiscount: totals.totalDiscount,
            shippingCost: totals.shipping,
            shippingLabel: comuna === 'Otra' && totals.shipping === 0 ? 'Pendiente de factibilidad' : (totals.shipping === 0 ? '¡Gratis!' : formatCurrency(totals.shipping)),
            installationCost: isDraft ? totals.installationCost : quote.installation_cost,
            dispenserLabel: dispenser === 'muro' ? 'Muro de Coctelería' : (dispenser === 'desechable' ? 'Barril Desechable' : 'Dispensador Portátil'),
            manualDiscount: quote.manual_discount || 0,
            totalPrice: totals.totalFinal,
            guests: guests,
            canHaveMuro: canHaveMuro
        };
    }, [items, totals, guests, dispenser, canHaveMuro]);

    const reservationData: QuoteSummaryReservationData = useMemo(() => {
        const fullName = `${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''}`;
        return {
            clientName: fullName,
            clientEmail: quote.client_email || '',
            clientPhone: phone,
            clientAddress: address,
            comunaDisplay: comuna === 'Otra' ? comunaOther : comuna,
            eventTypeDisplay: (otherType || eventTypes.find(t => t.id === eventType)?.name) ?? '',
            guests: guests,
            formattedDate: formatEventDate(eventDate),
            startTime: startTime,
            formattedPickupDate: pickupDate ? formatEventDate(pickupDate) : undefined,
            pickupTime: pickupTime,
            comments: comments
        };
    }, [quote.client_name, quote.client_lastname, quote.client_email, phone, address, comuna, comunaOther, eventType, otherType, eventTypes, guests, eventDate, startTime, pickupDate, pickupTime, comments]);

    // 1. Mapeamos availableCocktails a Product (para el modal)
    const mappedProducts: Product[] = useMemo(() => availableCocktails.map(c => ({
        id: c.id,
        name: c.name,
        description: c.desc,
        image: c.image,
        category: c.category,
        sizes: Object.entries(c.prices).map(([size, p]) => ({
            size,
            price: p.price,
            offerPrice: p.offerPrice
        }))
    })), [availableCocktails]);


    // 2. Definimos el cart para ProductCatalog
    const quoteCart: ICart = {
        addItem: (productId, productName, size, price, offerPrice) => {
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size);
                if (existing) {
                    return prev.map(i => (i.product_id === productId && i.size === size) ? { ...i, quantity: i.quantity + 1 } : i);
                }
                return [...prev, {
                    id: `temp-${Date.now()}`,
                    quote_id: quote.id,
                    product_id: productId,
                    product_name: productName,
                    size: size,
                    quantity: 1,
                    price_at_time: price,
                    offer_price_at_time: offerPrice
                }];
            });
        },
        removeItem: (productId, size) => {
            setItems(prev => prev.filter(i => !(i.product_id === productId && i.size === size)));
        },
        updateQuantity: (productId, size, quantity) => {
            if (quantity <= 0) {
                quoteCart.removeItem(productId, size);
                return;
            }
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size);
                if (existing) {
                    return prev.map(i => (i.product_id === productId && i.size === size) ? { ...i, quantity } : i);
                }
                // Si no existe, lo agregamos (esto puede pasar si se intenta actualizar algo que ya no está)
                const cocktail = availableCocktails.find(c => c.id === productId);
                if (!cocktail) return prev;
                const prices = cocktail.prices[size];
                if (!prices) return prev;

                return [...prev, {
                    id: `temp-${Date.now()}`,
                    quote_id: quote.id,
                    product_id: productId,
                    product_name: cocktail.name,
                    size: size,
                    quantity: quantity,
                    price_at_time: prices.price,
                    offer_price_at_time: prices.offerPrice
                }];
            });
        },
        getQuantity: (productId, size) => {
            return items.find(i => i.product_id === productId && i.size === size)?.quantity ?? 0;
        }
    };

    const handleConfirm = async () => {
        if (!validateAllFields()) return;

        setIsConfirming(true);
        setConfirmError('');
        const result = await confirmQuote({
            token: quote.token,
            client_phone: phone,
            client_lastname: lastName,
            client_address: address,
            comuna_name: comuna,
            comuna_other: comunaOther,
            guests: guests,
            event_type_id: eventType,
            event_type_other: otherType,
            event_date: eventDate,
            start_time: startTime,
            pickup_date: pickupDate,
            pickup_time: pickupTime,
            comments: comments,
            items: items,
            dispenser: dispenser,
            installation_cost: totals.installationCost
        });
        setIsConfirming(false);
        if (result.success) {
            setConfirmed(true);
            setShowSuccessScreen(true);
            setShowConfirmModal(false);
            setAcceptedTerms(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setConfirmError(result.error ?? 'Error al confirmar. Intenta nuevamente.');
        }
    };

    // ─── Filtrado de Catálogo ────────────────────────────────────────────────
    const filteredCocktails = useMemo(() => {
        return mappedProducts.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [mappedProducts, searchQuery]);

    // ─── Pantalla de éxito post-confirmación ──────────────────────────────────

    if (showSuccessScreen) {
        return (
            <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 text-green-600">
                    <CheckCircle className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-black text-brand-text mb-3 tracking-tight">¡Reserva confirmada!</h1>
                <p className="text-brand-text-muted text-[1.05rem] mb-8 max-w-md mx-auto leading-relaxed">
                    Te enviamos un email con todos los detalles y las instrucciones para el abono del 50%.
                </p>
                <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-8 max-w-sm mx-auto text-left shadow-lg overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16" />
                    <p className="text-green-800 font-black text-center mb-1 uppercase tracking-widest text-[0.7rem]">Monto a depositar (50%)</p>
                    <p className="text-green-600 font-black text-4xl text-center mb-6">{formatCurrency(halfAmount)}</p>
                    <div className="text-[0.9rem] text-green-800 space-y-2 border-t border-green-200 pt-6">
                        <p className="flex justify-between"><strong>Banco:</strong> <span>Mercado Pago</span></p>
                        <p className="flex justify-between"><strong>Cuenta Vista:</strong> <span>1098081647</span></p>
                        <p className="flex justify-between"><strong>Nombre:</strong> <span>Felipe Ramírez</span></p>
                        <p className="flex justify-between"><strong>RUT:</strong> <span>15.332.189-2</span></p>
                        <p className="flex justify-between"><strong>Email:</strong> <span>contacto@cocktailsontap.cl</span></p>
                    </div>
                    <button 
                        onClick={() => {
                            const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                            navigator.clipboard.writeText(text);
                        }}
                        className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-green-200 rounded-xl text-[0.85rem] font-black text-green-700 hover:border-green-400 hover:bg-green-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Copy className="w-4 h-4" /> Copiar Datos de Cuenta
                    </button>
                    <p className="text-[0.8rem] text-green-700 mt-4 text-center italic opacity-80 underline underline-offset-4 decoration-green-300">El 50% restante se paga el día del montaje.</p>
                </div>

                {/* Link Card de Seguimiento */}
                <div className="mt-12 max-w-lg mx-auto bg-slate-50 border border-brand-border rounded-3xl p-6 relative group text-left shadow-sm">
                    <p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Copy className="w-3 h-3" /> Tu Comprobante Digital
                    </p>
                    <div className="flex flex-col gap-3">
                        <div className="flex-1 bg-white border border-brand-border rounded-xl px-4 py-3 text-[0.85rem] font-bold text-brand-text overflow-hidden text-ellipsis whitespace-nowrap shadow-inner">
                            {typeof window !== 'undefined' ? window.location.href : ''}
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white border-2 border-brand-border text-brand-text font-black text-[0.85rem] hover:border-primary hover:text-primary transition-all active:scale-95"
                            >
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button 
                                onClick={() => {
                                    setShowSuccessScreen(false);
                                    setConfirmed(false);
                                    router.refresh();
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary text-white font-black text-[0.85rem] hover:bg-primary-dark transition-all active:scale-95 shadow-md"
                            >
                                <ExternalLink className="w-4 h-4" /> Ver Reserva
                            </button>
                        </div>
                    </div>
                    <p className="text-[0.7rem] text-brand-text-muted mt-4 italic font-medium">
                        Guarda este enlace para acceder a tu comprobante en cualquier momento.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[0.6rem] sm:text-[0.7rem] font-black border uppercase tracking-widest ${statusCfg.color}`}>
                            <StatusIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            {statusCfg.label}
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-brand-text">Cotización de {quote.client_name}{quote.client_lastname ? ` ${quote.client_lastname}` : ''}</h1>
                    <p className="text-brand-text-muted text-[0.8rem] sm:text-[0.9rem]">Creada el {new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {!isDraft && (
                    <div className="inline-flex sm:flex items-center gap-2 text-green-700 font-bold bg-green-50 px-4 py-2 rounded-xl border border-green-200 self-start sm:self-auto shadow-sm">
                        <Lock className="w-4 h-4" /> Reserva cerrada / Confirmada
                    </div>
                )}
            </div>

            {/* Banner Descriptivo */}
            <div className={`flex items-start gap-4 border rounded-2xl px-5 py-4 ${isDraft ? 'bg-primary/5 border-primary/15' : 'bg-slate-50 border-brand-border/50'}`}>
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isDraft ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-brand-text-muted'}`}>
                    {isDraft ? <Info className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                    <p className={`text-[0.8rem] font-black uppercase tracking-[0.15em] mb-1 ${isDraft ? 'text-primary' : 'text-brand-text'}`}>
                        {isDraft ? 'Revisa antes de confirmar' : 'Información de tu Reserva'}
                    </p>
                    <p className="text-brand-text-muted text-[0.875rem] leading-relaxed font-medium">
                        {isDraft ? (
                            <>Verifica los cócteles y los demas datos del evento. Todos los campos son obligatorios para asegurar tu reserva.</>
                        ) : (
                            <>Tus detalles han sido registrados exitosamente. Esta página es tu comprobante oficial del servicio. Si necesitas realizar cualquier cambio de último minuto, contáctanos directamente.</>
                        )}
                    </p>
                </div>
            </div>

            {/* Resumen de Pagos (Solo si no es Borrador) */}
            {!isDraft && (
                <div className="bg-white rounded-[1.5rem] border border-brand-border p-5 sm:p-7 shadow-sm overflow-hidden relative">
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-brand-border/50">
                        <h2 className="text-[0.65rem] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                             <Tag className="w-3.5 h-3.5" /> Estado de Cuenta
                        </h2>
                        {balance <= 0 && (
                            <span className="text-[0.6rem] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase">Pagado 👌</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-brand-border/50">
                            <p className="text-[0.6rem] font-black text-brand-text-muted uppercase tracking-widest mb-1">Total Cotizado</p>
                            <p className="text-xl font-black text-brand-text">{formatCurrency(totals.totalFinal)}</p>
                        </div>
                        <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                            <p className="text-[0.6rem] font-black text-green-700 uppercase tracking-widest mb-1">Total Pagado</p>
                            <p className="text-xl font-black text-green-600">{formatCurrency(totalPaid)}</p>
                        </div>
                        <div className={`p-5 rounded-2xl border ${balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                            <p className={`text-[0.6rem] font-black uppercase tracking-widest mb-1 ${balance > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                                {balance > 0 ? 'Saldo Pendiente' : 'Saldo en $0'}
                            </p>
                            <p className={`text-xl font-black ${balance > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                                {formatCurrency(Math.max(0, balance))}
                            </p>
                        </div>
                    </div>

                    {quote.payments && quote.payments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[0.7rem] font-black text-brand-text mb-4 uppercase tracking-widest px-1">Historial de Pagos</h3>
                            {quote.payments.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-brand-border/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-black text-xs">
                                            $
                                        </div>
                                        <div>
                                            <p className="text-[0.9rem] font-black text-brand-text">{formatCurrency(p.amount)}</p>
                                            <p className="text-[0.7rem] text-brand-text-muted font-bold">
                                                {new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL')} — {p.note}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-white border border-brand-border rounded-lg text-[0.65rem] font-black text-brand-text-muted uppercase tracking-tighter shrink-0">
                                        Recibido
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {balance > 0 && (
                        <div className="mt-8 p-6 bg-amber-50 rounded-[1.5rem] border-2 border-dashed border-amber-200 text-center">
                            <p className="text-[0.8rem] text-amber-800 font-bold mb-4">
                                Recuerda que para asegurar tu reserva debes haber abonado al menos el 50% ({formatCurrency(totals.totalFinal / 2)}).
                            </p>
                            <button 
                                onClick={() => {
                                    const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                                    navigator.clipboard.writeText(text);
                                }}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-amber-200 rounded-xl text-[0.85rem] font-black text-amber-700 hover:border-amber-400 transition-all active:scale-95 shadow-sm"
                            >
                                <Copy className="w-4 h-4" /> Copiar Datos para Transferir
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Datos de contacto y Dirección */}
            {!isDraft ? (
                <QuoteSummaryReservation data={reservationData} />
            ) : (
                <div className="bg-white rounded-[1.5rem] border border-brand-border p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-border/50">
                        <h2 className="text-[0.65rem] font-black text-primary uppercase tracking-[0.2em]">Información de Reserva</h2>
                        <span className="text-[0.6rem] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">Modo Edición</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {/* Columna 1: Datos de Contacto */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <User className="w-3 h-3" /> Nombre
                                    </label>
                                    <p className="text-[0.9rem] text-brand-text font-bold truncate">{quote.client_name}</p>
                                </div>

                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <User className="w-3 h-3" /> Apellido
                                    </label>
                                    <p className="text-[0.9rem] text-brand-text font-bold truncate">{quote.client_lastname || '--'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-0.5">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <p className="text-[0.9rem] text-brand-text font-bold truncate" title={quote.client_email || ''}>{quote.client_email}</p>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <Phone className="w-3 h-3" /> Celular <span className="text-red-500">*</span>
                                </label>
                                    <input
                                        id="field-phone"
                                        type="tel"
                                        value={phone}
                                        onFocus={(e) => {
                                            if (!e.target.value) setPhone('+569');
                                            setValidationErrors(prev => ({ ...prev, phone: false }));
                                        }}
                                        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                                        placeholder="+569-12345678"
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.phone ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
    
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                            <MapPin className="w-3 h-3" /> Comuna <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                                <select
                                                    id="field-comuna"
                                                    value={comuna}
                                                    onChange={(e) => {
                                                        setComuna(e.target.value);
                                                        setValidationErrors(prev => ({ ...prev, comuna: false }));
                                                    }}
                                                    className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10 ${validationErrors.comuna ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                                >
                                                    <option value="" disabled hidden>Seleccionar...</option>
                                                    {comunas.map((c) => (
                                                        <option key={c.name} value={c.name}>{c.name}</option>
                                                    ))}
                                                </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronRight className="w-3.5 h-3.5 text-brand-text-muted rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {comuna === 'Otra' && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[0.65rem] font-black text-brand-text-muted uppercase">Especificar Comuna</label>
                                        <input
                                            id="field-comunaOther"
                                            type="text"
                                            value={comunaOther}
                                            onChange={(e) => {
                                                setComunaOther(e.target.value);
                                                setValidationErrors(prev => ({ ...prev, comunaOther: false }));
                                            }}
                                            placeholder="¿Cuál?"
                                            className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.comunaOther ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <MapPin className="w-3 h-3" /> Dirección <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="field-address"
                                    type="text"
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setValidationErrors(prev => ({ ...prev, address: false }));
                                    }}
                                    placeholder="Calle, Número, Depto..."
                                    className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.address ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                />
                            </div>
                        </div>

                        {/* Columna 2: Detalles del Evento */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Tag className="w-3 h-3" /> Temática <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="field-eventType"
                                            value={eventType}
                                            onChange={(e) => {
                                                setEventType(e.target.value);
                                                setValidationErrors(prev => ({ ...prev, eventType: false }));
                                            }}
                                            className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10 ${validationErrors.eventType ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                        >
                                            <option value="" disabled hidden>Seleccionar...</option>
                                            {eventTypes.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronRight className="w-3.5 h-3.5 text-brand-text-muted rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Users className="w-3 h-3" /> Invitados <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="field-guests"
                                            type="number"
                                            min={0}
                                            value={guests}
                                            onChange={(e) => {
                                                setGuests(parseInt(e.target.value) || 0);
                                                setValidationErrors(prev => ({ ...prev, guests: false }));
                                            }}
                                            className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm pr-12 ${validationErrors.guests ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.7rem] text-brand-text-muted font-bold pointer-events-none">
                                            pers.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {eventType === 'Otro' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted uppercase">Especificar Evento</label>
                                    <input
                                        id="field-otherType"
                                        type="text"
                                        value={otherType}
                                        onChange={(e) => {
                                            setOtherType(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, otherType: false }));
                                        }}
                                        placeholder="Ej: Aniversario..."
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.otherType ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Calendar className="w-3 h-3" /> Fecha del Evento<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="field-eventDate"
                                        type="date"
                                        value={eventDate}
                                        min={getTodayString()}
                                        onChange={(e) => {
                                            setEventDate(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, eventDate: false }));
                                        }}
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.eventDate ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Clock className="w-3 h-3" /> Hora de Inicio <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="field-startTime"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => {
                                            setStartTime(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, startTime: false }));
                                        }}
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.startTime ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Calendar className="w-3 h-3" /> Fecha del Retiro <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="field-pickupDate"
                                        type="date"
                                        value={pickupDate}
                                        min={eventDate}
                                        max={calculateMaxPickupDate(eventDate)}
                                        onChange={(e) => {
                                            const newPickupDate = e.target.value;
                                            setPickupDate(newPickupDate);
                                            setValidationErrors(prev => ({ ...prev, pickupDate: false }));
                                            if (newPickupDate === eventDate) setPickupTime('');
                                        }}
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.pickupDate ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                                <div className={`flex flex-col gap-1 transition-all duration-300 ${isSameDayPickup ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Clock className="w-3 h-3" /> Horario Retiro <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="field-pickupTime"
                                            value={pickupTime}
                                            onChange={(e) => {
                                                setPickupTime(e.target.value);
                                                setValidationErrors(prev => ({ ...prev, pickupTime: false }));
                                            }}
                                            className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10 ${validationErrors.pickupTime ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="12:00 a 14:00">12:00 a 14:00</option>
                                            <option value="14:00 a 16:00">14:00 a 16:00</option>
                                            <option value="16:00 a 18:00">16:00 a 18:00</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronRight className="w-3.5 h-3.5 text-brand-text-muted rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-brand-border/50">
                        <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase mb-1.5">
                            <MessageSquare className="w-3 h-3" /> Comentarios
                        </label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Notas adicionales..."
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-[0.9rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm resize-none"
                        />
                    </div>
                </div>
            )}

            {/* Productos (Editables si es draft) */}
            <QuoteSummaryProducts
                data={summaryData}
                isEditable={isDraft}
                onUpdateQuantity={onSummaryUpdateQuantity}
                onAddProductsClick={() => setShowCatalog(true)}
                onToggleDispenser={() => setDispenser(prev => prev === 'muro' ? 'portatil' : 'muro')}
            />

            {/* Catálogo Modal (Full Screen Mobile) */}
            {showCatalog && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCatalog(false)}>
                    <div className="bg-white w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:zoom-in-95" onClick={e => e.stopPropagation()}>
                        {/* Handle para móvil */}
                        <div className="w-12 h-1.5 bg-slate-300/60 rounded-full mx-auto mt-4 mb-1 sm:hidden shrink-0" />
                        
                        <div className="p-4 sm:p-6 border-b border-brand-border flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-brand-text leading-tight">Añadir Cócteles</h3>
                                <p className="text-[0.7rem] sm:text-[0.8rem] text-brand-text-muted font-bold">Catálogo Cocktails On Tap</p>
                            </div>
                            <button onClick={() => setShowCatalog(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <XCircle className="w-6 h-6 text-brand-text-muted" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 bg-slate-50 border-b border-brand-border flex flex-col sm:flex-row gap-4 sm:gap-6 items-center">
                            {/* Barra de categorías (Estilo Wizard) */}
                            <div className="flex-1 w-full overflow-hidden">
                                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-[0.75rem] sm:text-[0.85rem] whitespace-nowrap transition-all duration-300 border-2 cursor-pointer
                                                ${cat === selectedCategory
                                                    ? 'bg-gradient-to-r from-primary to-primary-dark border-primary text-white shadow-md'
                                                    : 'bg-white border-brand-border text-brand-text hover:border-primary/50'
                                                }`}
                                            onClick={() => setSelectedCategory(cat)}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Buscador secundario en modal */}
                            <div className="relative w-full sm:w-64 shrink-0">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-brand-border rounded-xl focus:outline-none focus:border-primary font-bold shadow-sm text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-10">
                            <ProductCatalog
                                products={filteredCocktails}
                                activeCategory={selectedCategory}
                                cart={quoteCart}
                            />
                            {filteredCocktails.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-brand-text-muted font-bold">No se encontraron productos.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer del Modal con botón de cierre/finalizar */}
                        <div className="p-6 border-t border-brand-border bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowCatalog(false)}
                                className="px-8 py-3 bg-brand-text text-white font-black rounded-xl shadow-lg hover:bg-black transition-all transform active:scale-95"
                            >
                                Listo, volver a la cotización
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation / Confirmación - INTEGRADA AL FLUJO (UI/UX Expert) */}
            {isDraft && (
                <div className="mt-8 mb-16">
                    <div className="bg-white/60 backdrop-blur-md border-2 border-brand-border rounded-[2.5rem] p-6 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.08)] transition-all duration-500 relative overflow-hidden group">
                        {/* Decoración de fondo sutil */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />

                        <div className="text-center sm:text-left relative z-10">
                            <p className="text-[0.7rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-2 flex items-center justify-center sm:justify-start gap-2">
                                <Clock className="w-3.5 h-3.5" /> Abono para confirmar (50%)
                            </p>
                            <p className="text-4xl font-black text-brand-text tracking-tight">{formatCurrency(halfAmount)}</p>
                            <p className="text-[0.85rem] text-brand-text-muted mt-2 font-medium">
                                El monto restante se abona el día del montaje.
                            </p>
                        </div>

                        <div className="w-full sm:w-auto relative z-10">
                            <button
                                type="button"
                                onClick={handlePreConfirm}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-12 py-5 rounded-[1.25rem] bg-primary text-white font-black text-[1.1rem] sm:text-[1.15rem] shadow-[0_8px_30px_rgba(226,160,73,0.35)] hover:bg-primary-dark hover:shadow-[0_12px_40px_rgba(226,160,73,0.45)] transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 group/btn whitespace-nowrap"
                            >
                                🚀 Confirmar Reserva
                                <ChevronRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
                            </button>
                        </div>
                    </div>

                    {/* Mensaje de validación rápida si hay errores */}
                    {Object.keys(validationErrors).length > 0 && (
                        <div className="mt-4 text-center animate-fade-in">
                            <p className="text-[0.75rem] font-bold text-red-600 flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 py-2 px-4 rounded-full inline-flex mx-auto">
                                <AlertCircle className="w-3.5 h-3.5" /> Faltan campos obligatorios por completar.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de confirmación - REDISEÑADO UI/UX EXPERT */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-text/60 backdrop-blur-md" onClick={() => setShowConfirmModal(false)}>
                    <div className="bg-white rounded-[2.5rem] max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative border border-brand-border" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-amber-300" />

                        {/* Header */}
                        <div className="p-6 pb-2 sm:px-10 sm:pt-8 sm:pb-3 shrink-0">
                            <h2 className="text-2xl font-black text-brand-text mb-1 tracking-tight">Finalizar Reserva</h2>
                            <p className="text-brand-text-muted text-[0.85rem] leading-relaxed">Completa los pasos para asegurar tu fecha.</p>
                        </div>

                        {/* Contenido Scrollable Completo */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 sm:px-10 space-y-8">
                            
                            {/* 1. Datos de Transferencia (Prioridad Alta) */}
                            <div className="space-y-4">
                                <h3 className="text-[0.75rem] font-black text-brand-text flex items-center gap-2 uppercase tracking-widest">
                                    <CreditCard className="w-4 h-4 text-primary" /> 1. Datos para el Abono (50%)
                                </h3>
                                <div className="bg-slate-50 border-2 border-brand-border rounded-[1.75rem] p-6 relative group overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <CreditCard className="w-12 h-12 text-brand-text" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-b border-brand-border/50 pb-5 mb-5 font-medium">
                                        <div><p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-widest">Banco</p><p className="truncate">Mercado Pago</p></div>
                                        <div><p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-widest">Tipo</p><p>Vista</p></div>
                                        <div className="col-span-2"><p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-widest">Nº Cuenta</p><p className="text-lg font-black select-all">1098081647</p></div>
                                        <div className="col-span-2"><p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-widest">Nombre y RUT</p><p className="font-bold">Felipe Ramírez (15.332.189-2)</p></div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                                            navigator.clipboard.writeText(text);
                                        }}
                                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border-2 border-brand-border rounded-xl text-[0.85rem] font-black text-brand-text hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
                                    >
                                        <Copy className="w-4 h-4" /> Copiar Datos para Transferir
                                    </button>
                                </div>
                            </div>

                            {/* 2. Resumen del Monto */}
                            <div className="text-center py-2">
                                <p className="text-brand-text-muted text-[0.7rem] font-black uppercase tracking-[0.2em] mb-1">Monto del Abono</p>
                                <p className="text-primary font-black text-5xl tracking-tighter">{formatCurrency(halfAmount)}</p>
                            </div>

                            {/* 3. Contrato de Servicio con Scroll Propio */}
                            <div className="space-y-4">
                                <h3 className="text-[0.75rem] font-black text-brand-text flex items-center gap-2 uppercase tracking-widest">
                                    <FileText className="w-4 h-4 text-primary" /> 2. Contrato de Servicio
                                </h3>
                                <div className="bg-slate-50 border-2 border-brand-border rounded-2xl overflow-hidden shadow-inner">
                                    <div className="p-6 text-[0.85rem] text-brand-text-muted leading-relaxed bg-white/50">
                                        <div className="text-center font-black mb-6 uppercase tracking-[0.3em] border-b-2 border-brand-border/30 pb-3 text-brand-text text-[0.75rem]">CONTRATO DE SERVICIO</div>
                                        <p className="mb-4">
                                            Entre <strong>Cocktails on Tap Chile</strong>, en adelante “El Arrendador”, y don/doña: <strong>{quote.client_name} {lastName}</strong>, en adelante “El Arrendatario”, se acuerda lo siguiente:
                                        </p>
                                        <p className="font-black text-brand-text mb-2 mt-4">1. Objeto del contrato</p>
                                        <p className="mb-4">El Arrendador proporcionará al Arrendatario un servicio de cócteles listos para servir en formato autoservicio, incluyendo barriles, dispensadores y cristalería.</p>
                                        <p className="font-black text-brand-text mb-2">2. Responsabilidad por daños</p>
                                        <ul className="list-disc pl-5 mb-4 space-y-2">
                                            <li>$1.000 (mil pesos) por vaso extraviado o dañado.</li>
                                            <li>$2.000 (dos mil pesos) por copa extraviada o dañada.</li>
                                            <li>Hasta $500.000 (quinientos mil pesos) por dispensador extraviado o dañado.</li>
                                        </ul>
                                        <p className="font-black text-brand-text mb-2">3. Aceptación y Pago</p>
                                        <p className="mb-2">Se entiende aceptado al confirmar la reserva mediante el abono del <strong>50% del total</strong>.</p>
                                        <p>El saldo restante deberá ser cancelado en su totalidad al momento del montaje del equipo.</p>
                                    </div>
                                    <div className="p-4 bg-primary/5 flex items-center gap-3 border-t border-brand-border">
                                        <label className="flex items-center gap-3 cursor-pointer group w-full">
                                            <div className="relative flex items-center justify-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={acceptedTerms}
                                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                    className="peer appearance-none w-6 h-6 border-2 border-brand-border rounded-lg checked:bg-primary checked:border-primary transition-all cursor-pointer" 
                                                />
                                                <CheckCircle className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                            </div>
                                            <span className="text-[0.8rem] font-bold text-brand-text group-hover:text-primary transition-colors">He leído y acepto los términos del contrato</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Alerta de Error */}
                            {confirmError && (
                                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-100 text-red-700 rounded-2xl p-4 text-[0.85rem] font-bold animate-shake">
                                    <AlertCircle className="w-5 h-5 shrink-0" />{confirmError}
                                </div>
                            )}

                            {/* 4. Botones de Acción (Al final del scroll) */}
                            <div className="flex flex-col gap-3 pt-2 pb-10">
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isConfirming || !acceptedTerms}
                                    className="w-full py-5 rounded-[1.25rem] bg-primary text-white font-black text-[1.2rem] hover:bg-primary-dark transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(226,160,73,0.3)] active:scale-[0.98] group/btn"
                                >
                                    {isConfirming ? (
                                        <><Loader2 className="w-6 h-6 animate-spin text-white" /> Procesando...</>
                                    ) : (
                                        <>🚀 Confirmar Reserva</>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmModal(false)}
                                    className="w-full py-4 rounded-[1.25rem] border-2 border-brand-border text-brand-text-muted font-bold hover:bg-slate-50 hover:text-brand-text transition-all active:scale-[0.98]"
                                >
                                    Volver / Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function getSizeLiters(size: string): number {
    if (size.includes('30L')) return 30;
    if (size.includes('20L')) return 20;
    if (size.includes('10L')) return 10;
    if (size.includes('5L')) return 5;
    return 10;
}
