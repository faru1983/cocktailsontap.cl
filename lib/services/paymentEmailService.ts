/**
 * Servicio de envío de emails para pagos registrados (Eventos y Venta Directa).
 */
import * as React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { FROM_EMAIL } from '@/lib/config';
import type { Quote } from '@/lib/types';
import PaymentRegisteredEmail from '@/components/emails/PaymentRegisteredEmail';

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

export async function sendPaymentRegisteredEmail(
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

    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const paidInFull = balanceAfter <= 0;

    const html = await render(
        React.createElement(PaymentRegisteredEmail, {
            quote,
            paymentAmount,
            balanceAfter,
        })
    );

    let subject = '';
    if (isDirect) {
        subject = paidInFull
            ? `✅ Pago registrado – pedido pagado (${eventDate})`
            : `✅ Pago registrado – ${eventDate}`;
    } else {
        subject = paidInFull
            ? `✅ Pago recibido – Reserva pagada (${eventDate})`
            : `✅ Pago recibido (Abono) – ${eventDate}`;
    }

    return sendResend(email, subject, html);
}
