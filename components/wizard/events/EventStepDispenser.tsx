'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Box, Layout, Check, ArrowRight, ArrowLeft, X, Sparkles, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MURO_MIN_LITERS, PORTATIL_MIN_LITERS, MURO_INSTALLATION_COST } from '@/lib/config';

interface Props {
    selectedDispenser: 'portatil' | 'muro' | 'desechable' | '';
    onSelectDispenser: (disp: 'portatil' | 'muro') => void;
    suggestedLiters: number;
    onNext: () => void;
    onBack: () => void;
}

export default function EventStepDispenser({
    selectedDispenser,
    onSelectDispenser,
    suggestedLiters,
    onNext,
    onBack,
}: Props) {
    const [modalDispenser, setModalDispenser] = useState<'portatil' | 'muro' | null>(null);

    const dispensers = [
        {
            id: 'portatil' as const,
            title: 'Dispensador Portátil',
            summary: 'Formato práctico sin necesidad de energía. Ideal para cualquier espacio.',
            description: 'El dispensador portátil es perfecto para eventos donde necesitas flexibilidad. No requiere conexión eléctrica, mantiene el frío con hielo gracias a nuestra tecnología termo, y se adapta a espacios reducidos. ¡Llegar y servir!',
            image: '/assets/dispensador3.webp',
            price: 0,
            icon: Box,
            minLiters: PORTATIL_MIN_LITERS,
            features: ['No requiere enchufe eléctrico', 'Mantiene el frío garantizado', 'Fácil de ubicar en cualquier rincón'],
        },
        {
            id: 'muro' as const,
            title: 'Muro de Coctelería',
            summary: 'Estructura elegante tipo barra para eventos medianos y grandes.',
            description: 'Una opción premium que transforma la coctelería en una experiencia visual atractiva. El muro cuenta con iluminación LED, decoración y puntos de dispensación elegantes, diseñado para atender grandes flujos de invitados con rapidez y estilo.',
            image: '/assets/dispensador2.webp',
            price: MURO_INSTALLATION_COST,
            icon: Layout,
            minLiters: MURO_MIN_LITERS,
            features: ['Estructura estilo barra de madera', 'Iluminación LED decorativa', 'Ideal para fotos y alto impacto visual'],
        },
    ];

    const handleCardClick = (id: 'portatil' | 'muro') => {
        onSelectDispenser(id);
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col items-center animate-fade-in py-4 sm:py-8">
            {/* Tag / Step badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-4">
                <Box className="w-3.5 h-3.5" />
                <span>Paso 4 de 4 · Formato de Dispensación</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-text tracking-tight mb-3 text-center">
                ¿Qué formato de dispensador prefieres?
            </h2>
            <p className="text-brand-text-muted text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-10 text-center leading-relaxed font-medium">
                Elige cómo quieres presentar y servir los cócteles. Ambos formatos incluyen instalación profesional y retiro al día siguiente.
            </p>

            {/* Dispensers Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                {dispensers.map((disp) => {
                    const isSelected = selectedDispenser === disp.id;
                    const requiresMoreLiters = disp.id === 'muro' && suggestedLiters > 0 && suggestedLiters < MURO_MIN_LITERS;

                    return (
                        <div
                            key={disp.id}
                            onClick={() => handleCardClick(disp.id)}
                            className={`relative rounded-3xl border-2 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl flex flex-col overflow-hidden group ${
                                isSelected
                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                    : 'border-brand-border bg-white hover:border-primary/40'
                            }`}
                        >
                            {/* Selected Badge */}
                            {isSelected && (
                                <div className="absolute top-4 right-4 z-20 bg-primary text-white p-1.5 rounded-full shadow-md">
                                    <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                            )}

                            {/* Image Header */}
                            <div className="relative h-48 sm:h-56 w-full bg-slate-100 overflow-hidden">
                                <Image
                                    src={disp.image}
                                    alt={disp.title}
                                    fill
                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                
                                <div className="absolute bottom-4 left-4 right-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md">
                                            <disp.icon className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                            {disp.price === 0 ? 'Instalación Gratis' : `Instalación ${formatCurrency(disp.price)}`}
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                                        {disp.title}
                                    </h3>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-4">
                                        {disp.summary}
                                    </p>

                                    {/* Features bullets */}
                                    <ul className="space-y-2 mb-4">
                                        {disp.features.map((feat, i) => (
                                            <li key={i} className="flex items-center gap-2 text-xs font-medium text-brand-text">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    {requiresMoreLiters && (
                                        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <span>
                                                Tu sugerencia actual es de {suggestedLiters}L. Si eliges el Muro, podrás sumar los {MURO_MIN_LITERS - suggestedLiters}L faltantes al seleccionar tus cócteles.
                                            </span>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-brand-border/60 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setModalDispenser(disp.id);
                                            }}
                                            className="text-xs font-bold text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                                        >
                                            Ver fotos y detalles
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCardClick(disp.id)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'bg-slate-100 text-brand-text hover:bg-primary/10 hover:text-primary'
                                            }`}
                                        >
                                            {isSelected ? 'Seleccionado' : 'Elegir este formato'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between w-full max-w-xl mx-auto gap-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-brand-border text-brand-text-muted hover:text-brand-text hover:bg-slate-50 font-bold text-sm transition-all cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Ver propuesta</span>
                </button>

                <button
                    type="button"
                    onClick={onNext}
                    disabled={!selectedDispenser}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-black text-sm sm:text-base hover:bg-primary-dark transition-all shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <span>Ver y elegir cócteles</span>
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>

            {/* Modal de Detalle de Dispensador */}
            {modalDispenser && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setModalDispenser(null)}
                >
                    <div 
                        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-[40vh] min-h-[260px] w-full shrink-0">
                            {dispensers.find(d => d.id === modalDispenser)?.image && (
                                <Image
                                    src={dispensers.find(d => d.id === modalDispenser)!.image}
                                    alt={dispensers.find(d => d.id === modalDispenser)!.title}
                                    fill
                                    className="object-cover object-center"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <button 
                                onClick={() => setModalDispenser(null)}
                                className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-all z-10 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="absolute bottom-6 left-6 text-2xl sm:text-3xl font-black text-white tracking-tight pr-6 leading-tight">
                                {dispensers.find(d => d.id === modalDispenser)?.title}
                            </h3>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-brand-text text-sm leading-relaxed mb-6">
                                {dispensers.find(d => d.id === modalDispenser)?.description}
                            </p>
                            
                            <div className="flex flex-col gap-4 border-t border-brand-border pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted font-bold uppercase tracking-wider block">
                                        Costo de Instalación
                                    </span>
                                    <span className={`font-black text-lg ${
                                        dispensers.find(d => d.id === modalDispenser)?.price === 0 ? 'text-primary' : 'text-brand-text'
                                    }`}>
                                        {dispensers.find(d => d.id === modalDispenser)?.price === 0 ? 'Gratis ($0)' : formatCurrency(dispensers.find(d => d.id === modalDispenser)!.price)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectDispenser(modalDispenser);
                                        setModalDispenser(null);
                                    }}
                                    className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark shadow-[0_4px_20px_rgba(226,160,73,0.3)] cursor-pointer"
                                >
                                    Elegir este formato
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
