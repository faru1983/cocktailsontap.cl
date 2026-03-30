'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Product, ICart } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import QuantitySelector from '@/components/ui/QuantitySelector';

interface ProductCardProps {
    product: Product;
    cart: ICart;
}

export default function ProductCard({ product, cart }: ProductCardProps) {
    const [selectedSize, setSelectedSize] = useState(product.selectedSize || product.sizes[0]?.size || '');

    const sizeInfo = product.sizes.find((s) => s.size === selectedSize) ?? product.sizes[0];
    if (!sizeInfo) return null;

    const hasOffer = sizeInfo.offerPrice < sizeInfo.price;
    const quantity = cart.getQuantity(product.id, selectedSize);

    const handleSizeChange = (newSize: string) => {
        setSelectedSize(newSize);
    };

    return (
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-brand-border h-full group hover:-translate-y-1 hover:shadow-[0_12px_25px_rgba(0,0,0,0.1)]">
            <div className="aspect-square overflow-hidden bg-[#f8fafc] relative">
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-110"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
            </div>
            <div className="px-5 py-6 flex flex-col flex-1">
                <h3 className="text-[1.2rem] font-bold text-brand-text leading-[1.3] mb-1.5">{product.name}</h3>
                <p className="text-brand-text-muted text-[0.85rem] leading-[1.5] mb-4 flex-1">{product.description}</p>

                <select
                    className="w-full p-3 rounded-xl border border-brand-border bg-white text-[0.9rem] font-medium text-brand-text mb-5 outline-none transition-colors duration-200 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%231e293b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-1rem)_center] pr-10 hover:border-primary focus:border-primary focus:ring-1 focus:ring-primary"
                    value={selectedSize}
                    onChange={(e) => handleSizeChange(e.target.value)}
                >
                    {product.sizes.map((s) => (
                        <option key={s.size} value={s.size}>{s.size}</option>
                    ))}
                </select>

                <div className="flex flex-row items-baseline justify-center gap-2 font-extrabold text-[#059669] text-[1.3rem] min-h-[2rem] mb-4 leading-none">
                    {quantity > 0 ? (
                        <>
                            <span>{formatCurrency(sizeInfo.offerPrice * quantity)}</span>
                            {hasOffer && (
                                <span className="text-[0.85rem] text-brand-text-muted font-normal line-through opacity-60">
                                    {formatCurrency(sizeInfo.price * quantity)}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <span>{formatCurrency(sizeInfo.offerPrice)}</span>
                            {hasOffer && (
                                <span className="text-[0.85rem] text-brand-text-muted font-normal line-through opacity-60">
                                    {formatCurrency(sizeInfo.price)}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {quantity === 0 ? (
                    <button
                        type="button"
                        className="w-full p-[0.85rem] rounded-xl font-bold text-[1rem] bg-brand-text text-white transition-all duration-300 hover:bg-primary hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(226,160,73,0.3)]"
                        onClick={() => cart.addItem(product.id, product.name, selectedSize, sizeInfo.price, sizeInfo.offerPrice)}
                    >
                        Agregar
                    </button>
                ) : (
                    <div className="flex w-full items-center justify-center bg-white">
                        <QuantitySelector
                            value={quantity}
                            onChange={(delta) => cart.updateQuantity(product.id, selectedSize, quantity + delta)}
                            min={1}
                            className="w-full max-w-[180px] h-full"
                            compact={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
