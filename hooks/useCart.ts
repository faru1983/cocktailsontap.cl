'use client';

import { useState, useCallback } from 'react';
import type { CartItem } from '@/lib/types';

import { formatCurrency } from '@/lib/utils';

function key(productId: string, size: string) {
    return `${productId}__${size}`;
}

export function useCart() {
    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = useCallback(
        (productId: string, productName: string, size: string, price: number, offerPrice: number) => {
            setItems((prev) => {
                const existing = prev.find((i) => i.productId === productId && i.size === size);
                if (existing) return prev.map((i) => (i.productId === productId && i.size === size ? { ...i, quantity: i.quantity + 1 } : i));
                return [...prev, { productId, productName, size, price, offerPrice, quantity: 1 }];
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
        let text = '*COTIZACIÓN DESDE CATÁLOGO*\n\n*PRODUCTOS SELECCIONADOS:*\n';
        items.forEach((item) => {
            const hasOffer = item.price !== item.offerPrice;
            const priceText = hasOffer
                ? `~$${new Intl.NumberFormat('es-CL').format(item.price)}~ *$${new Intl.NumberFormat('es-CL').format(item.offerPrice)}*`
                : `*$${new Intl.NumberFormat('es-CL').format(item.offerPrice)}*`;
            text += `- x${item.quantity} ${item.productName} (${item.size}): ${priceText}\n`;
        });
        text += `\n*TOTAL ESTIMADO: $${new Intl.NumberFormat('es-CL').format(getTotalPrice())}*`;
        window.open(`https://wa.me/56929672978?text=${encodeURIComponent(text)}`, '_blank');
    }, [items]);

    const cartQuantityByKey = new Map(items.map((i) => [key(i.productId, i.size), i.quantity]));
    const getQuantity = (productId: string, size: string) => cartQuantityByKey.get(key(productId, size)) ?? 0;

    return { items, addItem, removeItem, updateQuantity, resetCart, getTotalItems, getTotalPrice, getQuantity, shareViaWhatsApp };
}
