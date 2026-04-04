'use client';

import type { useWizard } from '@/hooks/useWizard';
import type { EventType, Comuna } from '@/lib/types';
import { Cake, Baby, Heart, Briefcase, Plus, type LucideIcon } from 'lucide-react';
import SelectField from '@/components/ui/SelectField';
import OptionCard from '@/components/ui/OptionCard';
import QuantitySelector from '@/components/ui/QuantitySelector';
import { calculateMaxPickupDate, getTodayString } from '@/lib/wizardLogic';

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
    const maxPickupDate = calculateMaxPickupDate(state.eventData.date);
    const today = getTodayString();

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">1. Datos del Evento</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Cuéntanos sobre tu celebración para personalizar tu experiencia.</p>

            {/* Temática */}
            <div className="mb-8">
                <label className="block font-bold mb-3 text-brand-text text-[0.95rem]">¿Cuál es el motivo de tu celebración?</label>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                    {eventTypes.map((t) => {
                        const Icon = ICON_MAP[t.icon] || FallbackIcon;
                        return (
                            <OptionCard
                                key={t.id}
                                id={t.id}
                                label={t.name}
                                icon={<Icon className="w-7 h-7" />}
                                isSelected={state.eventData.type === t.id}
                                onClick={(id) => updateEventData('type', id)}
                            />
                        );
                    })}
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
                <QuantitySelector
                    value={state.consumption.guests || 0}
                    onChange={(delta) => updateConsumption('guests', Math.max(0, (state.consumption.guests || 0) + delta))}
                    min={0}
                    step={10}
                />
                <p className="mt-3 text-[0.8rem] text-brand-text-muted font-medium">Mínimo 10 invitados para el servicio.</p>
            </div>

            {/* Fecha y Hora de Inicio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                <div className="flex flex-col">
                    <label htmlFor="wizard-date" className="block font-bold mb-2 text-brand-text text-[0.9rem] sm:text-[0.95rem]">Fecha del Evento <span className="text-primary">*</span></label>
                    <div className="relative group/input">
                        <input
                            id="wizard-date"
                            type="date"
                            required
                            min={today}
                            className="w-full px-3 py-3 sm:p-4 border-2 border-brand-border rounded-2xl text-[0.95rem] sm:text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 hover:border-primary/30 [appearance:none] min-h-[52px] sm:min-h-[58px]"
                            value={state.eventData.date}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                updateEventData('date', newDate);
                            }}
                            onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                    </div>
                </div>
                <div className="flex flex-col">
                    <label htmlFor="wizard-start-time" className="block font-bold mb-2 text-brand-text text-[0.9rem] sm:text-[0.95rem]">Hora de Inicio</label>
                    <div className="relative group/input">
                        <input
                            id="wizard-start-time"
                            type="time"
                            className="w-full px-3 py-3 sm:p-4 border-2 border-brand-border rounded-2xl text-[0.95rem] sm:text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 hover:border-primary/30 [appearance:none] min-h-[52px] sm:min-h-[58px]"
                            value={state.eventData.startTime}
                            onChange={(e) => updateEventData('startTime', e.target.value)}
                            onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                        {!state.eventData.startTime && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none font-sans text-[0.95rem] sm:text-[1rem]">
                                Dato opcional
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Retiro del Equipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {state.eventData.startTime && (
                    <div className="animate-fade-in flex flex-col">
                        <label htmlFor="wizard-pickup-date" className="block font-bold mb-2 text-brand-text text-[0.9rem] sm:text-[0.95rem]">Fecha de Retiro</label>
                        <div className="relative group/input">
                            <input
                                id="wizard-pickup-date"
                                type="date"
                                min={minPickupDate}
                                max={maxPickupDate}
                                className="w-full px-3 py-3 sm:p-4 border-2 border-brand-border rounded-2xl text-[0.95rem] sm:text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 hover:border-primary/30 [appearance:none] min-h-[52px] sm:min-h-[58px]"
                                value={state.eventData.pickupDate}
                                onChange={(e) => updateEventData('pickupDate', e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker?.()}
                            />
                            {!state.eventData.pickupDate && (
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none font-sans text-[0.95rem] sm:text-[1rem]">
                                    Dato opcional
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {state.eventData.pickupDate && state.eventData.pickupDate !== state.eventData.date && (
                    <div className="animate-fade-in flex flex-col">
                        <label htmlFor="wizard-pickup-time" className="block font-bold mb-2 text-brand-text text-[0.9rem] sm:text-[0.95rem]">Horario de Retiro</label>
                        <SelectField
                            id="wizard-pickup-time"
                            value={state.eventData.pickupTime}
                            onChange={(v: string) => updateEventData('pickupTime', v)}
                            placeholder="Seleccionar..."
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
