// ==============================================================================
// OBJETIVO: Canal de origen de cotizaciones (web / admin / whatsapp).
// Usado al crear quotes y en badges del admin.
// ==============================================================================

/** Canal donde se originó la cotización o venta directa. */
export type QuoteSource = 'web' | 'admin' | 'whatsapp';

export const QUOTE_SOURCES: QuoteSource[] = ['web', 'admin', 'whatsapp'];

export const sourceBadge: Record<QuoteSource, { label: string; color: string; bg: string }> = {
    web: { label: 'Web', color: '#67e8f9', bg: 'rgba(103,232,249,0.12)' },
    admin: { label: 'Admin', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    whatsapp: { label: 'WhatsApp', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
};

/**
 * Resuelve el source al crear: explícito > admin > web.
 * La API de integración pasa source explícito (típico whatsapp).
 */
export function resolveQuoteSource(opts: {
    source?: QuoteSource;
    isAdmin?: boolean;
}): QuoteSource {
    if (opts.source) return opts.source;
    if (opts.isAdmin) return 'admin';
    return 'web';
}

/**
 * Normaliza valor de DB o API a QuoteSource conocido; fallback web.
 */
export function normalizeQuoteSource(value: string | null | undefined): QuoteSource {
    if (value === 'admin' || value === 'whatsapp') return value;
    return 'web';
}
