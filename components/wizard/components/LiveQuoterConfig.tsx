'use client';

import React, { useMemo, useEffect } from 'react';
import type { EventType } from '@/lib/types';
import type { useWizard } from '@/hooks/useWizard';
import { renderIconFromKey } from '@/lib/icons';
import OptionCard from '@/components/ui/OptionCard';
import SelectField from '@/components/ui/SelectField';
import { calculateMaxPickupDate, getMinDateString, calculateLiveQuoterSuggestion } from '@/lib/wizardLogic';
import { MURO_MIN_LITERS, PORTATIL_MIN_LITERS } from '@/lib/config';
import { ArrowRight, Check, Wine, Droplets, Snowflake, Leaf, GlassWater, Martini, Infinity, Box, Layout, Info, X, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    eventTypes: EventType[];
    onNext: () => void;
}



const INCLUYE_ITEMS = [
    { icon: Snowflake, label: 'Hielo para el evento' },
    { icon: Leaf, label: 'Garnish deshidratado' },
    { icon: GlassWater, label: 'Vasos/Copas' },
    { icon: Martini, label: 'Accesorios de bar' },
    { icon: Infinity, label: 'Sin límite de tiempo' },
];

export default function LiveQuoterConfig({ wizard, eventTypes, onNext }: Props) {
    const { state, updateEventData, updateConsumption, updateDispenser } = wizard;
    const [isInfoModalOpen, setIsInfoModalOpen] = React.useState(false);
    const [dispenserModal, setDispenserModal] = React.useState<string | null>(null);

    // Dates logic
    const minPickupDate = state.eventData.date;
    const maxPickupDate = calculateMaxPickupDate(state.eventData.date);
    const tomorrow = getMinDateString(1);
    let minDate = tomorrow;

    // Recommended Liters logic
    const guests = state.consumption.guests || 0;
    const drinks = state.consumption.drinksPerPerson || 3;

    const suggestionInfo = useMemo(() => calculateLiveQuoterSuggestion(guests, drinks), [guests, drinks]);

    const recommendedLiters = suggestionInfo ? suggestionInfo.recommendedLiters : 0;

    // Muro logic
    // Now allowed for any amount of liters
    const canHaveMuro = true;

    const dispensers = [
        {
            id: 'portatil' as const,
            title: 'Dispensador Portátil',
            summary: 'Formato práctico sin necesidad de energía. Ideal para cualquier espacio.',
            description: 'El dispensador portátil es perfecto para eventos donde necesitas flexibilidad. No requiere conexión eléctrica, mantiene el frío con hielo gracias a nuestra tecnología termo, y se adapta a espacios reducidos. ¡Llegar y servir!',
            image: '/assets/dispensador3.webp',
            price: 0,
            icon: Box,
            disabled: false,
            minLiters: PORTATIL_MIN_LITERS
        },
        {
            id: 'muro' as const,
            title: 'Muro de Coctelería',
            summary: 'Estructura elegante tipo barra para eventos medianos y grandes.',
            description: 'Una opción premium que transforma la coctelería en una experiencia visual atractiva. El muro cuenta con iluminación LED, decoración y puntos de dispensación elegantes, diseñado para atender grandes flujos de invitados con rapidez y estilo.',
            image: '/assets/dispensador2.webp',
            price: 50000,
            icon: Layout,
            disabled: false,
            minLiters: MURO_MIN_LITERS
        }
    ];

    return (
        <div className="flex flex-col relative pb-20">
            {/* Header Title */}
            <div className="mb-10 text-center md:text-left">
                <p className="text-primary font-black tracking-widest uppercase text-sm mb-2">Cotizador en Vivo</p>
                <h2 className="text-3xl md:text-5xl font-black text-brand-text">Arma tu evento en pocos pasos</h2>
            </div>

            {/* Configuración Básica */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* Fechas */}
                <div className="bg-white rounded-3xl p-6 border-2 border-brand-border shadow-sm">
                    <h3 className="text-lg font-black text-brand-text mb-6">1. ¿Cuándo es tu evento?</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col">
                            <label htmlFor="wizard-date" className="block font-bold mb-2 text-brand-text text-[0.95rem]">
                                Fecha Tentativa
                            </label>
                            <input
                                id="wizard-date"
                                type="date"
                                min={minDate}
                                className={`w-full p-4 border-2 rounded-2xl text-[1rem] text-brand-text transition-all duration-300 focus:outline-none
                                    ${state.eventData.date
                                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                        : 'border-brand-border bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                                    }`}
                                value={state.eventData.date}
                                onChange={(e) => updateEventData('date', e.target.value)}
                            />
                        </div>
                        {/* Event type */}
                        <div className="flex flex-col mt-2">
                            <label className="block font-bold mb-3 text-brand-text text-[0.95rem]">Temática</label>
                            <div className="grid grid-cols-2 gap-3">
                                {eventTypes.map((t) => (
                                    <OptionCard
                                        key={t.id}
                                        id={t.id}
                                        label={t.name}
                                        icon={renderIconFromKey(t.icon, 24, "w-6 h-6 text-primary")}
                                        isSelected={state.eventData.type === t.id}
                                        onClick={(id) => updateEventData('type', state.eventData.type === id ? '' : id)}
                                    />
                                ))}
                            </div>
                            {state.eventData.type === 'Otro' && (
                                <div className="mt-4 animate-slide-up">
                                    <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Especificar Temática <span className="text-primary">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Aniversario, Graduación..."
                                        className={`w-full p-3.5 border-2 rounded-xl text-[1rem] font-sans text-brand-text transition-all focus:outline-none
                                            ${state.eventData.otherType
                                                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                                : 'border-brand-border bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                                            }`}
                                        value={state.eventData.otherType || ''}
                                        onChange={(e) => updateEventData('otherType', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sliders de Consumo */}
                <div className="bg-white rounded-3xl p-5 border-2 border-brand-border shadow-sm flex flex-col">
                    <h3 className="text-lg font-black text-brand-text mb-4">2. ¿Cuántos invitados tienes?</h3>
                    
                    {/* Slider Invitados */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-brand-text">Cantidad de Invitados</label>
                            <input 
                                type="number"
                                min="0"
                                value={guests || ''}
                                onChange={(e) => updateConsumption('guests', parseInt(e.target.value) || 0)}
                                className="w-24 text-right text-2xl font-black text-primary bg-transparent border-b-2 border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition-colors p-0 rounded-none"
                                placeholder="0"
                            />
                        </div>
                        <input 
                            type="range" 
                            min="0" max={Math.max(250, guests)} step="5"
                            value={guests}
                            onChange={(e) => updateConsumption('guests', parseInt(e.target.value) || 0)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary"
                            style={{
                                background: `linear-gradient(to right, #E2A049 ${(guests / Math.max(250, guests)) * 100}%, #E2E8F0 ${(guests / Math.max(250, guests)) * 100}%)`
                            }}
                        />
                        <div className="flex justify-between text-[0.7rem] text-brand-text-muted mt-1.5 font-bold">
                            <span>0</span>
                            <span>{Math.max(250, guests)}+</span>
                        </div>
                    </div>

                    {/* Slider Tragos p/p */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-brand-text">Tragos por Persona</label>
                            <span className="text-2xl font-black text-primary">{drinks}</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" max="10" step="1"
                            value={drinks}
                            onChange={(e) => updateConsumption('drinksPerPerson', parseInt(e.target.value) || 3)}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary"
                            style={{
                                background: `linear-gradient(to right, #E2A049 ${((drinks - 1) / 9) * 100}%, #E2E8F0 ${((drinks - 1) / 9) * 100}%)`
                            }}
                        />
                        <div className="flex justify-between text-[0.7rem] text-brand-text-muted mt-1.5 font-bold">
                            <span>1 trago</span>
                            <span>10 tragos</span>
                        </div>
                    </div>

                    {/* Resultado en vivo */}
                    <div className="mt-auto pt-4 border-t border-brand-border">
                        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <span className="font-black text-brand-text text-[1.05rem]">Pedido Sugerido</span>
                            </div>
                            <div className="flex flex-col gap-2.5 mt-2.5 text-[0.95rem] font-medium text-brand-text leading-snug">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                                    <p className="flex-1">
                                        Necesitas <span className="text-primary font-black">{recommendedLiters} litros</span> para ofrecer {drinks} {drinks === 1 ? 'trago' : 'tragos'} a {guests} invitados.
                                    </p>
                                </div>
                                {suggestionInfo && suggestionInfo.barrelSuggestionText && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                                        <p className="flex-1">
                                            Selecciona <span className="text-primary font-black">{suggestionInfo.barrelSuggestionText}</span> (las variedades que prefieras).
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Extras / Dispensadores */}
            <div className="mb-12">
                <h3 className="text-lg font-black text-brand-text mb-6">3. Selecciona tu formato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {dispensers.map((disp) => (
                        <div key={disp.id} className={`relative flex flex-col items-stretch p-0 rounded-2xl border-2 transition-all group shadow-sm hover:shadow-md
                            ${state.dispenser === disp.id
                                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                : 'border-brand-border bg-white hover:border-primary/40'}
                        `}>
                            {state.dispenser === disp.id && (
                                <div className="absolute top-4 right-4 text-primary z-10 pointer-events-none">
                                    <Check className="w-5 h-5" />
                                </div>
                            )}
                            <button 
                                type="button"
                                className="p-4 sm:p-5 flex flex-col text-left w-full cursor-pointer outline-none h-full"
                                onClick={() => setDispenserModal(disp.id)}
                            >
                                <div className="flex items-start gap-4 mb-3 w-full">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${state.dispenser === disp.id ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-brand-text-muted'}`}>
                                        <disp.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <h4 className="font-black text-[1.05rem] text-brand-text leading-tight">{disp.title}</h4>
                                        </div>
                                        <p className="text-brand-text-muted text-[0.85rem] leading-snug">
                                            {disp.summary}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-auto pt-3 flex justify-between items-center w-full border-t border-brand-border/60">
                                    <span className="font-bold text-[0.75rem] text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                                        Pedido Mínimo: {disp.minLiters}L
                                    </span>
                                    <span className="font-bold text-[0.85rem] text-brand-text-muted">
                                        Instalación: <span className="font-black text-brand-text">{disp.price === 0 ? '$0' : formatCurrency(disp.price)}</span>
                                    </span>
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tu Pack Incluye */}
            <div className="mb-24">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-brand-text">Tu servicio incluye todo esto a costo $0</h3>
                    <button 
                        type="button" 
                        onClick={() => setIsInfoModalOpen(true)}
                        className="text-primary hover:text-primary-dark font-bold text-sm flex items-center gap-1.5 transition-colors"
                    >
                        <Info className="w-4 h-4" /> Ver detalle
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {INCLUYE_ITEMS.map((item, i) => (
                        <button 
                            key={i} 
                            type="button"
                            onClick={() => setIsInfoModalOpen(true)}
                            className="bg-primary/5 border-2 border-primary ring-2 ring-primary/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group hover:bg-primary/10 hover:ring-primary/40 transition-all w-full cursor-pointer shadow-sm"
                        >
                            <div className="absolute top-2 right-2 text-primary">
                                <Check className="w-5 h-5" />
                            </div>
                            <item.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-[0.8rem] font-bold text-brand-text leading-tight">{item.label}</span>
                        </button>
                    ))}
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
                        <div className="p-6 border-b border-brand-border flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
                            <h3 className="text-xl font-black text-brand-text flex items-center gap-2">
                                <Check className="w-6 h-6 text-primary" />
                                ¿Qué incluye nuestro servicio?
                            </h3>
                            <button 
                                onClick={() => setIsInfoModalOpen(false)}
                                className="p-2 bg-slate-50 rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100"
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
                                        <h4 className="font-bold text-brand-text text-sm mb-1">Vasos/Copas</h4>
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

            {/* Modal de Detalle de Dispensador */}
            {dispenserModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setDispenserModal(null)}
                >
                    <div 
                        className="bg-white rounded-3xl w-full max-w-[400px] shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header con imagen vertical */}
                        <div className="relative h-[40vh] min-h-[300px] w-full shrink-0">
                            {dispensers.find(d => d.id === dispenserModal)?.image && (
                                <Image
                                    src={dispensers.find(d => d.id === dispenserModal)!.image}
                                    alt={dispensers.find(d => d.id === dispenserModal)!.title}
                                    fill
                                    className="object-cover object-center"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <button 
                                onClick={() => setDispenserModal(null)}
                                className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="absolute bottom-6 left-6 text-3xl font-black text-white tracking-tight pr-6 leading-tight">
                                {dispensers.find(d => d.id === dispenserModal)?.title}
                            </h3>
                        </div>
                        {/* Contenido */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-brand-text text-[0.95rem] leading-relaxed mb-6">
                                {dispensers.find(d => d.id === dispenserModal)?.description}
                            </p>
                            
                            <div className="flex flex-col gap-4 border-t border-brand-border pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[0.8rem] text-brand-text-muted font-bold uppercase tracking-wider block">Costo de Instalación</span>
                                    <span className={`font-black text-xl ${dispensers.find(d => d.id === dispenserModal)?.price === 0 ? 'text-primary' : 'text-brand-text'}`}>
                                        {dispensers.find(d => d.id === dispenserModal)?.price === 0 ? 'Gratis' : formatCurrency(dispensers.find(d => d.id === dispenserModal)!.price)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        updateDispenser(dispenserModal as any);
                                        setDispenserModal(null);
                                    }}
                                    className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-lg transition-all hover:bg-primary-dark shadow-[0_4px_20px_rgba(226,160,73,0.3)]"
                                >
                                    Elegir este formato
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none">
                <div className="max-w-[1400px] mx-auto pointer-events-auto">
                    <div className="bg-white rounded-2xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] border border-brand-border p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[0.9rem] font-bold text-brand-text-muted">Pedido Sugerido:</span>
                                <span className="text-xl font-black text-brand-text">{recommendedLiters}L</span>
                            </div>
                            
                            <div className="hidden sm:block h-6 w-[2px] bg-brand-border" />
                            
                            <div className="hidden sm:flex items-center gap-1.5">
                                <span className="text-[0.9rem] font-bold text-brand-text">{guests} invitados / {drinks} tragos</span>
                                {state.dispenser && (
                                    <>
                                        <span className="text-primary font-black">•</span>
                                        <span className="text-[0.9rem] font-bold text-brand-text">{state.dispenser === 'portatil' ? 'Portátil' : 'Muro'}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onNext}
                            className="group shrink-0 inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-black text-[1rem] transition-all hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)]"
                        >
                            <span>Siguiente</span>
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
