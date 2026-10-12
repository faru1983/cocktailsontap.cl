'use client';

import React, { useMemo, useState } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import { X, Loader2, AlertCircle } from 'lucide-react';
import CheckoutCartSection from '@/components/quote/CheckoutCartSection';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';
import { DIRECT_SALE_MIN_DISPATCH_OFFSET_DAYS, validateDirectSaleDate } from '@/lib/wizardLogic';
import { getMinSelectableDate } from '@/lib/shippingMethods';
import { getDirectSaleDateFieldCopy } from '@/lib/blueExpress';
import { isChilePrefixOnly, isValidPhoneE164 } from '@/lib/phone';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    onClose: () => void;
    onConfirm: () => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
    saveError?: string;
}

export default function DirectWizardCheckoutModal({
    wizard,
    comunas,
    regions,
    onClose,
    onConfirm,
    sendStatus,
    saveError,
}: Props) {
    const { state, updateContact, updateEventData } = wizard;
    const [showComments, setShowComments] = useState(Boolean(state.contact.comments));
    const [dateError, setDateError] = useState<string | null>(null);
    const [localError, setLocalError] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handlePhoneBlur = () => {
        const phone = state.contact.phone.trim();
        if (!phone || isChilePrefixOnly(phone)) {
            setErrors((prev) => ({ ...prev, phone: 'El celular de WhatsApp es obligatorio.' }));
        } else if (!isValidPhoneE164(phone)) {
            setErrors((prev) => ({
                ...prev,
                phone: 'Ingresa tu celular de 9 dígitos (ej: +56 9 1234 5678).',
            }));
        } else {
            clearError('phone');
        }
    };

    const handleEmailBlur = () => {
        const email = state.contact.email.trim();
        if (!email) {
            setErrors((prev) => ({ ...prev, email: 'El email es obligatorio.' }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setErrors((prev) => ({
                ...prev,
                email: 'Ingresa un email válido (ej: nombre@correo.com).',
            }));
        } else {
            clearError('email');
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(() => wizard.calculateSummaryData(), [state.selections, state.contact.comuna, state.contact.region]);

    const hasComuna = Boolean(state.contact.comuna);
    const methodsConfig = comunas[0]?.shippingMethodsConfig;
    const activeMethodConfig = summaryData.shippingCarrier === 'blue_express'
        ? methodsConfig?.blue_express
        : methodsConfig?.own_direct;

    const minDate = getMinSelectableDate(activeMethodConfig, DIRECT_SALE_MIN_DISPATCH_OFFSET_DAYS);
    const dateCopy = getDirectSaleDateFieldCopy(summaryData.shippingCarrier);

    const hasMainProduct = useMemo(() => {
        return summaryData.items.some(item => item.category !== 'Otros');
    }, [summaryData.items]);

    const minLitersMet = summaryData.totalLiters >= 5;
    const canSubmit = minLitersMet && hasMainProduct;
    const formId = 'direct-checkout-form';
    const summaryForView = { ...summaryData, guests: 0, canHaveMuro: false };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

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
        } else if (state.contact.comuna === 'Otra' && !state.contact.otherComuna?.trim()) {
            newErrors.comuna = 'Especifica la comuna.';
        }
        if (!state.contact.address?.trim() || state.contact.address.trim().length < 5) {
            newErrors.address = 'Ingresa una dirección completa (mín. 5 caracteres).';
        }

        const dateErr = validateDirectSaleDate(state.eventData.date, activeMethodConfig);
        if (dateErr) {
            newErrors.date = dateErr;
            setDateError(dateErr);
        } else {
            setDateError(null);
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setLocalError('Por favor revisa los campos destacados en rojo.');

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
        onConfirm();
    };

    const displayError = localError || saveError || dateError;

    const getInputCls = (hasError: boolean) =>
        hasError
            ? 'w-full p-2.5 border border-red-400 bg-red-50/20 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-colors'
            : 'w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm bg-white transition-colors';

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
                    Debes seleccionar al menos 1 barril de 5L para continuar.
                </div>
            )}
            {minLitersMet && !hasMainProduct && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-[0.8rem] font-bold text-center animate-fade-in">
                    Debes seleccionar al menos un producto principal (el hielo y decoraciones son productos complementarios).
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
                disabled={sendStatus === 'saving' || !canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 p-3.5 rounded-xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
                {sendStatus === 'saving' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> <span>Guardando Pedido...</span></>
                ) : (
                    <span>Hacer pedido · {formatCurrency(summaryData.totalPrice)}</span>
                )}
            </button>
            <p className="text-center text-brand-text-muted text-[0.7rem] mt-2.5 leading-tight">
                Tu pedido será procesado y te enviaremos el comprobante a tu email. Al finalizar podrás enviarlo por WhatsApp si lo deseas.
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
                        <h3 className="text-lg sm:text-2xl font-black text-brand-text mb-0.5">Resumen de tu Pedido</h3>
                        <p className="text-brand-text-muted text-xs sm:text-[0.9rem] leading-tight">Revisa los detalles y completa tus datos de despacho para enviar.</p>
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
                                <h3 className="font-extrabold text-brand-text text-base sm:text-lg mb-3">Datos de Despacho</h3>

                                <form id={formId} className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Nombre <span className="text-primary">*</span></label>
                                            <input
                                                id="field-firstName"
                                                type="text" required placeholder="Juan"
                                                autoComplete="given-name"
                                                className={getInputCls(Boolean(errors.firstName))}
                                                value={state.contact.firstName}
                                                onChange={(e) => {
                                                    updateContact('firstName', e.target.value);
                                                    clearError('firstName');
                                                }}
                                            />
                                            {errors.firstName && (
                                                <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    {errors.firstName}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Apellido <span className="text-primary">*</span></label>
                                            <input
                                                id="field-lastName"
                                                type="text" required placeholder="Pérez"
                                                autoComplete="family-name"
                                                className={getInputCls(Boolean(errors.lastName))}
                                                value={state.contact.lastName}
                                                onChange={(e) => {
                                                    updateContact('lastName', e.target.value);
                                                    clearError('lastName');
                                                }}
                                            />
                                            {errors.lastName && (
                                                <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    {errors.lastName}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Email <span className="text-primary">*</span></label>
                                            <input
                                                id="field-email"
                                                type="email" required placeholder="juan@correo.com"
                                                autoComplete="email"
                                                className={getInputCls(Boolean(errors.email))}
                                                value={state.contact.email}
                                                onBlur={handleEmailBlur}
                                                onChange={(e) => {
                                                    updateContact('email', e.target.value);
                                                    clearError('email');
                                                }}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    {errors.email}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">WhatsApp <span className="text-primary">*</span></label>
                                            <PhoneInput
                                                id="field-phone"
                                                required
                                                autoComplete="tel"
                                                className={getInputCls(Boolean(errors.phone))}
                                                value={state.contact.phone}
                                                onBlur={handlePhoneBlur}
                                                onChange={(e164) => {
                                                    updateContact('phone', e164);
                                                    if (isValidPhoneE164(e164)) clearError('phone');
                                                }}
                                            />
                                            {errors.phone && (
                                                <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    {errors.phone}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <RegionComunaFields
                                        regions={regions}
                                        comunas={comunas}
                                        serviceType="direct"
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
                                            setDateError(null);
                                        }}
                                        onOtherComunaChange={(v) => {
                                            updateContact('otherComuna', v);
                                            if (v.trim()) clearError('comuna');
                                        }}
                                    />

                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Dirección <span className="text-primary">*</span></label>
                                        <input
                                            id="field-address"
                                            type="text" required placeholder="Calle 123 Depto 456"
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

                                    <div>
                                        <ShippingDatePicker
                                            id="field-date"
                                            label={dateCopy.label}
                                            required
                                            value={state.eventData.date}
                                            onChange={(val) => {
                                                updateEventData('date', val);
                                                clearError('date');
                                                setDateError(null);
                                                setLocalError('');
                                            }}
                                            methodConfig={activeMethodConfig}
                                            fallbackOffsetDays={2}
                                            helperText={errors.date || dateError ? undefined : (activeMethodConfig?.deliveryWindow || dateCopy.hint)}
                                            onErrorChange={(err) => {
                                                setDateError(err);
                                                if (!err) clearError('date');
                                            }}
                                        />
                                        {(errors.date || dateError) && (
                                            <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                {errors.date || dateError}
                                            </p>
                                        )}
                                    </div>

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
