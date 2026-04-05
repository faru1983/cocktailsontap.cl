'use client';

import { useState, useEffect } from 'react';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import { createQuote } from '@/app/actions/createQuote';
import { SITE_URL, WHATSAPP_URL } from '@/lib/config';
import WizardStep1 from './WizardStep1';
import WizardStep2 from './WizardStep2';
import WizardStep3 from './WizardStep3';
import WizardStep4 from './WizardStep4';
import WizardStep5 from './WizardStep5';
import WizardStep6 from './WizardStep6';
import WizardSuccess from './WizardSuccess';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    categories: string[];
}

type SendStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function WizardShell({ cocktails, eventTypes, comunas, categories }: Props) {
    const wizard = useWizard(cocktails, comunas, categories);
    const { state } = wizard;

    const [validationError, setValidationError] = useState('');
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
    const [quoteToken, setQuoteToken] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        wizard.initCategory(categories);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories]);

    const progress = ((state.step - 1) / 5) * 100;

    const handleNext = () => {
        const result = wizard.validateStep(state.step);
        if (result.valid) {
            setValidationError('');
            wizard.goToStep(state.step + 1);
        } else {
            setValidationError(result.message ?? '');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
        } else {
            setSaveError(result.error ?? 'Error guardando la cotización.');
            setSendStatus('error');
        }

        // Subir al top para ver el mensaje de confirmación
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Siempre abrir WhatsApp independiente del resultado del guardado, pasando el token si existe
        wizard.sendWhatsAppQuote(result.token);
    };

    const handleReset = () => {
        setSendStatus('idle');
        setQuoteToken(null);
        wizard.goToStep(1);
        // Resetear otros estados si es necesario, pero goToStep(1) ya limpia gran parte
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderStep = () => {
        switch (state.step) {
            case 1: return <WizardStep1 wizard={wizard} eventTypes={eventTypes} comunas={comunas} />;
            case 2: return <WizardStep2 wizard={wizard} />;
            case 3: return <WizardStep3 wizard={wizard} cocktails={cocktails} categories={categories} />;
            case 4: return <WizardStep4 wizard={wizard} cocktails={cocktails} comunas={comunas} />;
            case 5: return <WizardStep5 wizard={wizard} comunas={comunas} />;
            case 6: return <WizardStep6 wizard={wizard} cocktails={cocktails} comunas={comunas} />;
            default: return null;
        }
    };


    return (
        <div className="flex flex-col min-h-[600px]">

            {/* Progress */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                <div className="bg-brand-border h-2 w-full rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-primary via-[#f4a261] to-primary transition-all duration-1000 ease-in-out relative origin-left" style={{ width: `${progress}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                </div>
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

                {state.step === 6 && sendStatus === 'error' && saveError && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 mb-6 text-[0.9rem] animate-slide-up">
                        <strong>Nota:</strong> {saveError} Tu solicitud igual fue enviada por WhatsApp.
                    </div>
                )}

                <div className="animate-fade-in">
                    {sendStatus === 'saved' && quoteToken ? (
                        <WizardSuccess 
                            token={quoteToken} 
                            clientEmail={state.contact.email} 
                            onReset={handleReset} 
                        />
                    ) : (
                        renderStep()
                    )}
                    {/* Navigation - UI/UX MEJORADO PROFESIONAL */}
                    {sendStatus !== 'saved' && (
                        <div className="mt-12 mb-12 sm:mb-20">
                            <div className="bg-white/50 backdrop-blur-sm border border-brand-border rounded-[2.5rem] p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                                <div className="order-2 sm:order-1 w-full sm:w-auto">
                                    {state.step > 1 && (
                                        <button
                                            type="button"
                                            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-brand-border text-brand-text-muted font-bold text-[0.95rem] transition-all hover:border-primary/50 hover:text-primary active:scale-[0.98] bg-white/80"
                                            onClick={() => { setValidationError(''); wizard.goToStep(state.step - 1); }}
                                        >
                                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                            <span>Anterior</span>
                                        </button>
                                    )}
                                </div>

                                <div className="order-1 sm:order-2 w-full sm:w-auto">
                                    {state.step < 6 ? (
                                        <button
                                            type="button"
                                            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-3.5 rounded-2xl bg-primary text-white font-black text-[1.1rem] transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_20px_rgba(226,160,73,0.3)] hover:shadow-[0_8px_30px_rgba(226,160,73,0.4)]"
                                            onClick={handleNext}
                                        >
                                            <span>Siguiente</span>
                                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={sendStatus === 'saving'}
                                            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-3.5 rounded-2xl bg-[#25D366] text-white font-black text-[1.1rem] transition-all hover:bg-[#128c7e] active:scale-[0.98] shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:shadow-[0_8px_30px_rgba(37,211,102,0.4)] disabled:opacity-70 disabled:cursor-not-allowed"
                                            onClick={handleCotizar}
                                        >
                                            {sendStatus === 'saving' ? (
                                                <><Loader2 className="w-5 h-5 animate-spin" /> <span>Guardando...</span></>
                                            ) : (
                                                <><WhatsappIcon className="w-5 h-5" /> <span>Cotizar</span></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Indicador de ayuda/soporte adicional debajo del nav */}
                            <div className="mt-8 text-center animate-fade-in delay-500">
                                <p className="text-[0.8rem] text-brand-text-muted font-medium italic">
                                    ¿Necesitas ayuda con tu cotización? 
                                    <a href={WHATSAPP_URL} target="_blank" className="ml-1.5 text-primary hover:underline font-bold">Háblanos por WhatsApp</a>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
