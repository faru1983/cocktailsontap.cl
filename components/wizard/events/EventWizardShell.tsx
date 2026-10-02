'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/hooks/useWizard';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import type { CocktailForWizard, EventType, Comuna, Region } from '@/lib/types';
import { createQuote } from '@/app/actions/createQuote';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { calculateLiveQuoterSuggestion } from '@/lib/wizardLogic';

import EventStepGuests from './EventStepGuests';
import EventStepDrinks from './EventStepDrinks';
import EventStepProposal from './EventStepProposal';
import EventStepDispenser from './EventStepDispenser';
import EventWizardCatalog from './EventWizardCatalog';
import EventWizardCheckoutModal from './EventWizardCheckoutModal';
import EventWizardSuccess from './EventWizardSuccess';
import { getClientMetaAttribution } from '@/lib/attribution';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    regions: Region[];
    categories: string[];
    initialServiceType?: '' | 'event' | 'direct';
}

type SendStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function EventWizardShell({ cocktails, eventTypes, comunas, regions, categories, initialServiceType }: Props) {
    const router = useRouter();
    const wizard = useWizard(cocktails, comunas, categories, initialServiceType);
    const { state, updateConsumption, updateDispenser, goToStep } = wizard;

    const [validationError, setValidationError] = useState('');
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
    const [quoteToken, setQuoteToken] = useState<string | null>(null);
    const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        wizard.initCategory(categories);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories]);

    // Flujo de 5 pasos:
    // 1: Invitados
    // 2: Tragos p/p
    // 3: Propuesta Estimada
    // 4: Formato Dispensador
    // 5: Catálogo de Cócteles
    const currentStep = Math.min(5, Math.max(1, state.step));
    const progress = (currentStep / 5) * 100;

    useEffect(() => {
        setValidationError('');
        if (sendStatus === 'error') {
            setSendStatus('idle');
            setSaveError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, state.selections, isModalOpen]);

    // Litros sugeridos para pasar al paso de dispensador
    const suggestedLiters = useMemo(() => {
        const res = calculateLiveQuoterSuggestion(state.consumption.guests, state.consumption.drinksPerPerson);
        return res.recommendedLiters;
    }, [state.consumption.guests, state.consumption.drinksPerPerson]);

    // Handlers de avance de pasos
    const handleNextFromGuests = (guestsOverride?: number) => {
        const guests = guestsOverride !== undefined ? guestsOverride : state.consumption.guests;
        if (guests < 1) {
            setValidationError('Indica la cantidad de invitados para tu evento.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (guestsOverride !== undefined) {
            updateConsumption('guests', guestsOverride);
        }
        setValidationError('');
        goToStep(2);
    };

    const handleNextFromDrinks = (drinksOverride?: number) => {
        const drinks = drinksOverride !== undefined ? drinksOverride : state.consumption.drinksPerPerson;
        if (drinks < 1) {
            setValidationError('Indica la cantidad de cócteles por persona.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (drinksOverride !== undefined) {
            updateConsumption('drinksPerPerson', drinksOverride);
        }
        setValidationError('');
        goToStep(3);
    };

    const handleNextFromProposal = () => {
        setValidationError('');
        goToStep(4);
    };

    const handleNextFromDispenser = (dispenserOverride?: 'portatil' | 'muro') => {
        const disp = dispenserOverride ?? state.dispenser;
        if (!disp) {
            setValidationError('Selecciona un formato de dispensador.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (dispenserOverride) {
            updateDispenser(dispenserOverride);
        }
        setValidationError('');
        goToStep(5);
    };

    const handleOpenCheckout = () => {
        setValidationError('');
        setIsModalOpen(true);
    };

    const handleCotizar = async ({ confirmNow }: { confirmNow: boolean }) => {
        // Valida campos de contacto, fecha del evento y temática
        const resultVal = wizard.validateStep(6);
        if (!resultVal.valid) {
            setValidationError(resultVal.message ?? '');
            return;
        }
        if (confirmNow) {
            const confirmErr = validateConfirmNowState(state);
            if (confirmErr) {
                setValidationError(confirmErr);
                return;
            }
        }

        setSendStatus('saving');
        setSaveError('');
        setQuoteToken(null);
        setQuoteStatus(null);

        const attribution = getClientMetaAttribution();
        const result = await createQuote({
            state,
            confirmNow,
            fbc: attribution.fbc,
            fbp: attribution.fbp,
        });

        if (result.success && result.token) {
            setQuoteToken(result.token);
            setQuoteStatus(result.status || (confirmNow ? 'confirmed' : 'draft'));
            setSendStatus('saved');
            setIsModalOpen(false);
            const q = result.status === 'confirmed' ? '?new=true&confirmed=1' : '?new=true';
            router.push(`/cotizar/${result.token}${q}`);
        } else {
            setSaveError(result.error ?? 'Error guardando la cotización.');
            setSendStatus('error');
        }
    };

    const handleReset = () => {
        setSendStatus('idle');
        setQuoteToken(null);
        setQuoteStatus(null);
        setValidationError('');
        setIsModalOpen(false);
        wizard.reset();
        window.location.href = '/cotizar';
    };

    const handleRestartEventos = () => {
        setSendStatus('idle');
        setQuoteToken(null);
        setQuoteStatus(null);
        setValidationError('');
        setIsModalOpen(false);
        wizard.reset();
        window.location.href = '/eventos';
    };

    const handleBackStep = () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        } else {
            handleReset();
        }
    };

    return (
        <div className="flex flex-col min-h-[600px] relative">
            {/* Header / Navegación Superior */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-4 flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleBackStep}
                    className="group inline-flex items-center gap-2.5 text-brand-text-muted no-underline font-semibold text-xs sm:text-[0.9rem] transition-all hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                >
                    <div className="p-2 sm:p-2.5 rounded-full bg-white border border-brand-border group-hover:border-primary/30 group-hover:bg-primary/5 transition-all shadow-sm group-hover:shadow-md">
                        <ArrowLeft className="w-4 h-4 text-brand-text-muted group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
                    </div>
                    <span className="border-b border-transparent group-hover:border-primary/30 pb-0.5">
                        {currentStep === 1 && 'Volver al inicio'}
                        {currentStep === 2 && 'Cambiar invitados'}
                        {currentStep === 3 && 'Cambiar tragos p/p'}
                        {currentStep === 4 && 'Ver propuesta'}
                        {currentStep === 5 && 'Cambiar dispensador'}
                    </span>
                </button>

                {currentStep > 1 && (
                    <button
                        type="button"
                        onClick={handleRestartEventos}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reiniciar</span>
                    </button>
                )}
            </div>

            {/* Progress Bar Dinámica */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="bg-brand-border h-2 w-full rounded-full overflow-hidden shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-r from-primary via-[#f4a261] to-primary transition-all duration-700 ease-in-out relative origin-left" 
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-6 flex-1">
                {validationError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 mb-8 font-semibold flex items-center gap-4 text-[0.95rem] shadow-sm animate-slide-up max-w-2xl mx-auto">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <span className="flex-1">{validationError}</span>
                    </div>
                )}

                {sendStatus === 'error' && saveError && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 mb-6 text-[0.9rem] animate-slide-up max-w-2xl mx-auto">
                        <strong>Nota:</strong> {saveError}
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

                <div className="animate-fade-in pb-12">
                    {sendStatus === 'saved' && quoteToken ? (
                        <EventWizardSuccess
                            token={quoteToken}
                            clientEmail={state.contact.email}
                            onReset={handleReset}
                            confirmed={quoteStatus === 'confirmed'}
                        />
                    ) : (
                        <>
                            {currentStep === 1 && (
                                <EventStepGuests
                                    currentGuests={state.consumption.guests}
                                    onSelectGuests={(g) => updateConsumption('guests', g)}
                                    onNext={handleNextFromGuests}
                                />
                            )}

                            {currentStep === 2 && (
                                <EventStepDrinks
                                    guests={state.consumption.guests}
                                    currentDrinks={state.consumption.drinksPerPerson}
                                    onSelectDrinks={(d) => updateConsumption('drinksPerPerson', d)}
                                    onNext={handleNextFromDrinks}
                                    onBack={() => goToStep(1)}
                                />
                            )}

                            {currentStep === 3 && (
                                <EventStepProposal
                                    guests={state.consumption.guests}
                                    drinksPerPerson={state.consumption.drinksPerPerson}
                                    cocktails={cocktails}
                                    onNext={handleNextFromProposal}
                                    onBack={() => goToStep(2)}
                                />
                            )}

                            {currentStep === 4 && (
                                <EventStepDispenser
                                    selectedDispenser={state.dispenser}
                                    onSelectDispenser={(disp) => updateDispenser(disp)}
                                    suggestedLiters={suggestedLiters}
                                    onNext={handleNextFromDispenser}
                                    onBack={() => goToStep(3)}
                                />
                            )}

                            {currentStep === 5 && (
                                <EventWizardCatalog
                                    wizard={wizard}
                                    cocktails={cocktails}
                                    categories={categories}
                                    onOpenCheckout={handleOpenCheckout}
                                    onBack={() => goToStep(4)}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Checkout Modal Overlay */}
            {isModalOpen && sendStatus !== 'saved' && (
                <EventWizardCheckoutModal 
                    wizard={wizard} 
                    comunas={comunas}
                    regions={regions}
                    eventTypes={eventTypes}
                    onClose={() => setIsModalOpen(false)} 
                    onConfirm={handleCotizar}
                    sendStatus={sendStatus}
                />
            )}
        </div>
    );
}
