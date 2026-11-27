'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region, EventType } from '@/lib/types';
import { formatCurrency, normalizeEmail, normalizePersonName } from '@/lib/utils';
import { isValidPhoneE164, isChilePrefixOnly } from '@/lib/phone';
import { validateShippingDate } from '@/lib/shippingMethods';
import { countPortableKegs } from '@/lib/eventCapacity';
import { PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import {
    FileText,
    User,
    Calendar,
    AlertCircle,
    Loader2,
    Wine,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
    onOpenBarSummary: () => void;
    onSwitchToReserve: () => void;
    onBackToCatalog: () => void;
    onSubmitQuote: () => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
    saveError?: string;
}

/**
 * Paso sencillo de Cotización Formal (Camino 1 desde el resumen de barra).
 * Mantiene la estética de tarjeta centrada paso a paso de /eventos.
 */
export default function EventStepQuickQuote({
    wizard,
    comunas,
    regions,
    eventTypes,
    onOpenBarSummary,
    onSwitchToReserve,
    onBackToCatalog,
    onSubmitQuote,
    sendStatus,
    saveError,
}: Props) {
    const { state, updateContact, updateEventData } = wizard;
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [localError, setLocalError] = useState('');
    const [showComments, setShowComments] = useState(Boolean(state.contact.comments));

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const t = setTimeout(() => headingRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, []);

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(
        () => wizard.calculateSummaryData(),
        [state.selections, state.dispenser, state.contact.comuna]
    );

    const regularEventTypes = useMemo(
        () => eventTypes.filter((t) => t.id !== 'Otro' && t.name.toLowerCase() !== 'otro'),
        [eventTypes]
    );

    const minRequiredLiters = state.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = summaryData.totalLiters >= minRequiredLiters;
    const isSaving = sendStatus === 'saving';

    const clearError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setLocalError('');
    };

    const handlePhoneBlur = () => {
        const phone = state.contact.phone;
        if (phone && !isChilePrefixOnly(phone) && !isValidPhoneE164(phone)) {
            setErrors((prev) => ({
                ...prev,
                phone: 'Ingresa tu celular de 9 dígitos (ej: +56 9 1234 5678).',
            }));
        }
    };

    const handleEmailBlur = () => {
        const email = normalizeEmail(state.contact.email);
        if (email !== state.contact.email) {
            updateContact('email', email);
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setErrors((prev) => ({
                ...prev,
                email: 'Ingresa un email válido (ej: nombre@correo.com).',
            }));
        }
    };

    const validate = (): boolean => {
        const nextErrors: Record<string, string> = {};

        if (!state.contact.firstName.trim() || state.contact.firstName.trim().length < 2) {
            nextErrors.firstName = 'Ingresa tu nombre.';
        }
        if (!state.contact.lastName.trim() || state.contact.lastName.trim().length < 2) {
            nextErrors.lastName = 'Ingresa tu apellido.';
        }
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
        if (!state.contact.comuna.trim()) {
            nextErrors.comuna = 'Selecciona tu comuna en la Región Metropolitana.';
        }
        if (!state.eventData.date.trim()) {
            nextErrors.date = 'Indica la fecha de tu evento.';
        } else {
            const dateErr = validateShippingDate(state.eventData.date, eventMethodConfig, 5);
            if (dateErr) nextErrors.date = dateErr;
        }
        if (!state.eventData.type.trim()) {
            nextErrors.type = 'Selecciona la temática de tu evento.';
        } else if (state.eventData.type === 'Otro' && !state.eventData.otherType?.trim()) {
            nextErrors.type = 'Especifica la temática de tu evento.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            setLocalError('Por favor revisa los campos destacados en rojo.');
            const firstKey = Object.keys(nextErrors)[0];
            setTimeout(() => {
                const el = document.getElementById(`quote-${firstKey}`);
                el?.focus();
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 40);
            return false;
        }

        setErrors({});
        setLocalError('');
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || !minLitersMet) return;
        const fn = normalizePersonName(state.contact.firstName);
        const ln = normalizePersonName(state.contact.lastName);
        const em = normalizeEmail(state.contact.email);
        if (fn !== state.contact.firstName) updateContact('firstName', fn);
        if (ln !== state.contact.lastName) updateContact('lastName', ln);
        if (em !== state.contact.email) updateContact('email', em);
        if (!validate()) return;
        onSubmitQuote();
    };

    const getInputCls = (hasError: boolean) =>
        hasError
            ? 'w-full min-h-[46px] px-3.5 py-2.5 border border-red-400 bg-red-50/20 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-base sm:text-sm font-medium transition-colors'
            : 'w-full min-h-[46px] px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm font-medium bg-white transition-colors';

    const displayError = localError || saveError;

    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-5 animate-fade-in py-2 sm:py-4">
            {/* Unified Step 5 Header matching Steps 1-4 */}
            <div className="text-center mb-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold uppercase tracking-wider mb-3">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Paso 5 de 5 · Cotización</span>
                </div>
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-3xl sm:text-4xl font-extrabold text-brand-text tracking-tight mb-2.5 outline-none"
                >
                    ¿Dónde te enviamos tu cotización?
                </h1>
                <p className="text-sm sm:text-base text-brand-text-muted max-w-xl mx-auto font-medium leading-relaxed m-0">
                    Recibirás tu presupuesto formal en tu correo y WhatsApp con un enlace editable para confirmar cuando quieras.
                </p>
            </div>

            {/* Compact Bar Pill */}
            <div className="bg-white rounded-2xl border border-brand-border px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Wine className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-brand-text truncate m-0">
                            Tu Barra · {summaryData.totalLiters}L ({summaryData.totalCocktails} cócteles)
                        </p>
                        <p className="text-xs text-brand-text-muted font-medium m-0">
                            {state.consumption.guests} invitados ·{' '}
                            <span className="text-primary font-extrabold">
                                {formatCurrency(summaryData.totalPrice)}
                            </span>
                            {state.contact.comuna ? ` (incl. ${state.contact.comuna})` : ' (+ traslado)'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onOpenBarSummary}
                    className="text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer shrink-0"
                >
                    Ver barra
                </button>
            </div>

            {/* Main Centered Card */}
            <section className="bg-white rounded-3xl border border-brand-border p-5 sm:p-8 shadow-sm">

                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                    <fieldset className="flex flex-col gap-3.5 border-0 p-0 m-0">
                        <legend className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 text-brand-text w-full mb-1">
                            <User className="w-3.5 h-3.5 text-primary" />
                            <span className="font-extrabold text-[0.75rem] uppercase tracking-wider text-brand-text-muted">
                                Tus datos
                            </span>
                        </legend>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label htmlFor="quote-firstName" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Nombre <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="quote-firstName"
                                    name="firstName"
                                    type="text"
                                    required
                                    placeholder="Juan"
                                    autoComplete="given-name"
                                    enterKeyHint="next"
                                    aria-invalid={Boolean(errors.firstName)}
                                    className={getInputCls(Boolean(errors.firstName))}
                                    value={state.contact.firstName}
                                    onBlur={(e) => updateContact('firstName', normalizePersonName(e.target.value))}
                                    onChange={(e) => {
                                        updateContact('firstName', e.target.value);
                                        if (e.target.value.trim().length >= 2) clearError('firstName');
                                    }}
                                />
                                {errors.firstName && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.firstName}</span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="quote-lastName" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Apellido <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="quote-lastName"
                                    name="lastName"
                                    type="text"
                                    required
                                    placeholder="Pérez"
                                    autoComplete="family-name"
                                    enterKeyHint="next"
                                    aria-invalid={Boolean(errors.lastName)}
                                    className={getInputCls(Boolean(errors.lastName))}
                                    value={state.contact.lastName}
                                    onBlur={(e) => updateContact('lastName', normalizePersonName(e.target.value))}
                                    onChange={(e) => {
                                        updateContact('lastName', e.target.value);
                                        if (e.target.value.trim().length >= 2) clearError('lastName');
                                    }}
                                />
                                {errors.lastName && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.lastName}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label htmlFor="quote-email" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Email <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="quote-email"
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="juan@correo.com"
                                    autoComplete="email"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    enterKeyHint="next"
                                    aria-invalid={Boolean(errors.email)}
                                    className={getInputCls(Boolean(errors.email))}
                                    value={state.contact.email}
                                    onChange={(e) => {
                                        updateContact('email', e.target.value.toLowerCase());
                                        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())) clearError('email');
                                    }}
                                    onBlur={handleEmailBlur}
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.email}</span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="quote-phone" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    WhatsApp <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <PhoneInput
                                    id="quote-phone"
                                    required
                                    autoComplete="tel"
                                    className={getInputCls(Boolean(errors.phone))}
                                    value={state.contact.phone}
                                    onChange={(e164) => {
                                        updateContact('phone', e164);
                                        if (isValidPhoneE164(e164)) clearError('phone');
                                    }}
                                    onBlur={handlePhoneBlur}
                                />
                                {errors.phone && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.phone}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="flex flex-col gap-3.5 border-0 p-0 m-0">
                        <legend className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 text-brand-text w-full mb-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span className="font-extrabold text-[0.75rem] uppercase tracking-wider text-brand-text-muted">
                                Detalles básicos del evento
                            </span>
                        </legend>

                        <RegionComunaFields
                            regions={regions}
                            comunas={comunas}
                            serviceType="event"
                            regionCode={state.contact.region || 'RM'}
                            comuna={state.contact.comuna}
                            otherComuna={state.contact.otherComuna}
                            comunaError={errors.comuna}
                            comunaId="quote-comuna"
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <ShippingDatePicker
                                    id="quote-date"
                                    label="Fecha del Evento"
                                    required
                                    value={state.eventData.date}
                                    onChange={(val) => {
                                        updateEventData('date', val);
                                        clearError('date');
                                        setLocalError('');
                                    }}
                                    methodConfig={eventMethodConfig}
                                    fallbackOffsetDays={5}
                                    availabilityContext={{
                                        dispenser: state.dispenser === 'muro' ? 'muro' : 'portatil',
                                        portableKegCount: countPortableKegs(state.selections),
                                    }}
                                    helperText={
                                        errors.date
                                            ? undefined
                                            : eventMethodConfig?.minOffsetDays
                                              ? `Reserva con mín. ${eventMethodConfig.minOffsetDays} días de anticipación.`
                                              : undefined
                                    }
                                />
                                {errors.date && (
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.date}</span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="quote-type" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Temática <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <select
                                    id="quote-type"
                                    name="eventType"
                                    required
                                    aria-invalid={Boolean(errors.type)}
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
                                    <p className="mt-1 text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.type}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {state.eventData.type === 'Otro' && (
                            <div className="animate-slide-up">
                                <label htmlFor="quote-otherType" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Especificar Temática <span className="text-primary" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="quote-otherType"
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
                                <label htmlFor="quote-comments" className="block font-bold mb-1 text-brand-text text-xs sm:text-[0.82rem]">
                                    Comentarios adicionales (opcional)
                                </label>
                                <textarea
                                    id="quote-comments"
                                    rows={2}
                                    placeholder="Alguna consulta o detalle para considerar..."
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
                                + Añadir nota o comentario
                            </button>
                        )}
                    </fieldset>

                    {displayError && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{displayError}</span>
                        </div>
                    )}

                    <div className="pt-3 border-t border-brand-border/60 flex flex-col gap-3">
                        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={onBackToCatalog}
                                disabled={isSaving}
                                className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-white text-brand-text font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Volver al catálogo</span>
                            </button>

                            <button
                                type="submit"
                                disabled={isSaving || !minLitersMet}
                                className="w-full sm:w-auto min-h-[50px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Generando cotización...</span>
                                    </>
                                ) : (
                                    <span>Enviar cotización formal · {formatCurrency(summaryData.totalPrice)}</span>
                                )}
                            </button>
                        </div>

                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={onSwitchToReserve}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-text-muted hover:text-primary bg-transparent border-none p-0 cursor-pointer transition-colors"
                            >
                                <span>¿Prefieres reservar tu fecha ahora mismo?</span>
                                <span className="text-primary font-black inline-flex items-center gap-0.5">
                                    Ir a reserva paso a paso <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </div>
    );
}
