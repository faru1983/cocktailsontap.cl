'use client';

import { calculateSmartConfig } from '@/hooks/useWizard';
import type { useWizard } from '@/hooks/useWizard';
import { CheckCircle } from 'lucide-react';


type WizardHook = ReturnType<typeof useWizard>;

export default function WizardStep3({ wizard }: { wizard: WizardHook }) {
    const { state } = wizard;
    const guests = Math.max(state.consumption.guests, 1);
    const totalDrinksWanted = guests * state.consumption.drinksPerPerson;
    const { config, liters, totalDrinks } = calculateSmartConfig(totalDrinksWanted);
    const avgDrinks = (totalDrinks / guests).toFixed(1);

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">3. Sugerencia de Expertos</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Basado en tus datos, esta es la configuración óptima para que la barra nunca se detenga.</p>

            <div className="bg-gradient-to-br from-[#fff7ed] to-[#fffbeb] border-2 border-primary rounded-[20px] p-8">
                <div className="text-[0.85rem] uppercase text-primary font-extrabold tracking-[1px] mb-4">
                    Recomendación Cocktails on Tap
                </div>
                <p className="text-[1.1rem] text-brand-text-muted mb-6 leading-[1.6]">
                    Para <strong>{guests} invitados</strong> consumiendo <strong>{state.consumption.drinksPerPerson} cócteles</strong> c/u, sugerimos:
                    <span className="block mt-4 text-[1.6rem] text-primary font-black leading-[1.2]">
                        {config}
                    </span>
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6 bg-white rounded-xl p-5 shadow-sm">
                    <div className="text-center">
                        <span className="block text-2xl font-black text-primary">{liters}L</span>
                        <span className="text-[0.7rem] uppercase text-brand-text-muted font-bold tracking-wider">Volumen Total</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-2xl font-black text-primary">{totalDrinks}</span>
                        <span className="text-[0.7rem] uppercase text-brand-text-muted font-bold tracking-wider">Total Cócteles</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-2xl font-black text-primary">{avgDrinks}</span>
                        <span className="text-[0.7rem] uppercase text-brand-text-muted font-bold tracking-wider">x Persona</span>
                    </div>
                </div>
            </div>

            <p className="text-center text-brand-text-muted text-[0.9rem] mt-6 font-medium">
                <CheckCircle className="inline-block text-primary mr-2 w-4 h-4" />
                Acepta esta sugerencia o personalízala a tu gusto en el siguiente paso.
            </p>

        </div>
    );
}
