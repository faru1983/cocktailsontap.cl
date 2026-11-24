import type { Comuna, Region } from './types';

export interface QuoteAddressFields {
    client_address?: string | null;
    comuna_name?: string | null;
    comuna_other?: string | null;
    region_name?: string | null;
}

/** Comuna legible para display (Otra → comuna_other). */
export function resolveComunaDisplay(
    comunaName?: string | null,
    comunaOther?: string | null
): string {
    if (comunaName === 'Otra') return (comunaOther || '').trim();
    return (comunaName || '').trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quita país, región y comuna duplicados al final de direcciones legacy o pegadas completas
 * (ej. "Canal Tenglo 2935, Puerto Montt, Los Lagos" → "Canal Tenglo 2935"),
 * sin tocar nombres de calles que coincidan con una comuna (ej. "Avenida La Florida 9423").
 */
export function stripTrailingComuna(street: string, comuna: string, region?: string): string {
    let current = street.trim();
    if (!current) return '';

    const cleanTail = (pattern: RegExp) => {
        const match = current.match(pattern);
        if (match && match.index && match.index > 0) {
            const next = current.slice(0, match.index).replace(/[,\s.]+$/, '').trim();
            if (next) current = next;
        }
    };

    // 1. País al final
    cleanTail(/[,\s]+chile\.?\s*$/i);

    // 2. Región al final (con o sin prefijo "Región (de|del)")
    const cleanRegion = (region || '').trim();
    if (cleanRegion) {
        const regEsc = escapeRegExp(cleanRegion);
        cleanTail(new RegExp(`[,\\s]+(?:regi[oó]n\\s+(?:de\\s+|del\\s+)?)?${regEsc}(?:\\s+de\\s+santiago)?\\.?\\s*$`, 'i'));
    }
    cleanTail(/[,\s]+regi[oó]n\s+metropolitana(?:\s+de\s+santiago)?\.?\s*$/i);

    // 3. Comuna al final (con opcional código postal de 7 dígitos delante)
    const cleanComuna = (comuna || '').trim();
    if (cleanComuna) {
        const comEsc = escapeRegExp(cleanComuna);
        cleanTail(new RegExp(`(?:,\\s*|\\s+)(?:\\d{7}\\s+)?${comEsc}\\.?\\s*$`, 'i'));
    }

    return current;
}

/**
 * Acepta code (RM), short_name (Metropolitana) o name oficial y devuelve el code.
 */
export function resolveRegionCode(
    regionSnapshot: string | null | undefined,
    comunas: Comuna[]
): string {
    const raw = (regionSnapshot || '').trim();
    if (!raw) return '';
    if (comunas.some((c) => c.regionCode === raw)) return raw;
    const byShort = comunas.find((c) => c.regionShortName === raw);
    if (byShort) return byShort.regionCode;
    const byName = comunas.find((c) => c.regionName === raw);
    return byName?.regionCode || raw;
}

/** Snapshot legible para quotes.region_name (short_name). */
export function resolveRegionShortName(
    regionSnapshot: string | null | undefined,
    comunas: Comuna[]
): string | null {
    const code = resolveRegionCode(regionSnapshot, comunas);
    if (!code) return null;
    return comunas.find((c) => c.regionCode === code)?.regionShortName || code;
}

/**
 * Nombre corto de región para display (emails, resúmenes).
 * Usa catálogo de comunas si está disponible; si no, heurística para nombres legacy.
 */
export function formatRegionDisplayName(
    regionSnapshot?: string | null,
    comunas?: Comuna[]
): string {
    const raw = (regionSnapshot || '').trim();
    if (!raw) return '';

    if (comunas?.length) {
        const short = resolveRegionShortName(raw, comunas);
        if (short) return short;
    }

    if (raw.toUpperCase() === 'RM') return 'Metropolitana';
    if (!/^regi[oó]n\s/i.test(raw)) return raw;

    let name = raw.replace(/^regi[oó]n\s+(de\s+|del\s+)?/i, '').trim();
    const deMatch = name.match(/^(.+?)\s+de\s+/i);
    if (deMatch) return deMatch[1].trim();
    return name;
}

/**
 * Formato unificado: "Dirección, Comuna (Región)".
 * Región = nombre corto (ej. Valparaíso, Metropolitana).
 */
export function formatQuoteAddress(
    fields: QuoteAddressFields,
    comunas?: Comuna[]
): string {
    const comuna = resolveComunaDisplay(fields.comuna_name, fields.comuna_other);
    const region = formatRegionDisplayName(fields.region_name, comunas);
    let street = stripTrailingComuna((fields.client_address || '').trim(), comuna, region);

    if (street && comuna && street.toLowerCase() === comuna.toLowerCase()) {
        street = '';
    }

    if (!street && !comuna && !region) return '';

    const suffix = comuna
        ? region
            ? `${comuna} (${region})`
            : comuna
        : region;

    if (!street) return suffix;
    if (!suffix) return street;
    return `${street}, ${suffix}`;
}

/** Regiones activas para un canal (eventos | barriles). */
export function filterRegionsForService(
    regions: Region[],
    serviceType: 'event' | 'direct'
): Region[] {
    return regions.filter((r) => {
        if (!r.isActive) return false;
        return serviceType === 'direct' ? r.availableForDirect : r.availableForEvents;
    });
}

/** Comunas activas de una región (por code). */
export function filterComunasForRegion(comunas: Comuna[], regionCode: string): Comuna[] {
    return comunas
        .filter((c) => c.regionCode === regionCode && c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
