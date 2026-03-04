'use client';

import { calculateSmartConfig } from '@/hooks/useWizard';
import type { useWizard } from '@/hooks/useWizard';
import { Info, Sparkles } from 'lucide-react';

type WizardHook = ReturnType<typeof useWizard>;

export default function WizardStep3({ wizard }: { wizard: WizardHook }) {
    const { state, updateConsumption } = wizard;
    const guests = Math.max(state.consumption.guests, 1);
    const totalDrinksWanted = guests * state.consumption.drinksPerPerson;
    const { config, liters, totalDrinks } = calculateSmartConfig(totalDrinksWanted);
    const avgDrinks = (totalDrinks / guests).toFixed(1);

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">3. Preferencias de Consumo</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Ajusta la intensidad de la barra según el perfil de tus invitados.</p>

            {/* Slider de Consumo */}
            <div className="mb-10 bg-white p-6 rounded-2xl border-2 border-brand-border shadow-sm">
                <label className="block font-bold mb-1 text-brand-text text-[1rem]">Cócteles promedio por persona</label>
                <p className="text-brand-text-muted text-[0.85rem] mb-8">¿Cuántos cócteles estimas que consumirá cada invitado?</p>

                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 w-full flex flex-col gap-3">
                        <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            className="w-full cursor-pointer h-2.5 bg-slate-200 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white transition-all hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95"
                            value={state.consumption.drinksPerPerson}
                            onChange={(e) => updateConsumption('drinksPerPerson', parseInt(e.target.value))}
                        />
                        <div className="flex justify-between text-[0.8rem] font-bold text-brand-text-muted px-1">
                            <span>1 (Suave)</span>
                            <span>5 (Intermedio)</span>
                            <span>10 (Intenso)</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-primary/10 border-2 border-primary/20 rounded-[20px] p-4 min-w-[140px] shadow-sm">
                        <span className="text-[0.7rem] uppercase font-bold text-primary mb-1">CÓCTELES X PERS.</span>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            className="w-full bg-transparent text-center font-black text-4xl text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={state.consumption.drinksPerPerson}
                            onChange={(e) => updateConsumption('drinksPerPerson', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                    </div>
                </div>
            </div>

            {/* Recomendación inteligente */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#fff7ed] to-[#fffbeb] border-2 border-primary/50 rounded-[24px] p-8 shadow-md">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="w-20 h-20 text-primary" />
                </div>

                <div className="flex items-center gap-2 text-[0.8rem] uppercase text-primary font-black tracking-widest mb-4">
                    <Sparkles className="w-4 h-4" />
                    Recomendación de Expertos
                </div>

                <div className="mb-6">
                    <p className="text-[1.1rem] text-brand-text-muted leading-relaxed">
                        Para asegurar una barra continua durante todo el evento a <strong>{guests} invitados</strong>, sugerimos solicitar:
                    </p>
                    <span className="block mt-4 text-[1.8rem] text-brand-text font-black leading-[1.1] text-balance">
                        {config}
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-primary/10">
                    <div className="text-center">
                        <span className="block text-[1.4rem] font-black text-primary leading-none">{liters}L</span>
                        <span className="text-[0.6rem] uppercase text-brand-text-muted font-bold tracking-tighter">Volumen</span>
                    </div>
                    <div className="text-center border-x border-primary/10">
                        <span className="block text-[1.4rem] font-black text-primary leading-none">{totalDrinks}</span>
                        <span className="text-[0.6rem] uppercase text-brand-text-muted font-bold tracking-tighter">Cócteles</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-[1.4rem] font-black text-primary leading-none">{avgDrinks}</span>
                        <span className="text-[0.6rem] uppercase text-brand-text-muted font-bold tracking-tighter">x Persona</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-[0.85rem] text-brand-text-muted leading-relaxed italic">
                    Tip: Recomendamos <strong>3 a 4 cócteles</strong> para celebraciones de día y <strong>+5</strong> para fiestas que duren toda la noche.
                </p>
            </div>
        </div>
    );
}
