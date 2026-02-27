'use client';

import { useState, useCallback } from 'react';
import type { WizardState, WizardSelection, CocktailForWizard, Comuna } from '@/lib/types';

import { formatCurrency } from '@/lib/utils';

export function getSizeLiters(sizeLabel: string): number {
    return parseInt(sizeLabel, 10) || 0;
}

export function calculateSmartConfig(neededDrinks: number) {
    let liters = 0;
    let config = '';
    if (neededDrinks <= 25) { liters = 5; config = '1 Variedad de 5L'; }
    else if (neededDrinks <= 50) { liters = 10; config = '2 Variedades de 5L'; }
    else if (neededDrinks <= 75) { liters = 15; config = '3 Variedades de 5L'; }
    else if (neededDrinks <= 100) { liters = 20; config = '2 Variedades de 10L'; }
    else if (neededDrinks <= 150) { liters = 30; config = '3 Variedades de 10L'; }
    else if (neededDrinks <= 200) { liters = 40; config = '2 Variedades de 20L'; }
    else if (neededDrinks <= 300) { liters = 60; config = '3 Variedades de 20L'; }
    else if (neededDrinks <= 450) { liters = 90; config = '3 Variedades de 30L'; }
    else {
        const extraLiters = Math.ceil(neededDrinks / 150) * 30;
        liters = extraLiters;
        config = `${Math.ceil(extraLiters / 30)} Variedades de 30L`;
    }
    return { liters, config, totalDrinks: liters * 5 };
}

export function formatEventDate(dateStr: string): string {
    if (!dateStr) return 'Fecha por confirmar';
    try {
        const [year, month, day] = dateStr.split('-');
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
}

const INITIAL_STATE: WizardState = {
    step: 1,
    eventData: { type: '', otherType: '', date: '', comuna: '', otherComuna: '' },
    consumption: { guests: 50, drinksPerPerson: 3 },
    contact: { fullName: '', comments: '' },
    selections: [],
    expandedCocktailId: null,
    expandedCategoryId: '',
};

export function useWizard(cocktails: CocktailForWizard[], comunas: Comuna[], categories: string[]) {
    const [state, setState] = useState<WizardState>(() => ({
        ...INITIAL_STATE,
        expandedCategoryId: categories[0] ?? '',
    }));

    // Keep expandedCategoryId in sync when categories first load
    const initCategory = useCallback((cats: string[]) => {
        if (cats.length > 0 && state.expandedCategoryId === '') {
            setState((prev) => ({ ...prev, expandedCategoryId: cats[0] }));
        }
    }, [state.expandedCategoryId]);

    const updateEventData = useCallback((key: keyof WizardState['eventData'], value: string) => {
        setState((prev) => ({ ...prev, eventData: { ...prev.eventData, [key]: value } }));
    }, []);

    const updateConsumption = useCallback((key: keyof WizardState['consumption'], value: number) => {
        setState((prev) => ({ ...prev, consumption: { ...prev.consumption, [key]: value } }));
    }, []);

    const updateContact = useCallback((key: keyof WizardState['contact'], value: string) => {
        setState((prev) => ({ ...prev, contact: { ...prev.contact, [key]: value } }));
    }, []);

    const updateQuantity = useCallback((id: string, size: string, delta: number) => {
        setState((prev) => {
            const idx = prev.selections.findIndex((s) => s.id === id && s.size === size);
            let next: WizardSelection[];
            if (idx > -1) {
                next = [...prev.selections];
                next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
                if (next[idx].quantity <= 0) next.splice(idx, 1);
            } else if (delta > 0) {
                next = [...prev.selections, { id, size, quantity: 1 }];
            } else {
                next = prev.selections;
            }
            return { ...prev, selections: next };
        });
    }, []);

    const toggleCocktail = useCallback((id: string) => {
        setState((prev) => ({ ...prev, expandedCocktailId: prev.expandedCocktailId === id ? null : id }));
    }, []);

    const toggleCategory = useCallback((id: string) => {
        setState((prev) => ({ ...prev, expandedCategoryId: prev.expandedCategoryId === id ? '' : id }));
    }, []);

    const goToStep = useCallback((step: number) => {
        setState((prev) => ({ ...prev, step }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const reset = useCallback(() => setState({ ...INITIAL_STATE, expandedCategoryId: categories[0] ?? '' }), [categories]);

    function validateStep(step: number): { valid: boolean; message?: string } {
        if (step === 1) {
            const e = state.eventData;
            if (!e.type.trim()) return { valid: false, message: 'Selecciona la temática del evento.' };
            if (e.type === 'Otro' && !e.otherType.trim()) return { valid: false, message: 'Especifica la temática del evento.' };
            if (!e.date.trim()) return { valid: false, message: 'Indica la fecha del evento.' };
            if (!e.comuna.trim()) return { valid: false, message: 'Selecciona la comuna.' };
            if (e.comuna === 'Otra' && !e.otherComuna.trim()) return { valid: false, message: 'Especifica tu comuna.' };
        }
        if (step === 2) {
            if (state.consumption.guests < 10) return { valid: false, message: 'La cantidad de invitados debe ser al menos 10.' };
        }
        if (step === 4) {
            if (state.selections.length === 0) return { valid: false, message: 'Selecciona al menos un cóctel para continuar.' };
        }
        if (step === 5) {
            if ((state.contact.fullName ?? '').trim().length < 3) return { valid: false, message: 'El nombre completo es obligatorio (mínimo 3 caracteres).' };
        }
        return { valid: true };
    }

    function calculateSummaryData() {
        const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));
        const comunasByName = new Map(comunas.map((c) => [c.name, c]));
        let totalNormalPrice = 0;
        let totalOfferPrice = 0;
        let totalLiters = 0;

        const items = state.selections.map((s) => {
            const cocktail = cocktailsById.get(s.id);
            const priceData = cocktail?.prices[s.size] ?? { price: 0, offerPrice: 0 };
            const itemNormal = priceData.price * s.quantity;
            const itemOffer = priceData.offerPrice * s.quantity;
            totalNormalPrice += itemNormal;
            totalOfferPrice += itemOffer;
            totalLiters += getSizeLiters(s.size) * s.quantity;
            return { ...cocktail!, selectedSize: s.size, quantity: s.quantity, totalNormalPrice: itemNormal, totalOfferPrice: itemOffer };
        });

        const selectedComuna = comunasByName.get(state.eventData.comuna);
        let shippingCost = 0;
        let shippingLabel = 'Por calcular';
        if (selectedComuna && state.eventData.comuna !== 'Otra') {
            const isFree = selectedComuna.freeFrom !== null && totalLiters >= selectedComuna.freeFrom;
            shippingCost = isFree ? 0 : (selectedComuna.cost ?? 0);
            shippingLabel = shippingCost === 0 ? '¡Gratis!' : formatCurrency(shippingCost);
        } else if (state.eventData.comuna === 'Otra') {
            shippingLabel = 'Pendiente de factibilidad';
        }

        const eventTypeDisplay = state.eventData.type === 'Otro' ? state.eventData.otherType : state.eventData.type;
        const comunaDisplay = state.eventData.comuna === 'Otra' ? state.eventData.otherComuna : (state.eventData.comuna || 'No especificada');

        return {
            items, totalNormalPrice, totalOfferPrice,
            totalDiscount: totalNormalPrice - totalOfferPrice,
            totalLiters, shippingCost, shippingLabel,
            totalPrice: totalOfferPrice + (shippingCost || 0),
            eventTypeDisplay, comunaDisplay,
            formattedDate: formatEventDate(state.eventData.date),
        };
    }

    function sendWhatsAppQuote() {
        const data = calculateSummaryData();
        const guests = Math.max(state.consumption.guests, 1);
        const totalDrinks = data.totalLiters * 5;
        const avgDrinks = (totalDrinks / guests).toFixed(1);
        const N = new Intl.NumberFormat('es-CL');

        const itemsText = data.items.map((s) => {
            const hasOffer = s.totalNormalPrice > s.totalOfferPrice;
            return `- x${s.quantity} ${s.name} (${s.selectedSize}): ${hasOffer ? `~$${N.format(s.totalNormalPrice)}~ ` : ''}*$${N.format(s.totalOfferPrice)}*`;
        }).join('\n');

        let msg = `*COTIZACIÓN DE EVENTO*\n\n`;
        msg += `*Nombre*: ${state.contact.fullName}\n`;
        msg += `*Fecha*: ${data.formattedDate}\n`;
        msg += `*Temática*: ${data.eventTypeDisplay}\n`;
        msg += `*Invitados*: ${guests} pers.\n`;
        msg += `*Comuna*: ${data.comunaDisplay}\n`;
        if (state.contact.comments) msg += `*Comentarios*: ${state.contact.comments}\n`;
        msg += `\n*PRODUCTOS*:\n${itemsText}\n\n`;
        msg += `Subtotal: ${formatCurrency(data.totalNormalPrice)}\n`;
        if (data.totalDiscount > 0) msg += `Descuento: -${formatCurrency(data.totalDiscount)}\n`;
        msg += `Traslados: ${data.shippingLabel}\n`;
        msg += `*TOTAL: ${formatCurrency(data.totalPrice)}*\n\n`;
        msg += `*Notas*:\n`;
        msg += `_Estas cotizando *${data.totalLiters}L* con rendimiento total aprox. de *${totalDrinks} cócteles.*_\n`;
        msg += `_Para *${guests} invitados* tienes en promedio de *${avgDrinks} cócteles x pers.*_`;

        window.open(`https://wa.me/56929672978?text=${encodeURIComponent(msg)}`, '_blank');
    }

    return {
        state, updateEventData, updateConsumption, updateContact,
        updateQuantity, toggleCocktail, toggleCategory, goToStep, reset,
        validateStep, calculateSummaryData, calculateSmartConfig, sendWhatsAppQuote,
        initCategory,
    };
}
