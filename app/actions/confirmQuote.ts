'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import { buildQuoteConfirmedEmail, buildAdminConfirmationNotificationEmail } from '@/lib/emails';
import { revalidatePath } from 'next/cache';
import { ConfirmQuoteSchema } from '@/lib/types';
import type { Quote, QuoteItem } from '@/lib/types';
import { getSizeLiters, formatEventDate } from '@/lib/wizardLogic';
import { 
    SITE_URL, 
    ADMIN_EMAIL, 
    FROM_EMAIL, 
    MURO_INSTALLATION_COST, 
    MURO_COMPATIBLE_SIZES, 
    MURO_MIN_LITERS 
} from '@/lib/config';

import { syncGoogleContact, createGoogleEvent, CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID } from '@/lib/googleSync';

interface ConfirmQuoteResult {
    success: boolean;
    error?: string;
}

/**
 * Acción de servidor para confirmar una cotización draft.
 * Realiza validaciones de seguridad, recalcula totales en el servidor,
 * actualiza los datos del cliente, dispara correos y notifica a Make.com.
 */
export async function confirmQuote(input: any): Promise<ConfirmQuoteResult> {
    try {
        // ─── 1. VALIDACIÓN DE ESQUEMA (Zod) ───────────────────────────────────
        // Asegura que los datos recibidos del cliente tengan el formato y tipos correctos.
        const validation = ConfirmQuoteSchema.safeParse(input);
        if (!validation.success) {
            console.error('Validation Error:', validation.error.format());
            return { success: false, error: 'Datos de confirmación incompletos o inválidos.' };
        }

        const data = validation.data;
        const db = createServerClient();

        // ─── 2. CARGA DE COTIZACIÓN ───────────────────────────────────────────
        const { data: quote, error: fetchError } = await db
            .from('quotes')
            .select('*, quote_items(*), clients(google_contact_id)')
            .eq('token', data.token)
            .single();

        if (fetchError || !quote) {
            return { success: false, error: 'Cotización no encontrada.' };
        }

        // Solo se pueden confirmar cotizaciones en estado 'draft'.
        if (quote.status !== 'draft') {
            return { success: false, error: `Esta cotización ya está "${quote.status}".` };
        }

        // ─── 3. RECALCULO DE SEGURIDAD (Server-Side) ──────────────────────────
        // No confiamos en los totales enviados por el cliente. Recalculamos todo aquí.
        let totalNormalPrice = 0;
        let totalOfferPrice = 0;
        let totalLiters = 0;

        for (const item of data.items) {
            totalNormalPrice += item.price_at_time * item.quantity;
            totalOfferPrice += item.offer_price_at_time * item.quantity;
            totalLiters += getSizeLiters(item.size) * item.quantity;
        }

        // Recalcular costo de envío basado en la comuna oficial de la DB.
        let finalShippingCost = quote.shipping_cost;
        const { data: comunaData } = await db.from('comunas').select().eq('name', data.comuna_name).single();
        if (comunaData && comunaData.free_from !== null) {
            finalShippingCost = (totalLiters >= comunaData.free_from) ? 0 : (comunaData.cost || 0);
        }

        // Recalcular instalación del Muro (solo si es compatible y tiene los litros mínimos).
        const hasIncompatibleSize = data.items.some(i => !MURO_COMPATIBLE_SIZES.includes(getSizeLiters(i.size)));
        const canHaveMuro = !hasIncompatibleSize && totalLiters >= MURO_MIN_LITERS;
        const finalInstallationCost = (data.dispenser === 'muro' && canHaveMuro) ? MURO_INSTALLATION_COST : 0;
        const finalTotalPrice = totalOfferPrice + finalShippingCost + finalInstallationCost;

        // ─── 4. PERSISTENCIA EN BASE DE DATOS ────────────────────────────────
        
        // a) Sincronizar Cotización Items:
        // Borramos los que el cliente eliminó y actualizamos/insertamos los nuevos.
        const updatedItemIds = data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id);
        await db.from('quote_items')
            .delete()
            .eq('quote_id', quote.id)
            .not('id', 'in', `(${updatedItemIds.join(',') || 'NULL'})`);

        for (const item of data.items) {
            if (!item.id || item.id.includes('temp-')) {
                // Nuevo item agregado durante la revisión del draft.
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
                // Actualizar cantidad de item existente.
                await db.from('quote_items').update({ quantity: item.quantity }).eq('id', item.id);
            }
        }

        // b) Actualizar datos maestros del Cliente (CRM).
        if (quote.client_id) {
            const clientUpdate: any = {};
            if (data.client_lastname?.trim()) clientUpdate.last_name = data.client_lastname.trim();
            if (data.client_phone?.trim()) clientUpdate.phone = data.client_phone.trim();

            if (Object.keys(clientUpdate).length > 0) {
                await db.from('clients').update(clientUpdate).eq('id', quote.client_id);
            }
        }

        // c) Finalizar actualización de la Cotización Principal.
        const { error: updateError } = await db.from('quotes').update({
            status: 'confirmed',
            client_phone: data.client_phone,
            client_lastname: data.client_lastname || null,
            client_address: data.client_address,
            comuna_name: data.comuna_name,
            comuna_other: data.comuna_other || null,
            guests: data.guests,
            event_type_id: data.event_type_id,
            event_type_other: data.event_type_other || null,
            event_date: data.event_date,
            start_time: data.start_time,
            pickup_date: data.pickup_date,
            pickup_time: data.pickup_time || null,
            comments: data.comments || null,
            total_normal_price: totalNormalPrice,
            total_offer_price: totalOfferPrice,
            total_price: finalTotalPrice,
            total_liters: totalLiters,
            shipping_cost: finalShippingCost,
            dispenser: data.dispenser,
            installation_cost: finalInstallationCost,
            updated_at: new Date().toISOString()
        }).eq('token', data.token);

        if (updateError) throw updateError;

        // ─── 5. COMUNICACIONES (Emails vía Resend) ───────────────────────────
        
        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            ...data,
            status: 'confirmed',
            total_price: finalTotalPrice,
            shipping_cost: finalShippingCost,
            installation_cost: finalInstallationCost,
            quote_items: data.items as QuoteItem[],
        };

        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
            try {
                const resend = new Resend(resendKey);
                const emailPromises = [];

                // Notificar al Admin de la nueva reserva.
                emailPromises.push(resend.emails.send({
                    from: FROM_EMAIL,
                    to: ADMIN_EMAIL,
                    subject: buildAdminConfirmationNotificationEmail(fullQuote).subject,
                    html: buildAdminConfirmationNotificationEmail(fullQuote).html,
                }));

                // Notificar al cliente con los datos de transferencia.
                if (fullQuote.client_email) {
                    emailPromises.push(resend.emails.send({
                        from: FROM_EMAIL,
                        to: fullQuote.client_email,
                        subject: buildQuoteConfirmedEmail(fullQuote).subject,
                        html: buildQuoteConfirmedEmail(fullQuote).html,
                    }));
                }
                await Promise.allSettled(emailPromises);
            } catch (err) { console.error('Email error:', err); }
        }

        // ─── 6. SINCRONIZACIÓN CON GOOGLE (Calendar y Contacts) ─────────────
        try {
            const fullName = `${fullQuote.client_name}${fullQuote.client_lastname ? ' ' + fullQuote.client_lastname : ''}`;
            const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

            const productLines = data.items.map(item => 
                `${item.size} ${item.product_name} (x${item.quantity}) ${currency.format(item.offer_price_at_time * item.quantity)}`
            ).join('\n');

            const dispenserLabel = data.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil';

            const description = [
                `Nombre: ${fullName}`,
                `Teléfono: ${data.client_phone}`,
                `Email: ${fullQuote.client_email || 'No especificado'}`,
                `Dirección: ${data.client_address}, ${data.comuna_name === 'Otra' ? data.comuna_other : data.comuna_name}`,
                `Evento: ${data.event_type_other || data.event_type_id} (${data.guests} pers.)`,                        
                `Fecha: ${formatEventDate(data.event_date)} (${data.start_time}hrs)`,
                data.pickup_date ? `Retiro: ${formatEventDate(data.pickup_date)} (${data.pickup_time || 'Rango no especificado'})` : null,
                data.comments ? `Notas: ${data.comments}` : null,
                '',
                `Ver cotización: ${SITE_URL}/cotizar/${data.token}`,
                '',
                `Productos:`,
                productLines,
                `Transporte: ${currency.format(finalShippingCost)}`,
                `${dispenserLabel}: ${currency.format(finalInstallationCost)}`,
                `Total: ${currency.format(finalTotalPrice)}`,
            ].filter(line => line !== null).join('\n');

            const comunaLocation = data.comuna_name === 'Otra' ? data.comuna_other : data.comuna_name;
            const fullLocation = `${data.client_address || ''}, ${comunaLocation || ''}`.replace(/^, /, '');

            // a) Sincronizar Contacto
            if (fullQuote.client_email) {
                const googleContactId = await syncGoogleContact({
                    resourceName: (quote as any).clients?.google_contact_id || undefined,
                    firstName: fullQuote.client_name,
                    lastName: data.client_lastname || undefined,
                    email: fullQuote.client_email,
                    phone: data.client_phone,
                    address: data.client_address.trim() ? fullLocation : undefined,
                    notes: data.comments || undefined,
                    eventDate: data.event_date,
                    quoteUrl: `${SITE_URL}/cotizar/${data.token}`,
                    confirmed: true
                }).catch(err => {
                    console.error('Error syncing contact:', err);
                    return null;
                });

                if (googleContactId && quote.client_id && googleContactId !== (quote as any).clients?.google_contact_id) {
                    await db.from('clients').update({ google_contact_id: googleContactId }).eq('id', quote.client_id);
                }
            }

            // b) Crear Evento de Reserva (Montaje)
            const startTimeStr = (data.start_time && data.start_time !== '--:--') ? data.start_time : '12:00';
            const isoStart = `${data.event_date}T${startTimeStr}:00`;

            await createGoogleEvent(CALENDAR_RESERVA_ID, {
                summary: `Cócteles - ${fullName} ${data.guests}px`,
                location: fullLocation,
                description: description,
                startISO: isoStart,
                endISO: isoStart, // El calendario lo maneja o podemos sumar X horas
            }).catch(err => console.error('Error creating reserva event:', err));

            // c) Crear Evento de Retiro
            if (data.pickup_date) {
                let pickupStart = `${data.pickup_date}T00:00:00`;
                let pickupEnd = `${data.pickup_date}T23:59:59`;
                let isAllDay = false;

                if (data.pickup_date === data.event_date) {
                    isAllDay = true;
                } else if (data.pickup_time?.includes(' a ')) {
                    const parts = data.pickup_time.split(' a ');
                    const startH = parts[0].trim();
                    const endH = parts[1].trim().replace('hrs', '').trim();
                    pickupStart = `${data.pickup_date}T${startH}:00`;
                    pickupEnd = `${data.pickup_date}T${endH}:00`;
                    isAllDay = false;
                } else {
                    isAllDay = true;
                }

                await createGoogleEvent(CALENDAR_RETIRO_ID, {
                    summary: `Retiro - ${fullName}`,
                    location: fullLocation,
                    description: description,
                    startISO: pickupStart,
                    endISO: pickupEnd,
                    isAllDay: isAllDay
                }).catch(err => console.error('Error creating retiro event:', err));
            }

        } catch (err) {
            console.error('Google Sync Error:', err);
        }

        revalidatePath(`/cotizar/${validation.data.token}`);
        return { success: true };
    } catch (err) {
        console.error('Error in confirmQuote:', err);
        return { success: false, error: 'Error inesperado.' };
    }
}
