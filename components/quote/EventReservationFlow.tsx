'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    MapPin,
    Calendar,
    Clock,
    GlassWater,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    FileText,
    Loader2,
    Sparkles,
    Sun,
    Moon,
    User,
    Wine,
    Edit3,
    ShieldCheck,
} from 'lucide-react';
import type {
    Quote,
    QuoteItem,
    Comuna,
    Region,
    CocktailForWizard,
    EventType,
    UpdateDraftQuoteInput,
    GlasswareType,
} from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import {
    formatCurrency,
    evaluateGoogleEventAddress,
    normalizeEmail,
    normalizePersonName,
} from '@/lib/utils';
import { formatQuoteAddress } from '@/lib/geo';
import { formatPhoneDisplay, isValidPhoneE164, normalizePhoneE164 } from '@/lib/phone';
import {
    formatEventDate,
    calculateMaxPickupDate,
    isAllowedEventPickupDate,
    EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME,
    resolveShipping,
    getSizeLiters,
} from '@/lib/wizardLogic';
import {
    GLASSWARE_OPTIONS,
    formatGlasswareLabel,
    isGlasswareType,
} from '@/lib/glassware';
import {
    MURO_INSTALLATION_COST,
    PORTATIL_MIN_LITERS,
    MURO_MIN_LITERS,
    GOOGLE_MAPS_API_KEY,
} from '@/lib/config';
import { formatOffsetShortLabel, validateShippingDate } from '@/lib/shippingMethods';
import { countPortableKegs } from '@/lib/eventCapacity';
import { useDraftQuoteAutoSave } from '@/hooks/useDraftQuoteAutoSave';
import { confirmQuote } from '@/app/actions/confirmQuote';
import * as fp from '@/lib/fpixel';
import { getClientMetaAttribution } from '@/lib/attribution';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import PhoneInput from '@/components/ui/PhoneInput';
import DraftSaveBadge from '@/components/quote/DraftSaveBadge';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';
import type { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';

interface Props {
    quote: Quote & { quote_items: QuoteItem[] };
    comunas: Comuna[];
    regions: Region[];
    availableCocktails: CocktailForWizard[];
    eventTypes: EventType[];
    fromWizard?: boolean;
}

const STEP_META = [
    { num: 1, short: 'Lugar y hora' },
    { num: 2, short: 'Retiro' },
    { num: 3, short: 'Vasos' },
    { num: 4, short: 'Confirmar' },
] as const;

const QUICK_START_TIMES = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

export default function EventReservationFlow({
    quote,
    comunas,
    regions,
    availableCocktails,
    eventTypes,
    fromWizard = false,
}: Props) {
    const router = useRouter();
    const stepHeadingRef = useRef<HTMLHeadingElement>(null);
    const hasMountedRef = useRef(false);

    const isAdminQuote = quote.source === 'admin';
    const items = quote.quote_items || [];
    const dispenser: 'portatil' | 'muro' = quote.dispenser === 'muro' ? 'muro' : 'portatil';

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

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [showBarPeek, setShowBarPeek] = useState(false);

    // Editable fields (autosaved to draft)
    const [firstName, setFirstName] = useState(quote.client_name ?? '');
    const [lastName, setLastName] = useState(quote.client_lastname ?? '');
    const [email, setEmail] = useState(quote.client_email ?? '');
    const [phone, setPhone] = useState(() => normalizePhoneE164(quote.client_phone ?? '') ?? '');
    const [regionCode, setRegionCode] = useState(initialRegionCode);
    const [comuna, setComuna] = useState(quote.comuna_name ?? '');
    const [comunaOther, setComunaOther] = useState(quote.comuna_other ?? '');
    const [address, setAddress] = useState(quote.client_address ?? '');
    const [lastValidAddress, setLastValidAddress] = useState(quote.client_address ?? '');
    const [eventDate, setEventDate] = useState(quote.event_date ?? '');
    const [startTime, setStartTime] = useState(
        quote.start_time && quote.start_time !== '--:--' ? quote.start_time : ''
    );
    const [pickupDate, setPickupDate] = useState(quote.pickup_date ?? '');
    const [pickupTime, setPickupTime] = useState(quote.pickup_time ?? '');
    const [glasswareType, setGlasswareType] = useState<GlasswareType | ''>(
        isGlasswareType(quote.glassware_type) ? quote.glassware_type : 'disposable_pet'
    );
    const [guests, setGuests] = useState(quote.guests ?? 0);
    const [eventType, setEventType] = useState(
        quote.event_type_id ?? (quote.event_type_other ? 'Otro' : '')
    );
    const [otherType, setOtherType] = useState(quote.event_type_other ?? '');
    const [comments, setComments] = useState(quote.comments ?? '');

    const [showManualRegionComuna, setShowManualRegionComuna] = useState(
        () => !GOOGLE_MAPS_API_KEY || isAdminQuote || Boolean(quote.comuna_other)
    );
    const [showComments, setShowComments] = useState(Boolean(quote.comments));
    const [editingContact, setEditingContact] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [outOfRmError, setOutOfRmError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [stepError, setStepError] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');

    const [savedMeta, setSavedMeta] = useState({
        comuna_name: quote.comuna_name ?? '',
        region_code: initialRegionCode,
        shipping_cost: quote.shipping_cost,
        shipping_label: quote.shipping_label ?? null,
        total_liters: quote.total_liters ?? 0,
        total_offer_price: quote.total_offer_price ?? 0,
    });

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;

    const currentRegionShortName = useMemo(
        () => regions.find((r) => r.code === regionCode)?.shortName || quote.region_name || null,
        [regions, regionCode, quote.region_name]
    );

    // Move focus to step heading on transitions (not initial mount)
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const timer = setTimeout(() => {
            stepHeadingRef.current?.focus();
        }, 80);
        return () => clearTimeout(timer);
    }, [step]);

    // Calculate totals dynamically
    const totals = useMemo(() => {
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
                        totalLiters += (item.size_value || getSizeLiters(item.size)) * item.quantity;
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
            totalOffer + shipping + installationCost - (quote.manual_discount || 0)
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
    }, [
        items,
        availableCocktails,
        regionCode,
        comuna,
        comunas,
        savedMeta,
        dispenser,
        quote.manual_discount,
    ]);

    // Fire deduplicated Meta Pixel Lead when coming directly from /eventos wizard
    useEffect(() => {
        if (!fromWizard) return;
        const contents = items.map((item) => ({
            id: item.product_id || `${item.product_name}::${item.size}`,
            item_price: item.offer_price_at_time,
            quantity: item.quantity,
        }));
        fp.trackOnce(
            `lead_${quote.token}`,
            'Lead',
            {
                content_name: 'Cotización Eventos',
                ...fp.metaLineParams('event', fp.META_SERVICE_EVENTOS),
                value: totals.totalFinal,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromWizard]);

    // Autosave payload
    const draftPayload: UpdateDraftQuoteInput = useMemo(
        () => ({
            token: quote.token,
            client_name: firstName,
            client_lastname: lastName,
            client_email: email,
            client_phone: phone,
            client_address: outOfRmError ? lastValidAddress : address,
            region_name: currentRegionShortName,
            comuna_name: comuna,
            comuna_other: comunaOther,
            guests,
            event_type_id: eventType || null,
            event_type_other: otherType,
            event_date: eventDate,
            start_time: startTime,
            pickup_date: pickupDate,
            pickup_time: pickupTime,
            comments,
            dispenser,
            glassware_type: glasswareType || null,
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
            outOfRmError,
            lastValidAddress,
            currentRegionShortName,
            comuna,
            comunaOther,
            guests,
            eventType,
            otherType,
            eventDate,
            startTime,
            pickupDate,
            pickupTime,
            comments,
            dispenser,
            glasswareType,
            items,
        ]
    );

    const handleDraftSaved = useCallback(
        (res: Parameters<NonNullable<Parameters<typeof useDraftQuoteAutoSave>[0]['onSaved']>>[0]) => {
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
        router.replace(`/cotizar/${quote.token}`);
    }, [router, quote.token]);

    const { saveStatus, saveError, flushNow, flushOnBlur } = useDraftQuoteAutoSave({
        enabled: true,
        payload: draftPayload,
        onSaved: handleDraftSaved,
        onNotDraft: handleNotDraft,
    });

    const nextPickupDate = calculateMaxPickupDate(eventDate);
    const isSameDayPickup = Boolean(pickupDate && eventDate && pickupDate === eventDate);
    const isNextDayPickup = Boolean(pickupDate && eventDate && pickupDate === nextPickupDate);
    const pickupChoice: 'same' | 'next' | '' = isSameDayPickup
        ? 'same'
        : isNextDayPickup
          ? 'next'
          : '';

    const minRequiredLiters = dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = totals.totalLiters >= minRequiredLiters;

    const regularEventTypes = useMemo(
        () => eventTypes.filter((t) => t.id !== 'Otro' && t.name.toLowerCase() !== 'otro'),
        [eventTypes]
    );

    const eventTypeDisplay = useMemo(() => {
        if (eventType === 'Otro') return otherType.trim() || 'Otro';
        return eventTypes.find((t) => t.id === eventType)?.name || otherType || '';
    }, [eventType, otherType, eventTypes]);

    const missingBasicContact =
        firstName.trim().length < 2 ||
        lastName.trim().length < 2 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !isValidPhoneE164(phone) ||
        !eventType ||
        (eventType === 'Otro' && !otherType.trim()) ||
        guests <= 0;

    // Auto-open contact edit panel in Step 4 if something required is missing (e.g., WhatsApp draft without apellido)
    useEffect(() => {
        if (step === 4 && missingBasicContact) {
            setEditingContact(true);
        }
    }, [step, missingBasicContact]);

    const clearError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setStepError('');
    };

    const validateStep1 = (): boolean => {
        const nextErrors: Record<string, string> = {};
        if (outOfRmError) {
            nextErrors.address = outOfRmError;
        } else if (address.trim().length < 5) {
            nextErrors.address = 'Ingresa la dirección exacta del evento (mín. 5 caracteres).';
        }
        if (!comuna.trim()) {
            nextErrors.comuna = 'Selecciona la comuna del evento.';
            setShowManualRegionComuna(true);
        }
        if (!eventDate.trim()) {
            nextErrors.eventDate = 'Selecciona la fecha de tu evento.';
        } else {
            const dateErr = validateShippingDate(eventDate, eventMethodConfig, 2);
            if (dateErr) nextErrors.eventDate = dateErr;
        }
        if (!startTime.trim()) {
            nextErrors.startTime = 'Indica la hora de inicio del evento.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            setStepError('Completa los datos marcados para continuar.');
            const firstKey = Object.keys(nextErrors)[0];
            setTimeout(() => {
                const el = document.getElementById(`res-${firstKey}`);
                el?.focus();
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 40);
            return false;
        }
        setErrors({});
        setStepError('');
        return true;
    };

    const validateStep2 = (): boolean => {
        if (!pickupChoice || !pickupDate || !isAllowedEventPickupDate(eventDate, pickupDate)) {
            setErrors({ pickupDate: 'Elige cuándo prefieres que retiremos los equipos.' });
            setStepError('Selecciona una opción de retiro para continuar.');
            return false;
        }
        if (pickupChoice === 'next' && !pickupTime) {
            setPickupTime(EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
        }
        setErrors({});
        setStepError('');
        return true;
    };

    const validateStep3 = (): boolean => {
        if (!glasswareType) {
            setErrors({ glasswareType: 'Elige el tipo de vasos para tu evento.' });
            setStepError('Selecciona una de las dos opciones de vasos para continuar.');
            return false;
        }
        setErrors({});
        setStepError('');
        return true;
    };

    const validateStep4 = (): boolean => {
        const nextErrors: Record<string, string> = {};
        if (firstName.trim().length < 2) nextErrors.firstName = 'Ingresa tu nombre.';
        if (lastName.trim().length < 2) nextErrors.lastName = 'Ingresa tu apellido.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            nextErrors.email = 'Ingresa un email válido.';
        }
        if (!isValidPhoneE164(phone)) {
            nextErrors.phone = 'Ingresa un WhatsApp válido (+56 9 ...).';
        }
        if (!eventType) nextErrors.eventType = 'Selecciona la temática.';
        if (eventType === 'Otro' && !otherType.trim()) {
            nextErrors.otherType = 'Especifica la temática.';
        }
        if (guests <= 0) nextErrors.guests = 'Indica la cantidad de invitados.';
        if (!acceptedTerms) {
            nextErrors.terms = 'Debes aceptar los términos del contrato para confirmar.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            if (
                nextErrors.firstName ||
                nextErrors.lastName ||
                nextErrors.email ||
                nextErrors.phone ||
                nextErrors.eventType ||
                nextErrors.otherType ||
                nextErrors.guests
            ) {
                setEditingContact(true);
            }
            setStepError('Revisa los campos destacados antes de confirmar.');
            return false;
        }

        setErrors({});
        setStepError('');
        return true;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        if (step === 3 && !validateStep3()) return;
        void flushNow();
        setStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
    };

    const handleBack = () => {
        setStepError('');
        setErrors({});
        setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
    };

    const handleSelectPickup = (choice: 'same' | 'next') => {
        clearError('pickupDate');
        if (choice === 'same') {
            setPickupDate(eventDate);
            setPickupTime('');
        } else {
            setPickupDate(nextPickupDate);
            setPickupTime(EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isConfirming || !minLitersMet) return;
        if (!validateStep1()) {
            setStep(1);
            return;
        }
        if (!validateStep2()) {
            setStep(2);
            return;
        }
        if (!validateStep3()) {
            setStep(3);
            return;
        }
        if (!validateStep4()) return;

        setIsConfirming(true);
        setConfirmError('');
        await flushNow();

        const normFirst = normalizePersonName(firstName);
        const normLast = normalizePersonName(lastName);
        const normEmail = normalizeEmail(email);
        const attribution = getClientMetaAttribution();

        const result = await confirmQuote({
            token: quote.token,
            client_name: normFirst,
            client_lastname: normLast,
            client_email: normEmail,
            client_phone: phone,
            client_address: address.trim(),
            comuna_name: comuna,
            region_name: currentRegionShortName,
            comuna_other: comunaOther || null,
            guests,
            event_type_id: eventType || null,
            event_type_other: eventType === 'Otro' ? otherType : null,
            event_date: eventDate,
            start_time: startTime,
            pickup_date: pickupDate,
            pickup_time:
                pickupChoice === 'same'
                    ? null
                    : pickupTime || EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME,
            comments: comments.trim() || null,
            dispenser,
            glassware_type: glasswareType || null,
            items: items.map((item) => ({
                product_id: item.product_id || null,
                size: item.size,
                quantity: item.quantity,
                variant: item.variant ?? null,
            })),
            fbc: attribution.fbc,
            fbp: attribution.fbp,
        });

        setIsConfirming(false);

        if (result.success) {
            fp.trackOnce(
                `purchase_${quote.token}`,
                'Purchase',
                {
                    content_name: 'Reserva Eventos Confirmada',
                    ...fp.metaLineParams('event', fp.META_SERVICE_EVENTOS),
                    value: totals.totalFinal,
                    currency: 'CLP',
                    contents: items.map((item) => ({
                        id: item.product_id,
                        item_price: item.offer_price_at_time,
                        quantity: item.quantity,
                    })),
                    content_type: 'product',
                    order_id: quote.token,
                },
                fp.quotePixelUserData(quote, {
                    em: normEmail || undefined,
                    ph: phone || undefined,
                    fn: normFirst || undefined,
                    ln: normLast || undefined,
                    ct: comuna && comuna !== 'Otra' ? comuna : comunaOther || undefined,
                })
            );
            router.replace(`/cotizar/${quote.token}?confirmed=true`);
            router.refresh();
        } else {
            setConfirmError(result.error ?? 'Error al confirmar. Intenta nuevamente.');
        }
    };

    const summaryForTotals: QuoteSummaryData = useMemo(
        () => ({
            items: items.map((i) => ({
                id: i.id!,
                name: i.product_name,
                selectedSize: i.size,
                variant: i.variant ?? null,
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
            installationCost: totals.installationCost,
            dispenserLabel: dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil',
            manualDiscount: quote.manual_discount || 0,
            totalPrice: totals.totalFinal,
            guests,
            canHaveMuro: false,
        }),
        [items, totals, dispenser, quote.manual_discount, guests]
    );

    const formattedFullAddress = formatQuoteAddress({
        client_address: address,
        comuna_name: comuna,
        comuna_other: comunaOther,
        region_name: currentRegionShortName,
    });

    const getInputCls = (hasError: boolean) =>
        hasError
            ? 'w-full min-h-[46px] px-3.5 py-2.5 border border-red-400 bg-red-50/20 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-base sm:text-sm font-medium transition-colors'
            : 'w-full min-h-[46px] px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm font-medium bg-white transition-colors';

    const selectedGlasswareOption = GLASSWARE_OPTIONS.find((g) => g.id === glasswareType);
    const progressPct = (step / 4) * 100;

    return (
        <div className="flex flex-col gap-5 animate-fade-in">
            {/* Top Navigation & Save Status */}
            <div className="flex items-center justify-between gap-3">
                <Link
                    href={`/cotizar/${quote.token}`}
                    className="group inline-flex items-center gap-2 text-brand-text-muted hover:text-primary font-bold text-xs sm:text-sm no-underline transition-colors"
                >
                    <span className="p-2 rounded-full bg-white border border-brand-border group-hover:border-primary/40 shadow-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </span>
                    <span>Volver a mi propuesta</span>
                </Link>

                <DraftSaveBadge status={saveStatus} error={saveError} onRetry={() => void flushNow()} />
            </div>

            {/* Step Progress Indicator */}
            <nav aria-label="Progreso de reserva" className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[0.7rem] font-black uppercase tracking-widest text-primary">
                        Paso {step} de 4
                    </span>
                    <span className="text-xs font-bold text-brand-text-muted">
                        Reserva oficial · {formatCurrency(totals.totalFinal)}
                    </span>
                </div>

                <div className="bg-slate-100 h-2 w-full rounded-full overflow-hidden mb-3">
                    <div
                        className="h-full bg-gradient-to-r from-primary via-[#f4a261] to-primary transition-all duration-500 rounded-full"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                <ol className="grid grid-cols-4 gap-1.5 list-none p-0 m-0">
                    {STEP_META.map((s) => {
                        const isActive = s.num === step;
                        const isDone = s.num < step;
                        const canJump = isDone;
                        return (
                            <li
                                key={s.num}
                                aria-current={isActive ? 'step' : undefined}
                                className="min-w-0"
                            >
                                <button
                                    type="button"
                                    disabled={!canJump}
                                    onClick={() => canJump && setStep(s.num)}
                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl text-[0.7rem] sm:text-xs font-bold transition-colors border-none ${
                                        isActive
                                            ? 'bg-primary/10 text-primary font-black'
                                            : isDone
                                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                                              : 'bg-transparent text-brand-text-muted/70 cursor-default'
                                    }`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                    ) : (
                                        <span
                                            className={`w-4 h-4 rounded-full text-[0.65rem] flex items-center justify-center shrink-0 ${
                                                isActive
                                                    ? 'bg-primary text-white font-black'
                                                    : 'bg-slate-200 text-slate-500 font-bold'
                                            }`}
                                        >
                                            {s.num}
                                        </span>
                                    )}
                                    <span className="truncate">{s.short}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            {/* Compact Collapsible Bar Peek */}
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
                <button
                    type="button"
                    aria-expanded={showBarPeek}
                    aria-controls="bar-peek-panel"
                    onClick={() => setShowBarPeek((v) => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-transparent border-none text-left cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Wine className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold text-brand-text truncate m-0">
                                Tu Barra · {totals.totalLiters}L ({totals.totalCocktails} cócteles)
                            </p>
                            <p className="text-[0.7rem] text-brand-text-muted font-semibold m-0">
                                {dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'} ·{' '}
                                <span className="text-primary font-black">{formatCurrency(totals.totalFinal)}</span>
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                        <span>{showBarPeek ? 'Ocultar' : 'Ver detalle'}</span>
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${showBarPeek ? 'rotate-180' : ''}`}
                        />
                    </span>
                </button>

                {showBarPeek && (
                    <div
                        id="bar-peek-panel"
                        className="px-4 pb-4 pt-2 border-t border-brand-border/60 bg-slate-50/50 space-y-3"
                    >
                        <ul className="space-y-1.5 list-none p-0 m-0">
                            {items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center justify-between text-xs sm:text-sm gap-2"
                                >
                                    <span className="font-semibold text-brand-text">
                                        {item.quantity}× {item.product_name}
                                        {item.variant ? ` (${item.variant})` : ''}{' '}
                                        <span className="text-brand-text-muted font-medium">({item.size})</span>
                                    </span>
                                    <span className="font-bold text-brand-text shrink-0">
                                        {formatCurrency(item.offer_price_at_time * item.quantity)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-2 border-t border-brand-border/60">
                            <QuoteSummaryTotals
                                data={summaryForTotals}
                                compact
                                hasComuna={Boolean(comuna)}
                                pendingShippingLabel="Ingresa dirección para calcular"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Link
                                href={`/cotizar/${quote.token}`}
                                className="text-xs font-bold text-primary hover:underline no-underline"
                            >
                                Modificar cócteles en mi propuesta →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {!minLitersMet && (
                <div
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold flex items-start gap-2.5"
                >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                    <div>
                        <p className="m-0">
                            Tu barra actual suma {totals.totalLiters}L, pero el mínimo para{' '}
                            {dispenser === 'muro' ? 'el Muro de Coctelería' : 'el Dispensador Portátil'} es de{' '}
                            {minRequiredLiters}L.
                        </p>
                        <Link
                            href={`/cotizar/${quote.token}`}
                            className="inline-block mt-1 text-primary underline font-black"
                        >
                            Volver a ajustar mis cócteles
                        </Link>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CARD 1: LUGAR Y HORARIO                                          */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {step === 1 && (
                <section className="bg-white rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm animate-fade-in">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-3">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Paso 1 de 4 · Montaje</span>
                        </div>
                        <h1
                            ref={stepHeadingRef}
                            tabIndex={-1}
                            className="text-2xl sm:text-3xl font-black text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            ¿Dónde y a qué hora es tu evento?
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Con estos datos coordinamos el traslado y dejamos tu barra instalada y fría antes de que lleguen tus invitados.
                        </p>
                    </div>

                    <div className="flex flex-col gap-5">
                        {/* Dirección */}
                        <div>
                            <label
                                htmlFor="res-address"
                                className="block font-extrabold mb-1.5 text-brand-text text-sm"
                            >
                                Dirección del evento{' '}
                                {!isAdminQuote && (
                                    <span className="font-semibold text-brand-text-muted">(Región Metropolitana)</span>
                                )}{' '}
                                <span className="text-primary" aria-hidden="true">*</span>
                            </label>
                            <AddressAutocomplete
                                id="res-address"
                                required
                                comuna={comuna}
                                detectedLocationLabel={
                                    !showManualRegionComuna && comuna
                                        ? `${comuna}${currentRegionShortName ? ` (${currentRegionShortName})` : ''}`
                                        : null
                                }
                                className={getInputCls(Boolean(errors.address || outOfRmError))}
                                value={address}
                                onChange={(val) => {
                                    setAddress(val);
                                    clearError('address');
                                    setOutOfRmError(null);
                                    setLastValidAddress(val);
                                }}
                                onSelectAddressDetails={(details) => {
                                    const result = evaluateGoogleEventAddress(
                                        details.comunaCandidates,
                                        details.regionName,
                                        comunas,
                                        regions,
                                        isAdminQuote
                                    );
                                    if (result.status === 'matched') {
                                        setRegionCode(result.comuna.regionCode);
                                        setComuna(result.comuna.name);
                                        setComunaOther('');
                                        setOutOfRmError(null);
                                        setLastValidAddress(details.address);
                                        clearError('comuna');
                                        clearError('address');
                                        if (!isAdminQuote) setShowManualRegionComuna(false);
                                    } else if (result.status === 'outside_rm') {
                                        setOutOfRmError(
                                            'Los eventos con dispensador operan exclusivamente en la Región Metropolitana (52 comunas).'
                                        );
                                    } else {
                                        setOutOfRmError(null);
                                        setLastValidAddress(details.address);
                                        setShowManualRegionComuna(true);
                                    }
                                }}
                                onManualModeChange={(isManual) => {
                                    setShowManualRegionComuna(isManual || isAdminQuote);
                                }}
                                onBlur={flushOnBlur}
                                placeholder="Ej: Av. Providencia 1234, Providencia"
                            />

                            {outOfRmError ? (
                                <div
                                    role="alert"
                                    className="mt-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 space-y-1"
                                >
                                    <p className="font-bold flex items-start gap-1.5 m-0">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                                        <span>{outOfRmError}</span>
                                    </p>
                                    <p className="text-xs text-slate-600 pl-5 m-0">
                                        ¿Tu evento es en otra región?{' '}
                                        <Link href="/barriles" className="font-bold text-primary hover:underline">
                                            Compra barriles desechables de 5L con envío a todo Chile →
                                        </Link>
                                    </p>
                                </div>
                            ) : errors.address ? (
                                <p className="mt-1.5 text-xs text-red-500 font-semibold flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{errors.address}</span>
                                </p>
                            ) : null}

                            {comuna && !outOfRmError && (
                                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>
                                        Traslado a <strong>{comuna}</strong>:{' '}
                                        <strong className="text-emerald-700">{totals.shippingLabel}</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        {showManualRegionComuna && (
                            <RegionComunaFields
                                regions={regions}
                                comunas={comunas}
                                serviceType="event"
                                allowAllActiveRegions={isAdminQuote}
                                regionCode={regionCode}
                                comuna={comuna}
                                otherComuna={comunaOther}
                                comunaError={errors.comuna}
                                comunaId="res-comuna"
                                onRegionChange={(code) => {
                                    setRegionCode(code);
                                    setComuna('');
                                    setComunaOther('');
                                    clearError('comuna');
                                }}
                                onComunaChange={(name) => {
                                    setComuna(name);
                                    clearError('comuna');
                                }}
                                onOtherComunaChange={(v) => {
                                    setComunaOther(v);
                                    if (v.trim()) clearError('comuna');
                                }}
                            />
                        )}

                        {/* Fecha y Hora de inicio */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            <div>
                                <ShippingDatePicker
                                    id="res-eventDate"
                                    label="Fecha del Evento"
                                    required
                                    value={eventDate}
                                    onChange={(val) => {
                                        setEventDate(val);
                                        clearError('eventDate');
                                        if (pickupDate) {
                                            if (pickupChoice === 'same' || pickupDate === eventDate) {
                                                setPickupDate(val);
                                                setPickupTime('');
                                            } else if (
                                                pickupChoice === 'next' ||
                                                pickupDate === nextPickupDate
                                            ) {
                                                setPickupDate(calculateMaxPickupDate(val));
                                                setPickupTime(EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
                                            }
                                        }
                                    }}
                                    methodConfig={eventMethodConfig}
                                    fallbackOffsetDays={2}
                                    availabilityContext={{
                                        dispenser,
                                        portableKegCount: countPortableKegs(items),
                                        excludeQuoteId: quote.id,
                                    }}
                                    helperText={
                                        errors.eventDate
                                            ? undefined
                                            : eventMethodConfig && eventMethodConfig.minOffsetDays > 0
                                              ? `Mín. ${formatOffsetShortLabel(eventMethodConfig, 2, 'calendar')} de anticipación.`
                                              : undefined
                                    }
                                />
                                {errors.eventDate && (
                                    <p className="mt-1.5 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.eventDate}</span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="res-startTime"
                                    className="block font-extrabold mb-1.5 text-brand-text text-sm"
                                >
                                    Hora de inicio del evento <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="res-startTime"
                                    name="startTime"
                                    type="time"
                                    required
                                    aria-invalid={Boolean(errors.startTime)}
                                    className={getInputCls(Boolean(errors.startTime))}
                                    value={startTime}
                                    onChange={(e) => {
                                        setStartTime(e.target.value);
                                        clearError('startTime');
                                    }}
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {QUICK_START_TIMES.map((t) => {
                                        const active = startTime === t;
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    setStartTime(t);
                                                    clearError('startTime');
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                                    active
                                                        ? 'bg-primary text-white border-primary'
                                                        : 'bg-slate-50 text-brand-text-muted border-slate-200 hover:border-primary/50 hover:text-brand-text'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                                {errors.startTime ? (
                                    <p className="mt-1.5 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.startTime}</span>
                                    </p>
                                ) : (
                                    <p className="mt-1.5 text-[0.72rem] text-brand-text-muted">
                                        Coordinaremos contigo la hora exacta de llegada para instalar antes del inicio.
                                    </p>
                                )}
                            </div>
                        </div>

                        {stepError && (
                            <div
                                role="alert"
                                className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{stepError}</span>
                            </div>
                        )}

                        <div className="pt-3 border-t border-brand-border/60 flex justify-end">
                            <button
                                type="button"
                                onClick={handleNext}
                                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <span>Siguiente: Retiro de equipos</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CARD 2: RETIRO DE EQUIPOS                                        */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {step === 2 && (
                <section className="bg-white rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm animate-fade-in">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-3">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Paso 2 de 4 · Retiro</span>
                        </div>
                        <h1
                            ref={stepHeadingRef}
                            tabIndex={-1}
                            className="text-2xl sm:text-3xl font-black text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            ¿Cuándo retiramos los equipos?
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            No tienes que lavar nada. Elige si prefieres que pasemos al día siguiente o el mismo día de tu evento.
                        </p>
                    </div>

                    <fieldset className="border-0 p-0 m-0">
                        <legend className="sr-only">Modalidad de retiro de equipos</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Día siguiente */}
                            <label
                                htmlFor="pickup-next"
                                className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-colors ${
                                    pickupChoice === 'next'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                        : 'border-brand-border bg-white hover:border-primary/40'
                                }`}
                            >
                                <input
                                    id="pickup-next"
                                    type="radio"
                                    name="pickupChoice"
                                    value="next"
                                    checked={pickupChoice === 'next'}
                                    onChange={() => handleSelectPickup('next')}
                                    className="sr-only"
                                />
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[0.7rem] font-black uppercase tracking-wider">
                                            <Sparkles className="w-3 h-3" />
                                            Más elegido
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                pickupChoice === 'next'
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-slate-300 bg-white'
                                            }`}
                                        >
                                            {pickupChoice === 'next' && <CheckCircle2 className="w-4 h-4" />}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 mb-2">
                                        <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700">
                                            <Sun className="w-5 h-5" />
                                        </div>
                                        <h2 className="text-lg font-black text-brand-text m-0">Día siguiente</h2>
                                    </div>

                                    <p className="text-sm font-extrabold text-primary mb-2">
                                        {nextPickupDate ? formatEventDate(nextPickupDate) : 'Al día siguiente'} · 12:00 a 14:00 hrs
                                    </p>
                                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed m-0">
                                        Disfruta toda la celebración sin apuros ni horarios de corte. Pasamos al día siguiente en bloque estándar.
                                    </p>
                                </div>
                            </label>

                            {/* Mismo día */}
                            <label
                                htmlFor="pickup-same"
                                className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-colors ${
                                    pickupChoice === 'same'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                        : 'border-brand-border bg-white hover:border-primary/40'
                                }`}
                            >
                                <input
                                    id="pickup-same"
                                    type="radio"
                                    name="pickupChoice"
                                    value="same"
                                    checked={pickupChoice === 'same'}
                                    onChange={() => handleSelectPickup('same')}
                                    className="sr-only"
                                />
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-brand-text-muted text-[0.7rem] font-bold uppercase tracking-wider">
                                            Horario a coordinar
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                pickupChoice === 'same'
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-slate-300 bg-white'
                                            }`}
                                        >
                                            {pickupChoice === 'same' && <CheckCircle2 className="w-4 h-4" />}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 mb-2">
                                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                                            <Moon className="w-5 h-5" />
                                        </div>
                                        <h2 className="text-lg font-black text-brand-text m-0">Mismo día</h2>
                                    </div>

                                    <p className="text-sm font-extrabold text-brand-text mb-2">
                                        {eventDate ? formatEventDate(eventDate) : 'Mismo día del evento'}
                                    </p>
                                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed m-0">
                                        Ideal si el lugar exige retirar el mismo día. Coordinaremos contigo el mejor horario durante tu evento.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </fieldset>

                    {stepError && (
                        <div
                            role="alert"
                            className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{stepError}</span>
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-brand-border/60 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Atrás</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <span>Siguiente: Elegir vasos</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </section>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CARD 3: ELECCIÓN DE VASOS Y COPAS                                */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {step === 3 && (
                <section className="bg-white rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm animate-fade-in">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-3">
                            <GlassWater className="w-3.5 h-3.5" />
                            <span>Paso 3 de 4 · Vasos incluidos ($0)</span>
                        </div>
                        <h1
                            ref={stepHeadingRef}
                            tabIndex={-1}
                            className="text-2xl sm:text-3xl font-black text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            ¿Qué vasos prefieres para tu evento?
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Ambas opciones están incluidas sin costo adicional. Elige la que mejor se adapte al estilo de tu celebración.
                        </p>
                    </div>

                    <fieldset className="border-0 p-0 m-0">
                        <legend className="sr-only">Tipo de vasos para el evento</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {GLASSWARE_OPTIONS.map((opt) => {
                                const isSelected = glasswareType === opt.id;
                                const isReusable = opt.id === 'reusable';

                                return (
                                    <label
                                        key={opt.id}
                                        htmlFor={`glassware-${opt.id}`}
                                        className={`relative flex flex-col rounded-3xl border-2 overflow-hidden cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/20'
                                                : 'border-brand-border bg-white hover:border-primary/40'
                                        }`}
                                    >
                                        <input
                                            id={`glassware-${opt.id}`}
                                            type="radio"
                                            name="glasswareType"
                                            value={opt.id}
                                            checked={isSelected}
                                            onChange={() => {
                                                setGlasswareType(opt.id);
                                                clearError('glasswareType');
                                            }}
                                            className="sr-only"
                                        />

                                        {/* Visual Showcase */}
                                        <div className="relative bg-zinc-900">
                                            {opt.images.length === 2 ? (
                                                <div className="grid grid-cols-2 gap-0.5 bg-zinc-800">
                                                    {opt.images.map((img) => (
                                                        <div key={img.src} className="relative aspect-square overflow-hidden">
                                                            <Image
                                                                src={img.src}
                                                                alt={img.alt}
                                                                fill
                                                                sizes="(max-width: 768px) 45vw, 220px"
                                                                className="object-cover"
                                                            />
                                                            {img.label && (
                                                                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[0.65rem] font-extrabold">
                                                                    {img.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="relative aspect-[2/1] md:aspect-[4/3] w-full overflow-hidden">
                                                    <Image
                                                        src={opt.images[0].src}
                                                        alt={opt.images[0].alt}
                                                        fill
                                                        sizes="(max-width: 768px) 90vw, 400px"
                                                        className="object-cover"
                                                    />
                                                    {opt.images[0].label && (
                                                        <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[0.68rem] font-extrabold">
                                                            {opt.images[0].label}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Top Badges */}
                                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-brand-text text-[0.68rem] font-black shadow-sm">
                                                {opt.badge}
                                            </span>

                                            <span
                                                aria-hidden="true"
                                                className={`absolute top-3 right-3 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors ${
                                                    isSelected
                                                        ? 'border-primary bg-primary text-white'
                                                        : 'border-white/80 bg-black/30 backdrop-blur-sm'
                                                }`}
                                            >
                                                {isSelected && <CheckCircle2 className="w-4 h-4" />}
                                            </span>
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                            <div>
                                                <h2 className="text-lg font-black text-brand-text mb-1 leading-tight">
                                                    {opt.title}
                                                </h2>
                                                <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-3.5">
                                                    {opt.summary}
                                                </p>

                                                <ul className="space-y-1.5 list-none p-0 m-0">
                                                    {opt.highlights.map((h) => (
                                                        <li
                                                            key={h}
                                                            className="flex items-start gap-2 text-xs font-semibold text-brand-text"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                                            <span>{h}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div
                                                className={`rounded-xl px-3.5 py-2.5 text-[0.73rem] leading-snug font-semibold border ${
                                                    isReusable
                                                        ? 'bg-amber-50/80 border-amber-200/80 text-amber-950'
                                                        : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950'
                                                }`}
                                            >
                                                {opt.conditionNote}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    {stepError && (
                        <div
                            role="alert"
                            className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{stepError}</span>
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-brand-border/60 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Atrás</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <span>Siguiente: Revisar y confirmar</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </section>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CARD 4: REVISIÓN FINAL Y CONTRATO DINÁMICO                       */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {step === 4 && (
                <form
                    onSubmit={handleConfirm}
                    noValidate
                    className="bg-white rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm animate-fade-in flex flex-col gap-6"
                >
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-3">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Paso 4 de 4 · Confirmación final</span>
                        </div>
                        <h1
                            ref={stepHeadingRef}
                            tabIndex={-1}
                            className="text-2xl sm:text-3xl font-black text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            Revisa y confirma tu reserva
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Verifica que todos los detalles estén correctos. Al confirmar te mostraremos los datos de transferencia para asegurar tu fecha.
                        </p>
                    </div>

                    {/* Scannable Review Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Lugar y horario */}
                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 flex flex-col justify-between gap-2">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[0.68rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-primary" />
                                        Lugar y horario
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                                <p className="text-sm font-extrabold text-brand-text m-0 leading-snug">
                                    {formattedFullAddress || 'Sin dirección'}
                                </p>
                                <p className="text-xs font-semibold text-brand-text-muted mt-1 m-0">
                                    {formatEventDate(eventDate)} · Inicio {startTime} hrs
                                </p>
                            </div>
                        </div>

                        {/* Retiro */}
                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 flex flex-col justify-between gap-2">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[0.68rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-primary" />
                                        Retiro de equipos
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                                <p className="text-sm font-extrabold text-brand-text m-0">
                                    {pickupChoice === 'next' ? 'Día siguiente' : 'Mismo día'}
                                </p>
                                <p className="text-xs font-semibold text-brand-text-muted mt-1 m-0">
                                    {pickupChoice === 'next'
                                        ? `${formatEventDate(pickupDate)} · 12:00 a 14:00 hrs`
                                        : `${formatEventDate(pickupDate)} · Horario a coordinar`}
                                </p>
                            </div>
                        </div>

                        {/* Vasos */}
                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 flex items-center gap-3">
                            {selectedGlasswareOption && (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-brand-border bg-zinc-900">
                                    <Image
                                        src={selectedGlasswareOption.images[0].src}
                                        alt={selectedGlasswareOption.images[0].alt}
                                        fill
                                        sizes="56px"
                                        className="object-cover"
                                    />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[0.68rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                                        <GlassWater className="w-3.5 h-3.5 text-primary" />
                                        Vasos ($0)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                                <p className="text-sm font-extrabold text-brand-text m-0 leading-snug">
                                    {formatGlasswareLabel(glasswareType)}
                                </p>
                            </div>
                        </div>

                        {/* Contacto y Evento */}
                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 flex flex-col justify-between gap-1.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[0.68rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-primary" />
                                    Contacto y evento
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setEditingContact((v) => !v)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                >
                                    <Edit3 className="w-3 h-3" />
                                    <span>{editingContact ? 'Listo' : 'Editar'}</span>
                                </button>
                            </div>
                            <p className="text-sm font-extrabold text-brand-text m-0 leading-snug">
                                {`${firstName} ${lastName}`.trim() || 'Sin nombre'}
                            </p>
                            <p className="text-xs font-semibold text-brand-text-muted m-0 break-all">
                                {email || 'Falta email'} · {phone ? formatPhoneDisplay(phone) : 'Falta celular'}
                            </p>
                            <p className="text-xs font-semibold text-brand-text-muted m-0">
                                {eventTypeDisplay || 'Sin temática'} · {guests > 0 ? `${guests} invitados` : 'Indicar invitados'}
                            </p>
                        </div>
                    </div>

                    {/* Inline Contact / Event Details Editor (when editing or missing required info) */}
                    {editingContact && (
                        <div className="rounded-2xl border-2 border-primary/25 bg-primary/[0.02] p-4 sm:p-5 space-y-3.5 animate-fade-in">
                            <p className="text-xs font-black uppercase tracking-wider text-primary m-0">
                                Completa o edita tus datos de contacto y evento
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="res-firstName" className="block font-bold mb-1 text-xs text-brand-text">
                                        Nombre <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        id="res-firstName"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => {
                                            setFirstName(e.target.value);
                                            clearError('firstName');
                                        }}
                                        onBlur={(e) => {
                                            setFirstName(normalizePersonName(e.target.value));
                                            flushOnBlur();
                                        }}
                                        className={getInputCls(Boolean(errors.firstName))}
                                    />
                                    {errors.firstName && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.firstName}</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="res-lastName" className="block font-bold mb-1 text-xs text-brand-text">
                                        Apellido <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        id="res-lastName"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => {
                                            setLastName(e.target.value);
                                            clearError('lastName');
                                        }}
                                        onBlur={(e) => {
                                            setLastName(normalizePersonName(e.target.value));
                                            flushOnBlur();
                                        }}
                                        className={getInputCls(Boolean(errors.lastName))}
                                    />
                                    {errors.lastName && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.lastName}</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="res-email" className="block font-bold mb-1 text-xs text-brand-text">
                                        Email <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        id="res-email"
                                        type="email"
                                        autoCorrect="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value.toLowerCase());
                                            clearError('email');
                                        }}
                                        onBlur={(e) => {
                                            setEmail(normalizeEmail(e.target.value));
                                            flushOnBlur();
                                        }}
                                        className={getInputCls(Boolean(errors.email))}
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.email}</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="res-phone" className="block font-bold mb-1 text-xs text-brand-text">
                                        WhatsApp <span className="text-primary">*</span>
                                    </label>
                                    <PhoneInput
                                        id="res-phone"
                                        value={phone}
                                        onChange={(e164) => {
                                            setPhone(e164);
                                            if (isValidPhoneE164(e164)) clearError('phone');
                                        }}
                                        onBlur={flushOnBlur}
                                        className={getInputCls(Boolean(errors.phone))}
                                    />
                                    {errors.phone && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.phone}</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="res-eventType" className="block font-bold mb-1 text-xs text-brand-text">
                                        Temática <span className="text-primary">*</span>
                                    </label>
                                    <select
                                        id="res-eventType"
                                        value={eventType}
                                        onChange={(e) => {
                                            setEventType(e.target.value);
                                            clearError('eventType');
                                        }}
                                        className={getInputCls(Boolean(errors.eventType))}
                                    >
                                        <option value="">Selecciona temática...</option>
                                        {regularEventTypes.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                        <option value="Otro">Otro</option>
                                    </select>
                                    {errors.eventType && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.eventType}</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="res-guests" className="block font-bold mb-1 text-xs text-brand-text">
                                        Invitados <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        id="res-guests"
                                        type="number"
                                        min={1}
                                        value={guests || ''}
                                        onChange={(e) => {
                                            setGuests(parseInt(e.target.value, 10) || 0);
                                            clearError('guests');
                                        }}
                                        onBlur={flushOnBlur}
                                        className={getInputCls(Boolean(errors.guests))}
                                    />
                                    {errors.guests && (
                                        <p className="mt-1 text-xs text-red-500 font-semibold">{errors.guests}</p>
                                    )}
                                </div>
                            </div>
                            {eventType === 'Otro' && (
                                <div>
                                    <label htmlFor="res-otherType" className="block font-bold mb-1 text-xs text-brand-text">
                                        Especificar temática <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        id="res-otherType"
                                        type="text"
                                        value={otherType}
                                        onChange={(e) => {
                                            setOtherType(e.target.value);
                                            clearError('otherType');
                                        }}
                                        onBlur={flushOnBlur}
                                        placeholder="Ej: Aniversario, Graduación..."
                                        className={getInputCls(Boolean(errors.otherType))}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Optional Comments */}
                    {showComments ? (
                        <div>
                            <label htmlFor="res-comments" className="block font-bold mb-1.5 text-brand-text text-xs uppercase tracking-wider">
                                Indicaciones para el montaje o acceso (opcional)
                            </label>
                            <textarea
                                id="res-comments"
                                rows={2}
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                onBlur={flushOnBlur}
                                placeholder="Ej: Conserjería, estacionamiento de visitas, sector del quincho..."
                                className="w-full p-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm"
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowComments(true)}
                            className="text-left text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer w-fit"
                        >
                            + Añadir indicaciones de llegada o montaje (opcional)
                        </button>
                    )}

                    {/* Totals Summary */}
                    <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 sm:p-5">
                        <QuoteSummaryTotals
                            data={summaryForTotals}
                            compact
                            hasComuna={Boolean(comuna)}
                        />
                    </div>

                    {/* Dynamic Service Contract */}
                    <div className="space-y-2.5">
                        <h2 className="text-xs font-black text-brand-text flex items-center gap-2 uppercase tracking-widest m-0">
                            <FileText className="w-4 h-4 text-primary" />
                            <span>Contrato de Servicio</span>
                        </h2>
                        <div
                            className={`bg-slate-50 border-2 rounded-2xl overflow-hidden ${
                                errors.terms ? 'border-red-300' : 'border-brand-border'
                            }`}
                        >
                            <div className="max-h-52 overflow-y-auto p-4 sm:p-5 text-xs sm:text-[0.8rem] text-brand-text-muted leading-relaxed bg-white/80">
                                <p className="text-center font-black mb-3 uppercase tracking-[0.2em] text-brand-text text-[0.7rem] border-b border-brand-border/50 pb-2">
                                    CONTRATO DE SERVICIO
                                </p>
                                <p className="mb-2.5">
                                    Entre <strong>Cocktails on Tap Chile</strong>, en adelante &ldquo;El Arrendador&rdquo;, y don/doña:{' '}
                                    <strong>
                                        {firstName} {lastName}
                                    </strong>
                                    , en adelante &ldquo;El Arrendatario&rdquo;, se acuerda lo siguiente:
                                </p>
                                <p className="font-black text-brand-text mb-1">1. Objeto del contrato</p>
                                <p className="mb-2.5">
                                    El Arrendador proporcionará al Arrendatario un servicio de cócteles listos para servir en barra autoservicio, incluyendo barriles, dispensadores, hielo, garnish y{' '}
                                    {glasswareType === 'disposable_pet'
                                        ? 'vasos PET desechables de 360 ml.'
                                        : 'vasos (450 ml) y copas (480 ml) reutilizables en préstamo.'}
                                </p>
                                <p className="font-black text-brand-text mb-1">2. Responsabilidad por equipos</p>
                                <ul className="list-disc pl-4 mb-2.5 space-y-1">
                                    {glasswareType !== 'disposable_pet' && (
                                        <>
                                            <li>$1.000 (mil pesos) por vaso reutilizable extraviado o dañado.</li>
                                            <li>$2.000 (dos mil pesos) por copa reutilizable extraviada o dañada.</li>
                                        </>
                                    )}
                                    <li>
                                        Hasta $500.000 (quinientos mil pesos) por dispensador extraviado o dañado.
                                    </li>
                                </ul>
                                {glasswareType === 'disposable_pet' && (
                                    <p className="mb-2.5 text-emerald-700 font-semibold">
                                        Los vasos PET desechables no requieren devolución ni generan cobros por faltantes.
                                    </p>
                                )}
                                <p className="font-black text-brand-text mb-1">3. Aceptación y pago</p>
                                <p className="mb-1">
                                    Se entiende aceptado al confirmar la reserva mediante el pago del{' '}
                                    <strong>100% del total</strong>.
                                </p>
                                <p className="m-0">
                                    La reserva queda asegurada una vez realizado y validado el pago total.
                                </p>
                            </div>
                            <div
                                className={`p-4 border-t ${
                                    errors.terms
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-primary/5 border-brand-border'
                                }`}
                            >
                                <label
                                    htmlFor="res-terms"
                                    className="flex items-center gap-3 cursor-pointer group"
                                >
                                    <span className="relative flex items-center justify-center shrink-0">
                                        <input
                                            id="res-terms"
                                            type="checkbox"
                                            checked={acceptedTerms}
                                            onChange={(e) => {
                                                setAcceptedTerms(e.target.checked);
                                                if (e.target.checked) clearError('terms');
                                            }}
                                            className="peer sr-only"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                                                acceptedTerms
                                                    ? 'bg-primary border-primary text-white'
                                                    : errors.terms
                                                      ? 'border-red-400 bg-red-50'
                                                      : 'border-slate-300 bg-white group-hover:border-primary/60'
                                            }`}
                                        >
                                            {acceptedTerms && <CheckCircle2 className="w-4 h-4" />}
                                        </span>
                                    </span>
                                    <span
                                        className={`text-xs sm:text-sm font-bold leading-snug ${
                                            errors.terms ? 'text-red-700' : 'text-brand-text'
                                        }`}
                                    >
                                        He leído y acepto los términos del contrato de servicio
                                    </span>
                                </label>
                                {errors.terms && (
                                    <p className="mt-1.5 text-xs text-red-600 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.terms}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {(stepError || confirmError) && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{confirmError || stepError}</span>
                        </div>
                    )}

                    {/* Final Actions */}
                    <div className="pt-2 border-t border-brand-border/60 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={isConfirming}
                            className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Atrás</span>
                        </button>

                        <button
                            type="submit"
                            disabled={isConfirming || !minLitersMet}
                            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-primary text-white font-black text-base sm:text-lg hover:bg-primary-dark shadow-[0_8px_25px_rgba(226,160,73,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isConfirming ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Confirmando reserva...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Confirmar Reserva · {formatCurrency(totals.totalFinal)}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
