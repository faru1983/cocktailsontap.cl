'use server';

import * as React from 'react';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { ConfirmQuoteSchema } from '@/lib/types';
import type { Quote, QuoteItem } from '@/lib/types';
import { 
    ADMIN_EMAIL, 
    FROM_EMAIL, 
    MURO_INSTALLATION_COST, 
    MURO_COMPATIBLE_SIZES, 
    MURO_MIN_LITERS 
} from '@/lib/config';

import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { SettingsService } from '@/lib/services/settingsService';
import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData } from '@/lib/serverData';
import { calculateSummaryData } from '@/lib/wizardLogic';

interface ConfirmQuoteResult {
    success: boolean;
    error?: string;
}

export async function confirmQuote(input: any): Promise<ConfirmQuoteResult> {
    try {
        // ─── 1. VALIDACIÓN DE ESQUEMA (Zod) ───────────────────────────────────
        const validation = ConfirmQuoteSchema.safeParse(input);
        if (!validation.success) {
            console.error('Validation Error:', validation.error.format());
            return { success: false, error: 'Datos de confirmación incompletos o inválidos.' };
        }

        const data = validation.data;

        // ─── 1.5 VALIDACIÓN CONDICIONAL (Eventos) ──────────────────────────────
        if (data.dispenser !== 'desechable') {
            if (!data.guests || (data.guests && data.guests < 10)) return { success: false, error: 'Mínimo 10 invitados para eventos.' };
            if (!data.event_type_id) return { success: false, error: 'La temática es obligatoria para eventos.' };
            if (!data.start_time || data.start_time.length < 4) return { success: false, error: 'La hora de inicio es obligatoria.' };
            if (!data.pickup_date) return { success: false, error: 'La fecha de retiro es obligatoria.' };
        }

        const db = createServerClient();

        // ─── 2. CARGA Y CONFIRMACIÓN BÁSICA DE COTIZACIÓN ─────────────────────
        const confirmResult = await QuoteService.confirmQuote(data.token);
        if (!confirmResult.success || !confirmResult.quote) {
             return { success: false, error: confirmResult.error || 'Error al confirmar la cotización.' };
        }
        const quote = confirmResult.quote;

        // ─── 3. RECALCULO DE SEGURIDAD (Server-Side Zero Trust) ─────────────
        // Fetch current data to ensure calculations use the latest prices/rules
        const { cocktails, comunas } = await fetchAllProductData();

        const summary = calculateSummaryData({
            selections: data.items.map(i => ({
                id: i.product_id!,
                size: i.size,
                quantity: i.quantity,
                customPrice: i.offer_price_at_time
            })),
            eventData: {
                date: data.event_date,
                startTime: data.start_time || '',
                guests: data.guests || 0,
                eventType: data.event_type_id || '',
            },
            contact: {
                firstName: quote.client_name,
                lastName: data.client_lastname || '',
                email: quote.client_email || '',
                phone: data.client_phone,
                address: data.client_address,
                comuna: data.comuna_name,
                otherComuna: data.comuna_other || '',
            },
            dispenser: data.dispenser as any
        }, cocktails, comunas);

        const totalNormalPrice = summary.totalNormalPrice;
        const totalOfferPrice = summary.totalOfferPrice;
        const totalLiters = summary.totalLiters;
        const finalShippingCost = summary.shippingCost;
        const finalInstallationCost = summary.installationCost;
        const finalTotalPrice = summary.totalPrice;

        // ─── 4. PERSISTENCIA EN BASE DE DATOS (Items y Metadata) ─────────────
        
        // a) Sincronizar Cotización Items:
        const updatedItemIds = data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id);
        await db.from('quote_items')
            .delete()
            .eq('quote_id', quote.id)
            .not('id', 'in', `(${updatedItemIds.join(',') || 'NULL'})`);

        for (const item of data.items) {
            if (!item.id || item.id.includes('temp-')) {
                await db.from('quote_items').insert({
                    quote_id: quote.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    size: item.size,
                    size_value: item.size_value,
                    unit_id: item.unit_id,
                    is_disposable: item.is_disposable,
                    quantity: item.quantity,
                    price_at_time: item.price_at_time,
                    offer_price_at_time: item.offer_price_at_time
                });
            } else {
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
        }).eq('token', data.token);

        if (updateError) throw updateError;

        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            ...data,
            status: 'confirmed',
            total_price: finalTotalPrice,
            shipping_cost: finalShippingCost,
            installation_cost: finalInstallationCost,
            quote_items: data.items as QuoteItem[],
        };

        // ─── 5. SINCRONIZACIÓN (Google Sync Orchestration) ───────────────────
        try {
            await GoogleSyncService.updateContactConfirmedStatus(fullQuote);
            const { eventId, pickupEventId } = await GoogleSyncService.scheduleCalendarEvents(fullQuote);
            // Save Google Calendar event IDs for future edits (Editor Maestro)
            if (eventId || pickupEventId) {
                const db = createServerClient();
                await db.from('quotes').update({
                    ...(eventId && { google_event_id: eventId }),
                    ...(pickupEventId && { google_pickup_event_id: pickupEventId }),
                }).eq('id', fullQuote.id);
            }
        } catch(e) { 
            console.error('Google Sync failed in confirmQuote:', e);
        }

        // ─── 6. COMUNICACIONES (Emails vía Resend Non-blocking) ──────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
            try {
                const resend = new Resend(resendKey);
                const emailPromises = [];

                const { render } = await import('@react-email/components');
                const ConfirmationEmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;

                const adminHtml = await render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: true }));
                const clientHtml = await render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: false }));

                const eventDate = fullQuote.event_date
                    ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '';
                const fullName = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();


                const emailVars = {
                    full_name: fullName,
                    event_date: eventDate
                };

                const isDirect = fullQuote.dispenser === 'desechable';

                const adminSubject = await SettingsService.getResolvedValue(
                    isDirect ? 'email_direct_sale_confirmed_admin_subject' : 'email_quote_confirmed_admin_subject',
                    emailVars,
                    isDirect ? `✅ [Compra Confirmada] ${fullName} – ${eventDate}` : `✅ [Reserva Confirmada] ${fullName} – ${eventDate}`
                );

                const clientSubject = await SettingsService.getResolvedValue(
                    isDirect ? 'email_direct_sale_confirmed_subject' : 'email_quote_confirmed_subject',
                    emailVars,
                    isDirect ? `✅ Compra confirmada – ${eventDate}` : `✅ Reserva confirmada – ${eventDate}`
                );

                emailPromises.push(resend.emails.send({
                    from: FROM_EMAIL,
                    to: ADMIN_EMAIL,
                    subject: adminSubject,
                    html: adminHtml,
                }));

                if (fullQuote.client_email) {
                    emailPromises.push(resend.emails.send({
                        from: FROM_EMAIL,
                        to: fullQuote.client_email,
                        subject: clientSubject,
                        html: clientHtml,
                    }));
                }
                await Promise.allSettled(emailPromises);
            } catch (err) { console.error('Email error:', err); }
        }

        revalidatePath(`/cotizar/${validation.data.token}`);
        return { success: true };
    } catch (err) {
        console.error('Error in confirmQuote:', err);
        return { success: false, error: 'Error inesperado.' };
    }
}
