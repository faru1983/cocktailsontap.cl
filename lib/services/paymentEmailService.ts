/**
 * Servicio de envío de emails para pagos registrados (Eventos y Venta Directa).
 */
import * as React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { FROM_EMAIL } from '@/lib/config';
import { resolvePaymentMessageContext } from '@/lib/paymentMessageContext';
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
    balanceAfter: number,
    paymentCount?: number
): Promise<{ ok: boolean; error?: string }> {
    const email = quote.client_email?.trim();
    if (!email) return { ok: false, error: 'Sin email de cliente' };

    const ctx = resolvePaymentMessageContext(quote, paymentAmount, balanceAfter, {
        paymentCount,
    });

    const html = await render(
        React.createElement(PaymentRegisteredEmail, {
            quote,
            paymentAmount,
            balanceAfter,
            paymentCount,
        })
    );

    return sendResend(email, ctx.emailSubject, html);
}
