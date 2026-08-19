/**
 * Emails Resend para fulfillment venta directa (pago registrado, en reparto).
 */
import * as React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { FROM_EMAIL } from '@/lib/config';
import type { Quote } from '@/lib/types';
import PaymentRegisteredEmail from '@/components/emails/PaymentRegisteredEmail';
import DispatchEmail from '@/components/emails/DispatchEmail';

async function sendResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' };
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function sendDirectSalePaymentRegisteredEmail(
    quote: Quote,
    paymentAmount: number,
    balanceAfter: number
): Promise<{ ok: boolean; error?: string }> {
    const email = quote.client_email?.trim();
    if (!email) return { ok: false, error: 'Sin email de cliente' };

    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : '';

    const html = await render(
        React.createElement(PaymentRegisteredEmail, {
            quote,
            paymentAmount,
            balanceAfter,
        })
    );

    const subject =
        balanceAfter <= 0
            ? `✅ Pago registrado – pedido pagado (${eventDate})`
            : `✅ Pago registrado – ${eventDate}`;

    return sendResend(email, subject, html);
}

export async function sendDirectSaleDispatchEmail(quote: Quote): Promise<{ ok: boolean; error?: string }> {
    const email = quote.client_email?.trim();
    if (!email) return { ok: false, error: 'Sin email de cliente' };

    const html = await render(React.createElement(DispatchEmail, { quote }));
    const subject =
        quote.dispatch_mode === 'own'
            ? '📦 Tu pedido está en reparto'
            : `📦 Tu pedido fue despachado – ${quote.dispatch_carrier_name || 'envío'}`;

    return sendResend(email, subject, html);
}

/**
 * syncDirectSaleCalendarAfterPayment: Crea o actualiza evento Calendar desechables.
 */
export async function syncDirectSaleCalendarAfterPayment(
    quoteId: string,
    db: ReturnType<typeof import('@/lib/supabaseServer').createServerClient>
): Promise<void> {
    const { data: quote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
    if (!quote) return;

    const { GoogleSyncService } = await import('@/lib/services/googleSyncService');
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    if (!isDirect) return;

    try {
        const calResult = await GoogleSyncService.scheduleCalendarEvents(quote, {
            updateEventId: quote.google_event_id || undefined,
            updatePickupEventId: quote.google_pickup_event_id || undefined,
            isDirectSaleOverride: true,
        });

        const patch: Record<string, string | null> = {};
        if (calResult.eventId) patch.google_event_id = calResult.eventId;
        if (calResult.pickupEventId) patch.google_pickup_event_id = calResult.pickupEventId;

        if (Object.keys(patch).length > 0) {
            await db.from('quotes').update(patch).eq('id', quoteId);
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('syncDirectSaleCalendarAfterPayment:', err);
        await db.from('sync_logs').insert({
            quote_id: quoteId,
            type: 'google_calendar',
            status: 'error',
            error_msg: `Calendar tras pago: ${msg}`,
        });
    }
}
