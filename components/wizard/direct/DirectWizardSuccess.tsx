'use client';

import React, { useMemo } from 'react';
import { CheckCircle, Copy, ExternalLink, RefreshCw, ArrowRight } from 'lucide-react';
import { SITE_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';
import { calculateSummaryData } from '@/lib/wizardLogic';
import type { WizardState, CocktailForWizard, Comuna } from '@/lib/types';

interface Props {
    token: string;
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    onReset: () => void;
}

export default function DirectWizardSuccess({ token, state, cocktails, comunas, onReset }: Props) {
    const quoteLink = `${SITE_URL}/cotizar/${token}`;

    const { totalPrice } = useMemo(() => calculateSummaryData(state, cocktails, comunas), [state, cocktails, comunas]);

    const copyBankDetails = () => {
        const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 text-green-600 relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
                <CheckCircle className="w-10 h-10 relative z-10" />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black text-brand-dark mb-4 tracking-tight">
                ¡Pedido Confirmado!
            </h1>
            
            <p className="text-brand-text-muted text-[1.05rem] mb-10 max-w-lg mx-auto leading-relaxed">
                Hemos recibido tu solicitud y te enviamos un correo con los detalles. 
                <strong className="text-brand-text block mt-2">Para validar e iniciar la preparación, realiza el pago del total.</strong>
            </p>

            {/* Tarjeta de Pago */}
            <div className="bg-[#fffbf0] border-2 border-primary/20 rounded-3xl p-6 sm:p-8 max-w-sm mx-auto text-left shadow-lg overflow-hidden relative group mb-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <p className="text-primary font-black text-center mb-1 uppercase tracking-widest text-[0.7rem]">Monto a depositar (100%)</p>
                <p className="text-brand-text font-black text-4xl text-center mb-6">{formatCurrency(totalPrice)}</p>
                
                <div className="text-[0.85rem] text-brand-text space-y-2 border-t border-primary/20 pt-6">
                    <p className="flex justify-between"><strong>Banco:</strong> <span>Mercado Pago</span></p>
                    <p className="flex justify-between"><strong>Nº Cuenta:</strong> <span>1098081647 (Vista)</span></p>
                    <p className="flex justify-between"><strong>Nombre:</strong> <span>Felipe Ramírez</span></p>
                    <p className="flex justify-between"><strong>RUT:</strong> <span>15.332.189-2</span></p>
                    <p className="flex justify-between"><strong>Email:</strong> <span>contacto@cocktailsontap.cl</span></p>
                </div>
                
                <button 
                    onClick={copyBankDetails}
                    className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-primary/20 rounded-xl text-[0.85rem] font-black text-brand-text hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
                >
                    <Copy className="w-4 h-4" /> Copiar Datos de Cuenta
                </button>
            </div>

            {/* Comprobante Digital */}
            <div className="max-w-lg mx-auto bg-slate-50 border border-brand-border rounded-3xl p-5 relative text-left shadow-sm mb-10">
                <p className="text-[0.65rem] font-black text-brand-text-muted uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Tu Comprobante Digital
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 bg-white border border-brand-border rounded-xl px-4 py-3 text-[0.85rem] font-medium text-brand-text overflow-hidden text-ellipsis whitespace-nowrap shadow-inner flex items-center">
                        {quoteLink}
                    </div>
                    <button 
                        onClick={() => navigator.clipboard.writeText(quoteLink)} 
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border-2 border-brand-border text-brand-text font-bold text-[0.85rem] hover:border-primary hover:text-primary transition-all active:scale-95 flex-shrink-0"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <a 
                        href={quoteLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-text text-white font-bold text-[0.85rem] hover:bg-black transition-all active:scale-95 shadow-md flex-shrink-0"
                    >
                        Abrir
                    </a>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                    onClick={onReset}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-brand-border text-brand-text-muted font-bold transition-all hover:border-primary hover:text-primary active:scale-95"
                >
                    <RefreshCw className="w-5 h-5" /> Nuevo Pedido
                </button>
                <a
                    href="/"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-primary text-white font-black transition-all hover:bg-primary-dark active:scale-95 shadow-md shadow-primary/20"
                >
                    Volver al Inicio <ArrowRight className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}
