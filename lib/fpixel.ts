// Debe coincidir con META_PIXEL_ID en lib/config.ts (mismo fallback hardcodeado
// para que el script del browser y las llamadas server-side a CAPI usen el mismo Pixel ID).
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '1739547250109039';

/**
 * Línea de negocio en custom_data (`service` + `content_category`).
 * Todos los eventos estándar de Meta (ViewContent, Contact, InitiateCheckout, Purchase)
 * usan estas mismas claves para filtrar Eventos vs Barriles en Ads.
 * PageView no se etiqueta: cubre toda la web. Landings `/eventos` y `/barriles`
 * disparan ViewContent (Pixel) con `service`.
 */
export type MetaServiceLine = 'eventos' | 'barriles';
export const META_SERVICE_EVENTOS: MetaServiceLine = 'eventos';
export const META_SERVICE_BARRILES: MetaServiceLine = 'barriles';

/**
 * metaServiceLineFromIntent: CRM `event` → eventos, `direct` → barriles.
 * Si el intent no está claro, no adivina (null) — Contact sin carril no se etiqueta.
 */
export function metaServiceLineFromIntent(intent?: string | null): MetaServiceLine | null {
  if (intent === 'direct') return 'barriles';
  if (intent === 'event') return 'eventos';
  return null;
}

/**
 * metaLineParams: `service` + `content_category` cortos para Ads.
 * `fallback` solo en cotización/venta, donde el carril siempre se conoce.
 */
export function metaLineParams(
  intent: string | null | undefined,
  fallback: MetaServiceLine
): { service: MetaServiceLine; content_category: string };
export function metaLineParams(
  intent?: string | null,
  fallback?: MetaServiceLine
): { service: MetaServiceLine; content_category: string } | Record<string, never>;
export function metaLineParams(
  intent?: string | null,
  fallback?: MetaServiceLine
): { service: MetaServiceLine; content_category: string } | Record<string, never> {
  const line = metaServiceLineFromIntent(intent) ?? fallback ?? null;
  if (!line) return {};
  return {
    service: line,
    content_category: line === 'barriles' ? 'Barriles' : 'Eventos',
  };
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq: (...args: any[]) => void;
    _fbq: unknown;
  }
}

// https://developers.facebook.com/docs/facebook-pixel/advanced/advanced-matching
export interface FBUserData {
  /** clients.id (UUID) — mismo valor que CAPI user_data.external_id (Meta hashea en browser). */
  external_id?: string;
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
}

/** Campos mínimos de Quote para Advanced Matching en checkout/compra. */
export interface QuotePixelContact {
  client_id?: string | null;
  client_email?: string | null;
  client_name?: string | null;
}

export interface QuotePixelExtras {
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
}

/**
 * Advanced Matching para InitiateCheckout / Purchase.
 * external_id = clients.id, alineado con sendMetaCapiEvent (SHA-256 server-side).
 */
export function quotePixelUserData(
  quote: QuotePixelContact,
  extras: QuotePixelExtras = {}
): FBUserData {
  const data: FBUserData = {};
  if (quote.client_id?.trim()) data.external_id = quote.client_id.trim();
  if (quote.client_email?.trim()) data.em = quote.client_email;
  if (extras.ph) data.ph = extras.ph;
  if (extras.fn?.trim()) data.fn = extras.fn;
  else if (quote.client_name?.trim()) data.fn = quote.client_name;
  if (extras.ln?.trim()) data.ln = extras.ln;
  if (extras.ct?.trim()) data.ct = extras.ct;
  return data;
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

  if (data.external_id?.trim()) out.external_id = data.external_id.trim().toLowerCase();
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

/**
 * metaServiceLineFromPath: Solo landings con carril claro.
 * Home `/` y `/cotizar` (selector) no cuentan; `/cotizar/[token]` ya es checkout.
 */
export function metaServiceLineFromPath(pathname: string): MetaServiceLine | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/eventos') return 'eventos';
  if (path === '/barriles') return 'barriles';
  return null;
}

/**
 * trackLandingViewContent: ViewContent en `/eventos` y `/barriles`.
 * Una vez por línea y pestaña (anti doble disparo init + F5). Sin CAPI: visitante anónimo.
 */
export function trackLandingViewContent(pathname?: string) {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const line = metaServiceLineFromPath(path);
  if (!line) return;
  trackOnce(`viewContent_${line}`, 'ViewContent', {
    content_name: line === 'barriles' ? 'Landing Barriles' : 'Landing Eventos',
    content_type: 'product',
    ...metaLineParams(line === 'barriles' ? 'direct' : 'event', line),
  });
}

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
 * `onceKey` estable, ej: `initiateCheckout_TOKEN` o `purchase_TOKEN`.
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
