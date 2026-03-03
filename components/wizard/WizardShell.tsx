'use client';

import { useState, useEffect } from 'react';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import WizardStep1 from './WizardStep1';
import WizardStep2 from './WizardStep2';
import WizardStep3 from './WizardStep3';
import WizardStep4 from './WizardStep4';
import WizardStep5 from './WizardStep5';
import WizardStep6 from './WizardStep6';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    categories: string[];
}

export default function WizardShell({ cocktails, eventTypes, comunas, categories }: Props) {
    const wizard = useWizard(cocktails, comunas, categories);
    const { state } = wizard;

    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        wizard.initCategory(categories);
        // wizard.initCategory es un callback estable (useCallback sin deps), categories es la dependencia real
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

    const renderStep = () => {
        switch (state.step) {
            case 1: return <WizardStep1 wizard={wizard} eventTypes={eventTypes} comunas={comunas} />;
            case 2: return <WizardStep2 wizard={wizard} comunas={comunas} />;
            case 3: return <WizardStep3 wizard={wizard} />;
            case 4: return <WizardStep4 wizard={wizard} cocktails={cocktails} categories={categories} />;
            case 5: return <WizardStep5 wizard={wizard} cocktails={cocktails} comunas={comunas} />;
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
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-4 flex-1 mb-24">
                {validationError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 mb-8 font-semibold flex items-center gap-4 text-[0.95rem] shadow-sm animate-slide-up">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <span className="flex-1">{validationError}</span>
                    </div>
                )}
                <div className="animate-fade-in">
                    {renderStep()}
                </div>
            </div>

            {/* Fixed Nav */}
            <div className="fixed bottom-0 left-0 right-0 z-[160] bg-white border-t border-brand-border py-4 px-6 flex items-center justify-between gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between">
                    <div className="flex-1 flex justify-start">
                        {state.step > 1 && (
                            <button
                                type="button"
                                className="group inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-brand-border text-brand-text-muted font-bold text-[0.9rem] transition-all hover:border-primary hover:text-primary active:scale-95 bg-white"
                                onClick={() => { setValidationError(''); wizard.goToStep(state.step - 1); }}
                            >
                                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Anterior
                            </button>
                        )}
                    </div>

                    <div className="flex-1 flex justify-end">
                        {state.step < 6 ? (
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-primary text-white font-bold text-[1rem] transition-all hover:bg-primary-dark active:scale-95 shadow-[0_4px_15px_rgba(226,160,73,0.35)] hover:shadow-[0_8px_25px_rgba(226,160,73,0.45)]"
                                onClick={handleNext}
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-[#25D366] text-white font-bold text-[1rem] transition-all hover:bg-[#128c7e] active:scale-95 shadow-[0_4px_15px_rgba(37,211,102,0.35)] hover:shadow-[0_8px_25px_rgba(37,211,102,0.45)]"
                                onClick={wizard.sendWhatsAppQuote}
                            >
                                <WhatsappIcon className="w-5 h-5" /> Cotizar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
