'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { useWizard } from '@/hooks/useWizard';
import { DEFAULT_REGION_CODE, type Comuna, type Region, type EventType, type GlasswareType } from '@/lib/types';
import {
    formatCurrency,
    evaluateGoogleEventAddress,
    normalizeEmail,
    normalizePersonName,
} from '@/lib/utils';
import { formatQuoteAddress } from '@/lib/geo';
import { isValidPhoneE164, isChilePrefixOnly } from '@/lib/phone';
import {
    formatEventDate,
    calculateMaxPickupDate,
    isAllowedEventPickupDate,
    EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME,
} from '@/lib/wizardLogic';
import { GLASSWARE_OPTIONS, formatGlasswareLabel } from '@/lib/glassware';
import { GOOGLE_MAPS_API_KEY, PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import { formatOffsetShortLabel, validateShippingDate } from '@/lib/shippingMethods';
import { countPortableKegs } from '@/lib/eventCapacity';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import PhoneInput from '@/components/ui/PhoneInput';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';
import {
    ArrowLeft,
    ArrowRight,
    MapPin,
    Calendar,
    Clock,
    GlassWater,
    CheckCircle2,
    AlertCircle,
    FileText,
    Loader2,
    Sparkles,
    Sun,
    Moon,
    User,
    Wine,
    ShieldCheck,
} from 'lucide-react';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
    onOpenBarSummary: () => void;
    onSwitchToQuote: () => void;
    onBackToCatalog: () => void;
    onSubmitReserve: () => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
    saveError?: string;
}

const STEP_META = [
    { num: 1, short: 'Lugar y hora' },
    { num: 2, short: 'Retiro' },
    { num: 3, short: 'Vasos' },
    { num: 4, short: 'Confirmar' },
] as const;

const QUICK_START_TIMES = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

/**
 * Flujo guiado de 4 tarjetas paso a paso para "Generar reserva ahora" dentro de /eventos.
 * Comparte la misma experiencia visual y lógica de /cotizar/[token]/reservar.
 */
export default function EventWizardReserveFlow({
    wizard,
    comunas,
    regions,
    eventTypes,
    onOpenBarSummary,
    onSwitchToQuote,
    onBackToCatalog,
    onSubmitReserve,
    sendStatus,
    saveError,
}: Props) {
    const { state, updateContact, updateEventData } = wizard;
    const stepHeadingRef = useRef<HTMLHeadingElement>(null);

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [showManualRegionComuna, setShowManualRegionComuna] = useState(
        () => !GOOGLE_MAPS_API_KEY || Boolean(state.contact.otherComuna)
    );
    const [outOfRmError, setOutOfRmError] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(Boolean(state.contact.comments));
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [stepError, setStepError] = useState('');

    useEffect(() => {
        if (!state.eventData.glasswareType) {
            updateEventData('glasswareType', 'disposable_pet');
        }
    }, [state.eventData.glasswareType, updateEventData]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const t = setTimeout(() => stepHeadingRef.current?.focus(), 70);
        return () => clearTimeout(t);
    }, [step]);

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(
        () => wizard.calculateSummaryData(),
        [state.selections, state.dispenser, state.contact.comuna]
    );

    const summaryForTotals = {
        ...summaryData,
        guests: state.consumption.guests,
        canHaveMuro: summaryData.canHaveMuro,
    };

    const minRequiredLiters = state.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = summaryData.totalLiters >= minRequiredLiters;
    const isSaving = sendStatus === 'saving';

    const eventDate = state.eventData.date;
    const nextPickupDate = calculateMaxPickupDate(eventDate);
    const isSameDayPickup = Boolean(
        state.eventData.pickupDate && eventDate && state.eventData.pickupDate === eventDate
    );
    const isNextDayPickup = Boolean(
        state.eventData.pickupDate && eventDate && state.eventData.pickupDate === nextPickupDate
    );
    const pickupChoice: 'same' | 'next' | '' = isSameDayPickup
        ? 'same'
        : isNextDayPickup
          ? 'next'
          : '';

    const glasswareType = (state.eventData.glasswareType || '') as GlasswareType | '';
    const selectedGlasswareOption = GLASSWARE_OPTIONS.find((g) => g.id === glasswareType);

    const regularEventTypes = useMemo(
        () => eventTypes.filter((t) => t.id !== 'Otro' && t.name.toLowerCase() !== 'otro'),
        [eventTypes]
    );

    const currentRegionShortName =
        regions.find((r) => r.code === (state.contact.region || DEFAULT_REGION_CODE))?.shortName ||
        'RM';

    const formattedFullAddress = formatQuoteAddress({
        client_address: state.contact.address,
        comuna_name: state.contact.comuna,
        comuna_other: state.contact.otherComuna,
        region_name: currentRegionShortName,
    });

    const clearError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setStepError('');
    };

    const handleSelectPickup = (choice: 'same' | 'next') => {
        clearError('pickupDate');
        if (choice === 'same') {
            updateEventData('pickupDate', eventDate);
            updateEventData('pickupTime', '');
        } else {
            updateEventData('pickupDate', nextPickupDate);
            updateEventData('pickupTime', EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
        }
    };

    const validateStep1 = (): boolean => {
        const nextErrors: Record<string, string> = {};
        if (outOfRmError) {
            nextErrors.address = outOfRmError;
        } else if (state.contact.address.trim().length < 5) {
            nextErrors.address = 'Ingresa la dirección exacta del evento (mín. 5 caracteres).';
        }
        if (!state.contact.comuna.trim()) {
            nextErrors.comuna = 'Selecciona la comuna en la Región Metropolitana.';
            setShowManualRegionComuna(true);
        }
        if (!state.eventData.date.trim()) {
            nextErrors.eventDate = 'Selecciona la fecha de tu evento.';
        } else {
            const dateErr = validateShippingDate(state.eventData.date, eventMethodConfig, 2);
            if (dateErr) nextErrors.eventDate = dateErr;
        }
        if (!state.eventData.startTime.trim()) {
            nextErrors.startTime = 'Indica la hora de inicio del evento.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            setStepError('Completa los datos destacados para continuar.');
            const firstKey = Object.keys(nextErrors)[0];
            setTimeout(() => {
                const el = document.getElementById(`wres-${firstKey}`);
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
        if (
            !pickupChoice ||
            !state.eventData.pickupDate ||
            !isAllowedEventPickupDate(eventDate, state.eventData.pickupDate)
        ) {
            setErrors({ pickupDate: 'Elige cuándo prefieres que retiremos los equipos.' });
            setStepError('Selecciona una opción de retiro para continuar.');
            return false;
        }
        if (pickupChoice === 'next' && !state.eventData.pickupTime) {
            updateEventData('pickupTime', EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
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
        if (state.contact.firstName.trim().length < 2) nextErrors.firstName = 'Ingresa tu nombre.';
        if (state.contact.lastName.trim().length < 2) nextErrors.lastName = 'Ingresa tu apellido.';
        if (!state.contact.email.trim()) {
            nextErrors.email = 'El email es obligatorio.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email.trim())) {
            nextErrors.email = 'Ingresa un email válido (ej: nombre@correo.com).';
        }
        if (!state.contact.phone.trim() || isChilePrefixOnly(state.contact.phone)) {
            nextErrors.phone = 'El celular de WhatsApp es obligatorio.';
        } else if (!isValidPhoneE164(state.contact.phone)) {
            nextErrors.phone = 'Ingresa tu celular de 9 dígitos (ej: +56 9 1234 5678).';
        }
        if (!state.eventData.type.trim()) {
            nextErrors.type = 'Selecciona la temática de tu evento.';
        } else if (state.eventData.type === 'Otro' && !state.eventData.otherType?.trim()) {
            nextErrors.type = 'Especifica la temática de tu evento.';
        }
        if (!acceptedTerms) {
            nextErrors.terms = 'Debes aceptar los términos del contrato para confirmar.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            setStepError('Revisa los campos destacados antes de confirmar.');
            const firstKey = Object.keys(nextErrors)[0];
            setTimeout(() => {
                const el = document.getElementById(`wres-${firstKey}`);
                el?.focus();
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 40);
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
        setStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
    };

    const handleBack = () => {
        setStepError('');
        setErrors({});
        if (step === 1) {
            onBackToCatalog();
        } else {
            setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
        }
    };

    const handleFinalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || !minLitersMet) return;
        const fn = normalizePersonName(state.contact.firstName);
        const ln = normalizePersonName(state.contact.lastName);
        const em = normalizeEmail(state.contact.email);
        if (fn !== state.contact.firstName) updateContact('firstName', fn);
        if (ln !== state.contact.lastName) updateContact('lastName', ln);
        if (em !== state.contact.email) updateContact('email', em);
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
        onSubmitReserve();
    };

    const getInputCls = (hasError: boolean) =>
        hasError
            ? 'w-full min-h-[46px] px-3.5 py-2.5 border border-red-400 bg-red-50/20 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-base sm:text-sm font-medium transition-colors'
            : 'w-full min-h-[46px] px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm font-medium bg-white transition-colors';

    const progressPct = (step / 4) * 100;

    return (
        <div className="max-w-3xl mx-auto flex flex-col gap-5 animate-fade-in py-1 sm:py-3">
            {/* Unified Step 5 Header matching Steps 1-4 */}
            <div className="text-center mb-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold uppercase tracking-wider mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Paso 5 de 5 · Reserva</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-text tracking-tight mb-2">
                    Agenda tu Reserva
                </h2>
                <p className="text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto font-medium leading-relaxed m-0">
                    Completa estos 4 pasos breves para dejar tu fecha reservada.
                </p>
            </div>

            {/* Step Progress Nav */}
            <nav aria-label="Progreso de reserva" className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2.5 gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                        Tarjeta {step} de 4
                    </span>
                    <button
                        type="button"
                        onClick={onOpenBarSummary}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-text hover:text-primary bg-slate-50 hover:bg-primary/5 border border-brand-border rounded-xl px-2.5 py-1 cursor-pointer transition-colors"
                    >
                        <Wine className="w-3.5 h-3.5 text-primary" />
                        <span>
                            {summaryData.totalLiters}L · {formatCurrency(summaryData.totalPrice)}
                        </span>
                    </button>
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
                        return (
                            <li key={s.num} aria-current={isActive ? 'step' : undefined} className="min-w-0">
                                <button
                                    type="button"
                                    disabled={!isDone}
                                    onClick={() => isDone && setStep(s.num)}
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
                            className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            ¿Dónde y a qué hora es tu evento?
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Con estos datos calculamos el traslado exacto y dejamos tu barra instalada y fría antes de que lleguen tus invitados.
                        </p>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div>
                            <label htmlFor="wres-address" className="block font-extrabold mb-1.5 text-brand-text text-sm">
                                Dirección del evento{' '}
                                <span className="font-semibold text-brand-text-muted">(Región Metropolitana)</span>{' '}
                                <span className="text-primary" aria-hidden="true">*</span>
                            </label>
                            <AddressAutocomplete
                                id="wres-address"
                                required
                                comuna={state.contact.comuna}
                                detectedLocationLabel={
                                    !showManualRegionComuna && state.contact.comuna
                                        ? `${state.contact.comuna} (${currentRegionShortName})`
                                        : null
                                }
                                className={getInputCls(Boolean(errors.address || outOfRmError))}
                                value={state.contact.address}
                                onChange={(val) => {
                                    updateContact('address', val);
                                    clearError('address');
                                    setOutOfRmError(null);
                                }}
                                onSelectAddressDetails={(details) => {
                                    const result = evaluateGoogleEventAddress(
                                        details.comunaCandidates,
                                        details.regionName,
                                        comunas,
                                        regions
                                    );
                                    if (result.status === 'matched') {
                                        updateContact('region', result.comuna.regionCode);
                                        updateContact('comuna', result.comuna.name);
                                        updateContact('otherComuna', '');
                                        clearError('comuna');
                                        clearError('address');
                                        setOutOfRmError(null);
                                        setShowManualRegionComuna(false);
                                    } else if (result.status === 'outside_rm') {
                                        setOutOfRmError(
                                            'Los eventos con dispensador operan exclusivamente en la Región Metropolitana (52 comunas).'
                                        );
                                    } else {
                                        setOutOfRmError(null);
                                        setShowManualRegionComuna(true);
                                    }
                                }}
                                onManualModeChange={(isManual) => {
                                    setShowManualRegionComuna(isManual);
                                }}
                                placeholder="Ej: Av. Providencia 1234, Providencia"
                            />

                            {outOfRmError ? (
                                <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 space-y-1">
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

                            {state.contact.comuna && !outOfRmError && (
                                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>
                                        Traslado a <strong>{state.contact.comuna}</strong>:{' '}
                                        <strong className="text-emerald-700">{summaryData.shippingLabel}</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        {showManualRegionComuna && (
                            <RegionComunaFields
                                regions={regions}
                                comunas={comunas}
                                serviceType="event"
                                regionCode={state.contact.region || DEFAULT_REGION_CODE}
                                comuna={state.contact.comuna}
                                otherComuna={state.contact.otherComuna}
                                comunaError={errors.comuna}
                                comunaId="wres-comuna"
                                onRegionChange={(code) => {
                                    updateContact('region', code);
                                    clearError('comuna');
                                }}
                                onComunaChange={(name) => {
                                    updateContact('comuna', name);
                                    clearError('comuna');
                                }}
                                onOtherComunaChange={(v) => {
                                    updateContact('otherComuna', v);
                                    if (v.trim()) clearError('comuna');
                                }}
                            />
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            <div>
                                <ShippingDatePicker
                                    id="wres-eventDate"
                                    label="Fecha del Evento"
                                    required
                                    value={state.eventData.date}
                                    onChange={(val) => {
                                        updateEventData('date', val);
                                        clearError('eventDate');
                                        if (state.eventData.pickupDate) {
                                            if (isSameDayPickup) {
                                                updateEventData('pickupDate', val);
                                                updateEventData('pickupTime', '');
                                            } else if (isNextDayPickup) {
                                                updateEventData('pickupDate', calculateMaxPickupDate(val));
                                                updateEventData('pickupTime', EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME);
                                            }
                                        }
                                    }}
                                    methodConfig={eventMethodConfig}
                                    fallbackOffsetDays={2}
                                    availabilityContext={{
                                        dispenser: state.dispenser === 'muro' ? 'muro' : 'portatil',
                                        portableKegCount: countPortableKegs(state.selections),
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
                                <label htmlFor="wres-startTime" className="block font-extrabold mb-1.5 text-brand-text text-sm">
                                    Hora de inicio del evento <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="wres-startTime"
                                    type="time"
                                    required
                                    aria-invalid={Boolean(errors.startTime)}
                                    className={getInputCls(Boolean(errors.startTime))}
                                    value={state.eventData.startTime}
                                    onChange={(e) => {
                                        updateEventData('startTime', e.target.value);
                                        clearError('startTime');
                                    }}
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {QUICK_START_TIMES.map((t) => {
                                        const active = state.eventData.startTime === t;
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    updateEventData('startTime', t);
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
                            <div role="alert" className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{stepError}</span>
                            </div>
                        )}

                        <div className="pt-3 border-t border-brand-border/60 flex flex-col gap-3">
                            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Volver al catálogo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <span>Siguiente: Retiro de equipos</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={onSwitchToQuote}
                                    className="text-xs font-bold text-brand-text-muted hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                                >
                                    ¿Solo quieres recibir la cotización por ahora? <span className="text-primary font-black">Cambiar a cotización formal →</span>
                                </button>
                            </div>
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
                            className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight mb-1.5 outline-none"
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
                            <label
                                htmlFor="wpickup-next"
                                className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-colors ${
                                    pickupChoice === 'next'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                        : 'border-brand-border bg-white hover:border-primary/40'
                                }`}
                            >
                                <input
                                    id="wpickup-next"
                                    type="radio"
                                    name="wizardPickupChoice"
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

                            <label
                                htmlFor="wpickup-same"
                                className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-colors ${
                                    pickupChoice === 'same'
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                        : 'border-brand-border bg-white hover:border-primary/40'
                                }`}
                            >
                                <input
                                    id="wpickup-same"
                                    type="radio"
                                    name="wizardPickupChoice"
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
                        <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
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
                            className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            ¿Qué vasos prefieres para tu evento?
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Ambas opciones están incluidas sin costo adicional. Elige la que mejor se adapte a tu celebración.
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
                                        htmlFor={`wglass-${opt.id}`}
                                        className={`relative flex flex-col rounded-3xl border-2 overflow-hidden cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/20'
                                                : 'border-brand-border bg-white hover:border-primary/40'
                                        }`}
                                    >
                                        <input
                                            id={`wglass-${opt.id}`}
                                            type="radio"
                                            name="wizardGlasswareType"
                                            value={opt.id}
                                            checked={isSelected}
                                            onChange={() => {
                                                updateEventData('glasswareType', opt.id);
                                                clearError('glasswareType');
                                            }}
                                            className="sr-only"
                                        />

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
                        <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
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
                            <span>Siguiente: Tus datos y contrato</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </section>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CARD 4: TUS DATOS, REVISIÓN Y CONTRATO DINÁMICO                  */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {step === 4 && (
                <form
                    onSubmit={handleFinalSubmit}
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
                            className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight mb-1.5 outline-none"
                        >
                            Completa tus datos y confirma
                        </h1>
                        <p className="text-sm text-brand-text-muted m-0">
                            Al confirmar te mostraremos los datos de transferencia bancaria y te enviaremos tu comprobante oficial por email y WhatsApp.
                        </p>
                    </div>

                    {/* Review Strip of Steps 1-3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-3.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[0.66rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-primary" /> Lugar y hora
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-[0.72rem] font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                >
                                    Cambiar
                                </button>
                            </div>
                            <p className="text-xs font-extrabold text-brand-text m-0 leading-snug">
                                {formattedFullAddress}
                            </p>
                            <p className="text-[0.72rem] font-semibold text-brand-text-muted mt-1 m-0">
                                {formatEventDate(eventDate)} · {state.eventData.startTime} hrs
                            </p>
                        </div>

                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-3.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[0.66rem] font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-primary" /> Retiro
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="text-[0.72rem] font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                >
                                    Cambiar
                                </button>
                            </div>
                            <p className="text-xs font-extrabold text-brand-text m-0">
                                {pickupChoice === 'next' ? 'Día siguiente' : 'Mismo día'}
                            </p>
                            <p className="text-[0.72rem] font-semibold text-brand-text-muted mt-1 m-0">
                                {pickupChoice === 'next'
                                    ? `${formatEventDate(state.eventData.pickupDate)} · 12:00 a 14:00`
                                    : `${formatEventDate(state.eventData.pickupDate)} · A coordinar`}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-3.5 flex items-center gap-2.5">
                            {selectedGlasswareOption && (
                                <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-brand-border bg-zinc-900">
                                    <Image
                                        src={selectedGlasswareOption.images[0].src}
                                        alt={selectedGlasswareOption.images[0].alt}
                                        fill
                                        sizes="44px"
                                        className="object-cover"
                                    />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="text-[0.66rem] font-black uppercase tracking-wider text-brand-text-muted">
                                        Vasos ($0)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="text-[0.72rem] font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                                <p className="text-xs font-extrabold text-brand-text m-0 leading-snug">
                                    {formatGlasswareLabel(glasswareType)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contact + Theme Fields */}
                    <fieldset className="flex flex-col gap-3.5 border-0 p-0 m-0">
                        <legend className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 text-brand-text w-full mb-1">
                            <User className="w-3.5 h-3.5 text-primary" />
                            <span className="font-extrabold text-[0.75rem] uppercase tracking-wider text-brand-text-muted">
                                Tus datos de contacto
                            </span>
                        </legend>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label htmlFor="wres-firstName" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Nombre <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="wres-firstName"
                                    type="text"
                                    required
                                    placeholder="Juan"
                                    autoComplete="given-name"
                                    className={getInputCls(Boolean(errors.firstName))}
                                    value={state.contact.firstName}
                                    onBlur={(e) => updateContact('firstName', normalizePersonName(e.target.value))}
                                    onChange={(e) => {
                                        updateContact('firstName', e.target.value);
                                        if (e.target.value.trim().length >= 2) clearError('firstName');
                                    }}
                                />
                                {errors.firstName && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.firstName}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="wres-lastName" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Apellido <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="wres-lastName"
                                    type="text"
                                    required
                                    placeholder="Pérez"
                                    autoComplete="family-name"
                                    className={getInputCls(Boolean(errors.lastName))}
                                    value={state.contact.lastName}
                                    onBlur={(e) => updateContact('lastName', normalizePersonName(e.target.value))}
                                    onChange={(e) => {
                                        updateContact('lastName', e.target.value);
                                        if (e.target.value.trim().length >= 2) clearError('lastName');
                                    }}
                                />
                                {errors.lastName && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.lastName}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label htmlFor="wres-email" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Email <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="wres-email"
                                    type="email"
                                    required
                                    placeholder="juan@correo.com"
                                    autoComplete="email"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    className={getInputCls(Boolean(errors.email))}
                                    value={state.contact.email}
                                    onBlur={(e) => updateContact('email', normalizeEmail(e.target.value))}
                                    onChange={(e) => {
                                        updateContact('email', e.target.value.toLowerCase());
                                        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())) clearError('email');
                                    }}
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="wres-phone" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    WhatsApp <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <PhoneInput
                                    id="wres-phone"
                                    required
                                    autoComplete="tel"
                                    className={getInputCls(Boolean(errors.phone))}
                                    value={state.contact.phone}
                                    onChange={(e164) => {
                                        updateContact('phone', e164);
                                        if (isValidPhoneE164(e164)) clearError('phone');
                                    }}
                                />
                                {errors.phone && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold">{errors.phone}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="wres-type" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                Temática del evento <span className="text-primary" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="wres-type"
                                required
                                className={getInputCls(Boolean(errors.type))}
                                value={state.eventData.type}
                                onChange={(e) => {
                                    updateEventData('type', e.target.value);
                                    clearError('type');
                                }}
                            >
                                <option value="">Selecciona temática...</option>
                                {regularEventTypes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                                <option value="Otro">Otro</option>
                            </select>
                            {errors.type && (
                                <p className="mt-1 text-xs text-red-500 font-semibold">{errors.type}</p>
                            )}
                        </div>

                        {state.eventData.type === 'Otro' && (
                            <div className="animate-slide-up">
                                <label htmlFor="wres-otherType" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Especificar Temática <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="wres-otherType"
                                    type="text"
                                    required
                                    placeholder="Ej: Aniversario, Graduación..."
                                    className={getInputCls(Boolean(errors.type && !state.eventData.otherType?.trim()))}
                                    value={state.eventData.otherType || ''}
                                    onChange={(e) => {
                                        updateEventData('otherType', e.target.value);
                                        if (e.target.value.trim()) clearError('type');
                                    }}
                                />
                            </div>
                        )}

                        {showComments ? (
                            <div>
                                <label htmlFor="wres-comments" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Indicaciones de acceso o montaje (opcional)
                                </label>
                                <textarea
                                    id="wres-comments"
                                    rows={2}
                                    placeholder="Ej: Conserjería, estacionamiento de visitas, sector del quincho..."
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm"
                                    value={state.contact.comments}
                                    onChange={(e) => updateContact('comments', e.target.value)}
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
                    </fieldset>

                    {/* Final Totals */}
                    <div className="rounded-2xl border border-brand-border bg-slate-50/70 p-4 sm:p-5">
                        <QuoteSummaryTotals
                            data={summaryForTotals}
                            compact
                            hasComuna={Boolean(state.contact.comuna)}
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
                                        {state.contact.firstName || 'Cliente'} {state.contact.lastName}
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
                                <label htmlFor="wres-terms" className="flex items-center gap-3 cursor-pointer group">
                                    <span className="relative flex items-center justify-center shrink-0">
                                        <input
                                            id="wres-terms"
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

                    {(stepError || saveError) && (
                        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{saveError || stepError}</span>
                        </div>
                    )}

                    <div className="pt-2 border-t border-brand-border/60 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={isSaving}
                            className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Atrás</span>
                        </button>

                        <button
                            type="submit"
                            disabled={isSaving || !minLitersMet}
                            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-primary text-white font-black text-base sm:text-lg hover:bg-primary-dark shadow-[0_8px_25px_rgba(226,160,73,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Confirmando reserva...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Confirmar Reserva · {formatCurrency(summaryData.totalPrice)}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
