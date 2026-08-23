// ==============================================================================
// OBJETIVO: Tarifas Blue Express (domicilio) y armado de paquetes por barriles.
// Cada barril desechable ~5 kg. Talla M hasta 6 kg (1 barril); L hasta 20 kg (2–4).
// Origen Santiago → zona centro u extremo. No aplica a traslado propio (RM).
// ==============================================================================

export type ShippingCarrier = 'own' | 'blue_express';
export type BlueExpressZone = 'misma_zona' | 'centro' | 'extremo';
export type BlueExpressSizeRates = { M: number; L: number };
export type BlueExpressHomeRates = {
    misma_zona: BlueExpressSizeRates;
    centro: BlueExpressSizeRates;
    extremo: BlueExpressSizeRates;
};

export const BLUE_EXPRESS_ZONE_OPTIONS: { value: BlueExpressZone; label: string }[] = [
    { value: 'misma_zona', label: 'Misma zona' },
    { value: 'centro', label: 'Centro' },
    { value: 'extremo', label: 'Extremo (norte / sur)' },
];

export const BLUE_EXPRESS_RATES_SETTING_KEY = 'blue_express_home_rates';

/** Fallback si aún no hay fila en site_settings. */
export const BLUE_EXPRESS_HOME_RATES: BlueExpressHomeRates = {
    misma_zona: { M: 4800, L: 5400 },
    centro: { M: 7300, L: 9200 },
    extremo: { M: 14500, L: 17000 },
};

function cloneDefaultRates(): BlueExpressHomeRates {
    return {
        misma_zona: { ...BLUE_EXPRESS_HOME_RATES.misma_zona },
        centro: { ...BLUE_EXPRESS_HOME_RATES.centro },
        extremo: { ...BLUE_EXPRESS_HOME_RATES.extremo },
    };
}

function positiveInt(n: unknown): number | null {
    const v = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
    if (!Number.isFinite(v) || v < 0) return null;
    return Math.round(v);
}

export function isBlueExpressZone(v: unknown): v is BlueExpressZone {
    return v === 'misma_zona' || v === 'centro' || v === 'extremo';
}

/**
 * parseBlueExpressRates: lee JSON de site_settings y completa con el fallback.
 */
export function parseBlueExpressRates(raw: unknown): BlueExpressHomeRates {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return cloneDefaultRates();
        }
    }
    const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, Record<string, unknown>>) : {};
    const pick = (zone: BlueExpressZone): BlueExpressSizeRates => {
        const fallback = BLUE_EXPRESS_HOME_RATES[zone];
        const src = obj[zone] || {};
        return {
            M: positiveInt(src.M) ?? fallback.M,
            L: positiveInt(src.L) ?? fallback.L,
        };
    };
    return {
        misma_zona: pick('misma_zona'),
        centro: pick('centro'),
        extremo: pick('extremo'),
    };
}

/** Máximo de barriles en un paquete L (4 × 5 kg = 20 kg). */
export const BLUE_EXPRESS_BARRELS_PER_L = 4;

export interface BlueExpressPacks {
    m: number;
    l: number;
}

export interface BlueExpressQuote extends BlueExpressPacks {
    cost: number;
    zone: BlueExpressZone;
    barrelCount: number;
}

/**
 * barrelsFromLiters: 5L de cóctel = 1 barril desechable.
 * El wizard directo solo vende 5L, así el conteo coincide con la cantidad.
 */
export function barrelsFromLiters(totalLiters: number): number {
    if (!totalLiters || totalLiters <= 0) return 0;
    return Math.max(1, Math.round(totalLiters / 5));
}

/**
 * splitBlueExpressPacks: llena paquetes L de 4 barriles;
 * el resto de 1 va en un M; 2 o 3 barriles caben en un L (10–15 kg).
 */
export function splitBlueExpressPacks(barrelCount: number): BlueExpressPacks {
    if (barrelCount <= 0) return { m: 0, l: 0 };
    const fullL = Math.floor(barrelCount / BLUE_EXPRESS_BARRELS_PER_L);
    const rem = barrelCount % BLUE_EXPRESS_BARRELS_PER_L;
    if (rem === 0) return { m: 0, l: fullL };
    if (rem === 1) return { m: 1, l: fullL };
    return { m: 0, l: fullL + 1 };
}

/**
 * quoteBlueExpressHome: costo domicilio según zona, barriles y tarifas (admin o fallback).
 */
export function quoteBlueExpressHome(
    barrelCount: number,
    zone: BlueExpressZone,
    rates: BlueExpressHomeRates = BLUE_EXPRESS_HOME_RATES
): BlueExpressQuote {
    const packs = splitBlueExpressPacks(barrelCount);
    const zoneRates = rates[zone] || BLUE_EXPRESS_HOME_RATES[zone];
    const cost = packs.m * zoneRates.M + packs.l * zoneRates.L;
    return { ...packs, cost, zone, barrelCount };
}

/**
 * formatBlueExpressPacks: texto corto para admin (ej. "1× M" o "1× L + 1× M").
 */
export function formatBlueExpressPacks(packs: BlueExpressPacks): string {
    const parts: string[] = [];
    if (packs.l) parts.push(`${packs.l}× L`);
    if (packs.m) parts.push(`${packs.m}× M`);
    return parts.join(' + ') || '—';
}

export function getDirectSaleDateFieldCopy(carrier: ShippingCarrier): {
    label: string;
    hint: string;
} {
    if (carrier === 'blue_express') {
        return {
            label: 'Fecha de entrega en Blue Express',
            hint: 'Selecciona el día en que debemos llevar tu pedido a Blue Express. El envío a tu domicilio lo coordinará Blue Express después.',
        };
    }
    return {
        label: 'Fecha de entrega',
        hint: 'Indica cuándo quieres recibir tu pedido en la dirección indicada.',
    };
}
