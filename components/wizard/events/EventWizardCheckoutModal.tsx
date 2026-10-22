'use client';

import React, { useMemo, useState } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region, EventType } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import { X, Loader2, Calendar, Users, CheckCircle, FileText, User, AlertCircle } from 'lucide-react';
import CheckoutCartSection from '@/components/quote/CheckoutCartSection';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';
import { PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { calculateMaxPickupDate, EVENT_NEXT_DAY_PICKUP_SLOTS, getMinDateString, isAllowedEventPickupDate } from '@/lib/wizardLogic';
import { getMinSelectableDate, validateShippingDate } from '@/lib/shippingMethods';
import { isValidPhoneE164, isChilePrefixOnly } from '@/lib/phone';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
    onClose: () => void;
    onConfirm: (opts: { confirmNow: boolean }) => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
    saveError?: string;
}

export default function EventWizardCheckoutModal({
    wizard,
    comunas,
    regions,
    eventTypes,
    onClose,
    onConfirm,
    sendStatus,
    saveError,
}: Props) {
    const { state, updateContact, updateEventData } = wizard;
    const [confirmNow, setConfirmNow] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [localError, setLocalError] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showComments, setShowComments] = useState(Boolean(state.contact.comments));

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;
    const minEventDate = getMinSelectableDate(eventMethodConfig, 5);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(
        () => wizard.calculateSummaryData(),
        [state.selections, state.dispenser, state.contact.comuna]
    );

    const minRequiredLiters = state.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = summaryData.totalLiters >= minRequiredLiters;
    const nextPickupDate = calculateMaxPickupDate(state.eventData.date);
    const sameDayPickup = state.eventData.pickupDate === state.eventData.date;
    const pickupChoice: 'same' | 'next' | '' =
        !state.eventData.pickupDate
            ? ''
            : sameDayPickup
              ? 'same'
              : state.eventData.pickupDate === nextPickupDate
                ? 'next'
                : '';

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
        const email = state.contact.email.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setErrors((prev) => ({
                ...prev,
                email: 'Ingresa un email válido (ej: nombre@correo.com).',
            }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        // 1. Contacto
        if (!state.contact.firstName.trim() || state.contact.firstName.trim().length < 2) {
            newErrors.firstName = 'Ingresa tu nombre.';
        }
        if (!state.contact.lastName.trim() || state.contact.lastName.trim().length < 2) {
            newErrors.lastName = 'Ingresa tu apellido.';
        }
        if (!state.contact.email.trim()) {
            newErrors.email = 'El email es obligatorio.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email.trim())) {
            newErrors.email = 'Ingresa un email válido (ej: nombre@correo.com).';
        }
        if (!state.contact.phone.trim() || isChilePrefixOnly(state.contact.phone)) {
            newErrors.phone = 'El celular de WhatsApp es obligatorio.';
        } else if (!isValidPhoneE164(state.contact.phone)) {
            newErrors.phone = 'Ingresa tu celular de 9 dígitos (ej: +56 9 1234 5678).';
        }
        if (!state.contact.comuna.trim()) {
            newErrors.comuna = 'Selecciona tu comuna.';
        }

        // 2. Evento
        if (!state.eventData.date.trim()) {
            newErrors.date = 'Indica la fecha de tu evento.';
        } else {
            const shippingDateErr = validateShippingDate(state.eventData.date, eventMethodConfig, 5);
            if (shippingDateErr) {
                newErrors.date = shippingDateErr;
            }
        }
        if (!state.eventData.type.trim()) {
            newErrors.type = 'Selecciona la temática de tu evento.';
        } else if (state.eventData.type === 'Otro' && !state.eventData.otherType?.trim()) {
            newErrors.type = 'Especifica la temática de tu evento.';
        }

        // 3. Confirm Now
        if (confirmNow) {
            if (!state.contact.address?.trim() || state.contact.address.trim().length < 5) {
                newErrors.address = 'Ingresa una dirección completa (mín. 5 caracteres).';
            }
            if (!state.eventData.startTime?.trim()) {
                newErrors.startTime = 'Indica la hora de inicio del evento.';
            }
            if (!state.eventData.pickupDate?.trim()) {
                newErrors.pickupDate = 'Indica la fecha de retiro.';
            } else if (!isAllowedEventPickupDate(state.eventData.date, state.eventData.pickupDate)) {
                newErrors.pickupDate = 'El retiro debe ser el mismo día o al día siguiente.';
            }
            const isSameDay = state.eventData.pickupDate === state.eventData.date;
            if (!isSameDay && !state.eventData.pickupTime?.trim()) {
                newErrors.pickupTime = 'Selecciona el horario de retiro.';
            }
            if (!acceptedTerms) {
                newErrors.terms = 'Debes aceptar los términos del contrato.';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setLocalError('Por favor revisa los campos destacados en rojo.');

            // Scroll y foco al primer campo con error
            const firstErrorKey = Object.keys(newErrors)[0];
            const targetId = `field-${firstErrorKey}`;
            setTimeout(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);

            return false;
        }

        setErrors({});
        setLocalError('');
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        onConfirm({ confirmNow });
    };

    const regularEventTypes = useMemo(() => {
        return eventTypes.filter((t) => t.id !== 'Otro' && t.name.toLowerCase() !== 'otro');
    }, [eventTypes]);

    const formId = 'event-checkout-form';
    const hasComuna = Boolean(state.contact.comuna);
    const summaryForView = {
        ...summaryData,
        guests: state.consumption.guests,
        canHaveMuro: summaryData.canHaveMuro,
    };
    const ctaAmount = formatCurrency(summaryData.totalPrice);
    const ctaLabel = confirmNow
        ? `Confirmar reserva · ${ctaAmount}`
        : `Generar cotización · ${ctaAmount}`;

    const displayError = localError || saveError;

    const submitFooter = (opts: { formAttr?: string; withCard?: boolean; showTotals?: boolean }) => (
        <div
            className={
                opts.withCard
                    ? 'bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-border pb-[max(1rem,env(safe-area-inset-bottom))]'
                    : 'mt-2 pt-4 border-t border-brand-border'
            }
        >
            {opts.showTotals && (
                <div className="mb-4">
                    <QuoteSummaryTotals data={summaryForView} compact hasComuna={hasComuna} />
                </div>
            )}
            {!minLitersMet && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-[0.8rem] font-bold text-center animate-fade-in">
                    Debes seleccionar al menos {minRequiredLiters} Litros para usar el{' '}
                    {state.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'}.
                </div>
            )}
            {displayError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl text-[0.82rem] font-bold flex items-center justify-center gap-2 animate-fade-in text-center">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{displayError}</span>
                </div>
            )}
            <button
                type="submit"
                form={opts.formAttr}
                disabled={sendStatus === 'saving' || !minLitersMet}
                className="w-full inline-flex items-center justify-center gap-2 p-3.5 rounded-xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
                {sendStatus === 'saving' ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />{' '}
                        <span>{confirmNow ? 'Confirmando reserva...' : 'Generando Cotización...'}</span>
                    </>
                ) : (
                    <span>{ctaLabel}</span>
                )}
            </button>
            <p className="text-center text-brand-text-muted text-[0.7rem] mt-2.5 leading-tight">
                {confirmNow
                    ? 'Tu reserva quedará confirmada y te enviaremos el correo de confirmación.'
                    : 'Tu cotización será enviada a tu correo. Al finalizar podrás enviarla también por WhatsApp si lo deseas.'}
            </p>
        </div>
    );

    const getInputCls = (hasError: boolean) =>
        hasError
            ? 'w-full p-2.5 border border-red-400 bg-red-50/20 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-colors'
            : 'w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm bg-white transition-colors';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 xl:p-8 bg-black/60 backdrop-blur-sm animate-fade-in overflow-hidden"
            onClick={onClose}
        >
            <div
                className="bg-slate-50 rounded-2xl sm:rounded-3xl w-full max-w-4xl xl:max-w-6xl shadow-2xl max-h-[98dvh] sm:max-h-[95dvh] relative flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start shrink-0 p-4 sm:p-6 xl:p-8 pb-0 pr-8">
                    <div>
                        <h3 className="text-lg sm:text-2xl font-black text-brand-text mb-0.5">
                            Resumen de Cotización
                        </h3>
                        <p className="text-brand-text-muted text-xs sm:text-[0.9rem] leading-tight">
                            Indica la fecha y datos de contacto para enviarte el presupuesto formal.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-white rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100 z-10 shadow-sm cursor-pointer"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 xl:p-8 pt-3.5">
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-primary/5 text-primary rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border border-primary/10 mb-4 text-center">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>
                                Invitados: <strong className="font-extrabold">{state.consumption.guests} personas</strong>
                            </span>
                        </div>
                        <span className="text-primary/20 hidden sm:inline">•</span>
                        <div className="flex items-center gap-1.5">
                            <span>
                                Formato: <strong className="font-extrabold">{state.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'}</strong>
                            </span>
                        </div>
                        <span className="text-primary/20 hidden sm:inline">•</span>
                        <div className="flex items-center gap-1.5">
                            <span>
                                Volumen: <strong className="font-extrabold">{summaryForView.totalLiters}L ({summaryForView.totalCocktails} cócteles)</strong>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-8 items-start">
                        <div className="w-full lg:col-span-7 xl:col-span-6 flex flex-col order-2 lg:order-1">
                            <CheckoutCartSection
                                data={summaryForView}
                                isEditable
                                onUpdateQuantity={wizard.updateQuantity}
                                onAddProductsClick={onClose}
                                hasComuna={hasComuna}
                            />
                        </div>

                        <div className="w-full lg:col-span-5 xl:col-span-6 flex flex-col order-1 lg:order-2">
                            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-border flex flex-col">
                                <h3 className="font-extrabold text-brand-text text-base sm:text-lg mb-3">
                                    Detalles y Contacto
                                </h3>

                                <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                                    {/* 1. Datos Personales y Contacto */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 text-brand-text">
                                            <User className="w-3.5 h-3.5 text-primary" />
                                            <span className="font-extrabold text-[0.75rem] uppercase tracking-wider text-brand-text-muted">
                                                Datos Personales y Contacto
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Nombre <span className="text-primary">*</span>
                                                </label>
                                                <input
                                                    id="field-firstName"
                                                    type="text"
                                                    required
                                                    placeholder="Juan"
                                                    autoComplete="given-name"
                                                    className={getInputCls(Boolean(errors.firstName))}
                                                    value={state.contact.firstName}
                                                    onChange={(e) => {
                                                        updateContact('firstName', e.target.value);
                                                        if (e.target.value.trim().length >= 2) clearError('firstName');
                                                    }}
                                                />
                                                {errors.firstName && (
                                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold animate-fade-in">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{errors.firstName}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Apellido <span className="text-primary">*</span>
                                                </label>
                                                <input
                                                    id="field-lastName"
                                                    type="text"
                                                    required
                                                    placeholder="Pérez"
                                                    autoComplete="family-name"
                                                    className={getInputCls(Boolean(errors.lastName))}
                                                    value={state.contact.lastName}
                                                    onChange={(e) => {
                                                        updateContact('lastName', e.target.value);
                                                        if (e.target.value.trim().length >= 2) clearError('lastName');
                                                    }}
                                                />
                                                {errors.lastName && (
                                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold animate-fade-in">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{errors.lastName}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Email <span className="text-primary">*</span>
                                                </label>
                                                <input
                                                    id="field-email"
                                                    type="email"
                                                    required
                                                    placeholder="juan@correo.com"
                                                    autoComplete="email"
                                                    className={getInputCls(Boolean(errors.email))}
                                                    value={state.contact.email}
                                                    onChange={(e) => {
                                                        updateContact('email', e.target.value);
                                                        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())) clearError('email');
                                                    }}
                                                    onBlur={handleEmailBlur}
                                                />
                                                {errors.email && (
                                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold animate-fade-in">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{errors.email}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    WhatsApp <span className="text-primary">*</span>
                                                </label>
                                                <PhoneInput
                                                    id="field-phone"
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
                                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold animate-fade-in">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{errors.phone}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <RegionComunaFields
                                            regions={regions}
                                            comunas={comunas}
                                            serviceType="event"
                                            regionCode={state.contact.region || 'RM'}
                                            comuna={state.contact.comuna}
                                            otherComuna={state.contact.otherComuna}
                                            comunaError={errors.comuna}
                                            comunaId="field-comuna"
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
                                    </div>

                                    {/* 2. Detalles del Evento */}
                                    <div className="flex flex-col gap-3 pt-2">
                                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 text-brand-text">
                                            <Calendar className="w-3.5 h-3.5 text-primary" />
                                            <span className="font-extrabold text-[0.75rem] uppercase tracking-wider text-brand-text-muted">
                                                Detalles del Evento
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <ShippingDatePicker
                                                    id="field-date"
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
                                                    helperText={
                                                        errors.date ? undefined : (
                                                            eventMethodConfig?.minOffsetDays
                                                                ? `Reserva con mín. ${eventMethodConfig.minOffsetDays} días de anticipación.`
                                                                : undefined
                                                        )
                                                    }
                                                />
                                                {errors.date && (
                                                    <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        {errors.date}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Temática <span className="text-primary">*</span>
                                                </label>
                                                <select
                                                    id="field-type"
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
                                                    <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        {errors.type}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {state.eventData.type === 'Otro' && (
                                            <div className="animate-slide-up">
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Especificar Temática <span className="text-primary">*</span>
                                                </label>
                                                <input
                                                    id="field-otherType"
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

                                        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-primary/20 bg-primary/5 p-3 mt-1">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 w-5 h-5 accent-primary shrink-0"
                                                checked={confirmNow}
                                                onChange={(e) => {
                                                    setConfirmNow(e.target.checked);
                                                    setLocalError('');
                                                    if (e.target.checked) {
                                                        const eventDate = state.eventData.date;
                                                        const next = calculateMaxPickupDate(eventDate);
                                                        const current = state.eventData.pickupDate;
                                                        if (!current || (current !== eventDate && current !== next)) {
                                                            updateEventData('pickupDate', eventDate);
                                                            updateEventData('pickupTime', '');
                                                        }
                                                    }
                                                }}
                                            />
                                            <span className="text-[0.8rem] text-brand-text leading-snug">
                                                <strong className="font-black">Confirmar reserva ahora</strong>
                                                <span className="block text-brand-text-muted mt-0.5">
                                                    Pediremos dirección y horarios. Queda como reserva confirmada (no
                                                    solo cotización).
                                                </span>
                                            </span>
                                        </label>

                                    {confirmNow && (
                                        <div className="flex flex-col gap-3.5 pt-1 animate-fade-in border-t border-brand-border mt-1">
                                            <div>
                                                <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                    Dirección <span className="text-primary">*</span>
                                                </label>
                                                <input
                                                    id="field-address"
                                                    type="text"
                                                    required={confirmNow}
                                                    placeholder="Calle, número, depto..."
                                                    autoComplete="street-address"
                                                    className={getInputCls(Boolean(errors.address))}
                                                    value={state.contact.address}
                                                    onChange={(e) => {
                                                        updateContact('address', e.target.value);
                                                        clearError('address');
                                                    }}
                                                />
                                                {errors.address && (
                                                    <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        {errors.address}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Hora inicio <span className="text-primary">*</span>
                                                    </label>
                                                    <input
                                                        id="field-startTime"
                                                        type="time"
                                                        required={confirmNow}
                                                        className={getInputCls(Boolean(errors.startTime))}
                                                        value={state.eventData.startTime}
                                                        onChange={(e) => {
                                                            updateEventData('startTime', e.target.value);
                                                            clearError('startTime');
                                                        }}
                                                    />
                                                    {errors.startTime && (
                                                        <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                            {errors.startTime}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Fecha retiro <span className="text-primary">*</span>
                                                    </label>
                                                    <select
                                                        id="field-pickupDate"
                                                        required={confirmNow}
                                                        className={getInputCls(Boolean(errors.pickupDate))}
                                                        value={pickupChoice}
                                                        onChange={(e) => {
                                                            clearError('pickupDate');
                                                            const choice = e.target.value as 'same' | 'next';
                                                            if (choice === 'same') {
                                                                updateEventData('pickupDate', state.eventData.date);
                                                                updateEventData('pickupTime', '');
                                                            } else {
                                                                updateEventData('pickupDate', nextPickupDate);
                                                                if (
                                                                    !EVENT_NEXT_DAY_PICKUP_SLOTS.includes(
                                                                        state.eventData.pickupTime as (typeof EVENT_NEXT_DAY_PICKUP_SLOTS)[number]
                                                                    )
                                                                ) {
                                                                    updateEventData('pickupTime', '');
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>
                                                            Selecciona...
                                                        </option>
                                                        <option value="same">Mismo día</option>
                                                        <option value="next">Día siguiente</option>
                                                    </select>
                                                    {errors.pickupDate && (
                                                        <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                            {errors.pickupDate}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {!sameDayPickup && (
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Horario retiro <span className="text-primary">*</span>
                                                    </label>
                                                    <select
                                                        id="field-pickupTime"
                                                        required={confirmNow}
                                                        className={getInputCls(Boolean(errors.pickupTime))}
                                                        value={state.eventData.pickupTime}
                                                        onChange={(e) => {
                                                            updateEventData('pickupTime', e.target.value);
                                                            clearError('pickupTime');
                                                        }}
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {EVENT_NEXT_DAY_PICKUP_SLOTS.map((slot) => (
                                                            <option key={slot} value={slot}>
                                                                {slot}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {errors.pickupTime && (
                                                        <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                            {errors.pickupTime}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <h4 className="text-[0.7rem] font-black text-brand-text flex items-center gap-2 uppercase tracking-widest">
                                                    <FileText className="w-3.5 h-3.5 text-primary" /> Contrato de servicio
                                                </h4>
                                                <div className={`bg-slate-50 border rounded-xl overflow-hidden ${errors.terms ? 'border-red-300' : 'border-brand-border'}`}>
                                                    <div className="max-h-40 overflow-y-auto p-3 text-[0.7rem] text-brand-text-muted leading-relaxed bg-white/60">
                                                        <p className="text-center font-black mb-3 uppercase tracking-widest text-brand-text text-[0.65rem] border-b border-brand-border/40 pb-2">
                                                            CONTRATO DE SERVICIO
                                                        </p>
                                                        <p className="mb-2">
                                                            Entre <strong>Cocktails on Tap Chile</strong>, en adelante “El
                                                            Arrendador”, y don/doña:{' '}
                                                            <strong>
                                                                {state.contact.firstName} {state.contact.lastName}
                                                            </strong>
                                                            , en adelante “El Arrendatario”, se acuerda lo siguiente:
                                                        </p>
                                                        <p className="font-black text-brand-text mb-1 mt-2">
                                                            1. Objeto del contrato
                                                        </p>
                                                        <p className="mb-2">
                                                            El Arrendador proporcionará al Arrendatario un servicio de
                                                            cócteles listos para servir en formato autoservicio, incluyendo
                                                            barriles, dispensadores y cristalería.
                                                        </p>
                                                        <p className="font-black text-brand-text mb-1">
                                                            2. Responsabilidad por daños
                                                        </p>
                                                        <ul className="list-disc pl-4 mb-2 space-y-1">
                                                            <li>$1.000 (mil pesos) por vaso extraviado o dañado.</li>
                                                            <li>$2.000 (dos mil pesos) por copa extraviada o dañada.</li>
                                                            <li>
                                                                Hasta $500.000 (quinientos mil pesos) por dispensador
                                                                extraviado o dañado.
                                                            </li>
                                                        </ul>
                                                        <p className="font-black text-brand-text mb-1">
                                                            3. Aceptación y pago
                                                        </p>
                                                        <p className="mb-1">
                                                            Se entiende aceptado al confirmar la reserva mediante el pago
                                                            del <strong>100% del total</strong>.
                                                        </p>
                                                        <p>La reserva queda confirmada una vez realizado el pago total.</p>
                                                    </div>
                                                    <div className={`p-3 border-t ${errors.terms ? 'bg-red-50/50 border-red-300' : 'bg-primary/5 border-brand-border'}`}>
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div className="relative flex items-center justify-center shrink-0">
                                                                <input
                                                                    id="field-terms"
                                                                    type="checkbox"
                                                                    checked={acceptedTerms}
                                                                    onChange={(e) => {
                                                                        setAcceptedTerms(e.target.checked);
                                                                        if (e.target.checked) clearError('terms');
                                                                    }}
                                                                    className={`peer appearance-none w-5 h-5 border-2 rounded-lg checked:bg-primary checked:border-primary transition-all cursor-pointer ${
                                                                        errors.terms ? 'border-red-400 bg-red-50' : 'border-brand-border'
                                                                    }`}
                                                                />
                                                                <CheckCircle className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                                            </div>
                                                            <span className={`text-[0.75rem] font-bold leading-snug transition-colors ${
                                                                errors.terms ? 'text-red-600' : 'text-brand-text group-hover:text-primary'
                                                            }`}>
                                                                He leído y acepto los términos del contrato
                                                            </span>
                                                        </label>
                                                        {errors.terms && (
                                                            <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                                {errors.terms}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {showComments ? (
                                        <div className="pt-1">
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                Comentarios Adicionales (Opcional)
                                            </label>
                                            <textarea
                                                rows={2}
                                                placeholder="Ref. para llegar, timbre, horarios de entrega..."
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm resize-none"
                                                value={state.contact.comments}
                                                onChange={(e) => updateContact('comments', e.target.value)}
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowComments(true)}
                                            className="text-left text-[0.8rem] font-bold text-primary hover:underline cursor-pointer bg-transparent border-none p-0 inline-block pt-1"
                                        >
                                            + Añadir nota o comentario
                                        </button>
                                    )}
                                </div>
                                <div className="hidden lg:block">{submitFooter({})}</div>
                                </form>
                            </div>
                        </div>

                        <div className="w-full order-3 lg:hidden">
                            {submitFooter({ formAttr: formId, withCard: true, showTotals: true })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
