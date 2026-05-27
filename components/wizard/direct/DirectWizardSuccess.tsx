'use client';

import React, { useMemo } from 'react';
import { CheckCircle, Copy, ExternalLink, RefreshCw, ArrowRight, Mail, MessageSquare } from 'lucide-react';
import { SITE_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';
import type { WizardState, CocktailForWizard, Comuna } from '@/lib/types';
import { calculateSummaryData } from '@/lib/wizardLogic';
import { WhatsappIcon } from '@/components/shared/icons';

interface DirectWizardSuccessProps {
    token: string;
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    onReset: () => void;
}

export default function DirectWizardSuccess({ token, state, cocktails, comunas, onReset }: DirectWizardSuccessProps) {
    const quoteLink = `${SITE_URL}/cotizar/${token}`;

    // Calculamos el resumen para obtener el precio total real
    const summary = useMemo(() => {
        return calculateSummaryData(state, cocktails, comunas);
    }, [state, cocktails, comunas]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(quoteLink);
    };

    const copyBankDetails = () => {
        const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-brand-border text-center overflow-hidden relative">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />

                {/* Icono de Éxito */}
                <div className="relative mb-8 inline-flex">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping scale-150 opacity-20" />
                    <div className="relative bg-green-100 p-6 rounded-full">
                        <CheckCircle className="w-16 h-16 text-green-600" />
                    </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-brand-dark mb-4">
                    ¡Pedido Recibido!
                </h1>
                
                <p className="text-brand-text-muted text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                    Hemos registrado tu pedido correctamente. El resumen ha sido enviado a tu email y a nuestro equipo.
                </p>

                {/* Link Card de Seguimiento */}
                <div className="bg-brand-light/50 border border-brand-border rounded-3xl p-6 mb-8 relative group">
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">
                        Tu Link Único de Seguimiento
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium text-brand-dark overflow-hidden text-ellipsis whitespace-nowrap w-full text-left">
                            {quoteLink}
                        </div>
                        <button 
                            onClick={copyToClipboard}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-brand-border text-brand-dark font-bold text-sm hover:border-primary hover:text-primary transition-all active:scale-95"
                        >
                            <Copy className="w-4 h-4" /> Copiar Link
                        </button>
                    </div>
                    <p className="text-xs text-brand-text-muted mt-4 italic text-left sm:text-center">
                        Usa este link para ver o descargar tu comprobante más tarde.
                    </p>
                </div>

                {/* Card de Pago (Estilo Similar al de EventQuoteView pero adaptado) */}
                <div className="relative mb-10 overflow-hidden rounded-[2.5rem] bg-green-50 border-2 border-green-200 p-8 shadow-lg text-left">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16" />
                    
                    <p className="text-green-800 font-black text-center mb-1 uppercase tracking-widest text-[0.7rem]">Monto a depositar (100%)</p>
                    <p className="text-green-600 font-black text-4xl text-center mb-6">{formatCurrency(summary.totalOfferPrice + summary.shippingCost)}</p>
                    
                    <div className="text-[0.9rem] text-green-800 space-y-2 border-t border-green-200 pt-6 max-w-sm mx-auto">
                        <p className="flex justify-between"><strong>Banco:</strong> <span>Mercado Pago</span></p>
                        <p className="flex justify-between"><strong>Cuenta Vista:</strong> <span>1098081647</span></p>
                        <p className="flex justify-between"><strong>Nombre:</strong> <span>Felipe Ramírez</span></p>
                        <p className="flex justify-between"><strong>RUT:</strong> <span>15.332.189-2</span></p>
                        <p className="flex justify-between"><strong>Email:</strong> <span>contacto@cocktailsontap.cl</span></p>
                    </div>
                    
                    <button 
                        onClick={copyBankDetails}
                        className="w-full max-w-sm mx-auto mt-6 flex items-center justify-center gap-2 py-3 bg-white border border-green-200 rounded-xl text-[0.85rem] font-black text-green-700 hover:border-green-400 hover:bg-green-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Copy className="w-4 h-4" /> Copiar Datos de Cuenta
                    </button>
                    
                    <p className="text-[0.8rem] text-green-700 mt-4 text-center italic opacity-80 underline underline-offset-4 decoration-green-300">
                        Envíanos el comprobante por WhatsApp para validar tu pedido.
                    </p>
                </div>

                {/* Pasos Siguientes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-left">
                    <div className="bg-white border border-brand-border rounded-2xl p-5 flex gap-4">
                        <div className="bg-blue-50 p-3 rounded-xl h-fit">
                            <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-brand-dark text-sm">Respaldo por Email</h3>
                            <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">
                                Enviamos un respaldo a tu email. Revisa tu bandeja (y spam).
                            </p>
                        </div>
                    </div>
                    <div className="bg-white border border-brand-border rounded-2xl p-5 flex gap-4">
                        <div className="bg-green-50 p-3 rounded-xl h-fit">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-brand-dark text-sm">WhatsApp</h3>
                            <p className="text-xs text-brand-text-muted mt-1 leading-relaxed mb-3">
                                Recuerda enviar el comprobante de transferencia por WhatsApp.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={onReset}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border-2 border-brand-border text-brand-text-muted font-bold transition-all hover:border-primary hover:text-primary active:scale-95"
                    >
                        <RefreshCw className="w-5 h-5" /> Nuevo Pedido
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl bg-brand-dark text-white font-bold transition-all hover:bg-black active:scale-95 shadow-lg shadow-black/10"
                    >
                        Volver al Inicio <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
