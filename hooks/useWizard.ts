'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CocktailForWizard, Comuna, WizardState, WizardSelection } from '@/lib/types';
import { calculateSmartConfig, calculateSummaryData, buildWhatsAppMessage } from '@/lib/wizardLogic';

export { calculateSmartConfig };

const INITIAL_STATE: WizardState = {
    step: 1,
    eventData: {
        type: '',
        otherType: '',
        date: '',
        startTime: '',
        pickupDate: '',
        pickupTime: '',
    },
    consumption: {
        guests: 50,
        drinksPerPerson: 3,
    },
    contact: {
        firstName: '',
        email: '',
        phone: '',
        address: '',
        comuna: '',
        otherComuna: '',
        comments: '',
    },
    selections: [],
    dispenser: 'portatil',
    expandedCocktailId: null,
    expandedCategoryId: '',
};

export function useWizard(cocktails: CocktailForWizard[], comunas: Comuna[], categories: string[]) {
    const [state, setState] = useState<WizardState>(INITIAL_STATE);

    const initCategory = useCallback((cats: string[]) => {
        if (cats.length > 0) setState(prev => ({ ...prev, expandedCategoryId: prev.expandedCategoryId || cats[0] }));
    }, []);

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
            if (idx >= 0) {
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

    const updateDispenser = useCallback((id: 'portatil' | 'muro') => {
        setState((prev) => ({ ...prev, dispenser: id }));
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
            if (state.consumption.guests < 10) return { valid: false, message: 'La cantidad de invitados debe ser al menos 10.' };
        }
        if (step === 2) {
            const c = state.contact;
            if (!c.firstName.trim()) return { valid: false, message: 'El nombre completo es obligatorio.' };
            if (!c.comuna.trim()) return { valid: false, message: 'Selecciona la comuna.' };
            if (!c.email.trim()) return { valid: false, message: 'El email es obligatorio para enviarte el resumen de la cotización.' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
                return { valid: false, message: 'El formato del email no es válido.' };
            }
        }
        if (step === 4) {
            if (state.selections.length === 0) return { valid: false, message: 'Selecciona al menos un cóctel para continuar.' };
        }
        if (step === 5) {
            if (!state.dispenser) return { valid: false, message: 'Selecciona un sistema de dispensación.' };
        }
        return { valid: true };
    }

    // Delegate to pure business logic functions
    const calculateSummaryDataBound = useCallback(
        () => calculateSummaryData(state, cocktails, comunas),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state, cocktails, comunas]
    );

    function sendWhatsAppQuote(token?: string) {
        const data = calculateSummaryData(state, cocktails, comunas);
        const msg = buildWhatsAppMessage(state, data, token);
        const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '56929672978';
        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    return {
        state, updateEventData, updateConsumption, updateContact,
        updateQuantity, toggleCocktail, toggleCategory, goToStep, reset,
        validateStep, calculateSummaryData: calculateSummaryDataBound, calculateSmartConfig, sendWhatsAppQuote,
        initCategory, updateDispenser,
    };
}
