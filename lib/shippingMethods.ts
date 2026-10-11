// ==============================================================================
// OBJETIVO: Configuración unificada de métodos de envío para tienda virtual
// Soporta Transporte Propio (Directo y Eventos), Blue Express y Couriers personalizados.
// Maneja días hábiles, anticipación (lead time), fechas bloqueadas (blackout) y envío gratis.
// ==============================================================================

import { PROJECT_TIMEZONE } from './config';

export type ServiceScope = 'direct' | 'event' | 'both';

export interface ShippingMethodConfig {
    id: string; // 'own_direct' | 'own_events' | 'blue_express' | custom
    name: string;
    description: string;
    serviceType: ServiceScope;
    isActive: boolean;
    availableWeekdays: number[]; // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
    minOffsetDays: number; // Días mínimos de anticipación
    blockedDates: string[]; // Fechas bloqueadas en formato ISO 'YYYY-MM-DD'
    deliveryWindow?: string; // Ej: "Durante todo el día (09:00 a 20:00 hrs)"
    freeShippingEnabled?: boolean;
    freeShippingThresholdType?: 'amount' | 'liters';
    freeShippingThreshold?: number; // Monto en CLP o Litros
}

export interface ShippingMethodsSettings {
    own_direct: ShippingMethodConfig;
    own_events: ShippingMethodConfig;
    blue_express: ShippingMethodConfig;
    custom_methods: ShippingMethodConfig[];
}

export const SHIPPING_METHODS_SETTING_KEY = 'shipping_methods_config';

export const WEEKDAY_LABELS: Record<number, string> = {
    1: 'Lun',
    2: 'Mar',
    3: 'Mié',
    4: 'Jue',
    5: 'Vie',
    6: 'Sáb',
    0: 'Dom',
};

export const WEEKDAY_FULL_NAMES: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    0: 'Domingo',
};

export const DEFAULT_SHIPPING_METHODS: ShippingMethodsSettings = {
    own_direct: {
        id: 'own_direct',
        name: 'Transporte Propio (Barriles Desechables)',
        description: 'Entrega a domicilio para venta directa de barriles desechables en Santiago y comunas asignadas.',
        serviceType: 'direct',
        isActive: true,
        availableWeekdays: [1, 2, 3, 4, 5], // Lunes a Viernes
        minOffsetDays: 2,
        blockedDates: [],
        deliveryWindow: 'Durante todo el día (09:00 a 20:00 hrs)',
        freeShippingEnabled: false,
        freeShippingThresholdType: 'amount',
        freeShippingThreshold: 0,
    },
    own_events: {
        id: 'own_events',
        name: 'Transporte y Montaje (Eventos)',
        description: 'Logística, montaje y posterior retiro de dispensadores para eventos en Región Metropolitana.',
        serviceType: 'event',
        isActive: true,
        availableWeekdays: [0, 1, 2, 3, 4, 5, 6], // Lunes a Domingo
        minOffsetDays: 5,
        blockedDates: [],
        deliveryWindow: 'Coordinado según el horario de inicio y término del evento',
        freeShippingEnabled: true,
        freeShippingThresholdType: 'liters',
        freeShippingThreshold: 50,
    },
    blue_express: {
        id: 'blue_express',
        name: 'Blue Express (Courier Nacional)',
        description: 'Despacho a domicilio para regiones de Chile y comunas periféricas mediante encomienda.',
        serviceType: 'direct',
        isActive: true,
        availableWeekdays: [1, 2, 3, 4, 5], // Lunes a Viernes
        minOffsetDays: 1,
        blockedDates: [],
        deliveryWindow: 'Fecha en que entregamos tu pedido al courier Blue Express para su despacho a domicilio',
        freeShippingEnabled: false,
        freeShippingThresholdType: 'amount',
        freeShippingThreshold: 0,
    },
    custom_methods: [],
};

/**
 * Parsea y sanea el JSON proveniente de `site_settings`. Si falta algún campo o método, completa con el default.
 */
export function parseShippingMethodsConfig(raw: unknown): ShippingMethodsSettings {
    let parsed: any = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return JSON.parse(JSON.stringify(DEFAULT_SHIPPING_METHODS));
        }
    }

    if (!parsed || typeof parsed !== 'object') {
        return JSON.parse(JSON.stringify(DEFAULT_SHIPPING_METHODS));
    }

    const sanitizeMethod = (source: any, fallback: ShippingMethodConfig): ShippingMethodConfig => {
        if (!source || typeof source !== 'object') return { ...fallback };
        return {
            id: String(source.id || fallback.id),
            name: String(source.name || fallback.name),
            description: String(source.description || fallback.description),
            serviceType: source.serviceType === 'event' || source.serviceType === 'direct' || source.serviceType === 'both'
                ? source.serviceType
                : fallback.serviceType,
            isActive: source.isActive !== false,
            availableWeekdays: Array.isArray(source.availableWeekdays)
                ? source.availableWeekdays.filter((d: any) => typeof d === 'number' && d >= 0 && d <= 6)
                : fallback.availableWeekdays,
            minOffsetDays: typeof source.minOffsetDays === 'number' && source.minOffsetDays >= 0
                ? Math.round(source.minOffsetDays)
                : fallback.minOffsetDays,
            blockedDates: Array.isArray(source.blockedDates)
                ? source.blockedDates.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
                : [],
            deliveryWindow: typeof source.deliveryWindow === 'string' ? source.deliveryWindow : fallback.deliveryWindow,
            freeShippingEnabled: Boolean(source.freeShippingEnabled),
            freeShippingThresholdType: source.freeShippingThresholdType === 'amount' || source.freeShippingThresholdType === 'liters'
                ? source.freeShippingThresholdType
                : fallback.freeShippingThresholdType,
            freeShippingThreshold: typeof source.freeShippingThreshold === 'number' && source.freeShippingThreshold >= 0
                ? source.freeShippingThreshold
                : (fallback.freeShippingThreshold || 0),
        };
    };

    const customMethods: ShippingMethodConfig[] = Array.isArray(parsed.custom_methods)
        ? parsed.custom_methods.map((c: any) => ({
            id: String(c.id || `custom_${Date.now()}`),
            name: String(c.name || 'Courier Personalizado'),
            description: String(c.description || ''),
            serviceType: 'direct',
            isActive: c.isActive !== false,
            availableWeekdays: Array.isArray(c.availableWeekdays) ? c.availableWeekdays : [1, 2, 3, 4, 5],
            minOffsetDays: typeof c.minOffsetDays === 'number' ? c.minOffsetDays : 1,
            blockedDates: Array.isArray(c.blockedDates) ? c.blockedDates : [],
            deliveryWindow: typeof c.deliveryWindow === 'string' ? c.deliveryWindow : 'Entrega durante el día',
            freeShippingEnabled: Boolean(c.freeShippingEnabled),
            freeShippingThresholdType: c.freeShippingThresholdType === 'liters' ? 'liters' : 'amount',
            freeShippingThreshold: typeof c.freeShippingThreshold === 'number' ? c.freeShippingThreshold : 0,
        }))
        : [];

    return {
        own_direct: sanitizeMethod(parsed.own_direct, DEFAULT_SHIPPING_METHODS.own_direct),
        own_events: sanitizeMethod(parsed.own_events, DEFAULT_SHIPPING_METHODS.own_events),
        blue_express: sanitizeMethod(parsed.blue_express, DEFAULT_SHIPPING_METHODS.blue_express),
        custom_methods: customMethods,
    };
}

/**
 * Retorna la fecha mínima seleccionable para un método en formato 'YYYY-MM-DD' en hora Chile.
 */
export function getMinSelectableDate(methodConfig?: ShippingMethodConfig | null, fallbackOffsetDays = 2): string {
    const offset = methodConfig && typeof methodConfig.minOffsetDays === 'number'
        ? methodConfig.minOffsetDays
        : fallbackOffsetDays;

    const now = new Date();
    const chileTime = new Date(now.toLocaleString('en-US', { timeZone: PROJECT_TIMEZONE }));
    chileTime.setDate(chileTime.getDate() + offset);
    return chileTime.toISOString().split('T')[0];
}

/**
 * Valida si una fecha específica cae en un día de semana permitido por el método.
 */
export function isWeekdayAllowed(dateStr: string, methodConfig?: ShippingMethodConfig | null): boolean {
    if (!dateStr || !methodConfig || !Array.isArray(methodConfig.availableWeekdays) || methodConfig.availableWeekdays.length === 0) {
        return true;
    }
    const d = new Date(dateStr + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return false;
    const weekday = d.getDay();
    return methodConfig.availableWeekdays.includes(weekday);
}

/**
 * Valida si una fecha está en la lista de fechas bloqueadas del método.
 */
export function isDateBlocked(dateStr: string, methodConfig?: ShippingMethodConfig | null): boolean {
    if (!dateStr || !methodConfig || !Array.isArray(methodConfig.blockedDates)) {
        return false;
    }
    return methodConfig.blockedDates.includes(dateStr);
}

/**
 * Valida una fecha de despacho contra las reglas del método de envío.
 * Retorna null si es válida, o un mensaje de error legible para el cliente.
 */
export function validateShippingDate(
    dateStr: string,
    methodConfig?: ShippingMethodConfig | null,
    fallbackOffsetDays = 2
): string | null {
    if (!dateStr?.trim()) {
        return 'Indica la fecha de entrega.';
    }

    const minDate = getMinSelectableDate(methodConfig, fallbackOffsetDays);
    if (dateStr < minDate) {
        const offset = methodConfig?.minOffsetDays ?? fallbackOffsetDays;
        return `La fecha debe ser al menos ${offset} ${offset === 1 ? 'día' : 'días'} desde hoy.`;
    }

    if (methodConfig) {
        if (isDateBlocked(dateStr, methodConfig)) {
            return 'Esta fecha no tiene disponibilidad de despacho. Por favor selecciona otra fecha disponible.';
        }

        if (!isWeekdayAllowed(dateStr, methodConfig)) {
            const d = new Date(dateStr + 'T12:00:00');
            const dayName = Number.isNaN(d.getTime()) ? 'este día' : WEEKDAY_FULL_NAMES[d.getDay()] || 'este día';
            return `No realizamos entregas los días ${dayName}. Por favor selecciona otro día hábil.`;
        }
    }

    return null;
}

/**
 * Verifica si aplica envío gratis según la configuración del método, subtotal o litros totales.
 */
export function isFreeShippingApplicable(
    methodConfig: ShippingMethodConfig | undefined | null,
    subtotal: number,
    totalLiters: number
): boolean {
    if (!methodConfig || !methodConfig.freeShippingEnabled) {
        return false;
    }

    const threshold = methodConfig.freeShippingThreshold ?? 0;
    if (threshold <= 0) return false;

    if (methodConfig.freeShippingThresholdType === 'amount') {
        return subtotal >= threshold;
    }

    if (methodConfig.freeShippingThresholdType === 'liters') {
        return totalLiters >= threshold;
    }

    return false;
}
