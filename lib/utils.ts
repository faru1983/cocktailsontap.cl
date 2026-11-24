import { PROJECT_TIMEZONE } from '@/lib/config';

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

export function formatCurrency(n: number) {
    return CLP.format(n);
}

/**
 * Línea de producto para Google Calendar ({{items_list}}).
 * Ej: `5L (x2) Desechable Sangría $79.980` · `5L (x1) Piña Colada Sin Alcohol $79.990`
 */
export function formatQuoteItemCalendarLine(item: {
    size: string;
    product_name: string;
    variant?: string | null;
    quantity: number;
    offer_price_at_time: number;
}): string {
    const sizeParts = item.size.split(' - ').map((p) => p.trim()).filter(Boolean);
    const baseSize = sizeParts[0] || item.size;
    const sizeSuffix = sizeParts.slice(1).join(' - ');
    const nameWithVariant = item.variant ? `${item.product_name} (${item.variant})` : item.product_name;
    const productLabel = sizeSuffix ? `${sizeSuffix} ${nameWithVariant}`.trim() : nameWithVariant;
    return `${baseSize} (x${item.quantity}) ${productLabel} ${formatCurrency(item.offer_price_at_time * item.quantity)}`;
}

/**
 * Fechas Chile deterministas (SSR = cliente). Evita hydration mismatch de
 * toLocaleString('es-CL') por espacios distintos en a. m. / p. m. (ICU Node vs browser).
 */
function chileDateParts(value: string | Date, withTime: boolean) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: PROJECT_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime
            ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const }
            : {}),
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value || '';
    return {
        day: get('day'),
        month: get('month'),
        year: get('year'),
        hour: get('hour'),
        minute: get('minute'),
        second: get('second'),
    };
}

/** dd-mm-yyyy en America/Santiago */
export function formatDateCL(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const p = chileDateParts(value, false);
    if (!p) return '—';
    return `${p.day}-${p.month}-${p.year}`;
}

/** dd-mm-yyyy, HH:mm:ss en America/Santiago (24h) */
export function formatDateTimeCL(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const p = chileDateParts(value, true);
    if (!p) return '—';
    return `${p.day}-${p.month}-${p.year}, ${p.hour}:${p.minute}:${p.second}`;
}

/** Hora UTC del cron diario de recordatorios (`vercel.json` → 0 13 * * *). */
export const VERCEL_REMINDERS_CRON_UTC_HOUR = 13;

/**
 * Hora Chile (HH:mm) del disparo diario de Vercel, según DST de `at`.
 * Invierno ≈ 09:00, verano ≈ 10:00.
 */
export function formatVercelDailyCronTimeCL(at = new Date()): string {
    const slot = new Date(
        Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), VERCEL_REMINDERS_CRON_UTC_HOUR, 0, 0)
    );
    const p = chileDateParts(slot, true);
    if (!p) return '—';
    return `${p.hour}:${p.minute}`;
}

/**
 * Inicial de avatar SSR-safe.
 * `name[0]` rompe emojis / letras fuera del BMP (pares UTF-16): el HTML del
 * servidor reemplaza el surrogate huérfano por � y el cliente hidrata otro
 * code point → hydration mismatch. Busca la 1ª letra Unicode; si no hay, "?".
 */
export function getAvatarInitial(name: string | null | undefined): string {
    if (!name) return '?';
    const letter = name.match(/\p{L}/u)?.[0];
    if (letter) return letter.toLocaleUpperCase('es');
    return '?';
}

export function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text)
            .then(() => true)
            .catch(() => Promise.resolve(copyFallback(text)));
    }
    return Promise.resolve(copyFallback(text));
}

/** Fallback compatible con iOS Safari (evita opacity:0 y usa setSelectionRange). */
function copyFallback(text: string): boolean {
    if (typeof document === 'undefined') return false;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textArea);
    return success;
}

/**
 * Sanitiza términos de búsqueda para filtros PostgREST (.or / .ilike).
 * Remueve caracteres especiales de sintaxis que podrían romper la consulta o inyectar filtros.
 */
export function sanitizePostgrestSearch(term: string | null | undefined): string {
    if (!term || typeof term !== 'string') return '';
    return term.replace(/[,().:\"'\\%_]/g, ' ').replace(/\s+/g, ' ').trim();
}


/**
 * Escapa caracteres especiales de HTML para prevenir XSS / HTML Injection en emails y vistas.
 */
export function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Normaliza nombres y apellidos a Title Case (primera letra de cada palabra en mayúscula).
 * Colapsa espacios múltiples y recorta extremos. Ej: "  jUAN  pablo " -> "Juan Pablo".
 */
export function normalizePersonName(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\p{L}+/gu, (word) =>
            word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es')
        );
}

/**
 * Normaliza correos electrónicos: recorta espacios y convierte a minúsculas.
 */
export function normalizeEmail(value: string | null | undefined): string {
    if (!value) return '';
    return value.trim().toLowerCase();
}

function normalizeGeoToken(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/^(comuna de|ciudad de|region de|region metropolitana de|region)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Busca la comuna oficial más precisa a partir de los componentes devueltos por Google Places.
 */
export function matchComunaFromGoogle<
    T extends { name: string; regionName?: string; regionShortName?: string }
>(
    comunaCandidates: string[],
    regionHint: string | null | undefined,
    comunas: T[]
): T | null {
    const normalizedCandidates = comunaCandidates
        .map((c) => normalizeGeoToken(c))
        .filter(Boolean);
    if (normalizedCandidates.length === 0 || comunas.length === 0) return null;

    const normalizedRegion = regionHint ? normalizeGeoToken(regionHint) : '';
    const regionMatches = (c: T) => {
        if (!normalizedRegion) return true;
        const rName = c.regionName ? normalizeGeoToken(c.regionName) : '';
        const rShort = c.regionShortName ? normalizeGeoToken(c.regionShortName) : '';
        return (
            (rName && (rName.includes(normalizedRegion) || normalizedRegion.includes(rName))) ||
            (rShort && (rShort.includes(normalizedRegion) || normalizedRegion.includes(rShort)))
        );
    };

    // 1. Match exacto (priorizando coincidencia de región si hubiera homónimos)
    for (const candidate of normalizedCandidates) {
        const exact = comunas.filter((c) => normalizeGeoToken(c.name) === candidate);
        if (exact.length > 0) {
            return exact.find(regionMatches) || exact[0];
        }
    }

    // 2. Fallback: candidato contiene el nombre oficial de la comuna (nombres largos primero)
    const byLength = [...comunas].sort((a, b) => b.name.length - a.name.length);
    for (const candidate of normalizedCandidates) {
        const partial = byLength.filter((c) => {
            const name = normalizeGeoToken(c.name);
            return name.length >= 4 && candidate.includes(name);
        });
        if (partial.length > 0) {
            return partial.find(regionMatches) || partial[0];
        }
    }

    return null;
}

/**
 * Resuelve la comuna elegible para un tipo de servicio ('direct' | 'event') a partir de Google Places.
 */
export function resolveEligibleComunaFromGoogle<
    TComuna extends { name: string; isActive: boolean; regionCode: string; regionName?: string; regionShortName?: string },
    TRegion extends { code: string; isActive: boolean; availableForDirect: boolean; availableForEvents: boolean }
>(
    comunaCandidates: string[],
    regionHint: string | null | undefined,
    comunas: TComuna[],
    regions: TRegion[],
    serviceType: 'direct' | 'event'
): TComuna | null {
    const activeRegions = new Set(
        regions
            .filter((r) =>
                r.isActive && (serviceType === 'event' ? r.availableForEvents : r.availableForDirect)
            )
            .map((r) => r.code)
    );
    const eligible = comunas.filter(
        (c) => c.isActive && (activeRegions.size === 0 || activeRegions.has(c.regionCode))
    );
    return matchComunaFromGoogle(comunaCandidates, regionHint, eligible);
}

export type GoogleEventAddressResult<TComuna> =
    | { status: 'matched'; comuna: TComuna }
    | { status: 'outside_rm' }
    | { status: 'unknown' };

/**
 * Evalúa si una dirección elegida desde Google Places pertenece a la RM (eventos),
 * está claramente fuera de la RM, o requiere selección manual.
 */
export function evaluateGoogleEventAddress<
    TComuna extends { name: string; isActive: boolean; regionCode: string; regionName?: string; regionShortName?: string },
    TRegion extends { code: string; isActive: boolean; availableForDirect: boolean; availableForEvents: boolean }
>(
    comunaCandidates: string[],
    regionName: string | null | undefined,
    comunas: TComuna[],
    regions: TRegion[],
    allowAllActiveRegions = false
): GoogleEventAddressResult<TComuna> {
    const matchedRm = resolveEligibleComunaFromGoogle(
        comunaCandidates,
        regionName,
        comunas,
        regions,
        'event'
    );
    if (matchedRm) {
        return { status: 'matched', comuna: matchedRm };
    }

    const matchedOtherRegion = resolveEligibleComunaFromGoogle(
        comunaCandidates,
        regionName,
        comunas,
        regions,
        'direct'
    );
    if (allowAllActiveRegions) {
        return matchedOtherRegion ? { status: 'matched', comuna: matchedOtherRegion } : { status: 'unknown' };
    }
    const regionNorm = (regionName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const clearlyOutsideRm =
        Boolean(matchedOtherRegion) ||
        (Boolean(regionNorm) && !regionNorm.includes('metropolitana'));

    return clearlyOutsideRm ? { status: 'outside_rm' } : { status: 'unknown' };
}
