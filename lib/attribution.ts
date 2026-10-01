/**
 * Utilidades de Atribución Meta (fbc / fbp)
 * Formato oficial Meta:
 * - fbc: fb.1.<creation_time_ms>.<fbclid>
 * - fbp: fb.1.<creation_time_ms>.<random_int>
 */

export const STORAGE_FBC_KEY = 'cot_meta_fbc';
export const STORAGE_FBP_KEY = 'cot_meta_fbp';
export const STORAGE_FBCLID_KEY = 'cot_meta_fbclid';

export function getClientCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(
        new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : undefined;
}

export function setClientCookie(name: string, value: string, maxAgeDays = 90) {
    if (typeof document === 'undefined') return;
    const maxAge = maxAgeDays * 24 * 60 * 60;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
}

/**
 * Inicializa y sincroniza las cookies y almacenamiento local de fbc y fbp.
 * Captura ?fbclid= de la URL si está presente y genera el formato oficial de Meta.
 */
export function initClientMetaAttribution(): { fbc?: string; fbp?: string } {
    if (typeof window === 'undefined') return {};

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const fbclid = urlParams.get('fbclid');

        let fbc = getClientCookie('_fbc') || localStorage.getItem(STORAGE_FBC_KEY) || undefined;
        let fbp = getClientCookie('_fbp') || localStorage.getItem(STORAGE_FBP_KEY) || undefined;

        // Si viene un fbclid en la URL, siempre refrescamos fbc con timestamp actual
        if (fbclid && fbclid.trim().length > 0) {
            const cleanFbclid = fbclid.trim();
            fbc = `fb.1.${Date.now()}.${cleanFbclid}`;
            setClientCookie('_fbc', fbc);
            localStorage.setItem(STORAGE_FBC_KEY, fbc);
            localStorage.setItem(STORAGE_FBCLID_KEY, cleanFbclid);
        } else if (fbc) {
            // Asegurar que si está en localStorage también quede en la cookie
            if (!getClientCookie('_fbc')) {
                setClientCookie('_fbc', fbc);
            }
        }

        // Si fbp no existe, generarlo según estándar de Meta
        if (!fbp) {
            const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
            fbp = `fb.1.${Date.now()}.${randomDigits}`;
            setClientCookie('_fbp', fbp);
            localStorage.setItem(STORAGE_FBP_KEY, fbp);
        } else if (!getClientCookie('_fbp')) {
            setClientCookie('_fbp', fbp);
        }

        return { fbc, fbp };
    } catch {
        return {};
    }
}

/**
 * Obtiene fbc y fbp actuales desde cookie o respaldo localStorage.
 */
export function getClientMetaAttribution(): { fbc?: string; fbp?: string } {
    if (typeof window === 'undefined') return {};
    try {
        const fbc = getClientCookie('_fbc') || localStorage.getItem(STORAGE_FBC_KEY) || undefined;
        const fbp = getClientCookie('_fbp') || localStorage.getItem(STORAGE_FBP_KEY) || undefined;
        return { fbc, fbp };
    } catch {
        return {};
    }
}
