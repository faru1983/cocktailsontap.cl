'use client';

import { useState, useCallback } from 'react';
import type { CartItem } from '@/lib/types';

import { formatCurrency } from '@/lib/utils';
import { getWhatsAppUrl } from '@/lib/wizardLogic';

function key(productId: string, size: string) {
    return `${productId}__${size}`;
}

export function useCart() {
    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = useCallback(
        (productId: string, productName: string, size: string, price: number, offerPrice: number, sizeValue: number, unitId: string | null, isDisposable: boolean) => {
            setItems((prev) => {
                const existing = prev.find((i) => i.productId === productId && i.size === size);
                if (existing) return prev.map((i) => (i.productId === productId && i.size === size ? { ...i, quantity: i.quantity + 1 } : i));
                return [...prev, { productId, productName, size, price, offerPrice, sizeValue, unitId, isDisposable, quantity: 1 }];
            });
        },
        []
    );

    const removeItem = useCallback((productId: string, size: string) => {
        setItems((prev) => prev.filter((i) => !(i.productId === productId && i.size === size)));
    }, []);

    const updateQuantity = useCallback((productId: string, size: string, quantity: number) => {
        if (quantity <= 0) {
            setItems((prev) => prev.filter((i) => !(i.productId === productId && i.size === size)));
        } else {
            setItems((prev) => prev.map((i) => (i.productId === productId && i.size === size ? { ...i, quantity } : i)));
        }
    }, []);

    const resetCart = useCallback(() => setItems([]), []);

    const getTotalItems = () => items.reduce((s, i) => s + i.quantity, 0);
    const getTotalPrice = () => items.reduce((s, i) => s + i.offerPrice * i.quantity, 0);

    const shareViaWhatsApp = useCallback(() => {
        if (items.length === 0) return;
        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const total = getTotalPrice();
        const discount = subtotal - total;

        let text = '*COTIZACIÓN*\n\n*PRODUCTOS:*\n';
        items.forEach((item) => {
            const hasOffer = item.price !== item.offerPrice;
            const itemTotal = item.offerPrice * item.quantity;
            const itemNormal = item.price * item.quantity;

            const priceText = hasOffer
                ? `~${formatCurrency(itemNormal)}~ *${formatCurrency(itemTotal)}*`
                : `*${formatCurrency(itemTotal)}*`;
            text += `- x${item.quantity} ${item.productName} (${item.size}): ${priceText}\n`;
        });

        text += `\nSubtotal: ${formatCurrency(subtotal)}`;
        if (discount > 0) text += `\nDescuento: -${formatCurrency(discount)}`;
        text += `\n*TOTAL: ${formatCurrency(total)}*`;
        text += `\n\n_Valores netos. No incluyen IVA._`;

        window.open(getWhatsAppUrl(text), '_blank');
    }, [items, getTotalPrice]);

    const cartQuantityByKey = new Map(items.map((i) => [key(i.productId, i.size), i.quantity]));
    const getQuantity = (productId: string, size: string) => cartQuantityByKey.get(key(productId, size)) ?? 0;

    return { items, addItem, removeItem, updateQuantity, resetCart, getTotalItems, getTotalPrice, getQuantity, shareViaWhatsApp };
}
