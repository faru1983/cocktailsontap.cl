'use client';

import type { useWizard } from '@/hooks/useWizard';
import type { EventType, Comuna } from '@/lib/types';
import { Cake, Baby, Heart, Briefcase, Plus, type LucideIcon } from 'lucide-react';
import SelectField from '@/components/ui/SelectField';

const ICON_MAP: Record<string, LucideIcon> = {
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

export default function WizardStep1({ wizard, eventTypes }: Props) {
    const { state, updateEventData, updateConsumption } = wizard;

    // Lógica para fechas de retiro 
    const minPickupDate = state.eventData.date;
    const maxPickupDate = state.eventData.date ? (() => {
        const d = new Date(state.eventData.date + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    })() : '';

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">1. Datos del Evento</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Cuéntanos sobre tu celebración para personalizar tu experiencia.</p>

            {/* Temática */}
            <div className="mb-8">
                <label className="block font-bold mb-3 text-brand-text text-[0.95rem]">¿Cuál es el motivo de tu celebración?</label>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                    {eventTypes.map((t) => (
                        <div
                            key={t.id}
                            className={`group relative bg-white border-2 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 font-bold text-[0.9rem] transition-all duration-300
                                ${state.eventData.type === t.id
                                    ? 'border-primary ring-4 ring-primary/10 bg-primary/5'
                                    : 'border-brand-border text-brand-text-muted hover:border-primary/40 hover:bg-slate-50'
                                }`}
                            onClick={() => updateEventData('type', t.id)}
                        >
                            {(() => {
                                const Icon = ICON_MAP[t.icon] || FallbackIcon;
                                return <Icon className={`w-7 h-7 transition-all duration-300 ${state.eventData.type === t.id ? 'text-primary scale-110' : 'text-slate-400 group-hover:text-primary/70'}`} />;
                            })()}
                            <span className={state.eventData.type === t.id ? 'text-brand-text' : ''}>{t.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {state.eventData.type === 'Otro' && (
                <div className="mb-8 animate-slide-up">
                    <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Especificar Temática</label>
                    <input
                        type="text"
                        placeholder="Ej: Aniversario, Graduación..."
                        className="w-full p-4 border-2 border-brand-border rounded-2xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.otherType}
                        onChange={(e) => updateEventData('otherType', e.target.value)}
                    />
                </div>
            )}

            {/* Invitados */}
            <div className="mb-8">
                <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Cantidad de Invitados</label>
                <div className="flex items-center bg-white border-2 border-brand-border rounded-2xl max-w-[240px] overflow-hidden">
                    <button
                        type="button"
                        className="w-14 h-14 flex items-center justify-center bg-slate-50 text-brand-text hover:bg-primary/10 hover:text-primary transition-colors font-black text-2xl border-r-2 border-brand-border"
                        onClick={() => updateConsumption('guests', Math.max(0, state.consumption.guests - 10))}
                    >
                        −
                    </button>
                    <input
                        type="number"
                        min={0}
                        placeholder="0"
                        className="flex-1 w-full text-center font-black text-2xl text-brand-text bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={state.consumption.guests || ''}
                        onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            updateConsumption('guests', val);
                        }}
                    />
                    <button
                        type="button"
                        className="w-14 h-14 flex items-center justify-center bg-slate-50 text-brand-text hover:bg-primary/10 hover:text-primary transition-colors font-black text-2xl border-l-2 border-brand-border"
                        onClick={() => updateConsumption('guests', state.consumption.guests + 10)}
                    >
                        +
                    </button>
                </div>
                <p className="mt-3 text-[0.8rem] text-brand-text-muted font-medium">Mínimo 10 invitados para el servicio.</p>
            </div>

            {/* Fecha y Hora de Inicio */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label htmlFor="wizard-date" className="block font-bold mb-2 text-brand-text text-[0.95rem]">Fecha del Evento</label>
                    <input
                        id="wizard-date"
                        type="date"
                        required
                        className="w-full p-4 border-2 border-brand-border rounded-2xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.date}
                        onChange={(e) => {
                            const newDate = e.target.value;
                            updateEventData('date', newDate);
                        }}
                    />
                </div>
                <div>
                    <label htmlFor="wizard-start-time" className="block font-bold mb-2 text-brand-text text-[0.95rem]">Hora de Inicio</label>
                    <input
                        id="wizard-start-time"
                        type={state.eventData.startTime ? "time" : "text"}
                        placeholder="Dato opcional"
                        onFocus={(e) => (e.target.type = "time")}
                        onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                        className="w-full p-4 border-2 border-brand-border rounded-2xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={state.eventData.startTime}
                        onChange={(e) => updateEventData('startTime', e.target.value)}
                    />
                </div>
            </div>

            {/* Retiro del Equipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.eventData.startTime && (
                    <div className="animate-fade-in">
                        <label htmlFor="wizard-pickup-date" className="block font-bold mb-2 text-brand-text text-[0.95rem]">Fecha de Retiro</label>
                        <input
                            id="wizard-pickup-date"
                            type={state.eventData.pickupDate ? "date" : "text"}
                            min={minPickupDate}
                            max={maxPickupDate}
                            placeholder="Dato opcional"
                            onFocus={(e) => (e.target.type = "date")}
                            onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                            className="w-full p-4 border-2 border-brand-border rounded-2xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                            value={state.eventData.pickupDate}
                            onChange={(e) => updateEventData('pickupDate', e.target.value)}
                        />
                    </div>
                )}
                {state.eventData.pickupDate && state.eventData.pickupDate !== state.eventData.date && (
                    <div className="animate-fade-in">
                        <label htmlFor="wizard-pickup-time" className="block font-bold mb-2 text-brand-text text-[0.95rem]">Horario de Retiro</label>
                        <SelectField
                            id="wizard-pickup-time"
                            value={state.eventData.pickupTime}
                            onChange={(v) => updateEventData('pickupTime', v)}
                            placeholder="Dato opcional"
                        >
                            <option value="12:00 a 14:00">12:00 a 14:00</option>
                            <option value="14:00 a 16:00">14:00 a 16:00</option>
                            <option value="16:00 a 18:00">16:00 a 18:00</option>
                        </SelectField>
                    </div>
                )}
            </div>
        </div>
    );
}
