'use client';

import React from 'react';
import { CheckCircle, ArrowRight, Mail, RefreshCw, Copy } from 'lucide-react';
import { SITE_URL } from '@/lib/config';
import { copyToClipboard } from '@/lib/utils';

interface WizardSuccessProps {
    token: string;
    clientEmail: string;
    onReset: () => void;
    confirmed?: boolean;
}

export default function WizardSuccess({
    token,
    clientEmail,
    onReset,
    confirmed = false,
}: WizardSuccessProps) {
    const quoteLink = `${SITE_URL}/cotizar/${token}`;

    const handleCopyLink = () => {
        copyToClipboard(quoteLink);
    };

    return (
        <div className="w-full max-w-3xl mx-auto py-4 md:py-12 px-2 sm:px-4 animate-fade-in">
            <div className="w-full bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-brand-border text-center overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />

                <div className="relative mb-4 md:mb-8 inline-flex">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping scale-150 opacity-20" />
                    <div className="relative bg-green-100 p-3 md:p-6 rounded-full">
                        <CheckCircle className="w-10 h-10 md:w-16 md:h-16 text-green-600" />
                    </div>
                </div>

                <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-brand-dark mb-2 md:mb-4">
                    {confirmed ? '¡Reserva Confirmada!' : '¡Cotización Recibida!'}
                </h1>

                <p className="text-brand-text-muted text-[0.85rem] sm:text-base md:text-lg mb-5 md:mb-10 max-w-lg mx-auto leading-relaxed">
                    {confirmed
                        ? `Tu reserva quedó confirmada. Enviamos el comprobante${clientEmail ? ` a ${clientEmail}` : ' a tu correo'} y a nuestro equipo.`
                        : 'Hemos recibido tus datos correctamente. El resumen ha sido enviado a tu email y a nuestro equipo.'}
                </p>

                <div className="bg-brand-light/50 border border-brand-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 relative group w-full overflow-hidden">
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">
                        {confirmed ? 'Tu Link de Reserva' : 'Tu Link Único de Seguimiento'}
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
                    <p className="text-[0.7rem] sm:text-xs text-brand-text-muted mt-4 italic">
                        {confirmed
                            ? 'Guarda este link para revisar los detalles de tu reserva.'
                            : 'Usa este link para ver o editar tu cotización más tarde.'}
                    </p>
                </div>

                {!confirmed && (
                    <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-2xl sm:rounded-[3rem] bg-gradient-to-br from-[#fdfcfb] to-[#e2d1c3] border-2 border-primary/20 p-5 sm:p-10 shadow-[0_15px_40px_rgba(226,160,73,0.12)] group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
                        <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="inline-flex items-center justify-center px-4 py-1.5 bg-primary/10 rounded-full text-primary font-black text-[0.7rem] uppercase tracking-widest mb-4 border border-primary/10 animate-pulse">
                                ¡Asegura tu fecha hoy!
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-brand-dark mb-3">
                                ¿Listo para hacer que suceda?
                            </h2>
                            <p className="text-brand-text-muted font-medium text-balance mb-8 max-w-lg mx-auto leading-relaxed">
                                No te arriesgues a perder disponibilidad. Completa los detalles de entrega ahora mismo
                                y transforma esta cotización en una{' '}
                                <span className="text-brand-dark font-bold underline decoration-primary/40 decoration-2 underline-offset-4">
                                    reserva oficial
                                </span>
                                .
                            </p>

                            <a
                                href={quoteLink}
                                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-10 py-4 sm:py-5 bg-primary text-white font-black text-base sm:text-xl rounded-2xl shadow-[0_10px_25px_rgba(226,160,73,0.35)] hover:bg-primary-dark hover:shadow-[0_15px_35px_rgba(226,160,73,0.45)] hover:-translate-y-1 transition-all active:scale-95"
                            >
                                Confirmar Ahora
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:translate-x-1" />
                            </a>

                            <div className="flex items-center justify-center gap-6 mt-8">
                                <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-brand-text-muted">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> Reserva Exclusiva
                                </div>
                                <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-brand-text-muted">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> Montaje Garantizado
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                    <button
                        onClick={() => {
                            onReset();
                            window.location.href = '/eventos';
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-brand-border text-brand-text-muted text-[0.85rem] sm:text-base font-bold transition-all hover:border-primary hover:text-primary active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /> Nueva Cotización
                    </button>
                    <button
                        onClick={() => (window.location.href = `${SITE_URL}/cotizar/${token}`)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-brand-dark text-white text-[0.85rem] sm:text-base font-bold transition-all hover:bg-black active:scale-95 shadow-lg shadow-black/10"
                    >
                        Finalizar
                    </button>
                </div>
            </div>
        </div>
    );
}
