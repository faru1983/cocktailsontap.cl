'use client';

import React, { useState } from 'react';
import { Users, ArrowRight, UserPlus, Sparkles } from 'lucide-react';

interface Props {
    currentGuests: number;
    onSelectGuests: (guests: number) => void;
    onNext: (guests?: number) => void;
}

const PRESET_GUESTS = [30, 50, 80, 100, 150];

export default function EventStepGuests({ currentGuests, onSelectGuests, onNext }: Props) {
    const isCustomInitial = currentGuests > 0 && !PRESET_GUESTS.includes(currentGuests);
    const [isCustom, setIsCustom] = useState(isCustomInitial);
    const [customValue, setCustomValue] = useState<string>(isCustomInitial ? String(currentGuests) : '');

    const handleSelectPreset = (val: number) => {
        setIsCustom(false);
        onSelectGuests(val);
        // Pequeño retardo para feedback visual antes de avanzar
        setTimeout(() => {
            onNext(val);
        }, 180);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        setCustomValue(valStr);
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
            onSelectGuests(parsed);
        } else {
            onSelectGuests(0);
        }
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseInt(customValue, 10);
        if (parsed > 0) {
            onSelectGuests(parsed);
            onNext(parsed);
        }
    };

    return (
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center animate-fade-in py-4 sm:py-8">
            {/* Tag / Step badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-4">
                <Users className="w-3.5 h-3.5" />
                <span>Paso 1 de 4 · Invitados</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-text tracking-tight mb-3">
                ¿Cuántos invitados esperas?
            </h2>
            <p className="text-brand-text-muted text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed font-medium">
                Selecciona la cantidad estimada para calcular los litros necesarios y entregarte un presupuesto real al instante.
            </p>

            {/* Preset Options Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full mb-8">
                {PRESET_GUESTS.map((num) => {
                    const isSelected = !isCustom && currentGuests === num;
                    return (
                        <button
                            key={num}
                            type="button"
                            onClick={() => handleSelectPreset(num)}
                            className={`group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-95 ${
                                isSelected
                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-primary'
                                    : 'border-brand-border bg-white text-brand-text hover:border-primary/50 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-3xl sm:text-4xl font-black mb-1 group-hover:scale-105 transition-transform">
                                {num}
                            </span>
                            <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-brand-text-muted'}`}>
                                invitados
                            </span>
                        </button>
                    );
                })}

                {/* Custom Option Button */}
                <button
                    type="button"
                    onClick={() => {
                        setIsCustom(true);
                        if (currentGuests > 0 && !PRESET_GUESTS.includes(currentGuests)) {
                            setCustomValue(String(currentGuests));
                        }
                    }}
                    className={`group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-95 ${
                        isCustom
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-primary'
                            : 'border-brand-border bg-white text-brand-text hover:border-primary/50 hover:bg-slate-50'
                    }`}
                >
                    <UserPlus className={`w-7 h-7 sm:w-8 sm:h-8 mb-1.5 transition-transform group-hover:scale-110 ${
                        isCustom ? 'text-primary' : 'text-brand-text-muted'
                    }`} />
                    <span className="text-sm sm:text-base font-black">
                        Personalizado
                    </span>
                    <span className={`text-xs font-bold ${isCustom ? 'text-primary' : 'text-brand-text-muted'}`}>
                        otra cantidad
                    </span>
                </button>
            </div>

            {/* Custom Input Drawer / Form */}
            {isCustom && (
                <form 
                    onSubmit={handleCustomSubmit}
                    className="w-full max-w-md bg-white rounded-2xl p-6 border-2 border-primary/30 shadow-lg animate-slide-up mb-8 flex flex-col items-center"
                >
                    <label htmlFor="custom-guests-input" className="block text-sm font-bold text-brand-text mb-3">
                        Ingresa el número exacto de invitados:
                    </label>
                    <div className="relative w-full mb-4">
                        <input
                            id="custom-guests-input"
                            type="number"
                            min="1"
                            max="2000"
                            autoFocus
                            placeholder="Ej: 65"
                            value={customValue}
                            onChange={handleCustomChange}
                            className="w-full text-center text-3xl sm:text-4xl font-black text-primary p-3 bg-slate-50 border-2 border-brand-border rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!currentGuests || currentGuests < 1}
                        className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-black text-base flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <span>Continuar con {currentGuests > 0 ? `${currentGuests} invitados` : 'esta cantidad'}</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            )}

            {/* Reassuring note */}
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-text-muted">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span>No te preocupes por el número exacto: podrás ajustarlo más adelante si tu lista cambia.</span>
            </div>
        </div>
    );
}
