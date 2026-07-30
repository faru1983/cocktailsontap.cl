export const FB_PIXEL_ID = '1739547250109039';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq: (...args: any[]) => void;
    _fbq: unknown;
  }
}

// https://developers.facebook.com/docs/facebook-pixel/advanced/advanced-matching
export interface FBUserData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
}

/** Rutas internas que no deben enviar eventos al Pixel. */
export function shouldTrackMetaPath(pathname: string): boolean {
  return !pathname.startsWith('/admin');
}

/** Solo producción (cocktailsontap.cl). Sin localhost ni previews Vercel. */
export function isMetaPixelHostAllowed(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (host.endsWith('.vercel.app')) return false;
  return host === 'cocktailsontap.cl' || host === 'www.cocktailsontap.cl';
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normaliza PII para Advanced Matching (Meta hashea en el browser). */
export function normalizeFBUserData(data: FBUserData): FBUserData {
  const out: FBUserData = { country: 'cl' };

  if (data.em?.trim()) out.em = data.em.trim().toLowerCase();
  if (data.ph) {
    const digits = data.ph.replace(/\D/g, '');
    if (digits) out.ph = digits;
  }
  if (data.fn?.trim()) out.fn = stripAccents(data.fn.trim().toLowerCase());
  if (data.ln?.trim()) out.ln = stripAccents(data.ln.trim().toLowerCase());
  if (data.ct?.trim()) out.ct = stripAccents(data.ct.trim().toLowerCase());
  if (data.st?.trim()) out.st = stripAccents(data.st.trim().toLowerCase());
  if (data.zp?.trim()) out.zp = data.zp.trim();

  return out;
}

export const pageview = () => {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (!isMetaPixelHostAllowed() || !shouldTrackMetaPath(window.location.pathname)) return;
  window.fbq('track', 'PageView');
};

type TrackOptions = Record<string, unknown>;

// https://developers.facebook.com/docs/facebook-pixel/reference
export const event = (
  name: string,
  options: TrackOptions = {},
  userData?: FBUserData,
  eventID?: string
) => {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (!isMetaPixelHostAllowed() || !shouldTrackMetaPath(window.location.pathname)) return;

  if (userData) {
    window.fbq('init', FB_PIXEL_ID, normalizeFBUserData(userData));
  }

  const eventData = eventID ? { eventID } : undefined;
  if (eventData) {
    window.fbq('track', name, options, eventData);
  } else {
    window.fbq('track', name, options);
  }
};

/**
 * Dispara un evento una sola vez por pestaña (anti-refresh / F5).
 * `onceKey` estable, ej: `lead_TOKEN` o `purchase_TOKEN`.
 */
export const trackOnce = (
  onceKey: string,
  name: string,
  options: TrackOptions = {},
  userData?: FBUserData
) => {
  if (typeof window === 'undefined') return;
  const storageKey = `fbq_once_${onceKey}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // sessionStorage bloqueado: igual intentamos trackear
  }
  event(name, options, userData, onceKey);
};
