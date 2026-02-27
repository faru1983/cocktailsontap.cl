'use client';

import type { useWizard } from '@/hooks/useWizard';
import type { EventType, Comuna } from '@/lib/types';
import { Cake, Baby, Heart, Briefcase, Plus } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
    'fa-solid fa-cake-candles': Cake,
    'fa-solid fa-baby': Baby,
    'fa-solid fa-ring': Heart,
    'fa-solid fa-briefcase': Briefcase,
    'fa-solid fa-plus': Plus,
};

const FallbackIcon = Plus;


type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    eventTypes: EventType[];
    comunas: Comuna[];
}

export default function WizardStep1({ wizard, eventTypes, comunas }: Props) {
    const { state, updateEventData } = wizard;

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">1. Datos del Evento</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Cuéntanos sobre tu celebración para personalizar tu experiencia.</p>

            <div className="mb-6">
                <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Temática del Evento</label>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                    {eventTypes.map((t) => (
                        <div
                            key={t.id}
                            className={`bg-white border-2 rounded-[14px] p-4 text-center cursor-pointer flex flex-col items-center gap-2 font-semibold text-[0.9rem] transition-all duration-200 
                                ${state.eventData.type === t.id
                                    ? 'bg-gradient-to-br from-primary to-primary-dark border-primary text-white shadow-[0_4px_12px_rgba(226,160,73,0.2)]'
                                    : 'border-brand-border text-brand-text hover:border-primary/50 hover:shadow-sm'
                                }`}
                            onClick={() => updateEventData('type', t.id)}
                        >
                            {(() => {
                                const Icon = ICON_MAP[t.icon] || FallbackIcon;
                                return <Icon className={`w-6 h-6 ${state.eventData.type === t.id ? 'text-white' : 'text-brand-text-muted transition-colors duration-200 group-hover:text-primary/70'}`} />;
                            })()}

                            <span>{t.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {state.eventData.type === 'Otro' && (
                <div className="mb-6 animate-slide-up">
                    <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Especificar Temática</label>
                    <input
                        type="text"
                        placeholder="Ej: Aniversario, Graduación..."
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.otherType}
                        onChange={(e) => updateEventData('otherType', e.target.value)}
                    />
                </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
                <div className="mb-6">
                    <label htmlFor="wizard-date" className="block font-bold mb-2 text-brand-text text-[0.95rem]">¿Cuándo es el evento?</label>
                    <input
                        id="wizard-date"
                        type="date"
                        required
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.date}
                        onChange={(e) => updateEventData('date', e.target.value)}
                    />
                </div>
                <div className="mb-6">
                    <label htmlFor="wizard-comuna" className="block font-bold mb-2 text-brand-text text-[0.95rem]">Comuna del Evento</label>
                    <select
                        id="wizard-comuna"
                        required
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]"
                        value={state.eventData.comuna}
                        onChange={(e) => updateEventData('comuna', e.target.value)}
                    >
                        <option value="">Selecciona tu comuna...</option>
                        {comunas.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {state.eventData.comuna === 'Otra' && (
                <div className="mb-6 animate-slide-up">
                    <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Especificar Comuna</label>
                    <input
                        type="text"
                        placeholder="Ingresa tu comuna"
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.otherComuna}
                        onChange={(e) => updateEventData('otherComuna', e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}
