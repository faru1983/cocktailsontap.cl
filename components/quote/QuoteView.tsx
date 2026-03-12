'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatPhoneNumber } from '@/lib/utils';
import { formatEventDate, calculateMaxPickupDate, getTodayString } from '@/lib/wizardLogic';
import { confirmQuote } from '@/app/actions/confirmQuote';
import {
    CheckCircle, Clock, XCircle, AlertCircle, ShoppingCart,
    Calendar, Users, MapPin, User, Mail, Phone, MessageSquare, Loader2, Lock,
    Plus, Search, ChevronRight, Tag, Info, Copy
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
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Todos');

    // State para datos editables
    const [phone, setPhone] = useState(quote.client_phone ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [startTime, setStartTime] = useState(quote.start_time ?? '');
    const [pickupDate, setPickupDate] = useState(quote.pickup_date ?? '');
    const [pickupTime, setPickupTime] = useState(quote.pickup_time ?? '');
    const [comments, setComments] = useState(quote.comments ?? '');
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [guests, setGuests] = useState(quote.guests);
    const [eventType, setEventType] = useState(quote.event_type_id ?? '');
    const [otherType, setOtherType] = useState(quote.event_type_other ?? '');
    const [items, setItems] = useState<QuoteItem[]>(quote.quote_items);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro'>(quote.dispenser || 'portatil');

    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmed, setConfirmed] = useState(quote.status === 'confirmed');

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

    // Auto-ajuste de dispensador
    useEffect(() => {
        if (!canHaveMuro && dispenser === 'muro') {
            setDispenser('portatil');
        }
    }, [canHaveMuro, dispenser]);

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

        // Recalcular envío gratis si aplica (basado en comuna seleccionada)
        let shipping = quote.shipping_cost;
        const selectedComuna = comunas.find(c => c.name === comuna);
        if (selectedComuna && selectedComuna.freeFrom !== null) {
            if (totalLiters >= selectedComuna.freeFrom) {
                shipping = 0;
            } else {
                shipping = selectedComuna.cost || 0;
            }
        } else if (selectedComuna) {
            shipping = selectedComuna.cost || 0;
        }

        const installationCost = dispenser === 'muro' ? 50000 : 0;
        const totalFinal = totalOffer + shipping + installationCost;
        const totalDiscount = totalNormal - totalOffer;

        return { totalNormal, totalOffer, totalFinal, totalLiters, shipping, totalDiscount, installationCost };
    };

    const totals = calculateTotals();
    const halfAmount = totals.totalFinal / 2;
    const isSameDayPickup = pickupDate === eventDate;

    const canConfirm =
        phone.trim().length >= 8 &&
        address.trim().length >= 5 &&
        comuna.trim().length > 0 &&
        eventDate.trim().length > 0 &&
        startTime.trim().length > 0 &&
        pickupDate.trim().length > 0 &&
        (isSameDayPickup || pickupTime.trim().length > 0) &&
        guests >= 10 &&
        eventType.trim().length > 0 &&
        items.some(i => i.quantity > 0);

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
            shippingLabel: totals.shipping === 0 ? '¡Gratis!' : formatCurrency(totals.shipping),
            installationCost: totals.installationCost,
            dispenserLabel: dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil',
            totalPrice: totals.totalFinal,
            guests: guests
        };
    }, [items, totals, guests, dispenser]);

    const reservationData: QuoteSummaryReservationData = useMemo(() => {
        return {
            clientName: quote.client_name,
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
    }, [quote.client_name, quote.client_email, phone, address, comuna, comunaOther, eventType, otherType, eventTypes, guests, eventDate, startTime, pickupDate, pickupTime, comments]);

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
        if (!canConfirm) return;

        setIsConfirming(true);
        setConfirmError('');
        const result = await confirmQuote({
            token: quote.token,
            client_phone: phone,
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
            setShowConfirmModal(false);
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

    if (confirmed && quote.status !== 'confirmed') {
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
            </div>
        );
    }

    const isDraft = quote.status === 'draft' && !confirmed;

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
                    <h1 className="text-xl sm:text-2xl font-black text-brand-text">Cotización de {quote.client_name}</h1>
                    <p className="text-brand-text-muted text-[0.8rem] sm:text-[0.9rem]">Creada el {new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {isDraft && (
                    <button
                        type="button"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={!canConfirm}
                        className="hidden sm:inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-white font-black text-[1rem] shadow-[0_4px_20px_rgba(226,160,73,0.35)] hover:bg-primary-dark transition-all active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                    >
                        <CheckCircle className="w-5 h-5" /> Confirmar Reserva
                    </button>
                )}

                {!isDraft && (
                    <div className="inline-flex sm:flex items-center gap-2 text-green-700 font-bold bg-green-50 px-4 py-2 rounded-xl border border-green-200 self-start sm:self-auto">
                        <Lock className="w-4 h-4" /> Reserva cerrada
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
                            <>Verifica los cócteles, la fecha y la dirección del evento. Todos los campos marcados con <span className="text-red-500 font-black">*</span> son obligatorios para asegurar tu reserva.</>
                        ) : (
                            <>Tus detalles han sido registrados exitosamente. Esta página es tu comprobante oficial del servicio. Si necesitas realizar cualquier cambio de último minuto, contáctanos directamente.</>
                        )}
                    </p>
                </div>
            </div>

            {/* Productos (Editables si es draft) */}
            <QuoteSummaryProducts
                data={summaryData}
                isEditable={isDraft}
                onUpdateQuantity={onSummaryUpdateQuantity}
                onAddProductsClick={() => setShowCatalog(true)}
            />

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
                                        <Mail className="w-3 h-3" /> Email
                                    </label>
                                    <p className="text-[0.9rem] text-brand-text font-bold truncate" title={quote.client_email || ''}>{quote.client_email}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <Phone className="w-3 h-3" /> Celular <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onFocus={(e) => {
                                        if (!e.target.value) setPhone('+569');
                                    }}
                                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                                    placeholder="+569-12345678"
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <MapPin className="w-3 h-3" /> Comuna <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={comuna}
                                            onChange={(e) => setComuna(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10"
                                        >
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
                                            type="text"
                                            value={comunaOther}
                                            onChange={(e) => setComunaOther(e.target.value)}
                                            placeholder="¿Cuál?"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <MapPin className="w-3 h-3" /> Dirección <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Calle, Número, Depto..."
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Columna 2: Detalles del Evento */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Tag className="w-3 h-3" /> Evento <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={eventType}
                                            onChange={(e) => setEventType(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10"
                                        >
                                            <option value="" disabled hidden>...</option>
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
                                            type="number"
                                            min={0}
                                            value={guests}
                                            onChange={(e) => setGuests(parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm pr-12"
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
                                        type="text"
                                        value={otherType}
                                        onChange={(e) => setOtherType(e.target.value)}
                                        placeholder="Ej: Aniversario..."
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Calendar className="w-3 h-3" /> Fecha <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={eventDate}
                                        min={getTodayString()}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Clock className="w-3 h-3" /> Inicio <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Calendar className="w-3 h-3" /> Retiro <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={pickupDate}
                                        min={eventDate}
                                        max={calculateMaxPickupDate(eventDate)}
                                        onChange={(e) => {
                                            const newPickupDate = e.target.value;
                                            setPickupDate(newPickupDate);
                                            if (newPickupDate === eventDate) setPickupTime('');
                                        }}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                                <div className={`flex flex-col gap-1 transition-all duration-300 ${isSameDayPickup ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <Clock className="w-3 h-3" /> Horario Retiro <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={pickupTime}
                                            onChange={(e) => setPickupTime(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm appearance-none pr-10"
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

            {/* Barra de acción flotante (Draft) */}
            {isDraft && (
                <div className="fixed bottom-0 left-0 right-0 z-[150] bg-white/80 backdrop-blur-xl border-t border-brand-border py-3 sm:py-4 px-5 sm:px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 sm:gap-6">
                        <div className="hidden sm:block">
                            <p className="text-[0.7rem] font-black text-brand-text-muted uppercase tracking-widest leading-none mb-1">Abono del 50%</p>
                            <p className="text-xl font-black text-primary">{formatCurrency(halfAmount)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowConfirmModal(true)}
                            disabled={!canConfirm}
                            className="flex-1 py-3.5 sm:py-4 sm:flex-none sm:px-12 rounded-2xl bg-primary text-white font-black text-[1rem] sm:text-[1.1rem] shadow-[0_4px_25px_rgba(226,160,73,0.45)] hover:bg-primary-dark transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
                        >
                            🚀 Confirmar Reserva
                        </button>
                    </div>
                </div>
            )}

            {/* Padding extra para la barra flotante */}
            {isDraft && <div className="h-32" />}

            {/* Modal de confirmación */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowConfirmModal(false)}>
                    <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-amber-300" />

                        <h2 className="text-2xl font-black text-brand-text mb-2 tracking-tight">Finalizar Reserva</h2>
                        <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Para asegurar tu fecha, no olvides realizar un abono del <strong>50%</strong>.</p>

                        {/* Monto a pagar destacada */}
                        <div className="bg-amber-50 border-2 border-amber-100 rounded-[2rem] p-8 text-center mb-8 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <p className="text-amber-800 text-[0.75rem] font-black uppercase tracking-[0.2em] mb-2">Abono para confirmar (50%)</p>
                            <p className="text-primary font-black text-5xl mt-1 tracking-tighter">{formatCurrency(halfAmount)}</p>
                            <div className="mt-4 inline-flex items-center gap-2 bg-amber-200/40 px-4 py-1.5 rounded-full text-[0.8rem] text-amber-900 font-bold">
                                <Clock className="w-3.5 h-3.5" /> Saldo restante el día del evento
                            </div>
                        </div>

                        {/* Datos bancarios comprimidos */}
                        <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-[0.9rem] border border-brand-border space-y-4 relative group overflow-hidden">
                            <p className="font-black text-brand-text flex items-center gap-2">
                                <span className="p-1 bg-brand-text text-white rounded-md uppercase text-[0.6rem] tracking-widest">Pago</span> Datos de Transferencia
                            </p>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-b border-brand-border/50 pb-4">
                                <div><p className="text-[0.7rem] font-bold text-brand-text-muted uppercase">Banco</p><p className="font-bold">Mercado Pago</p></div>
                                <div><p className="text-[0.7rem] font-bold text-brand-text-muted uppercase">Tipo Cuenta</p><p className="font-bold">Vista</p></div>
                                <div className="col-span-2"><p className="text-[0.7rem] font-bold text-brand-text-muted uppercase">Nº Cuenta</p><p className="font-bold text-lg select-all">1098081647</p></div>
                                <div className="col-span-2"><p className="text-[0.7rem] font-bold text-brand-text-muted uppercase">Nombre y RUT</p><p className="font-bold">Felipe Ramírez (15.332.189-2)</p></div>
                            </div>
                            <button 
                                onClick={() => {
                                    const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                                    navigator.clipboard.writeText(text);
                                }}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-brand-border rounded-xl text-[0.8rem] font-bold text-brand-text hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
                            >
                                <Copy className="w-4 h-4" /> Copiar Datos para Transferir
                            </button>
                        </div>

                        {confirmError && (
                            <div className="flex items-center gap-3 bg-red-50 border-2 border-red-100 text-red-700 rounded-2xl p-4 mb-6 text-[0.9rem] font-bold animate-shake">
                                <AlertCircle className="w-5 h-5 shrink-0" />{confirmError}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="order-2 sm:order-1 flex-1 py-4 rounded-2xl border-2 border-brand-border text-brand-text-muted font-bold hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isConfirming || !canConfirm}
                                className="order-1 sm:order-2 flex-[2] py-4 rounded-2xl bg-primary text-white font-black text-[1.1rem] hover:bg-primary-dark transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 shadow-lg active:scale-95"
                            >
                                {isConfirming ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : '🚀 Confirmar Ahora'}
                            </button>
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
