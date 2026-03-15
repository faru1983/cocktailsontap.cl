'use server';

import * as React from 'react';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { ConfirmQuoteSchema } from '@/lib/types';
import type { Quote, QuoteItem } from '@/lib/types';
import { getSizeLiters } from '@/lib/wizardLogic';
import { 
    ADMIN_EMAIL, 
    FROM_EMAIL, 
    MURO_INSTALLATION_COST, 
    MURO_COMPATIBLE_SIZES, 
    MURO_MIN_LITERS 
} from '@/lib/config';

import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { createServerClient } from '@/lib/supabaseServer'; // temporal while some logic resides here

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
        const db = createServerClient();

        // ─── 2. CARGA Y CONFIRMACIÓN BÁSICA DE COTIZACIÓN ─────────────────────
        const confirmResult = await QuoteService.confirmQuote(data.token);
        if (!confirmResult.success || !confirmResult.quote) {
             return { success: false, error: confirmResult.error || 'Error al confirmar la cotización.' };
        }
        const quote = confirmResult.quote;

        // ─── 3. RECALCULO DE SEGURIDAD (Server-Side) ──────────────────────────
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

        // Recalcular instalación del Muro
        const hasIncompatibleSize = data.items.some(i => !MURO_COMPATIBLE_SIZES.includes(getSizeLiters(i.size)));
        const canHaveMuro = !hasIncompatibleSize && totalLiters >= MURO_MIN_LITERS;
        const finalInstallationCost = (data.dispenser === 'muro' && canHaveMuro) ? MURO_INSTALLATION_COST : 0;
        const finalTotalPrice = totalOfferPrice + finalShippingCost + finalInstallationCost;

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

        // ─── 5. SINCRONIZACIÓN ASÍNCRONA (Non-blocking) ──────────────────────
        
        // Google Sync Orchestration
        const runGoogleSync = async () => {
             try {
                // Not ideal but we pass fullQuote which now has updated fields
                await GoogleSyncService.updateContactConfirmedStatus(fullQuote);
                await GoogleSyncService.scheduleCalendarEvents(fullQuote);
             } catch(e) { console.error('Non-blocking Google Sync failed:', e); }
        };
        runGoogleSync();

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

                emailPromises.push(resend.emails.send({
                    from: FROM_EMAIL,
                    to: ADMIN_EMAIL,
                    subject: `✅ [Reserva Confirmada] ${fullName} – ${eventDate}`,
                    html: adminHtml,
                }));

                if (fullQuote.client_email) {
                    emailPromises.push(resend.emails.send({
                        from: FROM_EMAIL,
                        to: fullQuote.client_email,
                        subject: `✅ Reserva confirmada – ${eventDate}`,
                        html: clientHtml,
                    }));
                }
                Promise.allSettled(emailPromises).catch(e => console.error('Non-blocking Resend failed:', e));
            } catch (err) { console.error('Email error:', err); }
        }

        revalidatePath(`/cotizar/${validation.data.token}`);
        return { success: true };
    } catch (err) {
        console.error('Error in confirmQuote:', err);
        return { success: false, error: 'Error inesperado.' };
    }
}
