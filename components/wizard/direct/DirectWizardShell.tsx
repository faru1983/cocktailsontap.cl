'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft, ShoppingCart } from 'lucide-react';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import { createQuote } from '@/app/actions/createQuote';
import { WHATSAPP_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

import DirectStep1Products from './DirectStep1Products';
import DirectWizardCheckoutModal from './DirectWizardCheckoutModal';
import DirectWizardSuccess from './DirectWizardSuccess';

interface Props {
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    categories: string[];
    initialServiceType?: '' | 'event' | 'direct';
}

type SendStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function DirectWizardShell({ cocktails, comunas, categories, initialServiceType }: Props) {
    const router = useRouter();
    const wizard = useWizard(cocktails, comunas, categories, initialServiceType);
    const { state } = wizard;

    const [validationError, setValidationError] = useState('');
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
    const [quoteToken, setQuoteToken] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        wizard.initCategory(categories);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories]);

    // Reset error when selections or modal state changes
    useEffect(() => {
        setValidationError('');
        if (sendStatus === 'error') {
            setSendStatus('idle');
            setSaveError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.selections, isModalOpen]);

    const summaryData = useMemo(() => {
        return wizard.calculateSummaryData();
    }, [state.selections, wizard]);

    const totalItems = useMemo(() => {
        return state.selections.reduce((sum, s) => sum + s.quantity, 0);
    }, [state.selections]);

    const currentLiters = summaryData.totalLiters;

    const handleOpenCheckout = () => {
        // Validación preventiva antes de abrir el modal
        const hasMainProduct = state.selections.some(sel => {
            const product = cocktails.find(c => c.id === sel.id);
            return product && product.category !== 'Otros';
        });

        if (state.selections.length === 0) {
            setValidationError('Selecciona al menos un barril para continuar.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (currentLiters < 5) {
            setValidationError('Debes seleccionar al menos 1 barril desechable (5 litros) para continuar.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!hasMainProduct) {
            setValidationError('Debes seleccionar al menos un barril principal (el hielo y decoraciones son productos complementarios).');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setValidationError('');
        setIsModalOpen(true);
    };

    const handleCotizar = async () => {
        setSendStatus('saving');
        setSaveError('');
        setQuoteToken(null);

        // Guardar en Supabase
        const result = await createQuote({ state, cocktails, comunas });

        if (result.success && result.token) {
            setQuoteToken(result.token);
            setSendStatus('saved');
            setIsModalOpen(false);
            router.push(`/cotizar/${result.token}?new=true`);
        } else {
            setSaveError(result.error ?? 'Error procesando tu compra.');
            setSendStatus('error');
        }
    };

    const handleReset = () => {
        setSendStatus('idle');
        setQuoteToken(null);
        setValidationError('');
        setIsModalOpen(false);
        wizard.reset();
        window.location.href = '/cotizar';
    };

    return (
        <div className="flex flex-col min-h-[600px] relative">
            {/* Header / Volver */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <button
                    type="button"
                    onClick={handleReset}
                    className="group inline-flex items-center gap-3 text-brand-text-muted no-underline font-semibold text-[0.95rem] transition-all hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                >
                    <div className="p-2.5 rounded-full bg-white border border-brand-border group-hover:border-primary/30 group-hover:bg-primary/5 transition-all shadow-sm group-hover:shadow-md">
                        <ArrowLeft className="w-4 h-4 text-brand-text-muted group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
                    </div>
                    <span className="border-b border-transparent group-hover:border-primary/30 pb-0.5">Volver al inicio</span>
                </button>
            </div>

            {/* Content */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-8 flex-1">
                {validationError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 mb-8 font-semibold flex items-center gap-4 text-[0.95rem] shadow-sm animate-slide-up">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <span className="flex-1">{validationError}</span>
                    </div>
                )}

                {sendStatus === 'error' && saveError && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 mb-6 text-[0.9rem] animate-slide-up">
                        <span className="font-bold">Aviso:</span> {saveError}
                        <div className="mt-3">
                            <a
                                href={wizard.getWhatsAppQuoteUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#128c7e] text-white text-xs font-black no-underline transition-all active:scale-95"
                            >
                                Enviar por WhatsApp
                            </a>
                        </div>
                    </div>
                )}

                <div className="animate-fade-in pb-32">
                    {sendStatus === 'saved' && quoteToken ? (
                        <DirectWizardSuccess 
                            token={quoteToken} 
                            state={state}
                            cocktails={cocktails}
                            comunas={comunas}
                            onReset={handleReset} 
                        />
                    ) : (
                        <DirectStep1Products wizard={wizard} cocktails={cocktails} categories={categories} />
                    )}
                </div>
            </div>

            {/* Bottom Bar Fija (Sticky Bottom Bar) */}
            {sendStatus !== 'saved' && totalItems > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none">
                    <div className="max-w-[1400px] mx-auto">
                        <div className="bg-white/90 backdrop-blur-md border border-brand-border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-[0_-5px_30px_rgba(0,0,0,0.1)] pointer-events-auto">
                            <div className="flex items-center gap-4 pl-2">
                                <div className="flex flex-col">
                                    <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-brand-text-muted uppercase tracking-wider leading-none mb-1">
                                        Volumen Total
                                    </span>
                                    <span className="text-[1.1rem] sm:text-xl font-black text-brand-text leading-tight">
                                        {currentLiters}L
                                    </span>
                                </div>

                                <div className="flex flex-col hidden sm:flex">
                                    <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-brand-text-muted uppercase tracking-wider leading-none mb-1">
                                        Subtotal
                        </span>
                                    <span className="text-[1.1rem] sm:text-xl font-black text-primary leading-tight">
                                        {formatCurrency(summaryData.totalOfferPrice)}
                                    </span>
                                </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-3">
                                <div className="text-right sm:hidden flex flex-col justify-center pr-1">
                                    <span className="text-[0.6rem] font-bold text-brand-text-muted uppercase tracking-wider leading-none mb-0.5">
                                        Subtotal
                                    </span>
                                    <span className="text-sm font-black text-primary leading-none">
                                        {formatCurrency(summaryData.totalOfferPrice)}
                                    </span>
                                </div>
                                <div className="cart-button-target shrink-0 flex">
                                    <button
                                        type="button"
                                        onClick={handleOpenCheckout}
                                        className="group relative shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:gap-2 sm:px-6 sm:py-3 rounded-xl bg-primary text-white font-black text-[0.9rem] sm:text-[1.05rem] transition-all hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                                    >
                                        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                                        <span>Comprar</span>
                                        {totalItems > 0 && (
                                            <span className="absolute -top-2 -right-2 bg-brand-text text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[0.7rem] font-extrabold border-2 border-white shadow-sm">
                                                {totalItems}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal Overlay */}
            {isModalOpen && sendStatus !== 'saved' && (
                <DirectWizardCheckoutModal 
                    wizard={wizard} 
                    comunas={comunas} 
                    onClose={() => setIsModalOpen(false)} 
                    onConfirm={handleCotizar}
                    sendStatus={sendStatus}
                />
            )}
        </div>
    );
}
