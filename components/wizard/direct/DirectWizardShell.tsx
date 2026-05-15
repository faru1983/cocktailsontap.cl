'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import { createQuote } from '@/app/actions/createQuote';
import { WHATSAPP_URL } from '@/lib/config';

import DirectStep1Products from './DirectStep1Products';
import DirectStep2Delivery from './DirectStep2Delivery';
import DirectStep3Summary from './DirectStep3Summary';
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

    useEffect(() => {
        setValidationError('');
    }, [state.step]);

    useEffect(() => {
        wizard.initCategory(categories);
        // Dispenser is no longer forced to 'desechable' as it is deprecated
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories]);

    // Progress adjusted for 3 steps
    const progress = (state.step / 3) * 100;

    // Reset errors and status when step changes
    useEffect(() => {
        setValidationError('');
        if (sendStatus === 'error') {
            setSendStatus('idle');
            setSaveError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.step, state.selections]);

    const getDisposableLiters = () =>
        state.selections.reduce((sum, sel) => {
            const product = cocktails.find(c => c.id === sel.id);
            const selectedPrice = product?.prices?.[sel.size];
            const sizeValue = selectedPrice?.sizeValue ?? 0;
            const isDisposable = selectedPrice?.isDisposable ?? false;
            return sum + (isDisposable && sizeValue > 0 ? sizeValue * sel.quantity : 0);
        }, 0);

    const handleNext = () => {
        // We need custom validation logic here or adapt validateStep
        let isValid = true;
        let message = '';

        if (state.step === 1) {
            const disposableLiters = getDisposableLiters();
            if (disposableLiters < 5) {
                isValid = false;
                message = 'Debes seleccionar al menos 1 barril desechable (5 litros) para continuar.';
            }
        }
        if (state.step === 2) {
            const c = state.contact;
            const e = state.eventData;
            if (!c.firstName.trim()) { isValid = false; message = 'El nombre es obligatorio.'; }
            else if (!c.lastName.trim()) { isValid = false; message = 'El apellido es obligatorio.'; }
            else if (!c.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) { isValid = false; message = 'Ingresa un email válido.'; }
            else if (!c.phone.trim() || c.phone === '+569') { isValid = false; message = 'El celular es obligatorio.'; }
            else if (!c.comuna.trim()) { isValid = false; message = 'Selecciona la comuna de entrega.'; }
            else if (!c.address.trim()) { isValid = false; message = 'La dirección de entrega es obligatoria.'; }
            else if (!e.date.trim()) { isValid = false; message = 'Indica la fecha de entrega.'; }
        }

        if (isValid) {
            setValidationError('');
            wizard.goToStep(state.step + 1);
        } else {
            setValidationError(message);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCotizar = async () => {
        // Validación preventiva por consistencia de negocio
        if (getDisposableLiters() < 5) {
            setValidationError('Debes incluir al menos 1 barril desechable (5 litros) en tu pedido.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setSendStatus('saving');
        setSaveError('');
        setQuoteToken(null);

        // Guardar en Supabase
        const result = await createQuote({ state, cocktails, comunas });

        if (result.success && result.token) {
            setQuoteToken(result.token);
            setSendStatus('saved');
            // Desencadenar WhatsApp inmediatamente para aprovechar el gesto del usuario
            wizard.sendWhatsAppQuote(result.token);
            
            // Redirigir a la página de la cotización con un flag de éxito
            router.push(`/cotizar/${result.token}?new=true`);
        } else {
            setSaveError(result.error ?? 'Error procesando tu compra.');
            setSendStatus('error');
            // Intentar WhatsApp de todas formas
            wizard.sendWhatsAppQuote();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleReset = () => {
        setSendStatus('idle');
        setQuoteToken(null);
        setValidationError('');
        wizard.reset();
        window.location.href = '/cotizar';
    };

    const renderStep = () => {
        // Force state step mapping for Direct Sale since we decoupled from WizardStep0 which sits at 0 now. Wait, WizardStep0 will route to here and we'll start at step 1.
        switch (state.step) {
            case 1: return <DirectStep1Products wizard={wizard} cocktails={cocktails} categories={categories} setValidationError={setValidationError} />;
            case 2: return <DirectStep2Delivery wizard={wizard} comunas={comunas} />;
            case 3: return <DirectStep3Summary wizard={wizard} cocktails={cocktails} comunas={comunas} />;
            default: return null; // WizardStep0 or success are handled elsewhere or mapped to 1
        }
    };

    return (
        <div className="flex flex-col min-h-[600px]">
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

                {state.step === 3 && sendStatus === 'error' && saveError && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 mb-6 text-[0.9rem] animate-slide-up">
                        <span className="font-bold">Aviso:</span> {saveError}
                        <div className="mt-2 opacity-80 text-[0.8rem]">De todas formas puedes intentar enviar la información a través de WhatsApp.</div>
                    </div>
                )}

                <div className="animate-fade-in">
                    {sendStatus === 'saved' && quoteToken ? (
                        <DirectWizardSuccess 
                            token={quoteToken} 
                            state={state}
                            cocktails={cocktails}
                            comunas={comunas}
                            onReset={handleReset} 
                        />
                    ) : (
                        renderStep()
                    )}

                    {/* Navigation - MISMO ESTILO QUE WIZARDSHELL */}
                    {sendStatus !== 'saved' && state.step > 0 && (
                        <div className="mt-12 mb-12 sm:mb-20">
                            <div className="bg-white/50 backdrop-blur-sm border border-brand-border rounded-[2.5rem] p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                                <div className="order-2 sm:order-1 w-full sm:w-auto">
                                    {state.step > 1 && (
                                        <button
                                            type="button"
                                            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-brand-border text-brand-text-muted font-bold text-[0.95rem] transition-all hover:border-primary/50 hover:text-primary active:scale-[0.98] bg-white/80"
                                            onClick={() => {
                                                setValidationError('');
                                                wizard.goToStep(state.step - 1);
                                            }}
                                        >
                                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                            <span>Anterior</span>
                                        </button>
                                    )}
                                </div>

                                <div className="order-1 sm:order-2 w-full sm:w-auto">
                                    {state.step < 3 ? (
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
                                                <><WhatsappIcon className="w-5 h-5" /> <span>Hacer Pedido</span></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Indicador de ayuda */}
                            <div className="mt-8 text-center animate-fade-in delay-500">
                                <p className="text-[0.8rem] text-brand-text-muted font-medium italic">
                                    ¿Tienes dudas con tu pedido? 
                                    <a href={WHATSAPP_URL} target="_blank" className="ml-1.5 text-primary hover:underline font-bold">Consúltanos por WhatsApp</a>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
