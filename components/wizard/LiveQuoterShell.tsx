'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import { createQuote } from '@/app/actions/createQuote';

import LiveQuoterConfig from '@/components/wizard/components/LiveQuoterConfig';
import LiveQuoterCatalog from '@/components/wizard/components/LiveQuoterCatalog';
import LiveQuoterCheckoutModal from '@/components/wizard/components/LiveQuoterCheckoutModal';
import WizardSuccess from './WizardSuccess';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    categories: string[];
    initialServiceType?: '' | 'event' | 'direct';
}

type SendStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function LiveQuoterShell({ cocktails, eventTypes, comunas, categories, initialServiceType }: Props) {
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

    // Usaremos un flujo interno simplificado: Config (1) -> Catalog (2)
    const currentStep = state.step > 2 ? 2 : state.step;
    const progress = (currentStep / 2) * 100;

    useEffect(() => {
        setValidationError('');
        if (sendStatus === 'error') {
            setSendStatus('idle');
            setSaveError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, state.selections, isModalOpen]);

    const handleNextToCatalog = () => {
        const result = wizard.validateStep(1); // Valida fecha, temática e invitados
        
        if (!result.valid) {
            setValidationError(result.message ?? '');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!state.dispenser) {
             setValidationError('Selecciona un dispensador.');
             window.scrollTo({ top: 0, behavior: 'smooth' });
             return;
        }

        setValidationError('');
        wizard.goToStep(2);
    };

    const handleOpenCheckout = () => {
        setValidationError('');
        setIsModalOpen(true);
    };

    const handleCotizar = async () => {
        const resultVal = wizard.validateStep(5); // Valida contacto
        if (!resultVal.valid) {
             setValidationError(resultVal.message ?? '');
             return;
        }

        setSendStatus('saving');
        setSaveError('');
        setQuoteToken(null);

        const result = await createQuote({ state, cocktails, comunas });

        if (result.success && result.token) {
            setQuoteToken(result.token);
            setSendStatus('saved');
            setIsModalOpen(false);
            wizard.sendWhatsAppQuote(result.token);
            router.push(`/cotizar/${result.token}?new=true`);
        } else {
            setSaveError(result.error ?? 'Error guardando la cotización.');
            setSendStatus('error');
            wizard.sendWhatsAppQuote();
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

            {/* Progress Bar */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                <div className="bg-brand-border h-2 w-full rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-primary via-[#f4a261] to-primary transition-all duration-1000 ease-in-out relative origin-left" style={{ width: `${progress}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
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
                        <strong>Nota:</strong> {saveError} Tu solicitud igual fue enviada por WhatsApp.
                    </div>
                )}

                <div className="animate-fade-in pb-32">
                    {sendStatus === 'saved' && quoteToken ? (
                        <WizardSuccess 
                            token={quoteToken} 
                            clientEmail={state.contact.email} 
                            onReset={handleReset} 
                            onOpenWhatsApp={() => wizard.sendWhatsAppQuote(quoteToken)}
                        />
                    ) : (
                        currentStep === 1 ? (
                            <LiveQuoterConfig wizard={wizard} eventTypes={eventTypes} onNext={handleNextToCatalog} />
                        ) : (
                            <LiveQuoterCatalog wizard={wizard} cocktails={cocktails} categories={categories} onOpenCheckout={handleOpenCheckout} onBack={() => wizard.goToStep(1)} />
                        )
                    )}
                </div>
            </div>

            {/* Checkout Modal Overlay */}
            {isModalOpen && sendStatus !== 'saved' && (
                <LiveQuoterCheckoutModal 
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
