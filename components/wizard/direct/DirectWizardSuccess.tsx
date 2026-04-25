'use client';

import React, { useMemo } from 'react';
import { CheckCircle, Copy, ExternalLink, RefreshCw, ArrowRight } from 'lucide-react';
import { SITE_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

interface DirectWizardSuccessProps {
    token: string;
    totalPrice: number;
}

export default function DirectWizardSuccess({ token, totalPrice }: DirectWizardSuccessProps) {
    const quoteUrl = `${SITE_URL}/cotizar/${token}`;

    const copyToClipboard = () => {
        const text = `Banco: Mercado Pago\nCuenta Vista: 1098081647\nNombre: Felipe Ramírez\nRUT: 15.332.189-2\nE-mail: contacto@cocktailsontap.cl`;
        navigator.clipboard.writeText(text);
        alert('Datos de transferencia copiados al portapapeles');
    };

    return (
        <div className="max-w-xl mx-auto py-12 px-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="text-primary w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tighter italic">¡PEDIDO RECIBIDO!</h2>
                    <p className="text-white/60 text-sm">Tu pedido ha sido registrado con éxito.</p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8">
                    <p className="text-primary/60 text-[0.7rem] uppercase font-bold tracking-widest mb-1 text-center">Total a Transferir</p>
                    <p className="text-brand-text font-black text-4xl text-center mb-6">{formatCurrency(totalPrice)}</p>
                    
                    <div className="text-[0.85rem] text-brand-text space-y-2 border-t border-primary/20 pt-6">
                        <p className="flex justify-between"><strong>Banco:</strong> <span>Mercado Pago</span></p>
                        <p className="flex justify-between"><strong>Nº Cuenta:</strong> <span>1098081647 (Vista)</span></p>
                        <p className="flex justify-between"><strong>Nombre:</strong> <span>Felipe Ramírez</span></p>
                        <p className="flex justify-between"><strong>RUT:</strong> <span>15.332.189-2</span></p>
                        <p className="flex justify-between"><strong>Email:</strong> <span>contacto@cocktailsontap.cl</span></p>
                    </div>
                    
                    <button 
                        onClick={copyToClipboard}
                        className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all font-bold shadow-lg shadow-primary/20 group"
                    >
                        <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        COPIAR DATOS DE TRANSFERENCIA
                    </button>
                </div>

                <div className="space-y-4">
                    <a 
                        href={quoteUrl}
                        target="_blank"
                        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-white/40" />
                            </div>
                            <div className="text-left">
                                <p className="text-white font-bold text-sm">Ver Comprobante</p>
                                <p className="text-white/40 text-[0.7rem]">Accede a tu resumen detallado</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                    </a>
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 text-center">
                    <p className="text-white/40 text-[0.75rem] leading-relaxed">
                        Una vez realizada la transferencia, envíanos el comprobante por WhatsApp para validar tu pedido.
                    </p>
                </div>
            </div>
            
            <div className="mt-8 flex justify-center">
                <button 
                    onClick={() => window.location.href = '/'}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                >
                    <RefreshCw className="w-4 h-4" />
                    VOLVER AL INICIO
                </button>
            </div>
        </div>
    );
}
