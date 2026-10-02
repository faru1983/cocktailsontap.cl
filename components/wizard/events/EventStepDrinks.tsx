'use client';

import React, { useState } from 'react';
import { Wine, Sparkles, SlidersHorizontal, Check, ArrowRight } from 'lucide-react';

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
    const isCustomInitial = currentDrinks > 0 && currentDrinks !== 2 && currentDrinks !== 3;
    const [isCustom, setIsCustom] = useState(isCustomInitial);
    const [customValue, setCustomValue] = useState<string>(isCustomInitial ? String(currentDrinks) : '');

    const handleSelectStandard = (drinks: number) => {
        setIsCustom(false);
        onSelectDrinks(drinks);
        setTimeout(() => {
            onNext(drinks);
        }, 180);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        setCustomValue(valStr);
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
            onSelectDrinks(parsed);
        } else {
            onSelectDrinks(0);
        }
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseInt(customValue, 10);
        if (parsed > 0) {
            onSelectDrinks(parsed);
            onNext(parsed);
        }
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
                            : 'border-brand-border bg-white hover:border-primary/40'
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
                    onClick={() => {
                        setIsCustom(true);
                        if (currentDrinks > 0 && currentDrinks !== 2 && currentDrinks !== 3) {
                            setCustomValue(String(currentDrinks));
                        }
                    }}
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
                        {isCustom && parseInt(customValue, 10) > 0 ? (
                            <>{customValue} {parseInt(customValue, 10) === 1 ? 'trago' : 'tragos'} <span className="text-sm font-bold text-brand-text-muted">p/p</span></>
                        ) : (
                            <>Otra cantidad <span className="text-sm font-bold text-brand-text-muted">p/p</span></>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-4 flex-1">
                        Para eventos especiales (1 trago de bienvenida, o 4, 5 o más cócteles por invitado).
                    </p>

                    <div className="pt-3 border-t border-brand-border/60 text-xs font-bold text-primary flex items-center justify-between">
                        <span>Ingresar manualmente</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Custom Input Drawer / Form */}
            {isCustom && (
                <form 
                    onSubmit={handleCustomSubmit}
                    className="w-full max-w-md bg-white rounded-2xl p-6 border-2 border-primary/30 shadow-lg animate-slide-up mb-8 flex flex-col items-center"
                >
                    <label htmlFor="custom-drinks-input" className="block text-sm font-bold text-brand-text mb-3">
                        Ingresa la cantidad de cócteles por persona:
                    </label>
                    <div className="relative w-full mb-3">
                        <input
                            id="custom-drinks-input"
                            type="number"
                            min="1"
                            max="20"
                            autoFocus
                            placeholder="Ej: 4"
                            value={customValue}
                            onChange={handleCustomChange}
                            className="w-full text-center text-3xl sm:text-4xl font-black text-primary p-3 bg-slate-50 border-2 border-brand-border rounded-xl focus:border-primary focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                    {guests > 0 && parseInt(customValue, 10) > 0 && (
                        <p className="text-xs font-bold text-brand-text-muted mb-4">
                            Total para tu fiesta: <strong className="text-primary font-black">~{guests * parseInt(customValue, 10)} cócteles</strong>
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={!parseInt(customValue, 10) || parseInt(customValue, 10) < 1}
                        className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-black text-base flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <span>Continuar con {parseInt(customValue, 10) > 0 ? `${customValue} tragos p/p` : 'esta cantidad'}</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            )}
        </div>
    );
}
