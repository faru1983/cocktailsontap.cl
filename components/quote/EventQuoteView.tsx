'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    formatCurrency,
    copyToClipboard,
    normalizeEmail,
    normalizePersonName,
} from '@/lib/utils';
import { formatPhoneDisplay, normalizePhoneE164 } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import {
    formatEventDate,
    resolveShipping,
    isEventBarrelSizeLabelCompatible,
    getSizeLiters,
} from '@/lib/wizardLogic';
import { formatGlasswareLabel } from '@/lib/glassware';
import {
    MURO_INSTALLATION_COST,
    PORTATIL_MIN_LITERS,
    MURO_MIN_LITERS,
    MURO_COMPATIBLE_SIZES,
    WHATSAPP_URL,
} from '@/lib/config';
import { countPortableKegs } from '@/lib/eventCapacity';
import { useDraftQuoteAutoSave } from '@/hooks/useDraftQuoteAutoSave';
import DraftSaveBadge from '@/components/quote/DraftSaveBadge';
import {
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    Calendar,
    Users,
    MapPin,
    User,
    Mail,
    Phone,
    Lock,
    Search,
    ChevronRight,
    Tag,
    Info,
    Copy,
    ExternalLink,
    ArrowRight,
    Edit3,
    Snowflake,
    Leaf,
    GlassWater,
    Martini,
    Loader2,
} from 'lucide-react';
import * as fp from '@/lib/fpixel';
import type {
    Quote,
    QuoteItem,
    Comuna,
    Region,
    CocktailForWizard,
    EventType,
    Product,
    ICart,
    UpdateDraftQuoteInput,
} from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import QuoteSummaryProducts, { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';
import QuoteSummaryReservation, { QuoteSummaryReservationData } from '@/components/quote/QuoteSummaryReservation';
import BankTransferCard from '@/components/quote/BankTransferCard';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import { formatQuoteAddress } from '@/lib/geo';
import { WhatsappIcon } from '@/components/shared/icons';
import { STATUS_CONFIG } from './quoteStatusConfig';
import { sumQuotePayments } from '@/lib/directSaleFulfillment';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
    comunas: Comuna[];
    regions: Region[];
    availableCocktails: CocktailForWizard[];
    categories: string[];
    eventTypes: EventType[];
    isNew?: boolean;
}

export default function EventQuoteView({
    quote,
    comunas,
    regions,
    availableCocktails,
    categories,
    eventTypes,
    isNew,
}: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isConfirmedParam =
        searchParams.get('confirmed') === 'true' || searchParams.get('confirmed') === '1';

    const [showSuccessScreen, setShowSuccessScreen] = useState(isConfirmedParam);
    const [showCatalog, setShowCatalog] = useState(false);
    const [editingDetails, setEditingDetails] = useState(false);
    const [goingToReserve, setGoingToReserve] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(
        () => categories.filter((c) => c !== 'Otros')[0] || 'Todos'
    );
    const [copiedLink, setCopiedLink] = useState(false);

    const initialRegionCode = (() => {
        if (quote.region_name) {
            const byName = regions.find(
                (r) => r.name === quote.region_name || r.shortName === quote.region_name
            );
            if (byName) return byName.code;
            const byComuna = comunas.find(
                (c) => c.name === quote.comuna_name && c.regionName === quote.region_name
            );
            if (byComuna) return byComuna.regionCode;
        }
        const match = comunas.find((c) => c.name === quote.comuna_name);
        return match?.regionCode || DEFAULT_REGION_CODE;
    })();

    const [regionCode, setRegionCode] = useState(initialRegionCode);
    const eventCategories = useMemo(
        () => categories.filter((c) => c !== 'Otros'),
        [categories]
    );

    // State editable en borrador
    const [firstName, setFirstName] = useState(quote.client_name ?? '');
    const [lastName, setLastName] = useState(quote.client_lastname ?? '');
    const [email, setEmail] = useState(quote.client_email ?? '');
    const [phone, setPhone] = useState(() => normalizePhoneE164(quote.client_phone ?? '') ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [guests, setGuests] = useState(quote.guests);
    const [eventType, setEventType] = useState(
        quote.event_type_id ?? (quote.event_type_other ? 'Otro' : '')
    );
    const [otherType, setOtherType] = useState(quote.event_type_other ?? '');
    const [items, setItems] = useState<QuoteItem[]>(quote.quote_items);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro'>(
        (quote.dispenser as string) === 'muro' ? 'muro' : 'portatil'
    );

    const [savedMeta, setSavedMeta] = useState({
        comuna_name: quote.comuna_name ?? '',
        region_code: initialRegionCode,
        shipping_cost: quote.shipping_cost,
        shipping_label: quote.shipping_label ?? null,
        total_liters: quote.total_liters ?? 0,
        total_offer_price: quote.total_offer_price ?? 0,
    });

    const [clientUrl, setClientUrl] = useState('');

    const isDraft = quote.status === 'draft';
    const isAdminQuote = quote.source === 'admin';

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
            region_name: currentRegionShortName,
            comuna_name: comuna,
            comuna_other: comunaOther,
            guests,
            event_type_id: eventType || null,
            event_type_other: otherType,
            event_date: eventDate,
            dispenser,
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
            currentRegionShortName,
            comuna,
            comunaOther,
            guests,
            eventType,
            otherType,
            eventDate,
            dispenser,
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
                        (r) =>
                            r.shortName === res.quote?.region_name ||
                            r.name === res.quote?.region_name
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

    const statusCfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft;
    const StatusIcon = statusCfg.icon;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setClientUrl(`${window.location.origin}${window.location.pathname}`);
        }
    }, [quote.token]);

    useEffect(() => {
        setShowSuccessScreen(isConfirmedParam);
    }, [isConfirmedParam]);

    // Elegibilidad de Muro
    const muroEligibility = useMemo(() => {
        let liters = 0;
        let hasIncompatible = false;

        items.forEach((item) => {
            const cocktail = availableCocktails.find((c) => c.id === item.product_id);
            const priceData = cocktail?.prices[item.size];

            if (priceData && priceData.unit === 'L') {
                liters += priceData.sizeValue * item.quantity;
                if (!MURO_COMPATIBLE_SIZES.includes(priceData.sizeValue)) hasIncompatible = true;
            } else if (!priceData) {
                const parsedLiters = item.size_value || getSizeLiters(item.size);
                if (parsedLiters > 0) {
                    liters += parsedLiters * item.quantity;
                    if (item.is_disposable || !MURO_COMPATIBLE_SIZES.includes(parsedLiters)) {
                        hasIncompatible = true;
                    }
                }
            }
        });

        return {
            hasIncompatible,
            canHaveMuro: liters >= MURO_MIN_LITERS && !hasIncompatible,
        };
    }, [items, availableCocktails]);

    const canHaveMuro = muroEligibility.canHaveMuro;

    const calculateTotals = () => {
        let totalNormal = 0;
        let totalOffer = 0;
        let totalLiters = 0;

        items.forEach((item) => {
            totalNormal += item.price_at_time * item.quantity;
            totalOffer += item.offer_price_at_time * item.quantity;

            const cocktail = availableCocktails.find((c) => c.id === item.product_id);
            const priceData = cocktail?.prices[item.size];

            if (priceData && priceData.unit === 'L' && cocktail?.category !== 'Otros') {
                totalLiters += priceData.sizeValue * item.quantity;
            } else if (!priceData) {
                if (!item.product_id) {
                    totalLiters += getSizeLiters(item.size) * item.quantity;
                } else {
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

        const resolved = resolveShipping({
            serviceType: 'event',
            regionCode,
            comunaName: comuna,
            totalLiters,
            comunas,
            subtotal: totalOffer,
        });

        const locationChanged =
            comuna !== savedMeta.comuna_name || regionCode !== savedMeta.region_code;
        const itemsMetricsChanged =
            totalLiters !== savedMeta.total_liters || totalOffer !== savedMeta.total_offer_price;

        let shipping: number;
        let shippingLabel: string;

        if (savedMeta.shipping_label === 'Por Pagar' && !locationChanged) {
            shipping = savedMeta.shipping_cost ?? 0;
            shippingLabel = 'Por Pagar';
        } else if (!locationChanged && !itemsMetricsChanged) {
            shipping = savedMeta.shipping_cost;
            shippingLabel =
                comuna === 'Otra' && shipping === 0
                    ? 'Pendiente de factibilidad'
                    : shipping === 0
                      ? savedMeta.shipping_label ?? '¡Gratis!'
                      : formatCurrency(shipping);
        } else {
            shipping = resolved.isPending ? 0 : resolved.shippingCost;
            shippingLabel = resolved.shippingLabel;
        }

        const installationCost = dispenser === 'muro' ? MURO_INSTALLATION_COST : 0;
        const totalFinal = Math.max(
            0,
            totalOffer +
                shipping +
                (isDraft ? installationCost : quote.installation_cost) -
                (quote.manual_discount || 0)
        );
        const totalDiscount = totalNormal - totalOffer;
        const totalCocktails = totalLiters * 5;

        return {
            totalNormal,
            totalOffer,
            totalFinal,
            totalLiters,
            totalCocktails,
            shipping,
            shippingLabel,
            totalDiscount,
            installationCost,
            shippingCarrier: resolved.shippingCarrier,
        };
    };

    useEffect(() => {
        if (isDraft && muroEligibility.hasIncompatible && dispenser === 'muro') {
            setDispenser('portatil');
        }
    }, [muroEligibility.hasIncompatible, dispenser, isDraft]);

    // Meta Pixel: Lead al crear cotización (o Purchase si se confirmó al crear)
    useEffect(() => {
        if (isNew) {
            const totalsNow = calculateTotals();
            const contents = items.map((item) => ({
                id: item.product_id || `${item.product_name}::${item.size}`,
                item_price: item.offer_price_at_time,
                quantity: item.quantity,
            }));
            const isConfirmedOnCreate = quote.status === 'confirmed';
            fp.trackOnce(
                isConfirmedOnCreate ? `purchase_${quote.token}` : `lead_${quote.token}`,
                isConfirmedOnCreate ? 'Purchase' : 'Lead',
                {
                    content_name: isConfirmedOnCreate
                        ? 'Reserva Eventos Confirmada'
                        : 'Cotización Eventos',
                    ...fp.metaLineParams('event', fp.META_SERVICE_EVENTOS),
                    value: totalsNow.totalFinal,
                    currency: 'CLP',
                    contents,
                    content_ids: contents.map((c) => c.id),
                    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
                    content_type: 'product',
                    order_id: quote.token,
                },
                fp.quotePixelUserData(quote, {
                    em: email || undefined,
                    ph: phone || undefined,
                    fn: firstName || undefined,
                    ln: lastName || undefined,
                    ct: comuna && comuna !== 'Otra' ? comuna : comunaOther || undefined,
                })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isNew]);

    const totals = calculateTotals();
    const totalPaid = sumQuotePayments(quote);
    const advanceAmount = totals.totalFinal;
    const advancePercentText = '100%';

    const onSummaryUpdateQuantity = (id: string, _size: string, delta: number) => {
        setItems((prev) =>
            prev
                .map((item) =>
                    item.id === id ? { ...item, quantity: item.quantity + delta } : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const onSummaryUpdateVariant = (id: string, _size: string, newVariant: string) => {
        setItems((prev) => {
            const target = prev.find((item) => item.id === id);
            if (!target) return prev;
            const duplicate = prev.find(
                (item) =>
                    item.id !== id &&
                    item.product_id === target.product_id &&
                    item.size === target.size &&
                    (item.variant || null) === newVariant
            );
            if (duplicate) {
                return prev
                    .map((item) =>
                        item.id === duplicate.id
                            ? { ...item, quantity: item.quantity + target.quantity }
                            : item
                    )
                    .filter((item) => item.id !== id);
            }
            return prev.map((item) => (item.id === id ? { ...item, variant: newVariant } : item));
        });
    };

    const summaryData: QuoteSummaryData = useMemo(
        () => ({
            items: items.map((i) => ({
                id: i.id!,
                name: i.product_name,
                selectedSize: i.size,
                variant: i.variant ?? null,
                variantOptions: availableCocktails.find((c) => c.id === i.product_id)
                    ?.variant_config?.options,
                quantity: i.quantity,
                totalNormalPrice: i.price_at_time * i.quantity,
                totalOfferPrice: i.offer_price_at_time * i.quantity,
            })),
            totalLiters: totals.totalLiters,
            totalCocktails: totals.totalCocktails,
            totalNormalPrice: totals.totalNormal,
            totalOfferPrice: totals.totalOffer,
            totalDiscount: totals.totalDiscount,
            shippingCost: totals.shipping,
            shippingLabel: totals.shippingLabel,
            shippingCarrier: totals.shippingCarrier,
            installationCost: isDraft ? totals.installationCost : quote.installation_cost,
            dispenserLabel: dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil',
            manualDiscount: quote.manual_discount || 0,
            totalPrice: totals.totalFinal,
            guests,
            canHaveMuro,
        }),
        [
            items,
            totals,
            guests,
            dispenser,
            canHaveMuro,
            isDraft,
            quote.installation_cost,
            quote.manual_discount,
            availableCocktails,
        ]
    );

    const eventTypeDisplay =
        eventType === 'Otro'
            ? otherType || 'Otro'
            : eventTypes.find((t) => t.id === eventType)?.name || otherType || '';

    const reservationData: QuoteSummaryReservationData = useMemo(() => {
        const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();
        const regionDisplay =
            regions.find((r) => r.code === regionCode)?.shortName || quote.region_name || '';
        return {
            clientName: fullName,
            clientEmail: email || '',
            clientPhone: phone,
            addressDisplay: formatQuoteAddress({
                client_address: quote.client_address,
                comuna_name: comuna,
                comuna_other: comunaOther,
                region_name: regionDisplay,
            }),
            eventTypeDisplay,
            guests,
            formattedDate: formatEventDate(eventDate),
            startTime: quote.start_time ?? '',
            formattedPickupDate: quote.pickup_date ? formatEventDate(quote.pickup_date) : undefined,
            pickupTime: quote.pickup_time ?? undefined,
            glasswareLabel: formatGlasswareLabel(quote.glassware_type) || null,
            comments: quote.comments ?? undefined,
        };
    }, [
        firstName,
        lastName,
        email,
        phone,
        quote.client_address,
        quote.region_name,
        quote.start_time,
        quote.pickup_date,
        quote.pickup_time,
        quote.glassware_type,
        quote.comments,
        comuna,
        comunaOther,
        regionCode,
        regions,
        eventTypeDisplay,
        guests,
        eventDate,
    ]);

    const mappedProducts: Product[] = useMemo(
        () =>
            availableCocktails
                .filter((c) => c.category !== 'Otros')
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.desc,
                    image: c.image,
                    category: c.category,
                    variant_config: c.variant_config ?? null,
                    sizes: Object.entries(c.prices)
                        .filter(
                            ([size]) =>
                                !size.toLowerCase().includes('desechable') &&
                                isEventBarrelSizeLabelCompatible(size, dispenser)
                        )
                        .map(([size, p]) => ({
                            size,
                            price: p.price,
                            offerPrice: p.offerPrice,
                            sizeValue: p.sizeValue,
                            unitId: p.unitId,
                            isDisposable: p.isDisposable,
                            unit: p.unit,
                            image: p.image,
                        })),
                })),
        [availableCocktails, dispenser]
    );

    const quoteCart: ICart = {
        addItem: (
            productId,
            productName,
            size,
            price,
            offerPrice,
            sizeValue,
            unitId,
            isDisposable,
            _image,
            variant
        ) => {
            const normVar = variant ?? null;
            setItems((prev) => {
                const existing = prev.find(
                    (i) =>
                        i.product_id === productId &&
                        i.size === size &&
                        (i.variant ?? null) === normVar
                );
                if (existing) {
                    return prev.map((i) =>
                        i.product_id === productId &&
                        i.size === size &&
                        (i.variant ?? null) === normVar
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    );
                }
                return [
                    ...prev,
                    {
                        id: `temp-${Date.now()}`,
                        quote_id: quote.id,
                        product_id: productId,
                        product_name: productName,
                        size,
                        size_value: sizeValue,
                        unit_id: unitId,
                        is_disposable: isDisposable,
                        quantity: 1,
                        variant: normVar,
                        price_at_time: price,
                        offer_price_at_time: offerPrice,
                    },
                ];
            });
        },
        removeItem: (productId, size, variant) => {
            const normVar = variant ?? null;
            setItems((prev) =>
                prev.filter(
                    (i) =>
                        !(
                            i.product_id === productId &&
                            i.size === size &&
                            (i.variant ?? null) === normVar
                        )
                )
            );
        },
        updateQuantity: (productId, size, quantity, variant) => {
            const normVar = variant ?? null;
            if (quantity <= 0) {
                quoteCart.removeItem(productId, size, normVar);
                return;
            }
            setItems((prev) => {
                const existing = prev.find(
                    (i) =>
                        i.product_id === productId &&
                        i.size === size &&
                        (i.variant ?? null) === normVar
                );
                if (existing) {
                    return prev.map((i) =>
                        i.product_id === productId &&
                        i.size === size &&
                        (i.variant ?? null) === normVar
                            ? { ...i, quantity }
                            : i
                    );
                }
                const cocktail = availableCocktails.find((c) => c.id === productId);
                if (!cocktail) return prev;
                const prices = cocktail.prices[size];
                if (!prices) return prev;

                return [
                    ...prev,
                    {
                        id: `temp-${Date.now()}`,
                        quote_id: quote.id,
                        product_id: productId,
                        product_name: cocktail.name,
                        size,
                        size_value: prices.sizeValue,
                        unit_id: prices.unitId,
                        is_disposable: prices.isDisposable,
                        quantity,
                        variant: normVar,
                        price_at_time: prices.price,
                        offer_price_at_time: prices.offerPrice,
                    },
                ];
            });
        },
        getQuantity: (productId, size, variant) => {
            const normVar = variant ?? null;
            return (
                items.find(
                    (i) =>
                        i.product_id === productId &&
                        i.size === size &&
                        (i.variant ?? null) === normVar
                )?.quantity ?? 0
            );
        },
    };

    const filteredCocktails = useMemo(
        () =>
            mappedProducts.filter((c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [mappedProducts, searchQuery]
    );

    const handleGoToReserve = async () => {
        if (!minLitersMet || items.length === 0 || goingToReserve) return;
        setGoingToReserve(true);
        await flushNow();
        router.push(`/cotizar/${quote.token}/reservar`);
    };

    const minRequiredLiters = dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = totals.totalLiters >= minRequiredLiters;

    // ─── Pantalla de éxito post-creación o post-confirmación ──────────────────
    if (showSuccessScreen || isNew) {
        const isConfirmedView = showSuccessScreen || quote.status === 'confirmed';
        const title = isConfirmedView ? '¡Reserva confirmada!' : '¡Cotización lista!';
        const subtitle = isConfirmedView
            ? `Te enviamos una copia a tu email y WhatsApp con los detalles e instrucciones para el pago del ${advancePercentText}.`
            : 'Guardamos tu presupuesto y enviamos una copia a tu email y WhatsApp. Recuerda que aún no bloquea el cupo hasta confirmar.';

        return (
            <div className="text-center py-8 sm:py-14 px-3 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full mb-4 sm:mb-6 text-green-600">
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-brand-text mb-2 sm:mb-3 tracking-tight">
                    {title}
                </h1>
                <p className="text-brand-text-muted text-[0.95rem] sm:text-[1.05rem] mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-2">
                    {subtitle}
                </p>

                {isConfirmedView ? (
                    <div className="max-w-sm mx-auto shadow-lg">
                        <BankTransferCard
                            amount={advanceAmount}
                            amountLabel={`Monto a depositar (${advancePercentText})`}
                            variant="green"
                            footer={
                                <>
                                    <p className="text-[0.7rem] sm:text-[0.8rem] text-green-700 text-center italic font-bold leading-tight">
                                        Envía tu comprobante por WhatsApp o Email para validar tu reserva:
                                    </p>
                                    <a
                                        href={`${WHATSAPP_URL}?text=${encodeURIComponent(
                                            `Hola, adjunto el comprobante de transferencia para mi reserva: ${clientUrl}`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#128c7e] text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm no-underline text-center"
                                    >
                                        <WhatsappIcon className="w-3.5 h-3.5 fill-white" /> Enviar Comprobante
                                    </a>
                                </>
                            }
                        />
                    </div>
                ) : (
                    <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#fdfcfb] to-[#f4e7d7] border-2 border-primary/20 p-6 sm:p-10 shadow-[0_15px_40px_rgba(226,160,73,0.12)] mx-auto max-w-2xl">
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="inline-flex items-center justify-center px-4 py-1.5 bg-primary/10 rounded-full text-primary font-black text-[0.7rem] uppercase tracking-widest mb-4 border border-primary/15">
                                Asegura tu fecha en 4 pasos breves
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-brand-text mb-3">
                                ¿Listo para reservar tu fecha?
                            </h2>
                            <p className="text-brand-text-muted font-medium text-balance mb-7 max-w-lg mx-auto leading-relaxed text-sm sm:text-base">
                                Completa dirección, horario, retiro y elige tus vasos (reutilizables o PET desechables) para transformar esta cotización en una{' '}
                                <span className="text-brand-text font-bold underline decoration-primary/40 decoration-2 underline-offset-4">
                                    reserva oficial
                                </span>
                                .
                            </p>

                            <Link
                                href={`/cotizar/${quote.token}/reservar`}
                                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 sm:px-10 py-4 bg-primary text-white font-black text-base sm:text-lg rounded-2xl shadow-[0_10px_25px_rgba(226,160,73,0.35)] hover:bg-primary-dark hover:-translate-y-0.5 transition-all active:scale-95 no-underline"
                            >
                                <span>Reservar mi fecha ahora</span>
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* Link Card de Seguimiento */}
                <div className="mt-10 max-w-lg mx-auto bg-slate-50 border border-brand-border rounded-3xl p-4 sm:p-6 text-left shadow-sm w-full overflow-hidden">
                    <p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Copy className="w-3 h-3" /> Enlace permanente
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <div className="bg-white border border-brand-border rounded-xl px-4 py-3 text-[0.85rem] font-bold text-brand-text overflow-hidden text-ellipsis whitespace-nowrap shadow-inner">
                            {clientUrl}
                        </div>
                        <div className="flex items-stretch sm:items-center gap-2 w-full">
                            <button
                                type="button"
                                onClick={async () => {
                                    const ok = await copyToClipboard(clientUrl);
                                    if (ok) {
                                        setCopiedLink(true);
                                        setTimeout(() => setCopiedLink(false), 2000);
                                    }
                                }}
                                className="flex-1 shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white border-2 border-brand-border text-brand-text font-black text-[0.85rem] hover:border-primary hover:text-primary transition-all active:scale-95 cursor-pointer"
                            >
                                <Copy className="w-4 h-4" />
                                <span>{copiedLink ? '¡Copiado!' : 'Copiar enlace'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSuccessScreen(false);
                                    router.push(`/cotizar/${quote.token}`);
                                    router.refresh();
                                }}
                                className="flex-1 shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-brand-text text-white font-black text-[0.85rem] hover:bg-black transition-all active:scale-95 shadow-md cursor-pointer"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>{isConfirmedView ? 'Ver mi reserva' : 'Ver mi propuesta'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const balance = totals.totalFinal - totalPaid;

    return (
        <div className="w-full flex flex-col gap-5 sm:gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[0.65rem] sm:text-[0.7rem] font-black border uppercase tracking-widest ${statusCfg.color}`}
                        >
                            <StatusIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            {statusCfg.label}
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-brand-text">
                        {isDraft ? 'Propuesta de ' : 'Reserva de '}
                        {firstName}
                        {lastName ? ` ${lastName}` : ''}
                    </h1>
                    <p className="text-brand-text-muted text-[0.8rem] sm:text-[0.9rem]">
                        Creada el{' '}
                        {new Date(quote.created_at).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>

                {isDraft ? (
                    <div className="self-start sm:self-auto">
                        <DraftSaveBadge
                            status={saveStatus}
                            error={saveError}
                            onRetry={() => void flushNow()}
                        />
                    </div>
                ) : (
                    <div className="inline-flex sm:flex items-center gap-2 text-green-700 font-bold bg-green-50 px-4 py-2 rounded-xl border border-green-200 self-start sm:self-auto shadow-sm">
                        <Lock className="w-4 h-4" /> Reserva cerrada / Confirmada
                    </div>
                )}
            </div>

            {/* Banner Descriptivo */}
            <div
                className={`flex items-start gap-3.5 border rounded-2xl px-4 sm:px-5 py-3.5 ${
                    isDraft
                        ? 'bg-primary/5 border-primary/15'
                        : 'bg-slate-50 border-brand-border/50'
                }`}
            >
                <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isDraft
                            ? 'bg-primary/10 text-primary'
                            : 'bg-slate-100 text-brand-text-muted'
                    }`}
                >
                    {isDraft ? <Info className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                    <p
                        className={`text-xs font-black uppercase tracking-[0.14em] mb-1 ${
                            isDraft ? 'text-primary' : 'text-brand-text'
                        }`}
                    >
                        {isDraft
                            ? 'Propuesta editable · aún no bloquea cupo'
                            : 'Comprobante de tu Reserva'}
                    </p>
                    <p className="text-brand-text-muted text-xs sm:text-sm leading-relaxed font-medium m-0">
                        {isDraft
                            ? 'Puedes ajustar cócteles, cantidades o bebidas con autoguardado. Cuando estés listo, presiona "Reservar mi fecha" para completar dirección, horarios y tipo de vasos paso a paso.'
                            : 'Tus detalles han sido registrados exitosamente. Esta página es tu comprobante oficial del servicio. Si necesitas realizar cualquier cambio de último minuto, contáctanos directamente.'}
                    </p>
                </div>
            </div>

            {/* Estado de Cuenta (Solo si ya está confirmada/completada) */}
            {!isDraft && (
                <div className="bg-white rounded-[1.5rem] border border-brand-border p-5 sm:p-7 shadow-sm overflow-hidden relative">
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-brand-border/50">
                        <h2 className="text-[0.65rem] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5" /> Estado de Cuenta
                        </h2>
                        {balance <= 0 && (
                            <span className="text-[0.6rem] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase">
                                Pagado
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-brand-border/50">
                            <p className="text-[0.6rem] font-black text-brand-text-muted uppercase tracking-widest mb-1">
                                Total Cotizado
                            </p>
                            <p className="text-xl font-black text-brand-text">
                                {formatCurrency(totals.totalFinal)}
                            </p>
                        </div>
                        <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                            <p className="text-[0.6rem] font-black text-green-700 uppercase tracking-widest mb-1">
                                Total Pagado
                            </p>
                            <p className="text-xl font-black text-green-600">
                                {formatCurrency(totalPaid)}
                            </p>
                        </div>
                        <div
                            className={`p-5 rounded-2xl border ${
                                balance > 0
                                    ? 'bg-amber-50 border-amber-100'
                                    : 'bg-blue-50 border-blue-100'
                            }`}
                        >
                            <p
                                className={`text-[0.6rem] font-black uppercase tracking-widest mb-1 ${
                                    balance > 0 ? 'text-amber-700' : 'text-blue-700'
                                }`}
                            >
                                {balance > 0 ? 'Saldo Pendiente' : 'Saldo en $0'}
                            </p>
                            <p
                                className={`text-xl font-black ${
                                    balance > 0 ? 'text-amber-600' : 'text-blue-600'
                                }`}
                            >
                                {formatCurrency(Math.max(0, balance))}
                            </p>
                        </div>
                    </div>

                    {quote.payments && quote.payments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[0.7rem] font-black text-brand-text mb-4 uppercase tracking-widest px-1">
                                Historial de Pagos
                            </h3>
                            {quote.payments.map((p, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-brand-border/30"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-black text-xs">
                                            $
                                        </div>
                                        <div>
                                            <p className="text-[0.9rem] font-black text-brand-text">
                                                {formatCurrency(p.amount)}
                                            </p>
                                            <p className="text-[0.7rem] text-brand-text-muted font-bold">
                                                {new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL')}{' '}
                                                — {p.note}
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
                                Si aún no realizas tu transferencia, recuerda que el monto total para asegurar tu reserva es de{' '}
                                <strong>{formatCurrency(balance)}</strong>.
                            </p>
                            <BankTransferCard variant="amber" />
                        </div>
                    )}
                </div>
            )}

            {/* ── EN BORRADOR: PROPUESTA LIMPIA (BARRA PROTAGONISTA ARRIBA) ──── */}
            {isDraft ? (
                <>
                    {/* 1. Tu Barra (editable) */}
                    <QuoteSummaryProducts
                        data={summaryData}
                        title="Tu Barra"
                        isEditable
                        onUpdateQuantity={onSummaryUpdateQuantity}
                        onUpdateVariant={onSummaryUpdateVariant}
                        onAddProductsClick={() => setShowCatalog(true)}
                        onChangeDispenser={() =>
                            setDispenser((prev) => (prev === 'muro' ? 'portatil' : 'muro'))
                        }
                    />

                    {saveStatus === 'empty_items' && (
                        <div className="-mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>Agrega al menos un producto para guardar los cambios en tu cotización.</span>
                        </div>
                    )}

                    {/* 2. Resumen compacto del evento y contacto (con opción de editar) */}
                    <div className="bg-white rounded-[20px] border border-brand-border p-4 sm:p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-brand-border/60">
                            <h2 className="text-[0.7rem] font-black text-primary uppercase tracking-[0.18em] m-0">
                                Datos de tu Evento
                            </h2>
                            <button
                                type="button"
                                onClick={() => setEditingDetails((v) => !v)}
                                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{editingDetails ? 'Listo' : 'Editar datos'}</span>
                            </button>
                        </div>

                        {!editingDetails ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <User className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-brand-text-muted font-bold block">Cliente</span>
                                            <span className="font-bold text-brand-text">
                                                {`${firstName} ${lastName}`.trim() || '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <span className="text-xs text-brand-text-muted font-bold block">Email</span>
                                            <span className="font-semibold text-brand-text break-all">
                                                {email || 'Sin registrar'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-brand-text-muted font-bold block">WhatsApp</span>
                                            <span className="font-semibold text-brand-text">
                                                {phone ? formatPhoneDisplay(phone) : 'Sin registrar'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-brand-text-muted font-bold block">Fecha estimada</span>
                                            <span className="font-bold text-brand-text">
                                                {eventDate ? formatEventDate(eventDate) : 'Por definir'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-brand-text-muted font-bold block">Comuna</span>
                                            <span className="font-bold text-brand-text">
                                                {comuna || 'Por definir'}
                                                {currentRegionShortName ? ` (${currentRegionShortName})` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-brand-text-muted font-bold block">Evento</span>
                                            <span className="font-bold text-brand-text">
                                                {eventTypeDisplay || 'Evento'}
                                                {guests > 0 ? ` · ${guests} invitados` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    {quote.glassware_type && (
                                        <div className="flex items-start gap-2">
                                            <GlassWater className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-xs text-brand-text-muted font-bold block">Vasos preseleccionados</span>
                                                <span className="font-bold text-brand-text">
                                                    {formatGlasswareLabel(quote.glassware_type)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="draft-firstName" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Nombre
                                        </label>
                                        <input
                                            id="draft-firstName"
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            onBlur={(e) => {
                                                setFirstName(normalizePersonName(e.target.value));
                                                flushOnBlur();
                                            }}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="draft-lastName" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Apellido
                                        </label>
                                        <input
                                            id="draft-lastName"
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            onBlur={(e) => {
                                                setLastName(normalizePersonName(e.target.value));
                                                flushOnBlur();
                                            }}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="draft-email" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Email
                                        </label>
                                        <input
                                            id="draft-email"
                                            type="email"
                                            autoCorrect="off"
                                            autoCapitalize="none"
                                            spellCheck={false}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                            onBlur={(e) => {
                                                setEmail(normalizeEmail(e.target.value));
                                                flushOnBlur();
                                            }}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="draft-phone" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            WhatsApp
                                        </label>
                                        <PhoneInput
                                            id="draft-phone"
                                            value={phone}
                                            onChange={(e164) => setPhone(e164)}
                                            onBlur={flushOnBlur}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <RegionComunaFields
                                        regions={regions}
                                        comunas={comunas}
                                        serviceType="event"
                                        allowAllActiveRegions={isAdminQuote}
                                        regionCode={regionCode}
                                        comuna={comuna}
                                        otherComuna={comunaOther}
                                        onRegionChange={(code) => {
                                            setRegionCode(code);
                                            setComuna('');
                                            setComunaOther('');
                                        }}
                                        onComunaChange={(name) => setComuna(name)}
                                        onOtherComunaChange={(v) => setComunaOther(v)}
                                    />
                                </div>

                                <div>
                                    <ShippingDatePicker
                                        id="draft-eventDate"
                                        label="Fecha del Evento"
                                        value={eventDate}
                                        onChange={(val) => setEventDate(val)}
                                        methodConfig={comunas[0]?.shippingMethodsConfig?.own_events}
                                        fallbackOffsetDays={2}
                                        availabilityContext={{
                                            dispenser,
                                            portableKegCount: countPortableKegs(items),
                                            excludeQuoteId: quote.id,
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                                    <div>
                                        <label htmlFor="draft-eventType" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Temática
                                        </label>
                                        <select
                                            id="draft-eventType"
                                            value={eventType}
                                            onChange={(e) => setEventType(e.target.value)}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {eventTypes.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="draft-guests" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Invitados
                                        </label>
                                        <input
                                            id="draft-guests"
                                            type="number"
                                            min={0}
                                            value={guests}
                                            onChange={(e) => setGuests(parseInt(e.target.value, 10) || 0)}
                                            onBlur={flushOnBlur}
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {eventType === 'Otro' && (
                                    <div className="md:col-span-2">
                                        <label htmlFor="draft-otherType" className="block text-[0.7rem] font-black uppercase text-brand-text-muted mb-1">
                                            Especificar temática
                                        </label>
                                        <input
                                            id="draft-otherType"
                                            type="text"
                                            value={otherType}
                                            onChange={(e) => setOtherType(e.target.value)}
                                            onBlur={flushOnBlur}
                                            placeholder="Ej: Aniversario..."
                                            className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:bg-white"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. Strip Qué Incluye ($0) */}
                    <div className="bg-white rounded-[20px] border border-brand-border p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[0.7rem] font-black text-brand-text uppercase tracking-[0.16em]">
                                Incluido sin costo adicional
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[0.7rem] font-black">
                                $0
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                                { icon: Snowflake, title: 'Hielo abundante', sub: 'Para todo el evento' },
                                { icon: Leaf, title: 'Garnish', sub: 'Frutas deshidratadas' },
                                {
                                    icon: GlassWater,
                                    title: 'Vasos a elección',
                                    sub: 'Reutilizables o PET 360 ml',
                                },
                                { icon: Martini, title: 'Accesorios', sub: 'Hieleras, pinzas y palas' },
                            ].map((inc) => (
                                <div
                                    key={inc.title}
                                    className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-brand-border/60"
                                >
                                    <inc.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-extrabold text-brand-text leading-tight m-0">
                                            {inc.title}
                                        </p>
                                        <p className="text-[0.7rem] text-brand-text-muted leading-tight mt-0.5 m-0">
                                            {inc.sub}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. CTA Principal hacia el flujo de 4 tarjetas */}
                    <div className="mt-2 mb-12">
                        <div className="bg-white border-2 border-primary/25 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_15px_40px_rgba(226,160,73,0.1)]">
                            <div className="text-center sm:text-left">
                                <p className="text-[0.7rem] font-black text-brand-text-muted uppercase tracking-[0.18em] mb-1.5 flex items-center justify-center sm:justify-start gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    Total estimado (valores netos)
                                </p>
                                <p className="text-3xl sm:text-4xl font-black text-brand-text tracking-tight m-0">
                                    {formatCurrency(advanceAmount)}
                                </p>
                                <p className="text-xs sm:text-sm text-brand-text-muted mt-1.5 font-medium m-0">
                                    En el siguiente paso completarás dirección, horario, retiro y elegirás tus vasos.
                                </p>
                            </div>

                            <div className="w-full sm:w-auto flex flex-col gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => void handleGoToReserve()}
                                    disabled={!minLitersMet || items.length === 0 || goingToReserve}
                                    className="w-full sm:w-auto min-h-[54px] inline-flex items-center justify-center gap-2.5 px-7 sm:px-10 py-4 rounded-2xl bg-primary text-white font-black text-base sm:text-lg shadow-[0_8px_25px_rgba(226,160,73,0.35)] hover:bg-primary-dark transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                >
                                    {goingToReserve ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Abriendo reserva...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Reservar mi fecha</span>
                                            <ChevronRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                                <a
                                    href={`${WHATSAPP_URL}?text=${encodeURIComponent(
                                        `Hola! Tengo una consulta sobre mi cotización: ${clientUrl}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-brand-text-muted hover:text-[#128c7e] no-underline py-1"
                                >
                                    <WhatsappIcon className="w-3.5 h-3.5 fill-[#25D366]" />
                                    <span>¿Dudas antes de reservar? Escribir por WhatsApp</span>
                                </a>
                            </div>
                        </div>

                        {!minLitersMet && (
                            <div
                                role="alert"
                                className="mt-4 bg-red-50 border-2 border-red-200 text-red-600 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold text-center flex items-center justify-center gap-2"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>
                                    Debes seleccionar al menos {minRequiredLiters} Litros para usar el{' '}
                                    {dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'} (volumen actual:{' '}
                                    {totals.totalLiters}L).
                                </span>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <QuoteSummaryReservation data={reservationData} />
                    <QuoteSummaryProducts data={summaryData} title="Tu Barra" isEditable={false} />
                </>
            )}

            {/* Catálogo Modal para añadir cócteles en borrador */}
            {showCatalog && isDraft && (
                <div
                    className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => setShowCatalog(false)}
                >
                    <div
                        className="bg-white w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-[2.5rem] flex flex-col overflow-hidden animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-slate-300/60 rounded-full mx-auto mt-4 mb-1 sm:hidden shrink-0" />

                        <div className="p-4 sm:p-6 border-b border-brand-border flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-brand-text leading-tight">
                                    Añadir Cócteles
                                </h3>
                                <p className="text-[0.7rem] sm:text-[0.8rem] text-brand-text-muted font-bold">
                                    Catálogo Cocktails on Tap
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Cerrar catálogo"
                                onClick={() => setShowCatalog(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer bg-transparent border-none"
                            >
                                <XCircle className="w-6 h-6 text-brand-text-muted" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 bg-slate-50 border-b border-brand-border flex flex-col sm:flex-row gap-4 sm:gap-6 items-center">
                            <div className="flex-1 w-full overflow-hidden">
                                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                    {eventCategories.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-[0.75rem] sm:text-[0.85rem] whitespace-nowrap transition-all duration-300 border-2 cursor-pointer ${
                                                cat === selectedCategory
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

                            <div className="relative w-full sm:w-64 shrink-0">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                                <input
                                    type="search"
                                    placeholder="Buscar por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                    <p className="text-brand-text-muted font-bold">
                                        No se encontraron productos.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 sm:p-6 border-t border-brand-border bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                            <DraftSaveBadge
                                status={saveStatus}
                                error={saveError}
                                onRetry={() => void flushNow()}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCatalog(false)}
                                className="px-8 py-3 bg-brand-text text-white font-black rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 cursor-pointer"
                            >
                                Listo, volver a mi propuesta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
