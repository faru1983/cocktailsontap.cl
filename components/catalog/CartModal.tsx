'use client';

import type { CartItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { WhatsappIcon } from '@/components/shared/icons';


interface CartModalProps {
    items: CartItem[];
    isOpen: boolean;
    onClose: () => void;
    onUpdateQuantity: (productId: string, size: string, qty: number) => void;
    onRemove: (productId: string, size: string) => void;
    onShare?: () => void;
    ctaLabel?: string;
    onCtaClick?: () => void;
    getTotalPrice: () => number;
}

export default function CartModal({ items, isOpen, onClose, onUpdateQuantity, onRemove, onShare, ctaLabel, onCtaClick, getTotalPrice }: CartModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = getTotalPrice();
    const discount = subtotal - total;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-brand-text/50 backdrop-blur-[2px] cursor-pointer" onClick={onClose} />

            <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-2xl flex flex-col relative z-[251] max-h-[90vh] overflow-hidden animate-[slideUp_0.3s_ease]">
                <div className="p-5 flex justify-between items-center bg-[#f8fafc] border-b border-brand-border">
                    <h2 className="font-extrabold text-[1.25rem] text-brand-text m-0">Tu Selección</h2>
                    <button
                        className="w-8 h-8 rounded-full bg-white border border-brand-border flex items-center justify-center text-brand-text-muted cursor-pointer transition-colors hover:bg-[#ef4444] hover:text-white hover:border-[#ef4444]"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />

                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 bg-white">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[12rem] text-brand-text-muted gap-3 text-[1.1rem]">
                            <ShoppingCart className="text-4xl opacity-50" />
                            <p className="font-medium">Tu selección está vacía</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                {items.map((item) => {
                                    const itemTotal = item.offerPrice * item.quantity;
                                    const itemNormal = item.price * item.quantity;
                                    return (
                                        <div key={`${item.productId}_${item.size}`} className="bg-white p-4 rounded-xl border border-brand-border shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col gap-3 transition-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary/30">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <button
                                                        className="min-w-[28px] h-[28px] rounded-full bg-[#fee2e2] text-[#ef4444] border-none font-bold text-[0.9rem] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#ef4444] hover:text-white shrink-0 mt-0.5"
                                                        onClick={() => onRemove(item.productId, item.size)}
                                                    >
                                                        ✕
                                                    </button>
                                                    <span className="font-bold text-brand-text text-[1.05rem] leading-[1.2]">{item.productName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {item.price !== item.offerPrice && (
                                                        <span className="text-brand-text-muted text-[0.85rem] line-through opacity-70">{formatCurrency(itemNormal)}</span>
                                                    )}
                                                    <span className="font-extrabold text-[#059669] text-[1.1rem]">{formatCurrency(itemTotal)}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pl-[40px]">
                                                <span className="text-brand-text-muted text-[0.85rem] font-bold bg-[#f1f5f9] px-2.5 py-1 rounded-md">{item.size}</span>
                                                <div className="flex items-center gap-1 border border-brand-border rounded-lg p-0.5 bg-[#f8fafc]">
                                                    <button
                                                        type="button"
                                                        className="w-[28px] h-[28px] rounded-md bg-white border border-brand-border text-brand-text font-bold shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-primary hover:text-white hover:border-primary"
                                                        onClick={() => onUpdateQuantity(item.productId, item.size, item.quantity - 1)}
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        min={1}
                                                        className="w-8 text-center bg-transparent border-none text-brand-text font-bold text-[0.95rem] outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        onChange={(e) => onUpdateQuantity(item.productId, item.size, parseInt(e.target.value) || 1)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="w-[28px] h-[28px] rounded-md bg-white border border-brand-border text-brand-text font-bold shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-primary hover:text-white hover:border-primary"
                                                        onClick={() => onUpdateQuantity(item.productId, item.size, item.quantity + 1)}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-2 bg-[#f8fafc] p-5 rounded-xl border border-brand-border flex flex-col gap-2">
                                <div className="flex justify-between items-center font-bold text-brand-text-muted">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between items-center font-bold text-[#059669]">
                                        <span>Descuento:</span>
                                        <span>-{formatCurrency(discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center font-extrabold text-[1.2rem] text-brand-text pt-3 mt-1 border-t border-brand-border/50 uppercase">
                                    <span>Total:</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                                <p className="text-[0.75rem] text-brand-text-muted font-medium m-0 pt-1">
                                    Valores netos. No incluyen IVA.
                                </p>

                                {onCtaClick ? (
                                    <button
                                        className="w-full py-4 mt-4 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-2 text-[1.1rem] shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(226,160,73,0.4)] cursor-pointer border-none active:scale-[0.98]"
                                        onClick={onCtaClick}
                                    >
                                        {ctaLabel || 'Continuar'}
                                    </button>
                                ) : onShare ? (
                                    <button
                                        className="w-full py-3.5 mt-4 bg-gradient-to-r from-[#25d366] to-[#128c7e] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-[1.05rem] shadow-[0_4px_15px_rgba(37,211,102,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,211,102,0.3)] cursor-pointer border-none"
                                        onClick={onShare}
                                    >
                                        <WhatsappIcon className="w-5 h-5" /> Compartir
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
