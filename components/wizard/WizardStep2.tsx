'use client';

import type { useWizard } from '@/hooks/useWizard';
import { Info } from 'lucide-react';


type WizardHook = ReturnType<typeof useWizard>;

export default function WizardStep2({ wizard }: { wizard: WizardHook }) {
    const { state, updateConsumption } = wizard;

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">2. Preferencias de Consumo</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Ajusta la intensidad de la barra según el perfil de tus invitados para evitar que falten cócteles.</p>

            <div className="mb-10">
                <label htmlFor="wizard-guests" className="block font-bold mb-1 text-brand-text text-[0.95rem]">Cantidad de Invitados</label>
                <p className="text-brand-text-muted text-[0.85rem] mb-6">Mueve la barra para seleccionar el número de personas.</p>
                <div className="flex items-center gap-6 mt-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <input
                            id="wizard-guests"
                            type="range"
                            min={10}
                            max={500}
                            step={5}
                            className="w-full cursor-pointer h-2 bg-brand-border rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white transition-all hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95"
                            value={state.consumption.guests}
                            onChange={(e) => updateConsumption('guests', parseInt(e.target.value) || 10)}
                        />
                        <div className="flex justify-between text-[0.75rem] font-bold text-brand-text-muted px-1 mt-1">
                            <span>10</span>
                            <span>250</span>
                            <span>500+</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center bg-primary/5 border border-primary/20 rounded-2xl p-2 min-w-[100px] shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                        <input
                            type="number"
                            min={10}
                            max={5000}
                            className="w-full bg-transparent text-center font-extrabold text-2xl text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={state.consumption.guests}
                            onChange={(e) => updateConsumption('guests', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                    </div>
                </div>
            </div>

            <div className="mb-10">
                <label className="block font-bold mb-1 text-brand-text text-[0.95rem]">Cócteles promedio por persona</label>
                <p className="text-brand-text-muted text-[0.85rem] mb-6">¿Cuántos cócteles estimas que consumirá cada invitado?</p>
                <div className="flex items-center gap-6 mt-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            className="w-full cursor-pointer h-2 bg-brand-border rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white transition-all hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95"
                            value={state.consumption.drinksPerPerson}
                            onChange={(e) => updateConsumption('drinksPerPerson', parseInt(e.target.value))}
                        />
                        <div className="flex justify-between text-[0.75rem] font-bold text-brand-text-muted px-1 mt-1">
                            <span>1</span>
                            <span>5</span>
                            <span>10</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center bg-primary/5 border border-primary/20 rounded-2xl p-2 min-w-[100px] shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                        <input
                            type="number"
                            min={1}
                            max={20}
                            className="w-full bg-transparent text-center font-extrabold text-2xl text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={state.consumption.drinksPerPerson}
                            onChange={(e) => updateConsumption('drinksPerPerson', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-5 mt-4">
                <p className="font-bold text-primary mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Tip de Experto
                </p>

                <p className="text-[0.95rem] leading-[1.6]">
                    Recomendamos <strong>3 a 4 cócteles</strong> para celebraciones de día y <strong>+5</strong> para fiestas que duren toda la noche.
                </p>
            </div>
        </div>
    );
}
