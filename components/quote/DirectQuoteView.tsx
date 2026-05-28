'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, formatPhoneNumber, copyToClipboard } from '@/lib/utils';
import { formatEventDate, getTodayString, getMinDateString, getSizeLiters } from '@/lib/wizardLogic';
import { confirmQuote } from '@/app/actions/confirmQuote';
import {
    CheckCircle, Clock, XCircle, AlertCircle, ShoppingCart,
    Calendar, MapPin, User, Mail, Phone, MessageSquare, Loader2, Lock,
    Plus, Search, ChevronRight, Tag, Info, Copy, ExternalLink, CreditCard, FileText
} from 'lucide-react';
import * as fp from '@/lib/fpixel';
import type { Quote, QuoteItem, Comuna, CocktailForWizard, EventType, Product, ICart } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import QuoteSummaryProducts, { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';
import QuoteSummaryReservation, { QuoteSummaryReservationData } from '@/components/quote/QuoteSummaryReservation';
import { buildWhatsAppMessage } from '@/lib/wizardLogic';
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/lib/config';
import { WhatsappIcon } from '@/components/shared/icons';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
    comunas: Comuna[];
    availableCocktails: CocktailForWizard[];
    categories: string[];
    eventTypes: EventType[];
    isNew?: boolean;
}

const STATUS_CONFIG = {
    draft: { label: 'Borrador', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
    completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
};

export default function DirectQuoteView({ quote, comunas, availableCocktails, categories, eventTypes, isNew }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isConfirmedParam = searchParams.get('confirmed') === 'true';

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessScreen, setShowSuccessScreen] = useState(isConfirmedParam);
    const [showCatalog, setShowCatalog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Todos');

    // State para datos editables (Simplificado para Venta Directa)
    const [phone, setPhone] = useState(quote.client_phone ?? '');
    const [lastName, setLastName] = useState(quote.client_lastname ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [comments, setComments] = useState(quote.comments ?? '');
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [items, setItems] = useState<QuoteItem[]>(quote.quote_items);

    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmed, setConfirmed] = useState(quote.status === 'confirmed');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
    const [clientUrl, setClientUrl] = useState('');

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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setClientUrl(`${window.location.origin}${window.location.pathname}`);
        }
    }, [quote.token]);

    // Sync success screen state when navigating back/forward
    useEffect(() => {
        setShowSuccessScreen(isConfirmedParam);
    }, [isConfirmedParam]);

    // ─── Meta Pixel: Registro de Venta Directa (Confirmada) ───────────────────
    useEffect(() => {
        if (isNew) {
            const totals = calculateTotals();
            fp.event('Purchase', {
                content_name: 'Pedido de Barril Desechable',
                content_category: 'Venta Directa',
                value: totals.totalFinal,
                currency: 'CLP',
                contents: items.map(item => ({
                    id: item.product_id,
                    item_price: item.offer_price_at_time,
                    quantity: item.quantity
                })),
                content_type: 'product',
                order_id: quote.token
            }, {
                em: quote.client_email || undefined,
                ph: phone || undefined,
                fn: quote.client_name || undefined,
                ln: lastName || undefined
            });
        }
    }, [isNew]);

    // ─── Cálculos dinámicos ──────────────────────────────────────────────────

    const calculateTotals = () => {
        let totalNormal = 0;
        let totalOffer = 0;
        let totalLiters = 0;

        items.forEach(item => {
            totalNormal += item.price_at_time * item.quantity;
            totalOffer += item.offer_price_at_time * item.quantity;
            // Buscar el cocktail y el precio estructurado para obtener la unidad real
            const cocktail = availableCocktails.find(c => c.id === item.product_id);
            const priceData = cocktail?.prices[item.size];

            if (priceData && priceData.unit === 'L' && cocktail?.category !== 'Otros') {
                totalLiters += priceData.sizeValue * item.quantity;
            } else if (!priceData) {
                // Si no hay datos estructurados, usamos el fallback (y filtramos si es Otros por nombre si es posible)
                const sizeStr = (item.size || '').toLowerCase();
                if (!sizeStr.match(/kg|und|un|g\b/i) && cocktail?.category !== 'Otros') {
                    if (item.size_value && sizeStr.includes('l')) {
                        totalLiters += item.size_value * item.quantity;
                    } else {
                        totalLiters += getSizeLiters(item.size) * item.quantity;
                    }
                }
            }
        });

        // Recalcular envío dinámicamente
        let shipping = quote.shipping_cost;
        const selectedComuna = comunas.find(c => c.name === comuna);
        
        if (selectedComuna && selectedComuna.name !== 'Otra') {
            if (comuna !== quote.comuna_name) {
                shipping = selectedComuna.directSaleDeliveryCost ?? 5000;
            } else {
                // En venta directa no hay envío gratis, si el costo guardado es 0 
                // lo restauramos al costo de la comuna o al default.
                shipping = quote.shipping_cost || (selectedComuna.directSaleDeliveryCost ?? 5000);
            }
        }

        const totalFinal = totalOffer + shipping - (quote.manual_discount || 0);
        const totalDiscount = totalNormal - totalOffer;
        const totalCocktails = totalLiters * 5;

        return { totalNormal, totalOffer, totalFinal, totalLiters, totalCocktails, shipping, totalDiscount };
    };

    const totals = calculateTotals();
    const totalPaid = (quote.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const advanceAmount = totals.totalFinal; // Siempre 100%
    const advancePercentText = '100%';

    const validateAllFields = () => {
        const errors: Record<string, boolean> = {};
        
        if (phone.trim().length < 8) errors.phone = true;
        if (lastName.trim().length < 2) errors.lastName = true;
        if (address.trim().length < 5) errors.address = true;
        if (!comuna || comuna === '...') errors.comuna = true;
        if (comuna === 'Otra' && !comunaOther.trim()) errors.comunaOther = true;
        if (!eventDate) errors.eventDate = true;
        
        // Validar que haya al menos un producto
        if (!items.some(i => i.quantity > 0)) {
            errors.items = true;
        } else {
            // Validar que al menos uno sea un cóctel (no de la categoría "Otros")
            const hasCocktail = items.some(i => {
                const product = availableCocktails.find(p => p.id === i.product_id);
                return product && product.category !== 'Otros';
            });
            if (!hasCocktail) {
                errors.noCocktail = true;
            }
        }

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
            if (validationErrors.noCocktail) {
                setConfirmError('Para realizar un despacho, debes incluir al menos un cóctel en tu pedido (no solo complementos).');
                const productsSection = document.getElementById('products-summary-section');
                if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
                return;
            }
            const firstErrorField = Object.keys(validationErrors)[0] || 'phone';
            const element = document.getElementById(`field-${firstErrorField}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const onSummaryUpdateQuantity = (id: string, size: string, delta: number) => {
        setItems(prev => {
            const newItems = prev.map(item => {
                if (item.id === id) return { ...item, quantity: item.quantity + delta };
                return item;
            }).filter(item => item.quantity > 0);
            
            // Limpiar errores de validación al modificar carrito
            setValidationErrors(prev => ({ ...prev, items: false, noCocktail: false }));
            return newItems;
        });
    };

    const summaryData: QuoteSummaryData = useMemo(() => {
        return {
            items: items.map(i => ({
                id: i.id!,
                name: i.product_name,
                selectedSize: i.size,
                quantity: i.quantity,
                totalNormalPrice: i.price_at_time * i.quantity,
                totalOfferPrice: i.offer_price_at_time * i.quantity
            })),
            totalLiters: totals.totalLiters,
            totalCocktails: totals.totalCocktails,
            totalNormalPrice: totals.totalNormal,
            totalOfferPrice: totals.totalOffer,
            totalDiscount: totals.totalDiscount,
            shippingCost: totals.shipping,
            shippingLabel: comuna === 'Otra' && totals.shipping === 0 ? 'Pendiente de factibilidad' : (totals.shipping === 0 ? '¡Gratis!' : formatCurrency(totals.shipping)),
            installationCost: 0,
            dispenserLabel: 'Barril Desechable',
            manualDiscount: quote.manual_discount || 0,
            totalPrice: totals.totalFinal,
            guests: 0, // No aplica
            canHaveMuro: false
        };
    }, [items, totals, comuna]);

    const reservationData: QuoteSummaryReservationData = useMemo(() => {
        const fullName = `${quote.client_name}${lastName ? ' ' + lastName : ''}`;
        return {
            clientName: fullName,
            clientEmail: quote.client_email || '',
            clientPhone: phone,
            clientAddress: address,
            comunaDisplay: comuna === 'Otra' ? comunaOther : comuna,
            eventTypeDisplay: 'Venta Directa',
            guests: 0,
            formattedDate: formatEventDate(eventDate),
            startTime: '',
            formattedPickupDate: undefined,
            pickupTime: '',
            comments: comments,
            isDirect: true
        };
    }, [quote.client_name, lastName, quote.client_email, phone, address, comuna, comunaOther, eventDate, comments]);

    const mappedProducts: Product[] = useMemo(() => availableCocktails.map(c => ({
        id: c.id,
        name: c.name,
        description: c.desc,
        image: c.image,
        category: c.category,
        sizes: Object.entries(c.prices)
            .filter(([size]) => size.includes('desechable') || c.category === 'Otros') // Desechables o complementos
            .map(([size, p]) => ({
                size,
                price: p.price,
                offerPrice: p.offerPrice,
                sizeValue: p.sizeValue,
                unitId: p.unitId,
                isDisposable: p.isDisposable,
                unit: p.unit,
                image: p.image
            }))
    })).filter(p => p.sizes.length > 0), [availableCocktails]);

    const quoteCart: ICart = {
        addItem: (productId, productName, size, price, offerPrice, sizeValue, unitId, isDisposable, image) => {
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size);
                if (existing) return prev.map(i => (i.product_id === productId && i.size === size) ? { ...i, quantity: i.quantity + 1 } : i);
                return [...prev, {
                    id: `temp-${Date.now()}`,
                    quote_id: quote.id,
                    product_id: productId,
                    product_name: productName,
                    size: size,
                    size_value: sizeValue,
                    unit_id: unitId,
                    is_disposable: isDisposable,
                    quantity: 1,
                    price_at_time: price,
                    offer_price_at_time: offerPrice
                }];
            });
        },
        removeItem: (productId, size) => setItems(prev => prev.filter(i => !(i.product_id === productId && i.size === size))),
        updateQuantity: (productId, size, quantity) => {
            if (quantity <= 0) { quoteCart.removeItem(productId, size); return; }
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size);
                if (existing) return prev.map(i => (i.product_id === productId && i.size === size) ? { ...i, quantity } : i);
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
                    size_value: prices.sizeValue,
                    unit_id: prices.unitId,
                    is_disposable: prices.isDisposable,
                    quantity: quantity,
                    price_at_time: prices.price,
                    offer_price_at_time: prices.offerPrice
                }];
            });
        },
        getQuantity: (productId, size) => items.find(i => i.product_id === productId && i.size === size)?.quantity ?? 0
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
            guests: 0,
            event_type_id: null as any,
            event_type_other: '',
            event_date: eventDate,
            start_time: '',
            pickup_date: null as any,
            pickup_time: '',
            comments: comments,
            items: items,
            dispenser: 'desechable',
            installation_cost: 0
        });
        setIsConfirming(false);
        if (result.success) {
            router.replace(`/cotizar/${quote.token}?confirmed=true`);
            setShowSuccessScreen(true);
            setConfirmed(true);
            setShowConfirmModal(false);
            setAcceptedTerms(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                router.refresh();
            }, 150);

            // ─── Meta Pixel: Registro de Pedido Confirmado ───────────────────
            fp.event('Purchase', {
                content_name: 'Pedido de Barril Desechable (Confirmado)',
                content_category: 'Venta Directa',
                value: totals.totalFinal,
                currency: 'CLP',
                contents: items.map(item => ({
                    id: item.product_id,
                    item_price: item.offer_price_at_time,
                    quantity: item.quantity
                })),
                content_type: 'product',
                order_id: quote.token
            }, {
                em: quote.client_email || undefined,
                ph: phone || undefined,
                fn: quote.client_name || undefined,
                ln: lastName || undefined
            });
        } else {
            setConfirmError(result.error ?? 'Error al confirmar. Intenta nuevamente.');
        }
    };

    const filteredCocktails = useMemo(() => {
        return mappedProducts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [mappedProducts, searchQuery]);

    if (showSuccessScreen || isNew) {
        const title = isNew ? "¡Pedido recibido!" : "¡Pedido confirmado!";
        const subtitle = isNew 
            ? "Hemos registrado tu pedido correctamente. El resumen ha sido enviado a tu email y a nuestro equipo."
            : "Te enviamos un email con todos los detalles y las instrucciones para el pago.";

        return (
            <div className="text-center py-8 sm:py-16 animate-fade-in px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full mb-4 sm:mb-6 text-green-600">
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-brand-text mb-2 sm:mb-3 tracking-tight">{title}</h1>
                <p className="text-brand-text-muted text-[0.95rem] sm:text-[1.05rem] mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-2">
                    {subtitle}
                </p>
                <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-4 sm:p-8 max-w-sm mx-auto text-left shadow-lg overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16" />
                    <p className="text-green-800 font-black text-center mb-1 uppercase tracking-widest text-[0.65rem] sm:text-[0.7rem]">Monto a depositar (100%)</p>
                    <p className="text-green-600 font-black text-3xl sm:text-4xl text-center mb-6">{formatCurrency(advanceAmount)}</p>
                    <div className="text-xs sm:text-[0.9rem] text-green-800 space-y-2 border-t border-green-200 pt-4 sm:pt-6">
                        <p className="flex flex-row justify-between gap-2"><strong>Banco:</strong> <span>Mercado Pago</span></p>
                        <p className="flex flex-row justify-between gap-2"><strong>Cuenta Vista:</strong> <span>1098081647</span></p>
                        <p className="flex flex-row justify-between gap-2"><strong>Nombre:</strong> <span>Felipe Ramírez</span></p>
                        <p className="flex flex-row justify-between gap-2"><strong>RUT:</strong> <span>15.332.189-2</span></p>
                        <p className="flex flex-row justify-between gap-2"><strong>Email:</strong> <span className="break-all text-[0.7rem] sm:text-xs">contacto@cocktailsontap.cl</span></p>
                    </div>
                    <button 
                        onClick={() => {
                            const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                            copyToClipboard(text);
                        }}
                        className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-green-200 rounded-xl text-[0.85rem] font-black text-green-700 hover:border-green-400 hover:bg-green-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Copy className="w-4 h-4" /> Copiar Datos de Cuenta
                    </button>
                    <div className="mt-4 pt-3 border-t border-green-200/60 flex flex-col items-center gap-2">
                        <p className="text-[0.7rem] sm:text-[0.8rem] text-green-700 text-center italic font-bold leading-tight">
                            Envía tu comprobante por WhatsApp o Email para validar tu pedido:
                        </p>
                        <a 
                            href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hola, adjunto el comprobante de transferencia para mi pedido: ${clientUrl}`)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#128c7e] text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm no-underline text-center"
                        >
                            <WhatsappIcon className="w-3.5 h-3.5 fill-white" /> Enviar Comprobante
                        </a>
                    </div>
                </div>

                {/* Link Card de Seguimiento */}
                <div className="mt-12 max-w-lg mx-auto bg-slate-50 border border-brand-border rounded-3xl p-4 sm:p-6 relative group text-left shadow-sm w-full overflow-hidden">
                    <p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Copy className="w-3 h-3" /> Tu Comprobante Digital
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <div className="flex-1 w-full min-w-0">
                            <div className="bg-white border border-brand-border rounded-xl px-4 py-3 text-[0.85rem] font-bold text-brand-text overflow-hidden text-ellipsis whitespace-nowrap shadow-inner">
                                {clientUrl}
                            </div>
                        </div>
                        <div className="flex items-stretch sm:items-center gap-2 w-full">
                            <button 
                                onClick={() => {
                                    copyToClipboard(clientUrl);
                                }}
                                className="flex-1 shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white border-2 border-brand-border text-brand-text font-black text-[0.85rem] hover:border-primary hover:text-primary transition-all active:scale-95"
                            >
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button 
                                onClick={() => {
                                    setShowSuccessScreen(false);
                                    setConfirmed(false);
                                    router.push(`/cotizar/${quote.token}`);
                                }}
                                className="flex-1 shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary text-white font-black text-[0.85rem] hover:bg-primary-dark transition-all active:scale-95 shadow-md"
                            >
                                <ExternalLink className="w-4 h-4" /> Ver Pedido
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

    const balance = totals.totalFinal - totalPaid;

    return (
        <div className="w-full flex flex-col gap-4 sm:gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[0.6rem] sm:text-[0.7rem] font-black border uppercase tracking-widest ${statusCfg.color}`}>
                            <StatusIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            {statusCfg.label}
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-brand-text">Pedido de {quote.client_name}{lastName ? ` ${lastName}` : ''}</h1>
                    <p className="text-brand-text-muted text-[0.8rem] sm:text-[0.9rem]">Creado el {new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {!isDraft && (
                    <div className="inline-flex sm:flex items-center gap-2 text-green-700 font-bold bg-green-50 px-4 py-2 rounded-xl border border-green-200 self-start sm:self-auto shadow-sm">
                        <Lock className="w-4 h-4" /> Venta Cerrada / Confirmada
                    </div>
                )}
            </div>



            <div className={`flex items-start gap-4 border rounded-2xl px-5 py-4 ${isDraft ? 'bg-primary/5 border-primary/15' : 'bg-slate-50 border-brand-border/50'}`}>
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isDraft ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-brand-text-muted'}`}>
                    {isDraft ? <Info className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                    <p className={`text-[0.8rem] font-black uppercase tracking-[0.15em] mb-1 ${isDraft ? 'text-primary' : 'text-brand-text'}`}>
                        {isDraft ? 'Revisa tus datos' : 'Información de tu Pedido'}
                    </p>
                    <p className="text-brand-text-muted text-[0.875rem] leading-relaxed font-medium">
                        {isDraft ? (
                            <>Verifica los productos y la dirección de entrega. Confirma para asegurar tu disponibilidad.</>
                        ) : (
                            <>Tu pedido ha sido confirmado exitosamente. Esta página es tu comprobante oficial.</>
                        )}
                    </p>
                </div>
            </div>

            {/* Resumen de Pagos (Solo si no es Borrador) - ESTILO PREMIUM IGUAL A EVENTQUOTEVEW */}
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
                            <p className="text-[0.6rem] font-black text-brand-text-muted uppercase tracking-widest mb-1">Total Pedido</p>
                            <p className="text-xl font-black text-brand-text">{formatCurrency(summaryData.totalPrice)}</p>
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
                            <h3 className="text-[0.7rem] font-black text-brand-text mb-4 uppercase tracking-widest px-1">Historial de Transacciones</h3>
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
                            <p className="text-[0.85rem] text-amber-800 font-bold mb-4">
                                Si aún no realizas tu transferencia, recuerda que el monto total pendiente es de <strong>{formatCurrency(balance)}</strong>.
                            </p>
                            <button 
                                onClick={() => {
                                    const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                                    copyToClipboard(text);
                                }}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-amber-200 rounded-xl text-[0.85rem] font-black text-amber-700 hover:border-amber-400 transition-all active:scale-95 shadow-sm"
                            >
                                <Copy className="w-4 h-4" /> Copiar Datos para Transferir
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!isDraft ? (
                <QuoteSummaryReservation data={reservationData} />
            ) : (
                <div className="bg-white rounded-[1.5rem] border border-brand-border p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-border/50">
                        <h2 className="text-[0.65rem] font-black text-primary uppercase tracking-[0.2em]">Detalles de Entrega</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><User className="w-3 h-3" /> Nombre</label>
                                    <p className="text-[0.9rem] text-brand-text font-bold truncate">{quote.client_name}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <User className="w-3 h-3" /> Apellido
                                    </label>
                                    <p id="field-lastName" className="text-[0.9rem] text-brand-text font-bold truncate">{lastName}</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><Mail className="w-3 h-3" /> Email</label>
                                <p className="text-[0.9rem] text-brand-text font-bold truncate">{quote.client_email}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><Phone className="w-3 h-3" /> Celular <span className="text-red-500">*</span></label>
                                <input id="field-phone" type="tel" value={phone} onFocus={(e) => { if (!e.target.value) setPhone('+569'); setValidationErrors(prev => ({ ...prev, phone: false })); }} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} placeholder="+569-12345678" className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary shadow-sm ${validationErrors.phone ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><Calendar className="w-3 h-3" /> Fecha de Entrega <span className="text-red-500">*</span></label>
                                <input id="field-eventDate" type="date" value={eventDate} min={getMinDateString(2)} onChange={(e) => { setEventDate(e.target.value); setValidationErrors(prev => ({ ...prev, eventDate: false })); }} className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary shadow-sm ${validationErrors.eventDate ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><MapPin className="w-3 h-3" /> Comuna <span className="text-red-500">*</span></label>
                                <select id="field-comuna" value={comuna} onChange={(e) => { setComuna(e.target.value); setValidationErrors(prev => ({ ...prev, comuna: false })); }} className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary shadow-sm appearance-none pr-10 ${validationErrors.comuna ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`} >
                                    <option value="" disabled hidden>Seleccionar...</option>
                                    {comunas.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
                                </select>
                            </div>
                            {comuna === 'Otra' && (
                                <input id="field-comunaOther" type="text" value={comunaOther} onChange={(e) => setComunaOther(e.target.value)} placeholder="¿Cuál?" className="w-full px-3 py-2.5 bg-slate-50 border border-brand-border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary shadow-sm" />
                            )}
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><MapPin className="w-3 h-3" /> Dirección <span className="text-red-500">*</span></label>
                                <input id="field-address" type="text" value={address} onChange={(e) => { setAddress(e.target.value); setValidationErrors(prev => ({ ...prev, address: false })); }} placeholder="Calle, Número, Depto..." className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary shadow-sm ${validationErrors.address ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <QuoteSummaryProducts
                data={summaryData}
                isEditable={isDraft}
                onUpdateQuantity={onSummaryUpdateQuantity}
                onAddProductsClick={() => setShowCatalog(true)}
            />



            {showCatalog && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCatalog(false)}>
                    <div className="bg-white w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-brand-border flex items-center justify-between">
                            <div><h3 className="text-lg font-black text-brand-text">Añadir Cócteles</h3></div>
                            <button onClick={() => setShowCatalog(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-6 h-6 text-brand-text-muted" /></button>
                        </div>
                        <div className="p-4 bg-slate-50 flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex-1 overflow-x-auto pb-1 hide-scrollbar">
                                <div className="flex gap-2">
                                    {categories.map((cat) => (
                                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full font-bold text-[0.75rem] border-2 ${cat === selectedCategory ? 'bg-primary border-primary text-white' : 'bg-white border-brand-border text-brand-text'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                                <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2 border border-brand-border rounded-xl font-bold text-sm shadow-sm" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6"><ProductCatalog products={filteredCocktails} activeCategory={selectedCategory} cart={quoteCart} /></div>
                        <div className="p-6 border-t border-brand-border bg-slate-50 flex justify-end">
                            <button onClick={() => setShowCatalog(false)} className="px-8 py-3 bg-brand-text text-white font-black rounded-xl">Listo</button>
                        </div>
                    </div>
                </div>
            )}

            {isDraft && (
                <div className="mt-8 mb-16 px-4">
                    <div className="bg-white border-2 border-brand-border rounded-[2.5rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-8 shadow-sm">
                        <div className="text-center sm:text-left">
                            <p className="text-[0.7rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Pago total solicitado</p>
                            <p className="text-4xl font-black text-brand-text tracking-tight">{formatCurrency(advanceAmount)}</p>
                        </div>
                        <button onClick={handlePreConfirm} className="w-full sm:w-auto px-12 py-5 rounded-[1.25rem] bg-primary text-white font-black text-[1.1rem] shadow-lg hover:bg-primary-dark transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                            🚀 Confirmar Pedido <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    {Object.keys(validationErrors).length > 0 && <p className="mt-4 text-center text-[0.75rem] font-bold text-red-600">Faltan campos obligatorios.</p>}
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-text/60 backdrop-blur-md" onClick={() => setShowConfirmModal(false)}>
                    <div className="bg-white rounded-[2.5rem] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
                        <div className="p-10 space-y-8 overflow-y-auto">
                            <h2 className="text-2xl font-black">Finalizar Pedido</h2>
                            <div className="bg-slate-50 border-2 border-brand-border rounded-[1.75rem] p-6 space-y-4">
                                <h3 className="text-[0.75rem] font-black flex items-center gap-2 uppercase tracking-widest"><CreditCard className="w-4 h-4 text-primary" /> Datos para el Pago (100%)</h3>
                                <div className="text-[0.9rem] space-y-2 border-t border-brand-border/50 pt-4">
                                    <p><strong>Banco:</strong> Mercado Pago</p>
                                    <p><strong>Nº Cuenta:</strong> 1098081647 (Vista)</p>
                                    <p><strong>RUT:</strong> 15.332.189-2 (Felipe Ramírez)</p>
                                </div>
                                <button onClick={() => {
                                    const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
                                    navigator.clipboard.writeText(text);
                                }} className="w-full py-3 bg-white border-2 border-brand-border rounded-xl font-black text-[0.8rem] hover:border-primary">Copiar Datos</button>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[0.75rem] font-black uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Términos de Despacho</h3>
                                <div className="bg-slate-50 border-2 border-brand-border rounded-2xl p-6 text-[0.85rem] text-brand-text-muted leading-relaxed">
                                    <p className="font-black mb-4 uppercase tracking-widest text-center border-b pb-2">Términos de Compra Directa</p>
                                    <p className="mb-4">El despacho se realizará en la fecha seleccionada. Nos pondremos en contacto contigo para coordinar el horario de llegada.</p>
                                    <p className="mb-4">El pago íntegro (100%) es necesario para confirmar y agendar la preparación de tus cócteles.</p>
                                    <p>El formato 5L es desechable e incluye válvula dispensadora; no requiere equipo retornable.</p>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="w-6 h-6 border-2 border-brand-border rounded-lg" />
                                    <span className="text-[0.8rem] font-bold">Acepto los términos de despacho</span>
                                </label>
                            </div>
                            {confirmError && <div className="text-red-700 font-bold bg-red-50 p-4 rounded-xl text-center text-sm">{confirmError}</div>}
                            <div className="flex flex-col gap-3">
                                <button onClick={handleConfirm} disabled={isConfirming || !acceptedTerms} className="w-full py-5 rounded-[1.25rem] bg-primary text-white font-black text-[1.2rem] disabled:opacity-50">{isConfirming ? 'Procesando...' : '🚀 Confirmar Pedido'}</button>
                                <button onClick={() => setShowConfirmModal(false)} className="w-full py-4 text-brand-text-muted font-bold">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
