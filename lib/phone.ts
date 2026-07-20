/**
 * Utilidades de teléfono (Chile default + CO/PE/VE).
 * Almacenamiento canónico: E.164 con '+' (ej: +56912345678).
 * Presentación: máscara legible (ej: +56 9 1234 5678).
 */

const CHILE_MOBILE_RE = /^\+569\d{8}$/;
const OTHER_MOBILE_RE = /^\+(57|51|58)\d{8,12}$/;

export function digitsOnly(input: string): string {
    return (input || '').replace(/\D/g, '');
}

/** Prefijo incompleto de Chile (focus vacío). */
export function isChilePrefixOnly(value: string): boolean {
    const d = digitsOnly(value);
    return d === '' || d === '56' || d === '569';
}

/** Valida celular Chile estricto u otros países permitidos (CO/PE/VE). */
export function isValidPhoneE164(e164: string): boolean {
    if (!e164) return false;
    return CHILE_MOBILE_RE.test(e164) || OTHER_MOBILE_RE.test(e164);
}

/**
 * Normaliza cualquier input a E.164 con '+', o null si no hay dígitos.
 * - 9XXXXXXXX → +569XXXXXXXX (Chile local)
 * - 8 dígitos sueltos → +569XXXXXXXX (asume abonado Chile tras el 9)
 */
export function normalizePhoneE164(input: string): string | null {
    if (!input?.trim()) return null;

    let digits = digitsOnly(input);
    if (!digits) return null;

    if (/^9\d{8}$/.test(digits)) {
        digits = '56' + digits;
    } else if (/^\d{8}$/.test(digits)) {
        digits = '569' + digits;
    }

    return `+${digits}`;
}

function capDigitsForCountry(digits: string): string {
    if (digits.startsWith('57')) return digits.slice(0, 12); // +57 + 10
    if (digits.startsWith('51')) return digits.slice(0, 11); // +51 + 9
    if (digits.startsWith('58')) return digits.slice(0, 12); // +58 + 10
    // Chile: 56 + 9 dígitos nacionales
    let d = digits;
    if (d.startsWith('9')) d = '56' + d;
    return d.slice(0, 11);
}

/**
 * Máscara de entrada / display desde raw o E.164.
 * Chile: +56 9 XXXX XXXX
 * CO: +57 XXX XXX XXXX | PE: +51 XXX XXX XXX | VE: +58 XXX XXX XXXX
 */
export function formatPhoneDisplay(input: string): string {
    if (!input) return '';

    let digits = digitsOnly(input);
    if (!digits) return input.includes('+') ? '+' : '';

    // Colombia
    if (digits.startsWith('57')) {
        const rest = digits.slice(2, 12);
        let out = '+57';
        if (rest.length > 0) out += ` ${rest.slice(0, 3)}`;
        if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
        if (rest.length > 6) out += ` ${rest.slice(6, 10)}`;
        return out;
    }

    // Perú
    if (digits.startsWith('51')) {
        const rest = digits.slice(2, 11);
        let out = '+51';
        if (rest.length > 0) out += ` ${rest.slice(0, 3)}`;
        if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
        if (rest.length > 6) out += ` ${rest.slice(6, 9)}`;
        return out;
    }

    // Venezuela
    if (digits.startsWith('58')) {
        const rest = digits.slice(2, 12);
        let out = '+58';
        if (rest.length > 0) out += ` ${rest.slice(0, 3)}`;
        if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
        if (rest.length > 6) out += ` ${rest.slice(6, 10)}`;
        return out;
    }

    // Chile (default)
    if (digits.startsWith('9')) digits = '56' + digits;
    digits = digits.slice(0, 11);

    let out = '+';
    if (digits.length >= 1) out += digits.slice(0, Math.min(2, digits.length));
    if (digits.length > 2) out += ` ${digits.slice(2, 3)}`;
    if (digits.length > 3) out += ` ${digits.slice(3, 7)}`;
    if (digits.length > 7) out += ` ${digits.slice(7, 11)}`;
    return out;
}

/**
 * Procesa input del usuario: aplica tope por país y devuelve E.164 (posible incompleto).
 */
export function phoneInputToE164(raw: string): string {
    const digits = digitsOnly(raw);
    if (!digits) return '';
    const capped = capDigitsForCountry(digits);
    return capped ? `+${capped}` : '';
}

/** Dígitos para wa.me / APIs (sin '+'). */
export function toWhatsAppDigits(input: string): string {
    const normalized = normalizePhoneE164(input);
    return normalized ? digitsOnly(normalized) : digitsOnly(input);
}

export const PHONE_PLACEHOLDER = '+56 9 1234 5678';
export const CHILE_MOBILE_PREFIX_E164 = '+569';
