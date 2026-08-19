// ==============================================================================
// OBJETIVO: Constantes y helpers para fulfillment de venta directa (pagos, despacho).
// ==============================================================================

import type { Quote } from '@/lib/types';

/** Preset Blue Express para despacho por tercero. */
export const BLUE_EXPRESS_CARRIER = {
    name: 'Blue Express',
    trackingUrl: 'https://www.blue.cl/enviar/seguimiento',
} as const;

export const PAYMENT_NOTE_FULL = 'Transferencia total';
export const PAYMENT_NOTE_PARTIAL = 'Abono transferencia';

/**
 * sumQuotePayments: Total pagado desde JSONB payments.
 */
export function sumQuotePayments(quote: Pick<Quote, 'payments'>): number {
    const list = Array.isArray(quote.payments) ? quote.payments : [];
    return list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/**
 * getQuoteBalance: Saldo pendiente (total_price - pagos).
 */
export function getQuoteBalance(quote: Pick<Quote, 'payments' | 'total_price'>): number {
    const total = Number(quote.total_price) || 0;
    return Math.max(0, total - sumQuotePayments(quote));
}

/**
 * isDirectSaleQuote: Venta desechable / directa.
 */
export function isDirectSaleQuote(quote: {
    service_type?: string | null;
    dispenser?: string | null;
}): boolean {
    return quote.service_type === 'direct' || quote.dispenser === 'desechable';
}

/** Chip listado admin: venta directa confirmada sin pago. */
export const DIRECT_SALE_PAYMENT_PENDING_BADGE = {
    label: '$ Pendiente',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.12)',
};

export function isDirectSalePaymentPending(
    quote: Pick<Quote, 'service_type' | 'status' | 'payments' | 'total_price'>
): boolean {
    return (
        quote.service_type === 'direct' &&
        quote.status === 'confirmed' &&
        getQuoteBalance(quote) > 0
    );
}
