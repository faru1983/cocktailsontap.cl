'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import { buildQuoteConfirmedEmail } from '@/lib/emails';
import type { Quote, QuoteItem } from '@/lib/types';
import { formatEventDate } from '@/lib/wizardLogic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'contacto@cocktailsontap.cl';
const FROM_EMAIL = 'Cocktails on Tap <no-reply@cocktailsontap.cl>';
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_CALENDAR_URL;

interface ConfirmQuoteInput {
    token: string;
    // Datos opcionales para completar si faltan en la quote original
    client_phone?: string;
    client_address?: string;
}

interface ConfirmQuoteResult {
    success: boolean;
    error?: string;
}

export async function confirmQuote(input: ConfirmQuoteInput): Promise<ConfirmQuoteResult> {
    const { token, client_phone, client_address } = input;

    try {
        const db = createServerClient();

        // ─── 1. Cargar la cotización con sus items ────────────────────────────
        const { data: quote, error: fetchError } = await db
            .from('quotes')
            .select('*, quote_items(*)')
            .eq('token', token)
            .single();

        if (fetchError || !quote) {
            return { success: false, error: 'Cotización no encontrada.' };
        }

        if (quote.status !== 'draft') {
            return { success: false, error: `Esta cotización ya está en estado "${quote.status}" y no se puede confirmar.` };
        }

        // ─── 2. Validar campos requeridos para confirmar ──────────────────────
        const finalPhone = client_phone?.trim() || quote.client_phone;
        const finalAddress = client_address?.trim() || quote.client_address;

        if (!quote.client_email) {
            return { success: false, error: 'Se requiere email para confirmar la reserva.' };
        }
        if (!finalPhone && !quote.client_email) {
            return { success: false, error: 'Se requiere al menos un dato de contacto (email o teléfono).' };
        }

        // ─── 3. Actualizar columnas opcionales si se completaron ──────────────
        const updateData: Record<string, string> = { status: 'confirmed' };
        if (client_phone) updateData.client_phone = client_phone.trim();
        if (client_address) updateData.client_address = client_address.trim();

        const { error: updateError } = await db
            .from('quotes')
            .update(updateData)
            .eq('token', token);

        if (updateError) {
            console.error('Error actualizando estado:', updateError);
            return { success: false, error: 'No se pudo confirmar la reserva. Intenta nuevamente.' };
        }

        // ─── 4. Construir la quote actualizada para emails ────────────────────
        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            status: 'confirmed',
            client_phone: finalPhone ?? quote.client_phone,
            client_address: finalAddress ?? quote.client_address,
            quote_items: (quote.quote_items ?? []) as QuoteItem[],
        };

        // ─── 5. Enviar email de confirmación al cliente ───────────────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && fullQuote.client_email) {
            try {
                const resend = new Resend(resendKey);
                const confirmedEmail = buildQuoteConfirmedEmail(fullQuote);
                await resend.emails.send({
                    from: FROM_EMAIL,
                    to: fullQuote.client_email,
                    subject: confirmedEmail.subject,
                    html: confirmedEmail.html,
                });
            } catch (emailErr) {
                console.error('Error enviando email de confirmación:', emailErr);
            }
        }

        // ─── 6. Disparar webhook de Make.com para Google Calendar ─────────────
        if (MAKE_WEBHOOK_URL) {
            try {
                const eventDate = fullQuote.event_date
                    ? new Date(fullQuote.event_date + 'T12:00:00').toISOString()
                    : null;

                const items = fullQuote.quote_items
                    .map(i => `${i.quantity}x ${i.product_name} (${i.size})`)
                    .join(', ');

                const payload = {
                    title: `🍸 ${fullQuote.client_name} – ${fullQuote.guests} invitados`,
                    description: [
                        `Cliente: ${fullQuote.client_name}`,
                        fullQuote.client_phone ? `Teléfono: ${fullQuote.client_phone}` : '',
                        fullQuote.client_email ? `Email: ${fullQuote.client_email}` : '',
                        fullQuote.client_address ? `Dirección: ${fullQuote.client_address}` : '',
                        `Comuna: ${fullQuote.comuna_name === 'Otra' ? fullQuote.comuna_other : fullQuote.comuna_name}`,
                        `Invitados: ${fullQuote.guests}`,
                        `Productos: ${items}`,
                        fullQuote.comments ? `Notas: ${fullQuote.comments}` : '',
                    ].filter(Boolean).join('\n'),
                    start_date: eventDate,
                    start_time: fullQuote.start_time,
                    guests_email: fullQuote.client_email,
                    location: [fullQuote.client_address, fullQuote.comuna_name].filter(Boolean).join(', '),
                    event_date_formatted: formatEventDate(fullQuote.event_date),
                };

                await fetch(MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (webhookErr) {
                console.error('Error disparando webhook de Make.com:', webhookErr);
            }
        }

        return { success: true };
    } catch (err) {
        console.error('Error inesperado en confirmQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
