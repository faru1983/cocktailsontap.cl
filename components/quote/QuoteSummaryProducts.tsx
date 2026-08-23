'use client';

import { ShoppingCart, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import QuantitySelector from '@/components/ui/QuantitySelector';
import QuoteSummaryTotals from '@/components/quote/QuoteSummaryTotals';

export interface QuoteSummaryItem {
    id: string; // For Wizard this is productId, for QuoteView this is QuoteItem.id
    name: string;
    selectedSize: string;
    quantity: number;
    totalNormalPrice: number;
    totalOfferPrice: number;
}

export interface QuoteSummaryData {
    items: QuoteSummaryItem[];
    totalLiters: number;
    totalCocktails: number; // Nuevo
    totalNormalPrice: number;
    totalOfferPrice: number;
    totalDiscount: number;
    shippingCost: number;
    shippingLabel: string;
    shippingCarrier?: 'own' | 'blue_express';
    installationCost: number;
    dispenserLabel: string;
    manualDiscount: number;
    totalPrice: number;
    guests: number;
    canHaveMuro: boolean;
}

interface Props {
    data: QuoteSummaryData;
    isEditable?: boolean;
    onUpdateQuantity?: (id: string, size: string, delta: number) => void;
    onAddProductsClick?: () => void;
    onChangeDispenser?: () => void;
    compact?: boolean;
    hideTotals?: boolean;
    hasComuna?: boolean;
}

export default function QuoteSummaryProducts({ data, isEditable = false, onUpdateQuantity, onAddProductsClick, onChangeDispenser, compact = false, hideTotals = false, hasComuna = true }: Props) {

    return (
        <div className={`bg-white rounded-[20px] border border-brand-border shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${compact ? 'p-4 sm:p-5 mb-4' : 'p-4 sm:p-8 mb-6'}`}>
            {/* Products */}
            <div className={compact ? 'mb-4' : 'mb-8'}>
                <div className={`flex items-center justify-between border-b border-brand-border pb-2 gap-2 ${compact ? 'mb-3' : 'mb-5'}`}>
                    <div className="flex items-center gap-2 font-extrabold text-[1rem] sm:text-[1.1rem] text-brand-text m-0 shrink-0">
                        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        <span>Productos</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        {isEditable && onAddProductsClick && (
                            <button
                                type="button"
                                onClick={onAddProductsClick}
                                className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg font-black text-[0.6rem] sm:text-[0.7rem] hover:bg-primary hover:text-white transition-all active:scale-95 uppercase tracking-wider whitespace-nowrap"
                            >
                                <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Añadir más
                            </button>
                        )}
                        <span className="text-[0.6rem] sm:text-[0.7rem] bg-slate-100 text-brand-text-muted px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-black uppercase tracking-wider border border-brand-border whitespace-nowrap">
                            {data.items.length} {data.items.length === 1 ? 'Ítem' : 'Ítems'}
                        </span>
                    </div>
                </div>

                {data.items.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {data.items.map((item) => (
                            <div key={`${item.id}_${item.selectedSize}`} className={`bg-white rounded-xl border border-brand-border shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col transition-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary/30 ${compact ? 'p-3 gap-2' : 'p-4 gap-3'}`}>
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                        {isEditable && onUpdateQuantity && (
                                            <button
                                                type="button"
                                                className={`rounded-full bg-[#fee2e2] text-[#ef4444] border-none font-bold flex items-center justify-center cursor-pointer transition-colors hover:bg-[#ef4444] hover:text-white shrink-0 mt-0.5 ${compact ? 'min-w-[22px] h-[22px] text-[0.75rem]' : 'min-w-[28px] h-[28px] text-[0.9rem]'}`}
                                                onClick={() => onUpdateQuantity(item.id, item.selectedSize, -item.quantity)}
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <span className={`font-bold text-brand-text leading-[1.2] ${compact ? 'text-[0.9rem] sm:text-[0.95rem]' : 'text-[1.05rem]'}`}>{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {item.totalNormalPrice > item.totalOfferPrice && (
                                            <span className={`text-brand-text-muted line-through opacity-70 ${compact ? 'text-[0.75rem] sm:text-[0.8rem]' : 'text-[0.85rem]'}`}>{formatCurrency(item.totalNormalPrice)}</span>
                                        )}
                                        <span className={`font-extrabold text-[#059669] ${compact ? 'text-[0.95rem] sm:text-[1rem]' : 'text-[1.1rem]'}`}>{formatCurrency(item.totalOfferPrice)}</span>
                                    </div>
                                </div>
                                <div className={`flex justify-between items-center ${compact ? 'pl-[30px]' : 'pl-[40px]'}`}>
                                    <span className={`text-brand-text-muted font-bold bg-[#f1f5f9] rounded-md ${compact ? 'text-[0.75rem] px-2 py-0.5' : 'text-[0.85rem] px-2.5 py-1'}`}>{item.selectedSize}</span>
                                    {isEditable && onUpdateQuantity ? (
                                        <QuantitySelector
                                            compact
                                            value={item.quantity}
                                            onChange={(delta) => onUpdateQuantity(item.id, item.selectedSize, delta)}
                                            min={0}
                                        />
                                    ) : (
                                        <span className="font-medium text-brand-text">Cant: {item.quantity}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 bg-[#f8fafc] rounded-2xl border border-dashed border-[#cbd5e1] text-center">
                        <ShoppingCart className="w-10 h-10 text-brand-text-muted/30 mb-4" />
                        <p className="text-brand-text-muted font-bold mb-4">No hay productos seleccionados.</p>
                        {isEditable && onAddProductsClick && (
                            <button
                                type="button"
                                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-[0.9rem] hover:bg-primary-dark transition-all border-none cursor-pointer"
                                onClick={onAddProductsClick}
                            >
                                Añadir Productos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Metrics */}
            {data.items.length > 0 && data.totalLiters > 0 && (
                <div className={`flex justify-between items-center bg-[#f1f5f9] text-brand-text rounded-xl border border-[#e2e8f0] ${compact ? 'p-2.5 mb-4' : 'p-4 mb-8'}`}>
                    {[
                        { val: `${data.totalLiters}L`, label: 'Volumen' },
                        { val: String(data.totalCocktails), label: 'Cócteles' },
                        { val: (data.totalCocktails / (data.guests || 1)).toFixed(1), label: 'x Persona' },
                    ]
                    .filter(m => !(m.label === 'x Persona' && (!data.guests || data.guests === 0)))
                    .map((m, i) => (
                        <div key={m.label} className={`text-center flex-1 ${i > 0 ? 'border-l border-[#cbd5e1]' : ''}`}>
                            <span className={`block font-black text-primary ${compact ? 'text-[1.05rem] sm:text-[1.15rem]' : 'text-[1.25rem]'}`}>{m.val}</span>
                            <span className={`uppercase font-bold text-[#64748b] tracking-wider ${compact ? 'text-[0.55rem] sm:text-[0.6rem]' : 'text-[0.65rem]'}`}>{m.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {!hideTotals && (
                <QuoteSummaryTotals
                    data={data}
                    isEditable={isEditable}
                    onChangeDispenser={onChangeDispenser}
                    compact={compact}
                    hasComuna={hasComuna}
                />
            )}
        </div>
    );
}
