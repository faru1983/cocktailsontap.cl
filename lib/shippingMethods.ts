// ==============================================================================
// OBJETIVO: Configuración unificada de métodos de envío para tienda virtual
// Soporta Transporte Propio (Directo y Eventos) y Blue Express.
// Maneja días hábiles o corridos, anticipación (lead time), hora de corte,
// fechas bloqueadas (blackout) y envío gratis.
// ==============================================================================

import {
    calculateOffsetReadyDate,
    findNextAllowedDate,
    formatDateYMD,
    formatShortDateCL,
    parseCutoffMinutes,
    type OffsetDaysMode,
} from './businessDays';

export type { OffsetDaysMode };
export type ServiceScope = 'direct' | 'event' | 'both';

export interface ShippingMethodConfig {
    id: string; // 'own_direct' | 'own_events' | 'blue_express'
    name: string;
    description: string;
    serviceType: ServiceScope;
    isActive: boolean;
    availableWeekdays: number[]; // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
    offsetMode: OffsetDaysMode; // 'business' (Lun–Vie) | 'calendar' (Lun–Dom)
    minOffsetDays: number; // Cantidad de días mínimos de anticipación (desde 0)
    cutoffEnabled?: boolean; // Si está activo, compras desde cutoffTime cuentan desde el día siguiente
    cutoffTime?: string; // Formato 'HH:MM' en hora Chile (ej: '18:00')
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
    /** Conservado solo por retrocompatibilidad de lectura JSON; ya no se usa en la UI. */
    custom_methods?: ShippingMethodConfig[];
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
        offsetMode: 'business',
        minOffsetDays: 2,
        cutoffEnabled: false,
        cutoffTime: '18:00',
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
        offsetMode: 'calendar',
        minOffsetDays: 2,
        cutoffEnabled: false,
        cutoffTime: '18:00',
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
        offsetMode: 'business',
        minOffsetDays: 2,
        cutoffEnabled: false,
        cutoffTime: '18:00',
        blockedDates: [],
        deliveryWindow: 'Entrega a domicilio coordinada por Blue Express tras el despacho',
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
        const rawCutoff = typeof source.cutoffTime === 'string' ? source.cutoffTime.trim() : '';
        const validCutoff = parseCutoffMinutes(rawCutoff) !== null ? rawCutoff : (fallback.cutoffTime || '18:00');
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
            offsetMode: source.offsetMode === 'business' || source.offsetMode === 'calendar'
                ? source.offsetMode
                : fallback.offsetMode,
            minOffsetDays: typeof source.minOffsetDays === 'number' && Number.isFinite(source.minOffsetDays) && source.minOffsetDays >= 0
                ? Math.round(source.minOffsetDays)
                : fallback.minOffsetDays,
            cutoffEnabled: Boolean(source.cutoffEnabled),
            cutoffTime: validCutoff,
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

    return {
        own_direct: sanitizeMethod(parsed.own_direct, DEFAULT_SHIPPING_METHODS.own_direct),
        own_events: sanitizeMethod(parsed.own_events, DEFAULT_SHIPPING_METHODS.own_events),
        blue_express: sanitizeMethod(parsed.blue_express, DEFAULT_SHIPPING_METHODS.blue_express),
        custom_methods: [],
    };
}

/**
 * Resuelve la modalidad efectiva ('business' | 'calendar') de un método.
 */
export function resolveOffsetMode(
    methodConfig?: ShippingMethodConfig | null,
    fallbackMode: OffsetDaysMode = 'business'
): OffsetDaysMode {
    if (methodConfig?.offsetMode === 'calendar' || methodConfig?.offsetMode === 'business') {
        return methodConfig.offsetMode;
    }
    if (methodConfig?.serviceType === 'event' || methodConfig?.id === 'own_events') {
        return 'calendar';
    }
    return fallbackMode;
}

/**
 * Formatea la unidad legible según cantidad y modalidad ('día hábil' / 'días hábiles' / 'día corrido' / 'días corridos').
 */
export function formatOffsetUnit(days: number, mode: OffsetDaysMode): string {
    if (mode === 'calendar') {
        return days === 1 ? 'día corrido' : 'días corridos';
    }
    return days === 1 ? 'día hábil' : 'días hábiles';
}

/**
 * Texto corto para ayudas al cliente (ej: "2 días corridos" o "1 día hábil").
 */
export function formatOffsetShortLabel(
    methodConfig?: ShippingMethodConfig | null,
    fallbackOffsetDays = 2,
    fallbackMode: OffsetDaysMode = 'business'
): string {
    const offset = methodConfig && typeof methodConfig.minOffsetDays === 'number'
        ? methodConfig.minOffsetDays
        : fallbackOffsetDays;
    const mode = resolveOffsetMode(methodConfig, fallbackMode);
    return `${offset} ${formatOffsetUnit(offset, mode)}`;
}

/**
 * Retorna la fecha mínima seleccionable para un método en formato 'YYYY-MM-DD' en hora Chile,
 * respetando si cuenta en días hábiles o corridos y la hora de corte opcional.
 */
export function getMinSelectableDate(
    methodConfig?: ShippingMethodConfig | null,
    fallbackOffsetDays = 2,
    now?: Date
): string {
    const offset = methodConfig && typeof methodConfig.minOffsetDays === 'number'
        ? methodConfig.minOffsetDays
        : fallbackOffsetDays;
    const offsetMode = resolveOffsetMode(methodConfig);

    const minDateObj = calculateOffsetReadyDate({
        baseDate: now ?? null,
        offsetDays: offset,
        offsetMode,
        cutoffEnabled: Boolean(methodConfig?.cutoffEnabled),
        cutoffTime: methodConfig?.cutoffTime,
    });
    return formatDateYMD(minDateObj);
}

/**
 * Retorna la primera fecha efectivamente disponible considerando anticipación,
 * hora de corte, días de la semana habilitados y fechas bloqueadas.
 */
export function getFirstAvailableDate(
    methodConfig?: ShippingMethodConfig | null,
    fallbackOffsetDays = 2,
    now?: Date
): string {
    const minDate = getMinSelectableDate(methodConfig, fallbackOffsetDays, now);
    const firstAllowed = findNextAllowedDate(
        minDate,
        methodConfig?.availableWeekdays,
        methodConfig?.blockedDates
    );
    return formatDateYMD(firstAllowed);
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
 * Valida una fecha de despacho/evento contra las reglas del método de envío.
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
        const offset = methodConfig && typeof methodConfig.minOffsetDays === 'number'
            ? methodConfig.minOffsetDays
            : fallbackOffsetDays;
        const mode = resolveOffsetMode(methodConfig);
        if (offset <= 0) {
            return `La fecha seleccionada ya no está disponible. Puedes agendar desde el ${formatShortDateCL(minDate)}.`;
        }
        return `La fecha debe considerar al menos ${offset} ${formatOffsetUnit(offset, mode)} de anticipación (disponible desde el ${formatShortDateCL(minDate)}).`;
    }

    if (methodConfig) {
        if (isDateBlocked(dateStr, methodConfig)) {
            return 'Esta fecha no tiene disponibilidad. Por favor selecciona otra fecha disponible.';
        }

        if (!isWeekdayAllowed(dateStr, methodConfig)) {
            const d = new Date(dateStr + 'T12:00:00');
            const dayName = Number.isNaN(d.getTime()) ? 'este día' : WEEKDAY_FULL_NAMES[d.getDay()] || 'este día';
            return `No realizamos entregas los días ${dayName}. Por favor selecciona otro día disponible.`;
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
