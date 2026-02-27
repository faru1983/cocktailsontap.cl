'use client';

import type { useWizard } from '@/hooks/useWizard';

type WizardHook = ReturnType<typeof useWizard>;

export default function WizardStep5({ wizard }: { wizard: WizardHook }) {
    const { state, updateContact } = wizard;

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">5. Datos de Contacto</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Compártenos tu nombre para enviarte el resumen personalizado de tu cotización.</p>

            <div className="mb-6">
                <label htmlFor="wizard-fullname" className="block font-bold mb-2 text-brand-text text-[0.95rem]">
                    Nombre Completo <span className="text-primary">*</span>
                </label>
                <input
                    id="wizard-fullname"
                    type="text"
                    required
                    minLength={3}
                    placeholder="Tu nombre y apellido"
                    className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 pl-4"
                    value={state.contact.fullName}
                    onChange={(e) => updateContact('fullName', e.target.value)}
                />
            </div>

            <div className="mb-6">
                <label className="block font-bold mb-2 text-brand-text text-[0.95rem]">Comentarios Adicionales (Opcional)</label>
                <textarea
                    rows={4}
                    placeholder="Cuéntanos algún detalle especial para tu evento (Ej: Entrada difícil, horario específico...)"
                    className="w-full p-3.5 border-2 border-brand-border rounded-xl text-[1rem] font-sans text-brand-text bg-white transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-y min-h-[100px] pl-4"
                    value={state.contact.comments}
                    onChange={(e) => updateContact('comments', e.target.value)}
                />
            </div>
        </div>
    );
}
