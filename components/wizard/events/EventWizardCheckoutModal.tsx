'use client';

import React, { useMemo, useState } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import { X, Loader2, Calendar, Users, CheckCircle, FileText } from 'lucide-react';
import CheckoutCartSection from '@/components/quote/CheckoutCartSection';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';
import { PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { calculateMaxPickupDate, EVENT_NEXT_DAY_PICKUP_SLOTS } from '@/lib/wizardLogic';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    onClose: () => void;
    onConfirm: (opts: { confirmNow: boolean }) => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function EventWizardCheckoutModal({
    wizard,
    comunas,
    regions,
    onClose,
    onConfirm,
    sendStatus,
}: Props) {
    const { state, updateContact, updateEventData } = wizard;
    const [confirmNow, setConfirmNow] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [localError, setLocalError] = useState('');
    const [showComments, setShowComments] = useState(Boolean(state.contact.comments));

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        if (confirmNow) {
            const err = validateConfirmNowState(state);
            if (err) {
                setLocalError(err);
                return;
            }
            if (!acceptedTerms) {
                setLocalError('Debes aceptar los términos del contrato.');
                return;
            }
        }
        onConfirm({ confirmNow });
    };

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
            {localError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-[0.8rem] font-bold text-center">
                    {localError}
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
                            Revisa los detalles y completa tus datos para enviar.
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
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                Fecha:{' '}
                                <strong className="font-extrabold">
                                    {state.eventData.date
                                        ? state.eventData.date.split('-').reverse().join('-')
                                        : 'No definida'}
                                </strong>
                            </span>
                        </div>
                        <span className="text-primary/20 hidden sm:inline">•</span>
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>
                                Evento:{' '}
                                <strong className="font-extrabold">
                                    {state.eventData.type === 'Otro'
                                        ? state.eventData.otherType || 'Otra'
                                        : state.eventData.type || 'Evento'}{' '}
                                    ({state.consumption.guests} pers.)
                                </strong>
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
                                    Tus Datos
                                </h3>

                                <form id={formId} className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                Nombre <span className="text-primary">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Juan"
                                                autoComplete="given-name"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                value={state.contact.firstName}
                                                onChange={(e) => updateContact('firstName', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                Apellido <span className="text-primary">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Pérez"
                                                autoComplete="family-name"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                value={state.contact.lastName}
                                                onChange={(e) => updateContact('lastName', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                Email <span className="text-primary">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="juan@correo.com"
                                                autoComplete="email"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                value={state.contact.email}
                                                onChange={(e) => updateContact('email', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                WhatsApp <span className="text-primary">*</span>
                                            </label>
                                            <PhoneInput
                                                required
                                                autoComplete="tel"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                value={state.contact.phone}
                                                onChange={(e164) => updateContact('phone', e164)}
                                            />
                                        </div>
                                    </div>

                                    <RegionComunaFields
                                        regions={regions}
                                        comunas={comunas}
                                        serviceType="event"
                                        regionCode={state.contact.region || 'RM'}
                                        comuna={state.contact.comuna}
                                        otherComuna={state.contact.otherComuna}
                                        onRegionChange={(code) => updateContact('region', code)}
                                        onComunaChange={(name) => updateContact('comuna', name)}
                                        onOtherComunaChange={(v) => updateContact('otherComuna', v)}
                                    />

                                    {showComments ? (
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Comentarios Adicionales (Opcional)</label>
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
                                            className="text-left text-[0.8rem] font-bold text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                                        >
                                            Añadir nota
                                        </button>
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
                                                    type="text"
                                                    required={confirmNow}
                                                    placeholder="Calle, número, depto..."
                                                    autoComplete="street-address"
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                    value={state.contact.address}
                                                    onChange={(e) =>
                                                        updateContact('address', e.target.value)
                                                    }
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Hora inicio <span className="text-primary">*</span>
                                                    </label>
                                                    <input
                                                        type="time"
                                                        required={confirmNow}
                                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                        value={state.eventData.startTime}
                                                        onChange={(e) =>
                                                            updateEventData('startTime', e.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Fecha retiro <span className="text-primary">*</span>
                                                    </label>
                                                    <select
                                                        required={confirmNow}
                                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm bg-white"
                                                        value={pickupChoice}
                                                        onChange={(e) => {
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
                                                </div>
                                            </div>
                                            {!sameDayPickup && (
                                                <div>
                                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                                                        Horario retiro <span className="text-primary">*</span>
                                                    </label>
                                                    <select
                                                        required={confirmNow}
                                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm bg-white"
                                                        value={state.eventData.pickupTime}
                                                        onChange={(e) =>
                                                            updateEventData('pickupTime', e.target.value)
                                                        }
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {EVENT_NEXT_DAY_PICKUP_SLOTS.map((slot) => (
                                                            <option key={slot} value={slot}>
                                                                {slot}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <h4 className="text-[0.7rem] font-black text-brand-text flex items-center gap-2 uppercase tracking-widest">
                                                    <FileText className="w-3.5 h-3.5 text-primary" /> Contrato de servicio
                                                </h4>
                                                <div className="bg-slate-50 border border-brand-border rounded-xl overflow-hidden">
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
                                                    <div className="p-3 bg-primary/5 border-t border-brand-border">
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div className="relative flex items-center justify-center shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={acceptedTerms}
                                                                    onChange={(e) =>
                                                                        setAcceptedTerms(e.target.checked)
                                                                    }
                                                                    className="peer appearance-none w-5 h-5 border-2 border-brand-border rounded-lg checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                                                />
                                                                <CheckCircle className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                                            </div>
                                                            <span className="text-[0.75rem] font-bold text-brand-text group-hover:text-primary transition-colors leading-snug">
                                                                He leído y acepto los términos del contrato
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
