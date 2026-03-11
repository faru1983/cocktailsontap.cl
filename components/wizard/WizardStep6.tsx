'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { useWizard } from '@/hooks/useWizard';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import { RotateCcw } from 'lucide-react';
import QuoteSummaryProducts from '@/components/quote/QuoteSummaryProducts';
import QuoteSummaryReservation from '@/components/quote/QuoteSummaryReservation';


type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
}

export default function WizardStep6({ wizard, cocktails, comunas }: Props) {
    const { state, goToStep } = wizard;
    const data = useMemo(
        () => wizard.calculateSummaryData(),
        // wizard.calculateSummaryData es estable; dependemos de los slices reales que usa la función
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.selections, state.eventData, state.contact, state.dispenser]
    );

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">6. Resumen de Cotización</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Revisa los detalles de tu solicitud antes de enviar.</p>

            {/* Bloque 1: Productos y Totales */}
            <QuoteSummaryProducts
                data={{ ...data, guests: state.consumption.guests }}
                isEditable={true}
                onUpdateQuantity={wizard.updateQuantity}
                onAddProductsClick={() => goToStep(4)}
            />

            {/* Bloque 2: Información de Reserva */}
            <QuoteSummaryReservation
                data={{
                    clientName: state.contact.firstName.trim(),
                    clientEmail: state.contact.email,
                    clientPhone: state.contact.phone,
                    clientAddress: state.contact.address,
                    comunaDisplay: data.comunaDisplay,
                    eventTypeDisplay: data.eventTypeDisplay,
                    guests: state.consumption.guests,
                    formattedDate: data.formattedDate,
                    startTime: state.eventData.startTime || '--:--',
                    formattedPickupDate: state.eventData.pickupDate ? data.formattedPickupDate : undefined,
                    pickupTime: state.eventData.pickupTime,
                    comments: state.contact.comments
                }}
            />

            <div className="mt-8 text-center flex flex-col gap-3 items-center">
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#e2e8f0] text-[#64748b] bg-transparent font-bold text-[0.95rem] transition-all hover:bg-[#f1f5f9] hover:text-brand-text cursor-pointer w-full max-w-[300px]"
                    onClick={() => goToStep(1)}
                >
                    <RotateCcw className="w-4 h-4" /> Comenzar de Nuevo
                </button>
            </div>
        </div>
    );
}
