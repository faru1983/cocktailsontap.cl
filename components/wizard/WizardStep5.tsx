'use client';

import { useMemo, useEffect } from 'react';
import React from 'react';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import { useWizard } from '@/hooks/useWizard';
import { Check, Info, Box, Layout, Wine, Droplets, Snowflake, Leaf, GlassWater, Martini, Infinity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
}

const INCLUYE_ITEMS = [
    { icon: Wine, label: 'Cócteles Previamente Seleccionados' },
    { icon: Droplets, label: 'Sistema de Dispensador autoservicio' },
    { icon: Snowflake, label: 'Hielo suficiente para todo el evento' },
    { icon: Leaf, label: 'Decoraciones (garnish) deshidratadas' },
    { icon: GlassWater, label: 'Préstamo de vasos y/o copas' },
    { icon: Martini, label: 'Accesorios de bar: hieleras, palas, pinzas y más' },
    { icon: Infinity, label: '¡Sin límite de tiempo!' },
];

export default function WizardStep5({ wizard }: Props) {
    const { state, updateDispenser } = wizard;
    const data = useMemo(() => wizard.calculateSummaryData(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.selections]);

    function getLitersFromSize(size: string): number {
        if (size.includes('30L')) return 30;
        if (size.includes('20L')) return 20;
        if (size.includes('10L')) return 10;
        if (size.includes('5L')) return 5;
        return 0;
    }

    // Strict Muro condition: Only Compatible with 10L, 20L, 30L AND volume >= 30L
    const canHaveMuro = useMemo(() => {
        const hasIncompatibleSize = state.selections.some((s: { size: string }) => {
            const liters = getLitersFromSize(s.size);
            return liters !== 10 && liters !== 20 && liters !== 30;
        });
        return !hasIncompatibleSize && data.totalLiters >= 30;
    }, [state.selections, data.totalLiters]);

    // If user selected Muro but now doesn't meet the condition (e.g. went back and changed items), reset to portatil
    useEffect(() => {
        if (!canHaveMuro && state.dispenser === 'muro') {
            updateDispenser('portatil');
        }
    }, [canHaveMuro, state.dispenser, updateDispenser]);

    const dispensers: { id: 'portatil' | 'muro'; title: string; description: string; image: string; price: number; icon: React.ElementType }[] = [
        {
            id: 'portatil',
            title: 'Dispensador Portátil',
            description: 'Ideal para eventos simples, sin necesidad de energía eléctrica y adaptable a cualquier espacio.',
            image: '/assets/dispensador3.webp',
            price: 0,
            icon: Box
        },
        ...(canHaveMuro ? [{
            id: 'muro' as const,
            title: 'Muro de Coctelería',
            description: 'Opción decorativa y elegante para matrimonios y eventos corporativos de gran escala.',
            image: '/assets/dispensador4.webp',
            price: 50000,
            icon: Layout
        }] : [])
    ];

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h3 className="text-2xl font-extrabold text-brand-text mb-2">5. Sistema de Dispensación</h3>
                <p className="text-brand-text-muted text-[0.95rem] leading-relaxed">
                    Selecciona el sistema que mejor se adapte a tu evento.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dispensers.map((disp) => (
                    <button
                        key={disp.id}
                        type="button"
                        onClick={() => updateDispenser(disp.id)}
                        className={`relative flex flex-col items-stretch p-0 rounded-3xl border-2 transition-all overflow-hidden text-left bg-white group shadow-sm hover:shadow-md
                            ${state.dispenser === disp.id
                                ? 'border-primary ring-4 ring-primary/10'
                                : 'border-brand-border hover:border-primary/40'}
                        `}
                    >
                        <div className="relative h-48 w-full overflow-hidden">
                            <Image
                                src={disp.image}
                                alt={disp.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            {state.dispenser === disp.id && (
                                <div className="absolute top-4 right-4 bg-primary text-white p-2 rounded-full shadow-lg">
                                    <Check className="w-5 h-5" />
                                </div>
                            )}
                            <div className="absolute bottom-4 left-6">
                                <h4 className="text-white font-black text-xl tracking-tight">{disp.title}</h4>
                            </div>
                        </div>

                        <div className="p-6 flex flex-col flex-1">
                            <p className="text-brand-text-muted text-[0.9rem] leading-relaxed mb-6 flex-1">
                                {disp.description}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-brand-border">
                                <span className={`font-bold text-[0.9rem] ${disp.price === 0 ? 'text-primary' : 'text-brand-text'}`}>
                                    {disp.price === 0 ? 'Instalación Gratis' : `Instalación: ${formatCurrency(disp.price)}`}
                                </span>
                                <div className={`px-4 py-1.5 rounded-full text-[0.8rem] font-black uppercase tracking-wider transition-colors
                                    ${state.dispenser === disp.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'}
                                `}>
                                    {state.dispenser === disp.id ? 'Seleccionado' : 'Seleccionar'}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {!canHaveMuro && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 items-start animate-fade-in shadow-sm">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                        <p className="text-[0.9rem] text-amber-900 leading-relaxed m-0 font-bold">
                            El Muro de Coctelería no está disponible para esta selección
                        </p>
                        <p className="text-[0.8rem] text-amber-800/80 leading-relaxed m-0">
                            Para habilitar el Muro, asegúrate de no elegir barriles de 5L y alcanzar un volumen total de al menos 30L.
                            (Actualmente: {data.totalLiters}L {state.selections.some(s => s.size.includes('5L')) ? 'con barriles de 5L' : ''}).
                        </p>
                    </div>
                </div>
            )}

            {/* Qué incluye */}
            <div className="mt-4 pt-8 border-t border-brand-border">
                <h4 className="text-lg font-black text-brand-text mb-6 flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    ¿Qué incluye nuestro servicio?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INCLUYE_ITEMS.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-brand-border transition-colors hover:border-primary/30"
                        >
                            <item.icon className="w-5 h-5 text-primary shrink-0" />
                            <span className="text-[0.85rem] font-bold text-brand-text">{item.label}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-6 text-[0.85rem] text-brand-text-muted italic text-center">
                    Nos encargamos de la instalación horas antes del inicio y del retiro al finalizar, sin costos ocultos.
                </p>
            </div>
        </div>
    );
}
