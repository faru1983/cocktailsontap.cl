const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

export function formatCurrency(n: number) {
    return CLP.format(n);
}

/**
 * Formatea un string como número de teléfono: +XXX-XXXXXXXX
 * Permite borrar libremente y aplica el guion solo cuando hay números después del prefijo.
 */
export function formatPhoneNumber(value: string): string {
    if (!value) return '';

    // Solo extraemos los números
    const numbers = value.replace(/[^\d]/g, '');

    // Si no hay números, dejamos el valor limpio o el '+' si existe
    if (numbers.length === 0) return value.includes('+') ? '+' : '';

    // Formato flexible: +XXX-XXXXXXXX...
    // Ya no hay límite de 11 dígitos para permitir correcciones manuales
    if (numbers.length > 3) {
        return `+${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }
    return `+${numbers}`;
}

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
