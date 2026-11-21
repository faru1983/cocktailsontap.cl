'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, copyToClipboard, normalizeEmail, normalizePersonName } from '@/lib/utils';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { isValidPhoneE164, normalizePhoneE164 } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import { formatEventDate, getSizeLiters, resolveShipping, DIRECT_SALE_MIN_DISPATCH_OFFSET_DAYS, validateDirectSaleDate } from '@/lib/wizardLogic';
import { getDirectSaleDateFieldCopy } from '@/lib/blueExpress';
import { confirmQuote } from '@/app/actions/confirmQuote';
import { useDraftQuoteAutoSave } from '@/hooks/useDraftQuoteAutoSave';
import DraftSaveBadge from '@/components/quote/DraftSaveBadge';
import {
    CheckCircle, Clock, XCircle, AlertCircle, ShoppingCart,
    Calendar, MapPin, User, Mail, Phone, MessageSquare, Loader2, Lock,
    Plus, Search, ChevronRight, Tag, Info, Copy, ExternalLink, FileText
} from 'lucide-react';
import * as fp from '@/lib/fpixel';
import { getClientMetaAttribution } from '@/lib/attribution';
import type { Quote, QuoteItem, Comuna, Region, CocktailForWizard, EventType, Product, ICart, UpdateDraftQuoteInput } from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import { formatQuoteAddress } from '@/lib/geo';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import QuoteSummaryProducts, { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';
import QuoteSummaryReservation, { QuoteSummaryReservationData } from '@/components/quote/QuoteSummaryReservation';
import BankTransferCard from '@/components/quote/BankTransferCard';
import { WHATSAPP_URL } from '@/lib/config';
import { resolveDispatchTrackingUrl, sumQuotePayments } from '@/lib/directSaleFulfillment';
import { WhatsappIcon } from '@/components/shared/icons';
import { STATUS_CONFIG } from './quoteStatusConfig';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
    comunas: Comuna[];
    regions: Region[];
    availableCocktails: CocktailForWizard[];
    categories: string[];
    eventTypes: EventType[];
    isNew?: boolean;
}

export default function DirectQuoteView({ quote, comunas, regions, availableCocktails, categories, eventTypes, isNew }: Props) {
    const initialRegionCode = (() => {
        if (quote.region_name) {
            const byName = regions.find((r) => r.name === quote.region_name || r.shortName === quote.region_name);
            if (byName) return byName.code;
        }
        return comunas.find((c) => c.name === quote.comuna_name)?.regionCode || DEFAULT_REGION_CODE;
    })();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isConfirmedParam = searchParams.get('confirmed') === 'true';

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessScreen, setShowSuccessScreen] = useState(isConfirmedParam);
    const [showCatalog, setShowCatalog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Todos');

    // State para datos editables (Simplificado para Venta Directa)
    const [firstName, setFirstName] = useState(quote.client_name ?? '');
    const [lastName, setLastName] = useState(quote.client_lastname ?? '');
    const [email, setEmail] = useState(quote.client_email ?? '');
    const [phone, setPhone] = useState(() => normalizePhoneE164(quote.client_phone ?? '') ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [comments, setComments] = useState(quote.comments ?? '');
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [regionCode, setRegionCode] = useState(initialRegionCode);
    const [items, setItems] = useState<QuoteItem[]>(quote.quote_items);

    const [savedMeta, setSavedMeta] = useState({
        comuna_name: quote.comuna_name ?? '',
        region_code: initialRegionCode,
        shipping_cost: quote.shipping_cost,
        shipping_label: quote.shipping_label ?? null,
        total_liters: quote.total_liters ?? 0,
        total_offer_price: quote.total_offer_price ?? 0,
    });

    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmed, setConfirmed] = useState(quote.status === 'confirmed');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
    const [dateError, setDateError] = useState<string | null>(null);
    const [clientUrl, setClientUrl] = useState('');
    const dispatchTrackingUrl = resolveDispatchTrackingUrl(quote);

    const isDraft = quote.status === 'draft' && !confirmed;
    const statusCfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft;
    const StatusIcon = statusCfg.icon;

    const currentRegionShortName = useMemo(
        () => regions.find((r) => r.code === regionCode)?.shortName || quote.region_name || null,
        [regions, regionCode, quote.region_name]
    );

    const draftPayload: UpdateDraftQuoteInput = useMemo(
        () => ({
            token: quote.token,
            client_name: firstName,
            client_lastname: lastName,
            client_email: email,
            client_phone: phone,
            client_address: address,
            region_name: currentRegionShortName,
            comuna_name: comuna,
            comuna_other: comunaOther,
            guests: 0,
            event_type_id: null,
            event_type_other: '',
            event_date: eventDate,
            start_time: '',
            pickup_date: '',
            pickup_time: '',
            comments,
            dispenser: 'desechable',
            items: items
                .filter((i) => i.quantity > 0)
                .map((i) => ({
                    id: i.id,
                    product_id: i.product_id || null,
                    size: i.size,
                    quantity: i.quantity,
                    variant: i.variant ?? null,
                })),
        }),
        [
            quote.token,
            firstName,
            lastName,
            email,
            phone,
            address,
            currentRegionShortName,
            comuna,
            comunaOther,
            eventDate,
            comments,
            items,
        ]
    );

    const handleDraftSaved = useCallback(
        (res: Parameters<NonNullable<Parameters<typeof useDraftQuoteAutoSave>[0]['onSaved']>>[0]) => {
            if (res.items && res.items.length > 0) {
                setItems(res.items);
            }
            if (res.quote) {
                const nextRegCode =
                    regions.find(
                        (r) => r.shortName === res.quote?.region_name || r.name === res.quote?.region_name
                    )?.code || regionCode;
                setSavedMeta({
                    comuna_name: res.quote.comuna_name ?? '',
                    region_code: nextRegCode,
                    shipping_cost: res.quote.shipping_cost,
                    shipping_label: res.quote.shipping_label ?? null,
                    total_liters: res.quote.total_liters,
                    total_offer_price: res.quote.total_offer_price,
                });
            }
        },
        [regions, regionCode]
    );

    const handleNotDraft = useCallback(() => {
        router.refresh();
    }, [router]);

    const { saveStatus, saveError, flushNow, flushOnBlur } = useDraftQuoteAutoSave({
        enabled: isDraft,
        payload: draftPayload,
        onSaved: handleDraftSaved,
        onNotDraft: handleNotDraft,
    });

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

    // ─── Meta Pixel: Venta directa = Purchase al crear (pago por transferencia) ─
    useEffect(() => {
        if (isNew) {
            const totals = calculateTotals();
            fp.trackOnce(`purchase_${quote.token}`, 'Purchase', {
                content_name: 'Pedido Barriles',
                ...fp.metaLineParams('direct', fp.META_SERVICE_BARRILES),
                value: totals.totalFinal,
                currency: 'CLP',
                contents: items.map(item => ({
                    id: item.product_id || item.product_name,
                    item_price: item.offer_price_at_time,
                    quantity: item.quantity
                })),
                content_type: 'product',
                order_id: quote.token
            }, fp.quotePixelUserData(quote, {
                ph: phone || undefined,
                ln: lastName || undefined,
                ct: comuna && comuna !== 'Otra' ? comuna : (comunaOther || undefined),
            }));
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
                if (!item.product_id) {
                    // Ítems personalizados: solo suman volumen si su formato/tamaño especifica litros explícitamente (ej: "20L")
                    totalLiters += getSizeLiters(item.size) * item.quantity;
                } else {
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
            }
        });

        // Recalcular envío desechable (región + override; Blue Express por paquetes si aplica)
        const resolved = resolveShipping({
            serviceType: 'direct',
            regionCode,
            comunaName: comuna,
            totalLiters,
            comunas,
            subtotal: totalOffer,
        });
        const locationChanged = comuna !== savedMeta.comuna_name || regionCode !== savedMeta.region_code;
        const itemsMetricsChanged =
            totalLiters !== savedMeta.total_liters || totalOffer !== savedMeta.total_offer_price;

        let shipping: number;
        let shippingLabel: string;

        if (savedMeta.shipping_label === 'Por Pagar' && !locationChanged) {
            shipping = savedMeta.shipping_cost ?? 0;
            shippingLabel = 'Por Pagar';
        } else if (!locationChanged && !itemsMetricsChanged) {
            shipping = savedMeta.shipping_cost ?? resolved.shippingCost;
            shippingLabel =
                comuna === 'Otra' && shipping === 0
                    ? 'Pendiente de factibilidad'
                    : shipping === 0
                      ? (savedMeta.shipping_label ?? '¡Gratis!')
                      : formatCurrency(shipping);
        } else {
            shipping = resolved.isPending ? 0 : resolved.shippingCost;
            shippingLabel = resolved.shippingLabel;
        }

        const totalFinal = Math.max(0, totalOffer + shipping - (quote.manual_discount || 0));
        const totalDiscount = totalNormal - totalOffer;
        const totalCocktails = totalLiters * 5;

        return { totalNormal, totalOffer, totalFinal, totalLiters, totalCocktails, shipping, shippingLabel, totalDiscount, shippingCarrier: resolved.shippingCarrier };
    };

    const totals = calculateTotals();
    const dateCopy = getDirectSaleDateFieldCopy(totals.shippingCarrier);
    const methodsConfig = comunas[0]?.shippingMethodsConfig;
    const activeMethodConfig = totals.shippingCarrier === 'blue_express'
        ? methodsConfig?.blue_express
        : methodsConfig?.own_direct;
    const totalPaid = sumQuotePayments(quote);
    const advanceAmount = totals.totalFinal; // Siempre 100%
    const advancePercentText = '100%';

    const validateAllFields = (): Record<string, boolean> => {
        const errors: Record<string, boolean> = {};
        
        if (firstName.trim().length < 2) errors.firstName = true;
        if (lastName.trim().length < 2) errors.lastName = true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = true;
        if (!isValidPhoneE164(phone)) errors.phone = true;
        if (address.trim().length < 5) errors.address = true;
        if (!comuna || comuna === '...') errors.comuna = true;
        if (!eventDate) errors.eventDate = true;
        else {
            const dateErr = validateDirectSaleDate(eventDate, activeMethodConfig);
            if (dateErr) {
                errors.eventDate = true;
                setDateError(dateErr);
            } else {
                setDateError(null);
            }
        }
        
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
        return errors;
    };

    const handlePreConfirm = () => {
        const errors = validateAllFields();
        if (Object.keys(errors).length === 0) {
            setAcceptedTerms(false);
            setShowConfirmModal(true);
            setConfirmError('');
        } else {
            if (errors.noCocktail) {
                setConfirmError('Para realizar un despacho, debes incluir al menos un cóctel en tu pedido (no solo complementos).');
                const productsSection = document.getElementById('products-summary-section');
                if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
                return;
            }
            const firstErrorField = Object.keys(errors)[0] || 'firstName';
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
                variant: i.variant ?? null,
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
            shippingLabel: totals.shippingLabel,
            shippingCarrier: totals.shippingCarrier,
            installationCost: 0,
            dispenserLabel: 'Barril Desechable',
            manualDiscount: quote.manual_discount || 0,
            totalPrice: totals.totalFinal,
            guests: 0, // No aplica
            canHaveMuro: false
        };
    }, [items, totals, quote.manual_discount]);

    const reservationData: QuoteSummaryReservationData = useMemo(() => {
        const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();
        const regionDisplay = regions.find((r) => r.code === regionCode)?.shortName || quote.region_name || '';
        return {
            clientName: fullName,
            clientEmail: email || '',
            clientPhone: phone,
            addressDisplay: formatQuoteAddress({
                client_address: address,
                comuna_name: comuna,
                comuna_other: comunaOther,
                region_name: regionDisplay,
            }),
            eventTypeDisplay: 'Venta Directa',
            guests: 0,
            formattedDate: formatEventDate(eventDate),
            startTime: '',
            formattedPickupDate: undefined,
            pickupTime: '',
            comments: comments,
            isDirect: true,
            deliveryEstimateLabel: quote.delivery_estimate_label || null
        };
    }, [firstName, lastName, email, quote.region_name, quote.delivery_estimate_label, phone, address, comuna, comunaOther, regionCode, regions, eventDate, comments]);

    const mappedProducts: Product[] = useMemo(() => availableCocktails.map(c => ({
        id: c.id,
        name: c.name,
        description: c.desc,
        image: c.image,
        category: c.category,
        variant_config: c.variant_config ?? null,
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
        addItem: (productId, productName, size, price, offerPrice, sizeValue, unitId, isDisposable, image, variant) => {
            const normVar = variant ?? null;
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size && (i.variant ?? null) === normVar);
                if (existing) return prev.map(i => (i.product_id === productId && i.size === size && (i.variant ?? null) === normVar) ? { ...i, quantity: i.quantity + 1 } : i);
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
                    variant: normVar,
                    price_at_time: price,
                    offer_price_at_time: offerPrice
                }];
            });
        },
        removeItem: (productId, size, variant) => {
            const normVar = variant ?? null;
            setItems(prev => prev.filter(i => !(i.product_id === productId && i.size === size && (i.variant ?? null) === normVar)));
        },
        updateQuantity: (productId, size, quantity, variant) => {
            const normVar = variant ?? null;
            if (quantity <= 0) { quoteCart.removeItem(productId, size, normVar); return; }
            setItems(prev => {
                const existing = prev.find(i => i.product_id === productId && i.size === size && (i.variant ?? null) === normVar);
                if (existing) return prev.map(i => (i.product_id === productId && i.size === size && (i.variant ?? null) === normVar) ? { ...i, quantity } : i);
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
                    variant: normVar,
                    price_at_time: prices.price,
                    offer_price_at_time: prices.offerPrice
                }];
            });
        },
        getQuantity: (productId, size, variant) => {
            const normVar = variant ?? null;
            return items.find(i => i.product_id === productId && i.size === size && (i.variant ?? null) === normVar)?.quantity ?? 0;
        }
    };

    const handleConfirm = async () => {
        if (Object.keys(validateAllFields()).length > 0) return;
        setIsConfirming(true);
        setConfirmError('');
        await flushNow();
        const attribution = getClientMetaAttribution();
        const result = await confirmQuote({
            token: quote.token,
            client_name: normalizePersonName(firstName),
            client_email: normalizeEmail(email),
            client_phone: phone,
            client_lastname: normalizePersonName(lastName),
            client_address: address,
            comuna_name: comuna,
            region_name: regions.find(r => r.code === regionCode)?.shortName || quote.region_name || null,
            comuna_other: comunaOther,
            guests: 0,
            event_type_id: null as any,
            event_type_other: '',
            event_date: eventDate,
            start_time: '',
            pickup_date: null as any,
            pickup_time: '',
            comments: comments,
            items: items.map((item) => ({
                product_id: item.product_id || null,
                size: item.size,
                quantity: item.quantity,
                variant: item.variant ?? null,
            })),
            dispenser: 'desechable',
            fbc: attribution.fbc,
            fbp: attribution.fbp,
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

            // Misma onceKey que al crear: no duplica si ya se disparó en ?new=true
            fp.trackOnce(`purchase_${quote.token}`, 'Purchase', {
                content_name: 'Pedido Barriles (Confirmado)',
                ...fp.metaLineParams('direct', fp.META_SERVICE_BARRILES),
                value: totals.totalFinal,
                currency: 'CLP',
                contents: items.map(item => ({
                    id: item.product_id || item.product_name,
                    item_price: item.offer_price_at_time,
                    quantity: item.quantity
                })),
                content_type: 'product',
                order_id: quote.token
            }, fp.quotePixelUserData(quote, {
                em: email || undefined,
                ph: phone || undefined,
                fn: firstName || undefined,
                ln: lastName || undefined,
                ct: comuna && comuna !== 'Otra' ? comuna : (comunaOther || undefined),
            }));
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
            ? "Hemos registrado tu pedido correctamente. Enviamos una copia a tu email y WhatsApp."
            : "Te enviamos una copia a tu email y WhatsApp con los detalles e instrucciones para el pago.";

        return (
            <div className="text-center py-8 sm:py-16 animate-fade-in px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full mb-4 sm:mb-6 text-green-600">
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-brand-text mb-2 sm:mb-3 tracking-tight">{title}</h1>
                <p className="text-brand-text-muted text-[0.95rem] sm:text-[1.05rem] mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-2">
                    {subtitle}
                </p>
                <div className="max-w-sm mx-auto shadow-lg">
                    <BankTransferCard
                        amount={advanceAmount}
                        amountLabel="Monto a depositar (100%)"
                        variant="green"
                        footer={
                            <>
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
                            </>
                        }
                    />
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
                    <h1 className="text-xl sm:text-2xl font-black text-brand-text">Pedido de {firstName}{lastName ? ` ${lastName}` : ''}</h1>
                    <p className="text-brand-text-muted text-[0.8rem] sm:text-[0.9rem]">Creado el {new Date(quote.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {isDraft ? (
                    <div className="self-start sm:self-auto">
                        <DraftSaveBadge status={saveStatus} error={saveError} onRetry={() => void flushNow()} />
                    </div>
                ) : (
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
                        {isDraft ? 'Revisa y edita tus datos' : 'Información de tu Pedido'}
                    </p>
                    <p className="text-brand-text-muted text-[0.875rem] leading-relaxed font-medium">
                        {isDraft ? (
                            <>Puedes modificar los productos y tus datos de entrega — los cambios se guardan automáticamente. Confirma cuando estés listo para asegurar tu disponibilidad.</>
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
                        <div className="mt-8 space-y-4">
                            <p className="text-[0.85rem] text-amber-800 font-bold text-center">
                                Si aún no realizas tu transferencia, recuerda que el monto total pendiente es de <strong>{formatCurrency(balance)}</strong>.
                            </p>
                            <BankTransferCard variant="amber" />
                        </div>
                    )}
                </div>
            )}

            {quote.status === 'in_delivery' && (
                <div className="bg-sky-50 rounded-[1.5rem] border border-sky-200 p-5 sm:p-6 shadow-sm">
                    <h2 className="text-[0.65rem] font-black text-sky-800 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <ShoppingCart className="w-3.5 h-3.5" /> Estado del envío
                    </h2>
                    {quote.dispatch_mode === 'own' ? (
                        <p className="text-[0.9rem] text-sky-900 font-medium leading-relaxed">
                            Tu pedido está en reparto y será entregado durante el día.
                        </p>
                    ) : (
                        <div className="space-y-2 text-[0.9rem] text-sky-900">
                            <p className="font-medium">
                                Despachado vía <strong>{quote.dispatch_carrier_name || 'transportista'}</strong>
                            </p>
                            {quote.dispatch_tracking_number && (
                                <p>
                                    Número de seguimiento: <strong className="font-black">{quote.dispatch_tracking_number}</strong>
                                </p>
                            )}
                            {dispatchTrackingUrl && (
                                <a
                                    href={dispatchTrackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sky-700 font-black text-[0.85rem] hover:underline"
                                >
                                    <ExternalLink className="w-4 h-4" /> Rastrear envío
                                </a>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!isDraft ? (
                <QuoteSummaryReservation data={reservationData} />
            ) : (
                <div className="bg-white rounded-[1.5rem] border border-brand-border p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-brand-border/50">
                        <h2 className="text-[0.65rem] font-black text-primary uppercase tracking-[0.2em]">Detalles de Entrega</h2>
                        <DraftSaveBadge status={saveStatus} error={saveError} onRetry={() => void flushNow()} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="field-firstName" className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <User className="w-3 h-3" /> Nombre <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="field-firstName"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => {
                                            setFirstName(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, firstName: false }));
                                        }}
                                        onBlur={(e) => {
                                            setFirstName(normalizePersonName(e.target.value));
                                            flushOnBlur();
                                        }}
                                        placeholder="Tu nombre"
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.firstName ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="field-lastName" className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                        <User className="w-3 h-3" /> Apellido <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="field-lastName"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => {
                                            setLastName(e.target.value);
                                            setValidationErrors(prev => ({ ...prev, lastName: false }));
                                        }}
                                        onBlur={(e) => {
                                            setLastName(normalizePersonName(e.target.value));
                                            flushOnBlur();
                                        }}
                                        placeholder="Tu apellido"
                                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.lastName ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="field-email" className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase">
                                    <Mail className="w-3 h-3" /> Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="field-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value.toLowerCase());
                                        setValidationErrors(prev => ({ ...prev, email: false }));
                                    }}
                                    onBlur={(e) => {
                                        setEmail(normalizeEmail(e.target.value));
                                        flushOnBlur();
                                    }}
                                    placeholder="tu@correo.cl"
                                    className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.email ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><Phone className="w-3 h-3" /> Celular <span className="text-red-500">*</span></label>
                                <PhoneInput
                                    id="field-phone"
                                    value={phone}
                                    onFocus={() => setValidationErrors(prev => ({ ...prev, phone: false }))}
                                    onChange={(e164) => setPhone(e164)}
                                    onBlur={flushOnBlur}
                                    className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.phone ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <RegionComunaFields
                                regions={regions}
                                comunas={comunas}
                                serviceType="direct"
                                regionCode={regionCode}
                                comunaName={comuna}
                                otherComuna={comunaOther}
                                onRegionChange={(code) => {
                                    setRegionCode(code);
                                    setComuna('');
                                    setComunaOther('');
                                    setValidationErrors((prev) => ({ ...prev, comuna: false }));
                                    setDateError(null);
                                }}
                                onComunaChange={(name) => {
                                    setComuna(name);
                                    setValidationErrors((prev) => ({ ...prev, comuna: false }));
                                    setDateError(null);
                                }}
                                onOtherComunaChange={setComunaOther}
                            />
                            <div className="flex flex-col gap-1">
                                <label className="text-[0.65rem] font-black text-brand-text-muted flex items-center gap-1.5 uppercase"><MapPin className="w-3 h-3" /> Dirección <span className="text-red-500">*</span></label>
                                <AddressAutocomplete id="field-address" value={address} comuna={comuna} onChange={(val) => { setAddress(val); setValidationErrors(prev => ({ ...prev, address: false })); }} onBlur={flushOnBlur} placeholder="Calle, Número, Depto..." className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-[0.95rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm ${validationErrors.address ? 'border-red-500 bg-red-50/30' : 'border-brand-border'}`} />
                            </div>
                            <div className="flex flex-col">
                                <ShippingDatePicker
                                    id="field-eventDate"
                                    label={dateCopy.label}
                                    required
                                    value={eventDate}
                                    onChange={(val) => {
                                        setEventDate(val);
                                        setValidationErrors((prev) => ({ ...prev, eventDate: false }));
                                        setDateError(null);
                                    }}
                                    methodConfig={activeMethodConfig}
                                    fallbackOffsetDays={DIRECT_SALE_MIN_DISPATCH_OFFSET_DAYS}
                                    helperText={activeMethodConfig?.deliveryWindow || dateCopy.hint}
                                    onErrorChange={setDateError}
                                />
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
                            onBlur={flushOnBlur}
                            placeholder="Indicaciones de entrega o notas adicionales..."
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-[0.9rem] font-bold focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm resize-none"
                        />
                    </div>
                </div>
            )}

            <div id="products-summary-section">
                <QuoteSummaryProducts
                    data={summaryData}
                    isEditable={isDraft}
                    onUpdateQuantity={onSummaryUpdateQuantity}
                    onAddProductsClick={() => setShowCatalog(true)}
                />
            </div>

            {isDraft && saveStatus === 'empty_items' && (
                <div className="-mt-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-[0.8rem] font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Agrega al menos un producto para guardar los cambios en tu pedido.</span>
                </div>
            )}



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
                        <div className="p-4 sm:p-6 border-t border-brand-border bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                            <DraftSaveBadge status={saveStatus} error={saveError} onRetry={() => void flushNow()} />
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
                            <BankTransferCard variant="neutral" />
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
