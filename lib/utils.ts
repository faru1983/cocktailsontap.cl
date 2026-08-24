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
    quantity: number;
    offer_price_at_time: number;
}): string {
    const sizeParts = item.size.split(' - ').map((p) => p.trim()).filter(Boolean);
    const baseSize = sizeParts[0] || item.size;
    const sizeSuffix = sizeParts.slice(1).join(' - ');
    const productLabel = sizeSuffix ? `${sizeSuffix} ${item.product_name}`.trim() : item.product_name;
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

/** @deprecated Preferir formatPhoneDisplay / phoneInputToE164 desde `@/lib/phone`. */
export { formatPhoneDisplay as formatPhoneNumber, phoneInputToE164, toWhatsAppDigits } from '@/lib/phone';

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
