import { PROJECT_TIMEZONE } from '@/lib/config';

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

export function formatCurrency(n: number) {
    return CLP.format(n);
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

/** @deprecated Preferir formatPhoneDisplay / phoneInputToE164 desde `@/lib/phone`. */
export { formatPhoneDisplay as formatPhoneNumber, phoneInputToE164, toWhatsAppDigits } from '@/lib/phone';

export function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
            .then(() => true)
            .catch(() => copyFallback(text));
    }
    return Promise.resolve(copyFallback(text));
}

function copyFallback(text: string): boolean {
    if (typeof document === 'undefined') return false;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textArea);
    return success;
}
