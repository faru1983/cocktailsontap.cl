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
                data={{ ...data, guests: state.consumption.guests, canHaveMuro: data.canHaveMuro }}
                isEditable={true}
                onUpdateQuantity={wizard.updateQuantity}
                onAddProductsClick={() => goToStep(3)}
                onToggleDispenser={() => wizard.updateDispenser(state.dispenser === 'muro' ? 'portatil' : 'muro')}
            />

            {/* Bloque 2: Información de Reserva */}
            <QuoteSummaryReservation
                data={{
                    clientName: `${state.contact.firstName.trim()} ${state.contact.lastName.trim()}`.trim(),
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

        </div>
    );
}
