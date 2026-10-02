'use client';

import React, { useState } from 'react';
import { Wine, Sparkles, SlidersHorizontal, Check } from 'lucide-react';

interface Props {
    guests: number;
    currentDrinks: number;
    onSelectDrinks: (drinks: number) => void;
    onNext: (drinks?: number) => void;
    onBack?: () => void;
}

export default function EventStepDrinks({
    guests,
    currentDrinks,
    onSelectDrinks,
    onNext,
}: Props) {
    const isCustomInitial = currentDrinks !== 2 && currentDrinks !== 3;
    const [isCustom, setIsCustom] = useState(isCustomInitial);
    const [customValue, setCustomValue] = useState<number>(isCustomInitial ? currentDrinks : 4);

    const handleSelectStandard = (drinks: number) => {
        setIsCustom(false);
        onSelectDrinks(drinks);
        setTimeout(() => {
            onNext(drinks);
        }, 180);
    };

    const handleSelectCustom = (val: number) => {
        setIsCustom(true);
        setCustomValue(val);
        onSelectDrinks(val);
        setTimeout(() => {
            onNext(val);
        }, 180);
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center animate-fade-in py-4 sm:py-8">
            {/* Tag / Step badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-4">
                <Wine className="w-3.5 h-3.5" />
                <span>Paso 2 de 4 · Intensidad de Barra</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-text tracking-tight mb-3">
                ¿Cuántos cócteles por persona?
            </h2>
            <p className="text-brand-text-muted text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed font-medium">
                {guests > 0 ? (
                    <>Para tus <strong className="text-primary font-black">{guests} invitados</strong>, selecciona según el rol que tendrá la barra en tu evento:</>
                ) : (
                    <>Selecciona según el rol que tendrá la coctelería en tu celebración:</>
                )}
            </p>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full mb-8 text-left">
                {/* 1. Barra Complemento (2 tragos) */}
                <div
                    onClick={() => handleSelectStandard(2)}
                    className={`relative rounded-3xl p-6 border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col ${
                        !isCustom && currentDrinks === 2
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                            : 'border-brand-border bg-white hover:border-primary/40'
                    }`}
                >
                    {!isCustom && currentDrinks === 2 && (
                        <div className="absolute top-4 right-4 text-primary bg-primary/10 p-1.5 rounded-full">
                            <Check className="w-4 h-4" />
                        </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-brand-text-muted text-xs font-bold w-fit mb-3">
                        <span>Complementaria</span>
                    </div>
                    <h3 className="text-xl font-black text-brand-text mb-1">
                        Barra Complemento
                    </h3>
                    <div className="text-2xl font-black text-primary mb-3">
                        2 tragos <span className="text-sm font-bold text-brand-text-muted">por persona</span>
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-4 flex-1">
                        Ideal para acompañar si ya tienes otras opciones como cerveza, vino o espumante en el evento.
                    </p>
                    {guests > 0 && (
                        <div className="pt-3 border-t border-brand-border/60 text-xs font-bold text-brand-text">
                            Total para tu fiesta: <span className="text-primary font-black">~{guests * 2} cócteles</span>
                        </div>
                    )}
                </div>

                {/* 2. Recomendado Estándar (3 tragos) */}
                <div
                    onClick={() => handleSelectStandard(3)}
                    className={`relative rounded-3xl p-6 border-2 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex flex-col ${
                        !isCustom && currentDrinks === 3
                            ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                            : 'border-primary/50 bg-white hover:border-primary'
                    }`}
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-primary to-[#f4a261] text-white text-xs font-black tracking-wide shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Más Elegido ⭐</span>
                    </div>
                    {!isCustom && currentDrinks === 3 && (
                        <div className="absolute top-4 right-4 text-primary bg-primary/20 p-1.5 rounded-full">
                            <Check className="w-4 h-4" />
                        </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-black w-fit mb-3 mt-1">
                        <span>Recomendado Estándar</span>
                    </div>
                    <h3 className="text-xl font-black text-brand-text mb-1">
                        Barra Estándar
                    </h3>
                    <div className="text-2xl font-black text-primary mb-3">
                        3 tragos <span className="text-sm font-bold text-brand-text-muted">por persona</span>
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-4 flex-1">
                        El balance perfecto y más contratado para la gran mayoría de matrimonios y cumpleaños.
                    </p>
                    {guests > 0 && (
                        <div className="pt-3 border-t border-brand-border/60 text-xs font-bold text-brand-text">
                            Total para tu fiesta: <span className="text-primary font-black">~{guests * 3} cócteles</span>
                        </div>
                    )}
                </div>

                {/* 3. Personalizado */}
                <div
                    onClick={() => handleSelectCustom(customValue)}
                    className={`relative rounded-3xl p-6 border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col ${
                        isCustom
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                            : 'border-brand-border bg-white hover:border-primary/40'
                    }`}
                >
                    {isCustom && (
                        <div className="absolute top-4 right-4 text-primary bg-primary/10 p-1.5 rounded-full">
                            <Check className="w-4 h-4" />
                        </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-brand-text-muted text-xs font-bold w-fit mb-3">
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>A tu medida</span>
                    </div>
                    <h3 className="text-xl font-black text-brand-text mb-1">
                        Personalizado
                    </h3>
                    <div className="text-2xl font-black text-primary mb-3">
                        {isCustom ? `${customValue} tragos` : 'Otra cantidad'} <span className="text-sm font-bold text-brand-text-muted">p/p</span>
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-4 flex-1">
                        Para eventos de larga duración o barra principal exclusiva (4, 5 o más cócteles por invitado).
                    </p>

                    {/* Selector de cantidad personalizada si está activa */}
                    {isCustom && (
                        <div className="flex items-center justify-between gap-1.5 pt-2 pb-1 border-t border-brand-border/60">
                            {[4, 5, 6, 7].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCustom(num);
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                        customValue === num
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-slate-100 text-brand-text hover:bg-slate-200'
                                    }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    )}
                    {guests > 0 && isCustom && (
                        <div className="pt-2 text-xs font-bold text-brand-text">
                            Total para tu fiesta: <span className="text-primary font-black">~{guests * customValue} cócteles</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
