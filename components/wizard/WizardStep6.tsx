'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { useWizard } from '@/hooks/useWizard';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import { RotateCcw, Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';


type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
}

export default function WizardStep6({ wizard, cocktails, comunas }: Props) {
    const { state, goToStep } = wizard;
    const data = useMemo(() => wizard.calculateSummaryData(), [wizard, state.selections, state.eventData]);

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">6. Resumen de Cotización</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Revisa los detalles de tu solicitud.</p>

            <div className="bg-white rounded-[20px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.07)] border border-brand-border">
                {/* Event Info */}
                <div className="mb-8 pb-6 border-b border-[#e2e8f0]">
                    <div className="text-[0.75rem] text-brand-text-muted uppercase font-bold mb-4">Datos del Evento</div>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            ['Nombre', state.contact.fullName],
                            ['Fecha', data.formattedDate],
                            ['Temática', data.eventTypeDisplay],
                            ['Invitados', `${state.consumption.guests} pers.`],
                            ['Comuna', data.comunaDisplay],
                        ].map(([label, value]) => (
                            <div key={label} className="flex gap-2">
                                <span className="font-semibold text-brand-text-muted text-[0.85rem] w-[80px] shrink-0">{label}: </span>
                                <span className="font-bold text-brand-text">{value}</span>
                            </div>
                        ))}
                    </div>
                    {state.contact.comments && (
                        <div className="mt-6">
                            <span className="text-[0.8rem] block mb-2 font-semibold text-brand-text-muted">Notas Adicionales:</span>
                            <div className="bg-[#f8fafc] p-4 rounded-xl text-[0.9rem] text-brand-text-muted border border-[#edf2f7]">
                                {state.contact.comments}
                            </div>
                        </div>
                    )}
                </div>

                {/* Products */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-5 border-b border-brand-border pb-2">
                        <div className="flex items-center gap-2 font-extrabold text-[1.1rem] text-brand-text m-0">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            <span>Productos</span>
                        </div>
                        <span className="text-[0.7rem] bg-primary/10 text-primary px-3 py-1 rounded-full font-black">
                            {data.items.length} {data.items.length === 1 ? 'ITEM' : 'ITEMS'}
                        </span>
                    </div>

                    {data.items.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {data.items.map((item) => (
                                <div key={`${item.id}_${item.selectedSize}`} className="bg-white p-4 rounded-xl border border-brand-border shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col gap-3 transition-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary/30">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <button
                                                type="button"
                                                className="min-w-[28px] h-[28px] rounded-full bg-[#fee2e2] text-[#ef4444] border-none font-bold text-[0.9rem] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#ef4444] hover:text-white shrink-0 mt-0.5"
                                                onClick={() => wizard.updateQuantity(item.id, item.selectedSize, -item.quantity)}
                                            >
                                                ✕
                                            </button>
                                            <span className="font-bold text-brand-text text-[1.05rem] leading-[1.2]">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {item.totalNormalPrice > item.totalOfferPrice && (
                                                <span className="text-brand-text-muted text-[0.85rem] line-through opacity-70">{formatCurrency(item.totalNormalPrice)}</span>
                                            )}
                                            <span className="font-extrabold text-[#059669] text-[1.1rem]">{formatCurrency(item.totalOfferPrice)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pl-[40px]">
                                        <span className="text-brand-text-muted text-[0.85rem] font-bold bg-[#f1f5f9] px-2.5 py-1 rounded-md">{item.selectedSize}</span>
                                        <div className="flex items-center gap-1 border border-brand-border rounded-lg p-0.5 bg-[#f8fafc]">
                                            <button
                                                type="button"
                                                className="w-[28px] h-[28px] rounded-md bg-white border border-brand-border text-brand-text font-bold shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-primary hover:text-white hover:border-primary"
                                                onClick={() => wizard.updateQuantity(item.id, item.selectedSize, -1)}
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                min={1}
                                                className="w-8 text-center bg-transparent border-none text-brand-text font-bold text-[0.95rem] outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    wizard.updateQuantity(item.id, item.selectedSize, val - item.quantity);
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="w-[28px] h-[28px] rounded-md bg-white border border-brand-border text-brand-text font-bold shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-primary hover:text-white hover:border-primary"
                                                onClick={() => wizard.updateQuantity(item.id, item.selectedSize, 1)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 bg-[#f8fafc] rounded-2xl border border-dashed border-[#cbd5e1] text-center">
                            <ShoppingCart className="w-10 h-10 text-brand-text-muted/30 mb-4" />
                            <p className="text-brand-text-muted font-bold mb-4">No has seleccionado ningún producto aún.</p>
                            <button
                                type="button"
                                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-[0.9rem] hover:bg-primary-dark transition-all border-none cursor-pointer"
                                onClick={() => wizard.goToStep(4)}
                            >
                                Seleccionar Cócteles
                            </button>
                        </div>
                    )}
                </div>

                {/* Metrics */}
                <div className="flex justify-between items-center bg-[#f1f5f9] text-brand-text p-4 rounded-xl mb-8 border border-[#e2e8f0]">
                    {[
                        { val: `${data.totalLiters}L`, label: 'Volumen' },
                        { val: String(data.totalLiters * 5), label: 'Cócteles' },
                        { val: ((data.totalLiters * 5) / (state.consumption.guests || 1)).toFixed(1), label: 'x Persona' },
                    ].map((m, i) => (
                        <div key={m.label} className={`text-center flex-1 ${i > 0 ? 'border-l border-[#cbd5e1]' : ''}`}>
                            <span className="block text-[1.25rem] font-black text-primary">{m.val}</span>
                            <span className="text-[0.65rem] uppercase font-bold text-[#64748b] tracking-wider">{m.label}</span>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="flex flex-col">
                    <div className="flex justify-between py-1 text-[0.95rem] font-medium text-brand-text-muted">
                        <span>Subtotal</span>
                        <span className="font-bold text-brand-text">{formatCurrency(data.totalNormalPrice)}</span>
                    </div>
                    {data.totalDiscount > 0 && (
                        <div className="flex justify-between py-1 text-[0.95rem] font-bold text-[#16a34a]">
                            <span>Descuento</span>
                            <span>-{formatCurrency(data.totalDiscount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-1 text-[0.95rem] font-medium text-brand-text-muted">
                        <span>Transporte</span>
                        <span className={`font-bold ${data.shippingCost === 0 ? 'text-primary' : 'text-brand-text'}`}>{data.shippingLabel}</span>
                    </div>
                    <div className="flex justify-between pt-4 mt-2 border-t-2 border-primary items-center">
                        <span className="font-black text-brand-text text-[1rem]">TOTAL</span>
                        <span className="text-2xl font-black text-primary">{formatCurrency(data.totalPrice)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#e2e8f0] text-[#64748b] bg-transparent font-bold text-[0.95rem] transition-all hover:bg-[#f1f5f9] hover:text-brand-text cursor-pointer w-full max-w-[300px]"
                    onClick={() => goToStep(4)}
                >
                    <RotateCcw className="w-4 h-4" /> Modificar Cócteles
                </button>

            </div>
        </div>
    );
}
