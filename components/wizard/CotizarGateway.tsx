'use client';

import { useState } from 'react';
import { GlassWater, Box, Package, ChevronRight } from 'lucide-react';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import WizardShell from './WizardShell';
import DirectWizardShell from './direct/DirectWizardShell';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    categories: string[];
}

export default function CotizarGateway({ cocktails, eventTypes, comunas, categories }: Props) {
    const [serviceType, setServiceType] = useState<'' | 'event' | 'direct'>('');

    if (serviceType === 'event') {
        const eventCategories = categories.filter(c => c !== 'Otros');
        return <WizardShell cocktails={cocktails} eventTypes={eventTypes} comunas={comunas} categories={eventCategories} initialServiceType="event" />;
    }

    if (serviceType === 'direct') {
        const directCategories = categories.filter(c => c === 'Otros' || cocktails.some(cocktail => cocktail.category === c && Object.values(cocktail.prices).some(p => p.isDisposable)));
        return <DirectWizardShell cocktails={cocktails} comunas={comunas} categories={directCategories} initialServiceType="direct" />;
    }

    return (
        <div className="flex flex-col animate-fade-in relative z-0">
            <div className="text-center mb-10 pt-4">
                <h3 className="text-3xl font-black text-brand-text mb-3">¿Qué servicio necesitas?</h3>
                <p className="text-brand-text-muted text-[1rem] leading-relaxed max-w-lg mx-auto">
                    Selecciona la modalidad que mejor se adapte a tu celebración para que podamos personalizar tu experiencia.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full px-4 sm:px-6">
                {/* Opción 1: Servicio de Eventos */}
                <button
                    type="button"
                    onClick={() => setServiceType('event')}
                    className="group relative flex flex-col items-center p-8 bg-white rounded-3xl border-2 border-brand-border hover:border-primary transition-all duration-300 text-left hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />
                    
                    <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                        <GlassWater className="w-10 h-10" />
                    </div>
                    
                    <h4 className="text-xl font-black text-brand-text mb-3 text-center">Servicio de Eventos</h4>
                    <p className="text-brand-text-muted text-[0.95rem] text-center leading-relaxed flex-1 mb-8">
                        Arriendo de dispensadores, cristalería, hielo y decoraciones. Ideal para matrimonios, cumpleaños corporativos y fiestas grandes.
                    </p>

                    <div className="w-full flex items-center justify-between text-primary font-bold text-[0.9rem] bg-primary/5 px-5 py-3 rounded-xl group-hover:bg-primary/10 transition-colors">
                        <span>Ver más detalles</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </button>

                {/* Opción 2: Compra Directa (Desechable) */}
                <button
                    type="button"
                    onClick={() => setServiceType('direct')}
                    className="group relative flex flex-col items-center p-8 bg-white rounded-3xl border-2 border-brand-border hover:border-blue-500 transition-all duration-300 text-left hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />
                    
                    <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Package className="w-10 h-10" />
                    </div>
                    
                    <h4 className="text-xl font-black text-brand-text mb-3 text-center">Compra Directa</h4>
                    <p className="text-brand-text-muted text-[0.95rem] text-center leading-relaxed flex-1 mb-8">
                        Barril desechable de 5 Litros. Formato delivery listo para servir, sin retorno de equipos. Excelente para juntas pequeñas o regalos.
                    </p>

                    <div className="w-full flex items-center justify-between text-blue-600 font-bold text-[0.9rem] bg-blue-50 px-5 py-3 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <span>Ver más detalles</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>

                    <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 text-[0.65rem] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                        ¡Nuevo Formato!
                    </div>
                </button>
            </div>
        </div>
    );
}
