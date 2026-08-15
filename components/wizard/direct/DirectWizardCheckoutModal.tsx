'use client';

import React, { useMemo } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import { X, Loader2 } from 'lucide-react';
import QuoteSummaryProducts from '@/components/quote/QuoteSummaryProducts';
import { getMinDateString } from '@/lib/wizardLogic';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    onClose: () => void;
    onConfirm: () => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function DirectWizardCheckoutModal({ wizard, comunas, regions, onClose, onConfirm, sendStatus }: Props) {
    const { state, updateContact, updateEventData } = wizard;
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(() => wizard.calculateSummaryData(), [state.selections, state.contact.comuna, state.contact.region]);

    const minDate = getMinDateString(2);
    
    // Validamos que haya al menos 1 producto principal (categoría !== 'Otros') y al menos 5 Litros
    const hasMainProduct = useMemo(() => {
        return summaryData.items.some(item => item.category !== 'Otros');
    }, [summaryData.items]);

    const minLitersMet = summaryData.totalLiters >= 5;
    const canSubmit = minLitersMet && hasMainProduct;
    const formId = 'direct-checkout-form';

    const submitFooter = (opts: { formAttr?: string; withCard?: boolean }) => (
        <div
            className={
                opts.withCard
                    ? 'bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-border'
                    : 'mt-2 pt-4 border-t border-brand-border'
            }
        >
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
            <button
                type="submit"
                form={opts.formAttr}
                disabled={sendStatus === 'saving' || !canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 p-3.5 rounded-xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
                {sendStatus === 'saving' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> <span>Guardando Pedido...</span></>
                ) : (
                    <span>Hacer Pedido</span>
                )}
            </button>
            <p className="text-center text-brand-text-muted text-[0.7rem] mt-2.5 leading-tight">
                Tu pedido será procesado y te enviaremos el comprobante a tu email. Al finalizar podrás enviarlo por WhatsApp si lo deseas.
            </p>
        </div>
    );

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 xl:p-8 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
            onClick={onClose}
        >
            <div 
                className="bg-slate-50 rounded-2xl sm:rounded-3xl w-full max-w-4xl xl:max-w-6xl shadow-2xl overflow-y-auto max-h-[98vh] sm:max-h-[95vh] p-4 sm:p-6 xl:p-8 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-3.5 pr-8">
                    <div>
                        <h3 className="text-lg sm:text-2xl font-black text-brand-text mb-0.5">Resumen de tu Pedido</h3>
                        <p className="text-brand-text-muted text-xs sm:text-[0.9rem] leading-tight">Revisa los detalles y completa tus datos de despacho para enviar.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-white rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100 z-10 shadow-sm cursor-pointer"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-8 items-start">
                    
                    {/* Productos: en móvil van debajo del formulario */}
                    <div className="w-full lg:col-span-7 xl:col-span-6 flex flex-col order-2 lg:order-1">
                        <QuoteSummaryProducts 
                            data={{ ...summaryData, guests: 0, canHaveMuro: false }}
                            isEditable={true}
                            onUpdateQuantity={wizard.updateQuantity}
                            onAddProductsClick={onClose} // Cierra el modal para volver al catálogo
                            compact={true}
                        />
                    </div>

                    {/* Formulario: en móvil primero, para llenar datos sin bajar tanto */}
                    <div className="w-full lg:col-span-5 xl:col-span-6 flex flex-col order-1 lg:order-2">
                        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-border flex flex-col">
                            <h3 className="font-extrabold text-brand-text text-base sm:text-lg mb-3">Datos de Despacho</h3>

                            <form id={formId} className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Nombre <span className="text-primary">*</span></label>
                                        <input
                                            type="text" required placeholder="Juan"
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                            value={state.contact.firstName}
                                            onChange={(e) => updateContact('firstName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Apellido <span className="text-primary">*</span></label>
                                        <input
                                            type="text" required placeholder="Pérez"
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                            value={state.contact.lastName}
                                            onChange={(e) => updateContact('lastName', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Email <span className="text-primary">*</span></label>
                                        <input
                                            type="email" required placeholder="juan@correo.com"
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                            value={state.contact.email}
                                            onChange={(e) => updateContact('email', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">WhatsApp <span className="text-primary">*</span></label>
                                        <PhoneInput
                                            required
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                            value={state.contact.phone}
                                            onChange={(e164) => updateContact('phone', e164)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Fecha de Entrega <span className="text-primary">*</span></label>
                                        <input
                                            type="date"
                                            required
                                            min={minDate}
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm bg-white"
                                            value={state.eventData.date}
                                            onChange={(e) => updateEventData('date', e.target.value)}
                                            onClick={(e) => e.currentTarget.showPicker?.()}
                                        />
                                    </div>
                                </div>

                                <RegionComunaFields
                                    regions={regions}
                                    comunas={comunas}
                                    serviceType="direct"
                                    regionCode={state.contact.region || 'RM'}
                                    comuna={state.contact.comuna}
                                    otherComuna={state.contact.otherComuna}
                                    onRegionChange={(code) => updateContact('region', code)}
                                    onComunaChange={(name) => updateContact('comuna', name)}
                                    onOtherComunaChange={(v) => updateContact('otherComuna', v)}
                                />

                                <div>
                                    <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Dirección <span className="text-primary">*</span></label>
                                    <input
                                        type="text" required placeholder="Calle 123 Depto 456"
                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                        value={state.contact.address}
                                        onChange={(e) => updateContact('address', e.target.value)}
                                    />
                                </div>

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

                                <div className="hidden lg:block">{submitFooter({})}</div>
                            </form>
                        </div>
                    </div>

                    <div className="w-full order-3 lg:hidden">{submitFooter({ formAttr: formId, withCard: true })}</div>
                </div>
            </div>
        </div>
    );
}
