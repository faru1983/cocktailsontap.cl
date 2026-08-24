'use client';

import React, { useMemo } from 'react';
import { CheckCircle, Copy, ExternalLink, RefreshCw, ArrowRight, Mail, MessageSquare } from 'lucide-react';
import { SITE_URL, WHATSAPP_URL } from '@/lib/config';
import { copyToClipboard } from '@/lib/utils';
import BankTransferCard from '@/components/quote/BankTransferCard';
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

    const handleCopyLink = () => {
        copyToClipboard(quoteLink);
    };

    return (
        <div className="w-full max-w-3xl mx-auto py-4 md:py-12 px-2 sm:px-4 animate-fade-in">
            <div className="w-full bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-brand-border text-center overflow-hidden relative">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />

                {/* Icono de Éxito */}
                <div className="relative mb-4 md:mb-8 inline-flex">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping scale-150 opacity-20" />
                    <div className="relative bg-green-100 p-3 md:p-6 rounded-full">
                        <CheckCircle className="w-10 h-10 md:w-16 md:h-16 text-green-600" />
                    </div>
                </div>

                <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-brand-dark mb-2 md:mb-4">
                    ¡Pedido Recibido!
                </h1>
                
                <p className="text-brand-text-muted text-[0.85rem] sm:text-base md:text-lg mb-5 md:mb-10 max-w-lg mx-auto leading-relaxed">
                    Hemos registrado tu pedido correctamente. El resumen ha sido enviado a tu email y a nuestro equipo.
                </p>

                {/* Link Card de Seguimiento */}
                <div className="bg-brand-light/50 border border-brand-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 relative group w-full overflow-hidden">
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">
                        Tu Link Único de Seguimiento
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                        <div className="flex-1 w-full min-w-0">
                            <div className="bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium text-brand-dark overflow-hidden text-ellipsis whitespace-nowrap text-left">
                                {quoteLink}
                            </div>
                        </div>
                        <button 
                            onClick={handleCopyLink}
                            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl bg-white border border-brand-border text-brand-dark font-bold text-[0.75rem] sm:text-sm hover:border-primary hover:text-primary transition-all active:scale-95"
                        >
                            <Copy className="w-4 h-4" /> Copiar Link
                        </button>
                    </div>
                    <p className="text-[0.7rem] sm:text-xs text-brand-text-muted mt-4 italic text-center">
                        Usa este link para ver o editar tu cotización más tarde.
                    </p>
                </div>

                {/* Card de Pago */}
                <BankTransferCard
                    amount={summary.totalOfferPrice + summary.shippingCost}
                    amountLabel="Monto a depositar (100%)"
                    variant="green"
                    className="mb-6"
                    footer={
                        <>
                            <p className="text-[0.7rem] sm:text-[0.8rem] text-green-700 text-center italic font-bold leading-tight">
                                Envía tu comprobante por WhatsApp o Email para validar tu pedido:
                            </p>
                            <a
                                href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hola, adjunto el comprobante de transferencia para mi pedido: ${SITE_URL}/cotizar/${token}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto inline-flex justify-center items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-[#25D366] hover:bg-[#128c7e] text-white rounded-xl text-[0.75rem] sm:text-xs font-black transition-all active:scale-95 shadow-sm no-underline text-center"
                            >
                                <WhatsappIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" /> Enviar Comprobante
                            </a>
                        </>
                    }
                />

                {/* Pasos Siguientes */}
                <div className="max-w-md mx-auto mb-8 sm:mb-10 text-left">
                    <div className="bg-white border border-brand-border rounded-2xl p-4 sm:p-5 flex gap-3 sm:gap-4">
                        <div className="bg-blue-50 p-3 rounded-xl h-fit shrink-0">
                            <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-brand-dark text-sm">Respaldo por Email</h3>
                            <p className="text-xs text-brand-text-muted mt-1 leading-relaxed">
                                Enviamos un respaldo a tu email. Revisa tu bandeja (y spam).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                    <button
                        onClick={() => window.location.href = '/barriles'}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-brand-border text-brand-text-muted text-[0.85rem] sm:text-base font-bold transition-all hover:border-primary hover:text-primary active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /> Nuevo Pedido
                    </button>
                    <button
                        onClick={() => window.location.href = `${SITE_URL}/cotizar/${token}`}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-brand-dark text-white text-[0.85rem] sm:text-base font-bold transition-all hover:bg-black active:scale-95 shadow-lg shadow-black/10"
                    >
                        Finalizar
                    </button>
                </div>
            </div>
        </div>
    );
}
