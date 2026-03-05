'use client';

import { useState } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna } from '@/lib/types';
import { formatPhoneNumber } from '@/lib/utils';

type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    comunas: Comuna[];
}

export default function WizardStep2({ wizard, comunas }: Props) {
    const { state, updateContact } = wizard;

    // Estado local para recordar si debemos mostrar todos los campos
    const [showExtraFields, setShowExtraFields] = useState(
        state.contact.address.length > 2 ||
        state.contact.email.length > 0 ||
        state.contact.phone.length > 0 ||
        state.contact.comments.length > 0
    );

    return (
        <div className="flex flex-col space-y-6">
            <div className="mb-4">
                <h3 className="text-2xl font-extrabold text-brand-text mb-2">2. Datos de Contacto</h3>
                <p className="text-brand-text-muted text-[0.95rem] leading-relaxed">Solo unos pocos datos para enviarte la cotización formal.</p>
            </div>

            {/* Fila 1: Nombre Completo y Comuna (Obligatorios) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="wizard-firstname" className="block font-bold mb-2 text-brand-text text-[0.9rem]">Nombre Completo <span className="text-primary">*</span></label>
                    <input
                        id="wizard-firstname"
                        name="name"
                        autoComplete="name"
                        type="text"
                        required
                        placeholder="Ej: Juan Pérez"
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                        value={state.contact.firstName}
                        onChange={(e) => updateContact('firstName', e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="wizard-comuna" className="block font-bold mb-2 text-brand-text text-[0.9rem]">Comuna <span className="text-primary">*</span></label>
                    <select
                        id="wizard-comuna"
                        required
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]"
                        value={state.contact.comuna}
                        onChange={(e) => updateContact('comuna', e.target.value)}
                    >
                        <option value="">Selecciona comuna...</option>
                        {comunas.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {state.contact.comuna === 'Otra' && (
                <div className="animate-slide-up">
                    <label className="block font-bold mb-2 text-brand-text text-[0.9rem]">Especificar Comuna</label>
                    <input
                        type="text"
                        placeholder="Indica tu comuna"
                        className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                        value={state.contact.otherComuna}
                        onChange={(e) => updateContact('otherComuna', e.target.value)}
                    />
                </div>
            )}

            {/* Dirección (Aparece siempre después de los obligatorios) */}
            <div className="animate-slide-up">
                <label htmlFor="wizard-address" className="block font-bold mb-2 text-brand-text text-[0.9rem]">Dirección del Evento</label>
                <input
                    id="wizard-address"
                    name="street-address"
                    autoComplete="street-address"
                    type="text"
                    placeholder="Dato opcional"
                    className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                    value={state.contact.address}
                    onChange={(e) => {
                        const val = e.target.value;
                        updateContact('address', val);
                        if (val.length > 2) setShowExtraFields(true);
                    }}
                />
            </div>

            {/* Email, Celular y Comentarios (Aparecen todos si completó dirección una vez) */}
            {showExtraFields && (
                <>
                    <div className="animate-slide-up">
                        <label htmlFor="wizard-email" className="block font-bold mb-2 text-brand-text text-[0.9rem]">Email <span className="text-primary">*</span></label>
                        <input
                            id="wizard-email"
                            name="email"
                            autoComplete="email"
                            type="email"
                            placeholder="Dato opcional"
                            className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                            value={state.contact.email}
                            onChange={(e) => updateContact('email', e.target.value)}
                        />
                    </div>

                    <div className="animate-slide-up">
                        <label htmlFor="wizard-phone" className="block font-bold mb-2 text-brand-text text-[0.9rem]">Celular</label>
                        <input
                            id="wizard-phone"
                            name="tel"
                            autoComplete="tel"
                            type="tel"
                            placeholder="Dato opcional"
                            className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                            value={state.contact.phone}
                            onFocus={(e) => {
                                if (!e.target.value) updateContact('phone', '+569');
                            }}
                            onChange={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                updateContact('phone', formatted);
                            }}
                        />
                    </div>

                    <div className="animate-slide-up">
                        <label className="block font-bold mb-2 text-brand-text text-[0.9rem]">Comentarios</label>
                        <textarea
                            rows={3}
                            placeholder="Dato opcional"
                            className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none pl-4"
                            value={state.contact.comments}
                            onChange={(e) => updateContact('comments', e.target.value)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
