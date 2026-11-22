export interface EventCapacityConfig {
    portableDispensers: number;
    muroDispensers: number;
}

export const EVENT_CAPACITY_SETTING_KEY = 'event_capacity_config';

export const DEFAULT_EVENT_CAPACITY: EventCapacityConfig = {
    portableDispensers: 10,
    muroDispensers: 1,
};

export const ACTIVE_CAPACITY_STATUSES = ['confirmed', 'in_delivery', 'completed'] as const;

export interface DayCapacitySummary {
    date: string;
    portableUsed: number;
    portableTotal: number;
    portableAvailable: number;
    maxPortableKegsAvailable: number;
    muroUsed: number;
    muroTotal: number;
    muroAvailable: number;
    eventsCount: number;
}

export interface CapacityEvaluation {
    available: boolean;
    reason?: string;
    requiredPortable: number;
    requiredMuro: number;
}

function clampNonNegativeInt(val: unknown, fallback: number): number {
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

export function parseEventCapacityConfig(raw?: string | null): EventCapacityConfig {
    if (!raw) return { ...DEFAULT_EVENT_CAPACITY };
    try {
        const parsed = JSON.parse(raw);
        return {
            portableDispensers: clampNonNegativeInt(parsed?.portableDispensers, DEFAULT_EVENT_CAPACITY.portableDispensers),
            muroDispensers: clampNonNegativeInt(parsed?.muroDispensers, DEFAULT_EVENT_CAPACITY.muroDispensers),
        };
    } catch {
        return { ...DEFAULT_EVENT_CAPACITY };
    }
}

/**
 * Cuenta los barriles compatibles con Dispensador Portátil (5L o 10L).
 */
export function countPortableKegs(
    items: Array<{ size?: string | null; quantity?: number | null }> | null | undefined,
): number {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let total = 0;
    for (const item of items) {
        const size = String(item?.size ?? '').trim().toUpperCase();
        if (size === '5L' || size === '10L') {
            const qty = Number(item?.quantity ?? 0);
            if (Number.isFinite(qty) && qty > 0) {
                total += Math.floor(qty);
            }
        }
    }
    return total;
}

/**
 * Calcula cuántos equipos diarios requiere un evento.
 * - Portátil: 1 dispensador cada 2 barriles de 5L/10L (mínimo 1 si el evento es portátil).
 * - Muro: 1 Muro por evento.
 */
export function calculateRequiredDispensers(
    dispenser: string | null | undefined,
    portableKegCount: number,
): { portable: number; muro: number } {
    const normalized = String(dispenser ?? '').trim().toLowerCase();
    if (normalized === 'muro') {
        return { portable: 0, muro: 1 };
    }
    const safeKegs = Math.max(0, Math.floor(portableKegCount || 0));
    const portable = Math.max(1, Math.ceil(safeKegs / 2));
    return { portable, muro: 0 };
}

export function buildEmptyDaySummary(date: string, config: EventCapacityConfig): DayCapacitySummary {
    return {
        date,
        portableUsed: 0,
        portableTotal: config.portableDispensers,
        portableAvailable: config.portableDispensers,
        maxPortableKegsAvailable: config.portableDispensers * 2,
        muroUsed: 0,
        muroTotal: config.muroDispensers,
        muroAvailable: config.muroDispensers,
        eventsCount: 0,
    };
}

/**
 * Evalúa si un pedido (portátil con N barriles o muro) cabe en la capacidad restante de un día.
 */
export function evaluateCapacityForRequest(
    day: DayCapacitySummary,
    dispenser: 'portatil' | 'muro' | string | null | undefined,
    portableKegCount: number,
): CapacityEvaluation {
    const normalized = String(dispenser ?? '').trim().toLowerCase() === 'muro' ? 'muro' : 'portatil';
    const { portable: requiredPortable, muro: requiredMuro } = calculateRequiredDispensers(normalized, portableKegCount);

    if (normalized === 'muro') {
        if (day.muroAvailable < requiredMuro) {
            return {
                available: false,
                reason: `No hay Muro de Coctelería disponible para esta fecha (${day.muroUsed}/${day.muroTotal} reservado).`,
                requiredPortable,
                requiredMuro,
            };
        }
        return { available: true, requiredPortable, requiredMuro };
    }

    if (day.portableAvailable <= 0) {
        return {
            available: false,
            reason: `Fecha sin disponibilidad: los ${day.portableTotal} dispensadores portátiles ya están reservados.`,
            requiredPortable,
            requiredMuro,
        };
    }

    if (day.portableAvailable < requiredPortable) {
        const dispWord = day.portableAvailable === 1 ? 'dispensador disponible' : 'dispensadores disponibles';
        return {
            available: false,
            reason: `Solo queda ${day.portableAvailable} ${dispWord} para esta fecha (máximo ${day.maxPortableKegsAvailable} barriles de 5L/10L). Tu pedido requiere ${requiredPortable} dispensadores (${portableKegCount} barriles).`,
            requiredPortable,
            requiredMuro,
        };
    }

    return { available: true, requiredPortable, requiredMuro };
}
