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

        const db = createServerClient();

        // ─── 2. CARGA Y VALIDACIÓN DE ESTADO ─────────────────────────────────────
        const { data: quote, error: fetchError } = await db
            .from('quotes')
            .select('*')
            .eq('token', data.token)
            .single();

        if (fetchError || !quote) {
            return { success: false, error: 'No se encontró la cotización especificada.' };
        }

        if (quote.status === 'confirmed') {
            return { success: false, error: 'Esta cotización ya fue confirmada anteriormente.' };
        }

        // ─── 2.5 VALIDACIÓN CONDICIONAL (Uso de service_type como fuente de verdad) 
        const isDirect = quote.service_type === 'direct';
        
        if (!isDirect) {
            if (!data.guests || (data.guests && data.guests < 1)) return { success: false, error: 'La cantidad de invitados debe ser al menos 1.' };
            if (!data.event_type_id) return { success: false, error: 'La temática es obligatoria para eventos.' };
            if (!data.start_time || data.start_time.length < 4) return { success: false, error: 'La hora de inicio es obligatoria.' };
            if (!data.pickup_date) return { success: false, error: 'La fecha de retiro es obligatoria.' };
        }

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
                type: data.event_type_id || '',
                otherType: '',
                date: data.event_date || '',
                startTime: data.start_time || '',
                pickupDate: data.pickup_date || '',
                pickupTime: '',
            },
            consumption: {
                guests: data.guests || 0,
                drinksPerPerson: 3,
            },
            contact: {
                firstName: quote.client_name,
                lastName: data.client_lastname || '',
                email: quote.client_email || '',
                phone: data.client_phone,
                address: data.client_address,
                comuna: data.comuna_name,
                otherComuna: data.comuna_other || '',
                comments: '',
            },
            dispenser: data.dispenser as any,
            step: 0,
            serviceType: quote.service_type as any, // Prioridad absoluta al valor de la DB
            expandedCocktailId: null,
            expandedCategoryId: '',
        }, cocktails, comunas);

        const totalNormalPrice = summary.totalNormalPrice;
        const totalOfferPrice = summary.totalOfferPrice;
        const totalLiters = summary.totalLiters;
        const finalShippingCost = summary.shippingCost;
        const finalInstallationCost = summary.installationCost;
        const finalTotalPrice = summary.totalPrice;

        // ─── 4. PERSISTENCIA EN BASE DE DATOS (Items y Metadata) ─────────────
        const dbOps = [];
        
        // a) Sincronizar Cotización Items
        const updatedItemIds = data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id);
        dbOps.push(
            db.from('quote_items')
                .delete()
                .eq('quote_id', quote.id)
                .not('id', 'in', `(${updatedItemIds.join(',') || 'NULL'})`)
        );

        const newItems = data.items.filter(i => !i.id || i.id.includes('temp-')).map(item => ({
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
        }));

        if (newItems.length > 0) {
            dbOps.push(db.from('quote_items').insert(newItems));
        }

        const existingItemsToUpdate = data.items.filter(i => i.id && !i.id.includes('temp-'));
        if (existingItemsToUpdate.length > 0) {
            // Upsert works as a batch update if IDs are provided
            dbOps.push(db.from('quote_items').upsert(
                existingItemsToUpdate.map(i => ({ id: i.id, quantity: i.quantity }))
            ));
        }

        // b) Actualizar datos maestros del Cliente (CRM)
        if (quote.client_id) {
            const clientUpdate: any = {};
            if (data.client_lastname?.trim()) clientUpdate.last_name = data.client_lastname.trim();
            if (data.client_phone?.trim()) clientUpdate.phone = data.client_phone.trim();

            if (Object.keys(clientUpdate).length > 0) {
                dbOps.push(db.from('clients').update(clientUpdate).eq('id', quote.client_id));
            }
        }

        // c) Finalizar actualización de la Cotización Principal
        dbOps.push(db.from('quotes').update({
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
            status: 'confirmed', // CONFIRMACIÓN ATÓMICA
        }).eq('token', data.token));

        // Wait for all DB updates to complete
        const dbResults = await Promise.all(dbOps);
        const hasDbError = dbResults.some(r => r.error);
        if (hasDbError) {
            const firstError = dbResults.find(r => r.error)?.error;
            throw firstError;
        }

        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            ...data,
            status: 'confirmed',
            total_price: finalTotalPrice,
            shipping_cost: finalShippingCost,
            installation_cost: finalInstallationCost,
            quote_items: data.items as QuoteItem[],
        };

        // ─── 5. SINCRONIZACIÓN Y COMUNICACIONES (Paralelizado) ────────────────
        const resendKey = process.env.RESEND_API_KEY;
        
        // Ejecutamos Sync y Preparación de Emails en paralelo
        const [syncResult, emailData] = await Promise.all([
            // Google Sync
            (async () => {
                try {
                    await GoogleSyncService.updateContactConfirmedStatus(fullQuote);
                    const isDirect = quote.service_type === 'direct';
                    const { eventId, pickupEventId } = await GoogleSyncService.scheduleCalendarEvents(fullQuote, { isDirectSaleOverride: isDirect });
                    if (eventId || pickupEventId) {
                        const db = createServerClient();
                        await db.from('quotes').update({
                            ...(eventId && { google_event_id: eventId }),
                            ...(pickupEventId && { google_pickup_event_id: pickupEventId }),
                        }).eq('id', fullQuote.id);
                    }
                } catch (e) {
                    console.error('Google Sync failed in confirmQuote:', e);
                }
            })(),
            // Preparación de Emails (Render + Subjects)
            (async () => {
                if (!resendKey) return null;
                try {
                    const { render } = await import('@react-email/components');
                    const ConfirmationEmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;

                    const eventDate = fullQuote.event_date
                        ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                        : '';
                    const fullName = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();
                    const emailVars = { full_name: fullName, event_date: eventDate };

                    const [adminHtml, clientHtml, adminSubject, clientSubject] = await Promise.all([
                        render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: true })),
                        render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: false })),
                        SettingsService.getResolvedValue('email_quote_confirmed_admin_subject', emailVars, `✅ [Reserva Confirmada] ${fullName} – ${eventDate}`),
                        SettingsService.getResolvedValue('email_quote_confirmed_subject', emailVars, `✅ Reserva confirmada – ${eventDate}`)
                    ]);

                    return { adminHtml, clientHtml, adminSubject, clientSubject, fullName, eventDate };
                } catch (err) {
                    console.error('Email preparation error:', err);
                    return null;
                }
            })()
        ]);

        // Envío final de correos (Acl para no bloquear el retorno exitoso)
        if (resendKey && emailData) {
            const resend = new Resend(resendKey);
            Promise.allSettled([
                resend.emails.send({
                    from: FROM_EMAIL,
                    to: ADMIN_EMAIL,
                    subject: emailData.adminSubject,
                    html: emailData.adminHtml,
                }),
                ...(fullQuote.client_email ? [
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: fullQuote.client_email,
                        subject: emailData.clientSubject,
                        html: emailData.clientHtml,
                    })
                ] : [])
            ]).catch(e => console.error('Final email send failed:', e));
        }

        revalidatePath(`/cotizar/${validation.data.token}`);
        return { success: true };
    } catch (err) {
        console.error('Error in confirmQuote:', err);
        return { success: false, error: 'Error inesperado.' };
    }
}
