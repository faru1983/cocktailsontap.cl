'use client';

import React, { useMemo } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import { X, Loader2, Calendar, Users } from 'lucide-react';
import { WhatsappIcon } from '@/components/shared/icons';
import QuoteSummaryProducts from '@/components/quote/QuoteSummaryProducts';
import { PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    onClose: () => void;
    onConfirm: () => void;
    sendStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function EventWizardCheckoutModal({ wizard, comunas, onClose, onConfirm, sendStatus }: Props) {
    const { state, updateContact } = wizard;
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(() => wizard.calculateSummaryData(), [state.selections, state.dispenser, state.contact.comuna]);

    const minRequiredLiters = state.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = summaryData.totalLiters >= minRequiredLiters;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
            onClick={onClose}
        >
            <div 
                className="bg-slate-50 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[98vh] sm:max-h-[95vh] p-4 sm:p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-3.5 pr-8">
                    <div>
                        <h3 className="text-lg sm:text-2xl font-black text-brand-text mb-0.5">Resumen de Cotización</h3>
                        <p className="text-brand-text-muted text-xs sm:text-[0.9rem] leading-tight">Revisa los detalles y completa tus datos para enviar.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-white rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100 z-10 shadow-sm"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Event info quick banner */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-primary/5 text-primary rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border border-primary/10 mb-4 text-center">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Fecha: <strong className="font-extrabold">{state.eventData.date ? state.eventData.date.split('-').reverse().join('-') : 'No definida'}</strong></span>
                    </div>
                    <span className="text-primary/20 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Evento: <strong className="font-extrabold">{state.eventData.type === 'Otro' ? state.eventData.otherType || 'Otra' : state.eventData.type || 'Evento'} ({state.consumption.guests} pers.)</strong></span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    
                    {/* Columna Izquierda: Productos (7/12 cols) */}
                    <div className="w-full lg:col-span-7 flex flex-col">
                        <QuoteSummaryProducts 
                            data={{ ...summaryData, guests: state.consumption.guests, canHaveMuro: summaryData.canHaveMuro }}
                            isEditable={true}
                            onUpdateQuantity={wizard.updateQuantity}
                            onAddProductsClick={onClose} // Cierra el modal para volver al catálogo
                            compact={true}
                        />
                    </div>

                    {/* Columna Derecha: Formulario (5/12 cols) */}
                    <div className="w-full lg:col-span-5 flex flex-col">
                        {/* Formulario */}
                        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-border flex flex-col">
                            <h3 className="font-extrabold text-brand-text text-base sm:text-lg mb-3">Tus Datos</h3>

                            <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
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

                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Comuna <span className="text-primary">*</span></label>
                                        <select
                                            required
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]"
                                            value={state.contact.comuna}
                                            onChange={(e) => updateContact('comuna', e.target.value)}
                                        >
                                            <option value="">Selecciona comuna...</option>
                                            {comunas.map((c) => (
                                                <option key={c.name} value={c.name}>
                                                    {c.name === 'Otra' ? 'Otra / No está en la lista' : c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {state.contact.comuna === 'Otra' && (
                                        <div className="animate-fade-in">
                                            <label className="block font-bold mb-1 text-brand-text text-[0.8rem]">Especificar Comuna</label>
                                            <input
                                                type="text" placeholder="Ej: Curacaví"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                                                value={state.contact.otherComuna}
                                                onChange={(e) => updateContact('otherComuna', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 pt-4 border-t border-brand-border">
                                    {!minLitersMet && (
                                        <div className="mb-3 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-[0.8rem] font-bold text-center animate-fade-in">
                                            Debes seleccionar al menos {minRequiredLiters} Litros para usar el {state.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'}.
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={sendStatus === 'saving' || !minLitersMet}
                                        className="w-full inline-flex items-center justify-center gap-2 p-3.5 rounded-xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {sendStatus === 'saving' ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> <span>Generando Cotización...</span></>
                                        ) : (
                                            <><span>Generar Cotización</span></>
                                        )}
                                    </button>
                                    <p className="text-center text-brand-text-muted text-[0.7rem] mt-2.5 leading-tight">
                                        Tu cotización será enviada a tu correo. Al finalizar podrás enviarla también por WhatsApp si lo deseas.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
