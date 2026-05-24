'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassWater, Box, Package, ChevronRight } from 'lucide-react';
import type { CocktailForWizard, EventType, Comuna } from '@/lib/types';
import LiveQuoterShell from './LiveQuoterShell';
import DirectWizardShell from './direct/DirectWizardShell';

interface Props {
    cocktails: CocktailForWizard[];
    eventTypes: EventType[];
    comunas: Comuna[];
    categories: string[];
    initialServiceType?: 'event' | 'direct';
}

export default function CotizarGateway({ cocktails, eventTypes, comunas, categories, initialServiceType }: Props) {
    const [serviceType, setServiceType] = useState<'event' | 'direct' | ''>(initialServiceType || '');
    const router = useRouter();

    if (serviceType === 'event') {
        const eventCategories = categories.filter(c => c !== 'Otros');
        return <LiveQuoterShell cocktails={cocktails} eventTypes={eventTypes} comunas={comunas} categories={eventCategories} initialServiceType="event" />;
    }

    if (serviceType === 'direct') {
        const directCategories = categories.filter(c => c === 'Otros' || cocktails.some(cocktail => cocktail.category === c && Object.values(cocktail.prices).some(p => p.isDisposable)));
        return <DirectWizardShell cocktails={cocktails} comunas={comunas} categories={directCategories} initialServiceType="direct" />;
    }

    return (
        <div className="flex flex-col animate-fade-in relative z-0 pb-20">
            <div className="text-center mb-10 pt-4">
                <h3 className="text-3xl font-black text-brand-text mb-3">¿Qué servicio necesitas?</h3>
                <p className="text-brand-text-muted text-[1rem] leading-relaxed max-w-lg mx-auto">
                    Selecciona la modalidad que mejor se adapte a tu celebración para que podamos personalizar tu experiencia.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full px-4 sm:px-6">
                {/* Opción 1: Servicio de Eventos */}
                <button
                    type="button"
                    onClick={() => router.push('/eventos')}
                    className="group relative isolate flex flex-col items-center p-8 bg-zinc-900 rounded-3xl border border-white/10 hover:border-primary transition-all duration-300 text-left hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 overflow-hidden min-h-[420px]"
                >
                    {/* Image Background */}
                    <div 
                        className="absolute inset-0 bg-[url('/assets/service_events.webp')] bg-cover bg-center -z-20 transition-transform duration-1000 group-hover:scale-110" 
                    />
                    {/* Dark Gradient Overlay for contrast */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 group-hover:via-black/60 transition-colors duration-500 -z-10" 
                    />
                    
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300 border border-white/10 shadow-lg group-hover:shadow-primary/30">
                        <GlassWater className="w-10 h-10" />
                    </div>
                    
                    <h4 className="text-2xl font-black text-white mb-3 text-center drop-shadow-md">Servicio de Eventos</h4>
                    <p className="text-zinc-300 text-[0.95rem] text-center leading-relaxed flex-1 mb-8 drop-shadow-sm font-medium">
                        Arriendo de dispensadores, cristalería, hielo y decoraciones. Ideal para matrimonios, cumpleaños corporativos y fiestas grandes.
                    </p>

                    <div className="w-full flex items-center justify-between text-primary font-bold text-[0.95rem] bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-300 border border-white/5 shadow-inner">
                        <span>Ver más detalles</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                </button>

                {/* Opción 2: Compra Directa (Desechable) */}
                <button
                    type="button"
                    onClick={() => router.push('/barriles')}
                    className="group relative isolate flex flex-col items-center p-8 bg-zinc-900 rounded-3xl border border-white/10 hover:border-blue-500 transition-all duration-300 text-left hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 overflow-hidden min-h-[420px]"
                >
                    {/* Image Background */}
                    <div 
                        className="absolute inset-0 bg-[url('/assets/direct_purchase.webp')] bg-cover bg-center -z-20 transition-transform duration-1000 group-hover:scale-110" 
                    />
                    {/* Dark Gradient Overlay for contrast */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 group-hover:via-black/60 transition-colors duration-500 -z-10" 
                    />
                    
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 border border-white/10 shadow-lg group-hover:shadow-blue-500/30">
                        <Package className="w-10 h-10" />
                    </div>
                    
                    <h4 className="text-2xl font-black text-white mb-3 text-center drop-shadow-md">Compra Directa</h4>
                    <p className="text-zinc-300 text-[0.95rem] text-center leading-relaxed flex-1 mb-8 drop-shadow-sm font-medium">
                        Barril desechable de 5 Litros. Formato delivery listo para servir, sin retorno de equipos. Excelente para juntas pequeñas o regalos.
                    </p>

                    <div className="w-full flex items-center justify-between text-blue-400 font-bold text-[0.95rem] bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 border border-white/5 shadow-inner">
                        <span>Ver más detalles</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                    </div>

                    <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                        <div className="bg-amber-400 text-amber-950 text-[0.65rem] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg border border-amber-300/50">
                            ¡Nuevo Formato!
                        </div>
                        <div className="bg-red-500 text-white text-[0.65rem] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg border border-red-400/50 animate-pulse">
                            20% OFF Lanzamiento
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}
