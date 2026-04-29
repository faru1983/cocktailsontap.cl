'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { CocktailForWizard, Comuna, WizardState, WizardSelection } from '@/lib/types';
import { calculateSmartConfig, calculateSummaryData, buildWhatsAppMessage } from '@/lib/wizardLogic';
import { WHATSAPP_NUMBER } from '@/lib/config';

export { calculateSmartConfig };

// No persistence key needed as we revert to start-over on refresh

const INITIAL_STATE: WizardState = {
    step: 1,
    serviceType: '',
    eventData: {
        type: '',
        otherType: '',
        date: '',
        startTime: '',
        pickupDate: '',
        pickupTime: '',
    },
    consumption: {
        guests: 0,
        drinksPerPerson: 3,
    },
    contact: {
        firstName: '',
        lastName: '',
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

export function useWizard(cocktails: CocktailForWizard[], comunas: Comuna[], categories: string[], initialServiceType: '' | 'event' | 'direct' = '') {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Obtener el paso inicial de la URL si existe, de lo contrario usar 1
    const urlStep = useMemo(() => {
        const step = parseInt(searchParams.get('step') || '1', 10);
        return isNaN(step) ? 1 : step;
    }, [searchParams]);

    const [state, setState] = useState<WizardState>({
        ...INITIAL_STATE,
        serviceType: initialServiceType,
        step: urlStep
    });

    // Seguridad: Si se refresca la página en un paso > 1, pero no hay datos (estado inicial), volver al paso 1
    useEffect(() => {
        if (state.step > 1) {
            const hasDate = state.eventData.date.trim() !== '';
            const isMissingCriticalData = state.serviceType === 'event' 
                ? (!hasDate || state.consumption.guests === 0)
                : !hasDate;

            if (isMissingCriticalData) {
                // Forzar redirección al paso 1
                const params = new URLSearchParams(searchParams.toString());
                params.set('step', '1');
                router.replace(`${pathname}?${params.toString()}`);
                setState(prev => ({ ...prev, step: 1 }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo al montar

    // Sincronizar el estado interno si la URL cambia (ej: botón Atrás del navegador)
    useEffect(() => {
        if (urlStep !== state.step) {
            setState(prev => ({ ...prev, step: urlStep }));
        }
    }, [urlStep, state.step]);

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

    const updateServiceType = useCallback((type: 'event' | 'direct') => {
        setState((prev) => ({ 
            ...prev,
            ...INITIAL_STATE,
            serviceType: type, 
            dispenser: 'portatil',
            step: 1
        }));
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', '1');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [searchParams, router, pathname]);

    const updateDispenser = useCallback((id: 'portatil' | 'muro' | 'desechable') => {
        setState((prev) => ({ ...prev, dispenser: id }));
    }, []);

    const goToStep = useCallback((step: number) => {
        setState((prev) => ({ ...prev, step }));
        
        // Actualizar URL
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', step.toString());
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [searchParams, router, pathname]);

    const reset = useCallback(() => {
        setState({ ...INITIAL_STATE, serviceType: initialServiceType, dispenser: 'portatil', expandedCategoryId: categories[0] || '' });
        router.push(pathname); // Limpiar query params
    }, [categories, initialServiceType, router, pathname]);

    function validateStep(step: number): { valid: boolean; message?: string } {
        if (step === 0) {
            if (!state.serviceType) return { valid: false, message: 'Selecciona una modalidad para continuar.' };
        }
        if (step === 1) {
            const e = state.eventData;
            if (state.serviceType === 'event') {
                if (!e.type.trim()) return { valid: false, message: 'Selecciona la temática del evento.' };
                if (e.type === 'Otro' && !e.otherType.trim()) return { valid: false, message: 'Especifica la temática del evento.' };
                if (state.consumption.guests < 1) return { valid: false, message: 'La cantidad de invitados debe ser al menos 1.' };
            }
            if (!e.date.trim()) return { valid: false, message: state.serviceType === 'direct' ? 'Indica la fecha de entrega.' : 'Indica la fecha del evento.' };
        }
        if (step === 5) {
            const c = state.contact;
            if (!c.firstName.trim()) return { valid: false, message: 'El nombre es obligatorio.' };
            if (!c.lastName.trim()) return { valid: false, message: 'El apellido es obligatorio.' };
            if (!c.email.trim()) return { valid: false, message: 'El email es obligatorio para enviarte el resumen de la cotización.' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
                return { valid: false, message: 'El formato del email no es válido.' };
            }
            if (!c.phone.trim() || c.phone === '+569') return { valid: false, message: 'El celular es obligatorio para contactarte.' };
            if (!c.comuna.trim()) return { valid: false, message: 'Selecciona la comuna.' };
        }
        if (step === 3) {
            // Contamos cuántos productos "principales" (que no sean de la categoría Otros) hay en total
            const mainProductsCount = state.selections.reduce((sum, sel) => {
                const product = cocktails.find(p => p.id === sel.id);
                if (product && product.category !== 'Otros') {
                    return sum + sel.quantity;
                }
                return sum;
            }, 0);

            if (mainProductsCount < 2) {
                return { 
                    valid: false, 
                    message: 'El pedido mínimo es de 2 barriles para contratar nuestros servicios.' 
                };
            }
        }
        if (step === 4) {
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
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    return {
        state, updateEventData, updateConsumption, updateContact,
        updateQuantity, toggleCocktail, toggleCategory, goToStep, reset,
        validateStep, calculateSummaryData: calculateSummaryDataBound, calculateSmartConfig, sendWhatsAppQuote,
        initCategory, updateDispenser, updateServiceType
    };
}
