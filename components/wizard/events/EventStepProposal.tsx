'use client';

import React, { useMemo, useState } from 'react';
import type { CocktailForWizard } from '@/lib/types';
import { calculateEstimatedProposal } from '@/lib/wizardLogic';
import { formatCurrency } from '@/lib/utils';
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
    Droplets
} from 'lucide-react';

interface Props {
    guests: number;
    drinksPerPerson: number;
    cocktails: CocktailForWizard[];
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
    onNext,
}: Props) {
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const proposal = useMemo(() => {
        return calculateEstimatedProposal(guests, drinksPerPerson, cocktails);
    }, [guests, drinksPerPerson, cocktails]);

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
                <strong className="text-brand-text font-black">{drinksPerPerson} tragos por persona</strong>, hemos calculado la siguiente configuración ideal:
            </p>

            {/* High-Impact Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full mb-8">
                {/* 1. Cobertura Total */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-brand-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none -z-0" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider mb-2">
                            <Wine className="w-4 h-4" />
                            <span>Cobertura Total</span>
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
                            {formatCurrency(proposal.estimatedTotal)}
                        </div>
                        <p className="text-sm font-bold text-brand-text-muted leading-relaxed mb-4">
                            Aprox. <span className="text-brand-text font-black">{formatCurrency(proposal.estimatedPricePerDrink)}</span> por cóctel servido.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-primary/20 flex items-center justify-between text-xs text-brand-text-muted">
                        <span className="font-medium">Calculado desde cócteles base</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                            <BadgeCheck className="w-4 h-4" /> Valores netos
                        </span>
                    </div>
                </div>
            </div>

            {/* Inclusiones Incluidas a Costo $0 */}
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

            {/* Botón Central Siguiente */}
            <div className="flex justify-center w-full mt-2">
                <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-black text-base hover:bg-primary-dark transition-all shadow-[0_4px_20px_rgba(226,160,73,0.3)] cursor-pointer hover:scale-105 active:scale-95"
                >
                    <span>Elegir formato de dispensador</span>
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>

            {/* Modal de Detalle de Inclusiones (Reutilizado) */}
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
                                        <p className="text-xs text-brand-text-muted">Vasos y/o copas de plástico premium ideal para eventos, segura y resistente para tus invitados.</p>
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
        </div>
    );
}
