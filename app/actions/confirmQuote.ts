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
    client_phone?: string;
    client_address?: string;
    comuna_name?: string;
    comuna_other?: string | null;
    guests?: number;
    event_type_id?: string;
    event_type_other?: string | null;
    items?: QuoteItem[]; // Lista completa de items actualizada
    event_date?: string;
    start_time?: string;
    pickup_date?: string | null;
    pickup_time?: string | null;
    comments?: string | null;
    dispenser?: 'portatil' | 'muro';
    installation_cost?: number;
}

interface ConfirmQuoteResult {
    success: boolean;
    error?: string;
}

export async function confirmQuote(input: ConfirmQuoteInput): Promise<ConfirmQuoteResult> {
    const {
        token,
        client_phone,
        client_address,
        comuna_name,
        comuna_other,
        guests,
        event_type_id,
        event_type_other,
        items: updatedItems,
        event_date,
        start_time,
        pickup_date,
        pickup_time,
        comments,
        dispenser,
        installation_cost
    } = input;

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

        // ─── 2. Validar campos requeridos ─────────────────────────────────────
        const finalPhone = client_phone?.trim() || quote.client_phone;
        const finalAddress = client_address?.trim() || quote.client_address;
        const finalEventDate = event_date || quote.event_date;
        const finalComunaName = comuna_name || quote.comuna_name;
        const finalComunaOther = comuna_other !== undefined ? comuna_other : quote.comuna_other;
        const finalGuests = guests !== undefined ? guests : quote.guests;

        const finalStartTime = start_time || quote.start_time;
        const finalPickupDate = pickup_date || quote.pickup_date;
        const finalPickupTime = pickup_time || quote.pickup_time;

        const isSameDayPickup = finalPickupDate === finalEventDate;

        if (!finalPhone || !finalAddress || !finalEventDate || !finalComunaName || !finalGuests || !finalStartTime || !finalPickupDate || (!isSameDayPickup && !finalPickupTime)) {
            return { success: false, error: 'Por favor completa todos los campos (Teléfono, Dirección, Comuna, Fecha, Invitados, Horarios y Retiro).' };
        }

        if (!updatedItems || updatedItems.length === 0) {
            return { success: false, error: 'La cotización debe tener al menos un producto.' };
        }

        // ─── 3. Procesar cambios en items y recalcular totales ────────────────
        let totalNormalPrice = 0;
        let totalOfferPrice = 0;
        let totalLiters = 0;

        for (const item of updatedItems) {
            totalNormalPrice += item.price_at_time * item.quantity;
            totalOfferPrice += item.offer_price_at_time * item.quantity;
            totalLiters += getSizeLiters(item.size) * item.quantity;
        }

        // Recalcular envío basado en la comuna (usando la nueva si existe)
        let finalShippingCost = quote.shipping_cost;
        const { data: comuna } = await db.from('comunas').select().eq('name', finalComunaName).single();
        if (comuna && comuna.free_from !== null) {
            if (totalLiters >= comuna.free_from) {
                finalShippingCost = 0;
            } else {
                finalShippingCost = comuna.cost || 0;
            }
        }

        const finalInstallationCost = installation_cost !== undefined ? installation_cost : quote.installation_cost;
        const finalPrice = totalOfferPrice + finalShippingCost + finalInstallationCost;

        // ─── 4. Sincronizar items en la base de datos ────────────────────────
        // a) Eliminar items que ya no están
        const currentIds = updatedItems.filter(i => !i.id?.includes('temp-')).map(i => i.id);
        await db.from('quote_items')
            .delete()
            .eq('quote_id', quote.id)
            .not('id', 'in', `(${currentIds.join(',') || 'NULL'})`);

        // b) Actualizar existentes e insertar nuevos
        for (const item of updatedItems) {
            if (item.id?.includes('temp-')) {
                // Nuevo item
                await db.from('quote_items').insert({
                    quote_id: quote.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    size: item.size,
                    quantity: item.quantity,
                    price_at_time: item.price_at_time,
                    offer_price_at_time: item.offer_price_at_time
                });
            } else {
                // Actualizar existente
                await db.from('quote_items')
                    .update({ quantity: item.quantity })
                    .eq('id', item.id);
            }
        }

        // ─── 5. Actualizar la Cotización ───────────────────────────────
        const { error: updateQuoteError } = await db
            .from('quotes')
            .update({
                status: 'confirmed',
                client_phone: finalPhone,
                client_address: finalAddress,
                comuna_name: finalComunaName,
                comuna_other: finalComunaOther,
                guests: finalGuests,
                event_type_id: event_type_id || quote.event_type_id,
                event_type_other: event_type_other !== undefined ? event_type_other : quote.event_type_other,
                event_date: finalEventDate,
                start_time: start_time || quote.start_time,
                pickup_date: pickup_date !== undefined ? pickup_date : quote.pickup_date,
                pickup_time: pickup_time !== undefined ? pickup_time : quote.pickup_time,
                comments: comments !== undefined ? comments : quote.comments,
                total_normal_price: totalNormalPrice,
                total_offer_price: totalOfferPrice,
                total_price: finalPrice,
                total_liters: totalLiters,
                shipping_cost: finalShippingCost, // Guardar el nuevo costo de envío
                dispenser: dispenser || quote.dispenser,
                installation_cost: finalInstallationCost,
                updated_at: new Date().toISOString()
            })
            .eq('token', token);

        if (updateQuoteError) {
            console.error('Error actualizando quote:', updateQuoteError);
            return { success: false, error: 'No se pudo confirmar la reserva.' };
        }

        // ─── 6. Enviar emails y disparar webhook ───────
        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            status: 'confirmed',
            client_phone: finalPhone,
            client_address: finalAddress,
            comuna_name: finalComunaName,
            comuna_other: finalComunaOther,
            guests: finalGuests,
            event_type_id: event_type_id || quote.event_type_id,
            event_type_other: event_type_other !== undefined ? event_type_other : quote.event_type_other,
            event_date: finalEventDate,
            start_time: start_time || quote.start_time,
            pickup_date: pickup_date !== undefined ? pickup_date : quote.pickup_date,
            pickup_time: pickup_time !== undefined ? pickup_time : quote.pickup_time,
            comments: comments !== undefined ? comments : quote.comments,
            total_normal_price: totalNormalPrice,
            total_offer_price: totalOfferPrice,
            total_price: finalPrice,
            total_liters: totalLiters,
            shipping_cost: finalShippingCost,
            dispenser: dispenser || quote.dispenser,
            installation_cost: finalInstallationCost,
            quote_items: updatedItems,
        };

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
                console.error('Error enviando email:', emailErr);
            }
        }

        if (MAKE_WEBHOOK_URL) {
            try {
                // Calcular fecha ISO de inicio usando la hora del evento
                const startTimeStr = (fullQuote.start_time && fullQuote.start_time !== '--:--') ? fullQuote.start_time : '12:00';
                const isoStart = fullQuote.event_date ? new Date(`${fullQuote.event_date}T${startTimeStr}:00`).toISOString() : null;

                // Estimar fin (ej: 3 horas después)
                const isoEnd = isoStart ? new Date(new Date(isoStart).getTime() + 3 * 60 * 60 * 1000).toISOString() : null;

                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cocktailsontap.cl';
                const resumeLink = `${siteUrl}/cotizar/${fullQuote.token}`;
                const dispenserLabel = fullQuote.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil';
                const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

                const itemsDetailed = fullQuote.quote_items
                    .map(i => `${i.quantity}x ${i.product_name} (${i.size}) ${currency.format(i.offer_price_at_time * i.quantity)}`)
                    .join('\n');

                const pickupDateDisplay = fullQuote.pickup_date
                    ? new Date(fullQuote.pickup_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '';

                const payload = {
                    title: `🍸 RESERVA: ${fullQuote.client_name} – ${fullQuote.guests} invitados`,
                    customerName: fullQuote.client_name,
                    summary: `${fullQuote.guests} invitados, ${fullQuote.quote_items.length} productos`,
                    description: [
                        `Nombre: ${fullQuote.client_name}`,
                        `Teléfono: ${fullQuote.client_phone}`,
                        `Email: ${fullQuote.client_email}`,
                        `Dirección: ${fullQuote.client_address}, ${fullQuote.comuna_name === 'Otra' ? fullQuote.comuna_other : fullQuote.comuna_name}`,
                        `Evento: ${fullQuote.event_type_other || fullQuote.event_type_id} (${fullQuote.guests} pers.)`,
                        fullQuote.pickup_date ? `Retiro: ${pickupDateDisplay} (${fullQuote.pickup_time || 'Rango no especificado'})` : '',
                        fullQuote.comments ? `Notas: ${fullQuote.comments}` : '',
                        ``,
                        `Productos:`,
                        itemsDetailed,
                        `Transporte: ${currency.format(fullQuote.shipping_cost)}`,
                        `${dispenserLabel}: ${currency.format(fullQuote.installation_cost)}`,
                        `Total: ${currency.format(fullQuote.total_price)}`,
                        ``,
                        `Ver cotización: ${resumeLink}`
                    ].filter(Boolean).join('\n'),
                    start_date: isoStart,
                    end_date: isoEnd,
                    location: `${fullQuote.client_address}, ${fullQuote.comuna_name}`,
                    guests_email: fullQuote.client_email,
                    guests: fullQuote.guests,
                };

                await fetch(MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (webhookErr) {
                console.error('Error webhook:', webhookErr);
            }
        }

        return { success: true };
    } catch (err) {
        console.error('Error inesperado en confirmQuote:', err);
        return { success: false, error: 'Error inesperado.' };
    }
}

function getSizeLiters(size: string): number {
    if (size.includes('30L')) return 30;
    if (size.includes('20L')) return 20;
    if (size.includes('10L')) return 10;
    if (size.includes('5L')) return 5;
    return 10;
}

