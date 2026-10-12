'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import type { CocktailForWizard } from '@/lib/types';
import { calculateEstimatedProposal } from '@/lib/wizardLogic';
import { formatCurrency } from '@/lib/utils';
import { MURO_MIN_LITERS, PORTATIL_MIN_LITERS, MURO_INSTALLATION_COST } from '@/lib/config';
import { 
    Sparkles, 
    Wine, 
    BadgeCheck, 
    Coins, 
    Snowflake, 
    Leaf, 
    GlassWater, 
    Martini, 
    Infinity, 
    ArrowRight, 
    Info, 
    Check, 
    X,
    Droplets,
    Box,
    Layout
} from 'lucide-react';

interface Props {
    guests: number;
    drinksPerPerson: number;
    cocktails: CocktailForWizard[];
    selectedDispenser?: 'portatil' | 'muro' | 'desechable' | '';
    onSelectDispenser: (disp: 'portatil' | 'muro') => void;
    onNext: () => void;
    onBack?: () => void;
}

const INCLUYE_ITEMS = [
    { icon: Snowflake, label: 'Hielo para todo el evento', desc: 'Cantidad suficiente según tus litros' },
    { icon: Leaf, label: 'Garnish y frutas deshidratadas', desc: 'Cítricos y botánicos de decoración' },
    { icon: GlassWater, label: 'Vasos y copas premium', desc: 'Cristalería segura reutilizable' },
    { icon: Martini, label: 'Accesorios y herramientas', desc: 'Hieleras, pinzas y palas de bar' },
    { icon: Infinity, label: '¡Sin límite de horas de arriendo!', desc: 'Instalamos antes y retiramos al día siguiente' },
];

export default function EventStepProposal({
    guests,
    drinksPerPerson,
    cocktails,
    selectedDispenser,
    onSelectDispenser,
    onNext,
}: Props) {
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [modalDispenser, setModalDispenser] = useState<'portatil' | 'muro' | null>(null);

    const proposal = useMemo(() => {
        return calculateEstimatedProposal(guests, drinksPerPerson, cocktails);
    }, [guests, drinksPerPerson, cocktails]);

    // Opción recomendada por volumen del evento
    const recommendedDispenser: 'portatil' | 'muro' = proposal.liters >= MURO_MIN_LITERS ? 'muro' : 'portatil';

    // Formato activo para reflejar en el presupuesto
    const activeDispenser: 'portatil' | 'muro' = useMemo(() => {
        if (selectedDispenser === 'muro' || selectedDispenser === 'portatil') {
            return selectedDispenser;
        }
        return recommendedDispenser;
    }, [selectedDispenser, recommendedDispenser]);

    const installationCost = activeDispenser === 'muro' ? MURO_INSTALLATION_COST : 0;
    const totalEstimated = proposal.estimatedTotal + installationCost;
    const pricePerDrink = Math.round(totalEstimated / (proposal.totalDrinks || 1));

    const dispensers = [
        {
            id: 'portatil' as const,
            title: 'Dispensador Portátil',
            summary: 'Formato práctico sin necesidad de energía eléctrica. Ideal para terrazas, quinchos o salones.',
            description: 'El dispensador portátil es perfecto para eventos donde necesitas máxima flexibilidad. No requiere conexión eléctrica, mantiene el frío continuo con hielo y aislamiento térmico, y se adapta a cualquier mesa o rincón. ¡Llegar y servir!',
            image: '/assets/dispensador3.webp',
            price: 0,
            icon: Box,
            minLiters: PORTATIL_MIN_LITERS,
            compatibleSizesText: 'Barriles compactos de 5L y 10L',
            features: [
                'No requiere conexión eléctrica',
                'Mantiene el frío garantizado con hielo',
                'Barriles compactos de 5L y 10L',
                'Instalación y montaje incluidos a $0',
            ],
        },
        {
            id: 'muro' as const,
            title: 'Muro de Coctelería',
            summary: 'Estructura elegante tipo barra con canillas e iluminación decorativa.',
            description: 'Una opción premium que transforma la coctelería en el punto central de tu celebración. Estructura con iluminación LED, bandeja de goteo y canillas de alto flujo, diseñada para atender a tus invitados con gran rapidez, elegancia y estilo.',
            image: '/assets/dispensador2.webp',
            price: MURO_INSTALLATION_COST,
            icon: Layout,
            minLiters: MURO_MIN_LITERS,
            compatibleSizesText: 'Barriles de gran formato (20L y 30L)',
            features: [
                'Estructura estilo barra con canillas',
                'Iluminación LED y puesta en escena fotográfica',
                'Barriles de gran formato (20L y 30L)',
                'Ideal para alto flujo de invitados',
            ],
        },
    ];

    const handleCardClick = (id: 'portatil' | 'muro') => {
        onSelectDispenser(id);
        setTimeout(() => {
            onNext();
        }, 180);
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col items-center animate-fade-in py-4 sm:py-8">
            {/* Tag / Step badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Paso 3 de 4 · Tu Propuesta Sugerida</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-text tracking-tight mb-3 text-center">
                Tu Propuesta de Barra Sugerida
            </h2>
            <p className="text-brand-text-muted text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-10 text-center leading-relaxed font-medium">
                Para tus <strong className="text-brand-text font-black">{guests} invitados</strong> y{' '}
                <strong className="text-brand-text font-black">{drinksPerPerson} tragos por persona</strong>, calculamos la siguiente configuración ideal:
            </p>

            {/* High-Impact Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full mb-8">
                {/* 1. Cobertura Total */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-brand-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none -z-0" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider mb-2">
                            <Wine className="w-4 h-4" />
                            <span>Cobertura Total Sugerida</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black text-brand-text mb-2">
                            Aprox. {proposal.totalDrinks} cócteles
                        </div>
                        <p className="text-sm font-bold text-brand-text-muted leading-relaxed mb-4">
                            Equivalente a <span className="text-primary font-black">{proposal.liters} Litros</span> en{' '}
                            <span className="text-brand-text font-black">{proposal.varietiesCount} {proposal.varietiesCount === 1 ? 'variedad' : 'variedades'}</span> de cócteles sugeridas.
                        </p>
                    </div>

                    <div className="relative z-10 pt-4 border-t border-brand-border/60 flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-text-muted">Formato recomendado:</span>
                        <span className="font-black text-brand-text bg-slate-100 px-2.5 py-1 rounded-md">
                            {proposal.config}
                        </span>
                    </div>
                </div>

                {/* 2. Presupuesto Estimado */}
                <div className="bg-gradient-to-br from-white to-primary/5 rounded-3xl p-6 sm:p-7 border-2 border-primary/30 shadow-md flex flex-col justify-between relative overflow-hidden group hover:border-primary transition-all">
                    <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[0.7rem] font-black uppercase tracking-wider">
                        Transparente
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider mb-2">
                            <Coins className="w-4 h-4" />
                            <span>Presupuesto Estimado</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black text-primary mb-2">
                            {formatCurrency(totalEstimated)}
                        </div>
                        <p className="text-sm font-bold text-brand-text-muted leading-relaxed mb-4">
                            Aprox. <span className="text-brand-text font-black">{formatCurrency(pricePerDrink)}</span> por cóctel servido.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-primary/20 flex flex-col gap-1.5 text-xs text-brand-text-muted">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">
                                Cócteles: {formatCurrency(proposal.estimatedTotal)}
                                {installationCost > 0 ? ` + Muro: ${formatCurrency(installationCost)}` : ' + Dispensador: $0'}
                            </span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                                <BadgeCheck className="w-4 h-4" /> Valores netos
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inclusiones Incluidas a Costo $0 (AHORA ARRIBA DEL DISPENSADOR) */}
            <div className="w-full bg-white rounded-3xl p-6 sm:p-7 border-2 border-brand-border shadow-sm mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-black text-brand-text">
                                Insumos y Cristalería
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                                Incluidos ($0)
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-brand-text-muted mt-0.5">
                            Tu servicio incluye todo el equipamiento necesario sin costos ocultos:
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsInfoModalOpen(true)}
                        className="inline-flex items-center gap-1.5 text-primary hover:text-primary-dark font-bold text-xs sm:text-sm cursor-pointer self-start sm:self-center transition-colors"
                    >
                        <Info className="w-4 h-4" />
                        <span>Ver detalle completo</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {INCLUYE_ITEMS.map((item, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-brand-border/70 ${
                                idx === INCLUYE_ITEMS.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''
                            }`}
                        >
                            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                                <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-extrabold text-brand-text text-xs sm:text-sm leading-snug">
                                    {item.label}
                                </h4>
                                <p className="text-[0.75rem] text-brand-text-muted leading-tight mt-0.5">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECCIÓN DISPENSADOR: Formato de Servicio y Avance en 1 Clic */}
            <div className="w-full bg-white rounded-3xl p-6 sm:p-7 border-2 border-brand-border shadow-sm mb-4">
                <div className="mb-6 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                        <Box className="w-5 h-5 text-primary" />
                        <h3 className="text-xl sm:text-2xl font-black text-brand-text">
                            Elige tu formato de dispensador
                        </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-brand-text-muted font-medium">
                        Pincha la opción que prefieres para avanzar directamente a elegir tus cócteles:
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                    {dispensers.map((disp) => {
                        const isSelected = selectedDispenser === disp.id;
                        const isRecommended = disp.id === recommendedDispenser;

                        return (
                            <div
                                key={disp.id}
                                onClick={() => handleCardClick(disp.id)}
                                className={`relative rounded-3xl border-2 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl flex flex-col overflow-hidden group hover:scale-[1.01] active:scale-[0.99] ${
                                    isSelected
                                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                        : isRecommended
                                            ? 'border-primary/60 bg-white hover:border-primary'
                                            : 'border-brand-border bg-white hover:border-primary/40'
                                }`}
                            >
                                {/* Badge de Opción Recomendada */}
                                {isRecommended && (
                                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-black shadow-md uppercase tracking-wider">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Recomendado para tu evento</span>
                                    </div>
                                )}

                                {/* Selected Badge */}
                                {isSelected && (
                                    <div className="absolute top-3 right-3 z-20 bg-primary text-white p-1.5 rounded-full shadow-md">
                                        <Check className="w-4 h-4 stroke-[3]" />
                                    </div>
                                )}

                                {/* Image Header */}
                                <div className="relative h-44 sm:h-52 w-full bg-slate-100 overflow-hidden">
                                    <Image
                                        src={disp.image}
                                        alt={disp.title}
                                        fill
                                        className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                                    
                                    <div className="absolute bottom-3 left-4 right-4 text-white">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded-lg bg-white/20 backdrop-blur-md">
                                                <disp.icon className="w-3.5 h-3.5 text-white" />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                                {disp.price === 0 ? 'Instalación Gratis' : `Instalación ${formatCurrency(disp.price)}`}
                                            </span>
                                        </div>
                                        <h4 className="text-xl font-black text-white leading-tight">
                                            {disp.title}
                                        </h4>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed mb-3">
                                            {disp.summary}
                                        </p>

                                        {/* Formatos de barril compatibles tag */}
                                        <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-brand-text font-bold text-[0.75rem] border border-brand-border/60">
                                            <Wine className="w-3.5 h-3.5 text-primary" />
                                            <span>{disp.compatibleSizesText}</span>
                                        </div>

                                        {/* Features bullets */}
                                        <ul className="space-y-1.5 mb-4">
                                            {disp.features.map((feat, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs font-medium text-brand-text">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="pt-3 border-t border-brand-border/60 flex items-center justify-between">
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

                                        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all bg-primary text-white shadow-sm group-hover:bg-primary-dark">
                                            <span>{isSelected ? 'Continuar' : 'Elegir'}</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de Detalle de Inclusiones */}
            {isInfoModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsInfoModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-brand-border flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                            <h3 className="text-xl font-black text-brand-text flex items-center gap-2">
                                <Check className="w-6 h-6 text-primary" />
                                ¿Qué incluye nuestro servicio?
                            </h3>
                            <button 
                                onClick={() => setIsInfoModalOpen(false)}
                                className="p-2 bg-slate-50 rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <Wine className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Cócteles Seleccionados</h4>
                                        <p className="text-xs text-brand-text-muted">Las variedades y tamaños que elijas de nuestro catálogo.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <Droplets className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Sistema Autoservicio</h4>
                                        <p className="text-xs text-brand-text-muted">Dispensador portátil o muro instalado y listo para usar.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <Snowflake className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Hielo Abundante</h4>
                                        <p className="text-xs text-brand-text-muted">Hielo suficiente para todo el evento, no te preocupes por comprar extra.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <Leaf className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Garnish Decorativo</h4>
                                        <p className="text-xs text-brand-text-muted">Frutas deshidratadas y decoraciones para tus cócteles.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <GlassWater className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Vasos/Copas Premium</h4>
                                        <p className="text-xs text-brand-text-muted">Vasos y/o copas reutilizables seguras y resistentes para tus invitados.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border">
                                    <Martini className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Accesorios de Bar</h4>
                                        <p className="text-xs text-brand-text-muted">Hieleras, palas, pinzas y todo lo necesario en la barra.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-brand-border sm:col-span-2">
                                    <Infinity className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-brand-text text-sm mb-1">¡Sin límite de tiempo!</h4>
                                        <p className="text-xs text-brand-text-muted">Disfruta toda la noche. Nos encargamos de la instalación horas antes y del retiro al día siguiente sin costos ocultos.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                            <p className="text-brand-text text-sm leading-relaxed mb-4">
                                {dispensers.find(d => d.id === modalDispenser)?.description}
                            </p>

                            <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-brand-border/60">
                                <span className="text-[0.7rem] uppercase tracking-wider font-extrabold text-brand-text-muted block mb-1">
                                    Formatos de Barril
                                </span>
                                <span className="text-xs font-bold text-brand-text">
                                    {dispensers.find(d => d.id === modalDispenser)?.compatibleSizesText}
                                </span>
                            </div>
                            
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
                                        if (modalDispenser) {
                                            const chosen = modalDispenser;
                                            setModalDispenser(null);
                                            handleCardClick(chosen);
                                        }
                                    }}
                                    className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-base transition-all hover:bg-primary-dark shadow-[0_4px_20px_rgba(226,160,73,0.3)] cursor-pointer"
                                >
                                    Elegir este formato y ver cócteles
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
