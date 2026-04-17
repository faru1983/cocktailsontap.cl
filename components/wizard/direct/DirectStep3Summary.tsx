'use client';

import { useMemo } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import QuoteSummaryProducts from '@/components/quote/QuoteSummaryProducts';

type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
}

export default function DirectStep3Summary({ wizard, cocktails, comunas }: Props) {
    const { state, goToStep } = wizard;
    const data = useMemo(
        () => wizard.calculateSummaryData(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.selections, state.eventData, state.contact, state.dispenser]
    );

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">3. Resumen de tu Pedido</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Revisa los detalles de tu compra directa antes de confirmar.</p>

            {/* Productos y Totales */}
            <QuoteSummaryProducts
                data={{ ...data, guests: 0, canHaveMuro: false }} // Deshabilitar características de evento
                isEditable={true}
                onUpdateQuantity={wizard.updateQuantity}
                onAddProductsClick={() => goToStep(1)}
            />

            {/* Información de Despacho (Simplificado) */}
            <div className="bg-white rounded-[20px] p-8 mt-6 shadow-[0_4px_20px_rgba(0,0,0,0.07)] border border-brand-border">
                <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-[0.7rem] sm:text-[0.75rem] font-black text-primary uppercase tracking-[0.2em]">Datos de Despacho</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 mb-8 text-[0.875rem]">
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Nombre:</span>
                            <span className="font-medium text-brand-text leading-tight">
                                {state.contact.firstName} {state.contact.lastName}
                            </span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Celular:</span>
                            <span className="font-medium text-brand-text leading-tight">{state.contact.phone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Email:</span>
                            <span className="font-medium text-brand-text leading-tight">{state.contact.email}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Dirección:</span>
                            <span className="font-medium text-brand-text leading-tight">
                                {state.contact.address}{state.contact.address && data.comunaDisplay ? ', ' : ''}{data.comunaDisplay}
                            </span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Fecha de Entrega:</span>
                            <span className="font-medium text-brand-text leading-tight">
                                {data.formattedDate} <br />(Rango abierto durante el día)
                            </span>
                        </div>
                    </div>
                </div>

                {state.contact.comments && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-brand-border/50 italic text-brand-text-muted text-[0.9rem]">
                        Comentarios: {state.contact.comments}
                    </div>
                )}
            </div>
        </div>
    );
}
