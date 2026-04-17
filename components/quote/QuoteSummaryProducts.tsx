'use client';

import { ShoppingCart, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import QuantitySelector from '@/components/ui/QuantitySelector';

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
    onToggleDispenser?: () => void;
}

export default function QuoteSummaryProducts({ data, isEditable = false, onUpdateQuantity, onAddProductsClick, onToggleDispenser }: Props) {
    const isDesechable = data.dispenserLabel.toLowerCase().includes('desechable');
    const isMuro = data.dispenserLabel.toLowerCase().includes('muro');
    
    // Solo permitimos el toggle si es editable, hay una función de toggle y 
    // actualmente es muro O cumple los requisitos para ser muro.
    // Prohibimos toggle si es 'Barril Desechable' (opción solo admin)
    const canToggle = isEditable && onToggleDispenser && !isDesechable && (isMuro || data.canHaveMuro);

    return (
        <div className="bg-white rounded-[20px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.07)] border border-brand-border mb-6">
            {/* Products */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-5 border-b border-brand-border pb-2 gap-2">
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
                            <div key={`${item.id}_${item.selectedSize}`} className="bg-white p-4 rounded-xl border border-brand-border shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col gap-3 transition-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary/30">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {isEditable && onUpdateQuantity && (
                                            <button
                                                type="button"
                                                className="min-w-[28px] h-[28px] rounded-full bg-[#fee2e2] text-[#ef4444] border-none font-bold text-[0.9rem] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#ef4444] hover:text-white shrink-0 mt-0.5"
                                                onClick={() => onUpdateQuantity(item.id, item.selectedSize, -item.quantity)}
                                            >
                                                ✕
                                            </button>
                                        )}
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
                <div className="flex justify-between items-center bg-[#f1f5f9] text-brand-text p-4 rounded-xl mb-8 border border-[#e2e8f0]">
                    {[
                        { val: `${data.totalLiters}L`, label: 'Volumen' },
                        { val: String(data.totalCocktails), label: 'Cócteles' },
                        { val: (data.totalCocktails / (data.guests || 1)).toFixed(1), label: 'x Persona' },
                    ]
                    .filter(m => !(m.label === 'x Persona' && (!data.guests || data.guests === 0)))
                    .map((m, i) => (
                        <div key={m.label} className={`text-center flex-1 ${i > 0 ? 'border-l border-[#cbd5e1]' : ''}`}>
                            <span className="block text-[1.25rem] font-black text-primary">{m.val}</span>
                            <span className="text-[0.65rem] uppercase font-bold text-[#64748b] tracking-wider">{m.label}</span>
                        </div>
                    ))}
                </div>
            )}

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
                {data.manualDiscount > 0 && (
                    <div className="flex justify-between py-1 text-[0.95rem] font-bold text-[#f87171]">
                        <span>Descuento Extra</span>
                        <span>-{formatCurrency(data.manualDiscount)}</span>
                    </div>
                )}
                {data.shippingLabel && (
                    <div className="flex justify-between py-1 text-[0.95rem] font-medium text-brand-text-muted">
                        <span>Transporte</span>
                        <span className={`font-bold ${data.shippingCost === 0 ? 'text-primary' : 'text-brand-text'}`}>{data.shippingLabel}</span>
                    </div>
                )}
                {!isDesechable && (
                    <div 
                        className={`flex justify-between py-2 px-3 -mx-3 rounded-xl transition-all ${
                            canToggle 
                            ? 'cursor-pointer hover:bg-primary/5 active:scale-[0.98] border border-transparent hover:border-primary/20' 
                            : 'text-brand-text-muted font-medium'
                        }`}
                        onClick={() => canToggle && onToggleDispenser?.()}
                        title={canToggle ? 'Click para cambiar tipo de dispensador' : ''}
                    >
                        <div className="flex flex-col">
                            <span className={`text-[0.95rem] ${canToggle ? 'font-black text-brand-text' : ''}`}>{data.dispenserLabel}</span>
                            {canToggle && (
                                <span className="text-[0.6rem] text-primary font-bold uppercase tracking-wider">
                                    Click para cambiar a {isMuro ? 'Dispensador Portátil' : 'Muro de Coctelería'}
                                </span>
                            )}
                        </div>
                        <span className={`text-[0.95rem] font-bold ${data.installationCost === 0 ? 'text-primary' : 'text-brand-text'}`}>
                            {data.installationCost === 0 ? '¡Gratis!' : formatCurrency(data.installationCost)}
                        </span>
                    </div>
                )}
                <div className="flex justify-between pt-4 mt-2 border-t-2 border-primary items-center">
                    <span className="font-black text-brand-text text-[1rem]">TOTAL</span>
                    <span className="text-2xl font-black text-primary">{formatCurrency(data.totalPrice)}</span>
                </div>
            </div>
        </div>
    );
}
