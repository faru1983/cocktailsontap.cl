'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import * as React from 'react';
import { Resend } from 'resend';
import { ConfirmQuoteSchema, type Quote, type QuoteItem } from '@/lib/types';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { SettingsService } from '@/lib/services/settingsService';
import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData } from '@/lib/serverData';
import { calculateSummaryData, formatEventDate } from '@/lib/wizardLogic';

interface ConfirmQuoteResult {
    success: boolean;
    token?: string;
    error?: string;
}

/**
 * Server Action para confirmar una cotización borrador.
 * Realiza el recálculo de seguridad, actualiza la BD y sincroniza servicios externos.
 */
export async function confirmQuote(formData: any): Promise<ConfirmQuoteResult> {
    console.log('[ConfirmQuote] Iniciando flujo para token:', formData.token);
    try {
        // 1. Validar Datos
        const validation = ConfirmQuoteSchema.safeParse(formData);
        if (!validation.success) {
            console.error('[ConfirmQuote] Validación fallida:', validation.error);
            return { success: false, error: 'Datos de confirmación inválidos.' };
        }

        const { data } = validation;
        const db = createServerClient();

        // 2. Fetch Quote actual y Catálogo (Recálculo Zero Trust)
        const [ { data: quote, error: fetchError }, { cocktails, comunas } ] = await Promise.all([
            db.from('quotes').select('*').eq('token', data.token).single(),
            fetchAllProductData()
        ]);

        if (fetchError || !quote) {
            console.error('[ConfirmQuote] Error buscando cotización:', fetchError);
            return { success: false, error: 'Cotización no encontrada.' };
        }

        console.log('[ConfirmQuote] Cotización encontrada ID:', quote.id);

        if (quote.status === 'confirmed') {
            return { success: false, error: 'Esta cotización ya fue confirmada anteriormente.' };
        }

        // Determinar tipo de servicio
        const isDirect = quote.service_type === 'direct' || (quote.service_type === undefined && quote.dispenser === 'desechable');

        // 3. Recalcular Totales Server-Side (Seguridad Financiera)
        const summary = calculateSummaryData({
            ...quote,
            selections: data.items.map(i => ({
                id: i.product_id || 'manual',
                size: i.size,
                quantity: i.quantity,
                customPrice: i.offer_price_at_time
            })),
            serviceType: isDirect ? 'direct' : 'event',
            contact: {
                ...quote,
                firstName: quote.client_name,
                lastName: data.client_lastname || quote.client_lastname,
                email: quote.client_email,
                phone: data.client_phone || quote.client_phone,
                address: quote.client_address,
                comuna: quote.comuna_name,
                otherComuna: quote.comuna_other,
                comments: quote.comments
            },
            dispenser: data.dispenser as any,
            eventData: {
                date: quote.event_date,
                startTime: quote.start_time,
                pickupDate: quote.pickup_date,
                pickupTime: quote.pickup_time,
                type: quote.event_type_id
            }
        } as any, cocktails, comunas);

        const finalNormalPrice = summary.totalNormalPrice;
        const finalOfferPrice = summary.totalOfferPrice;
        const finalShippingCost = summary.shippingCost;
        const finalInstallationCost = summary.installationCost;
        const finalTotalPrice = finalOfferPrice + finalShippingCost + finalInstallationCost - (quote.manual_discount || 0);

        // 4. TRANSACCIÓN ATÓMICA EN BASE DE DATOS
        const dbOps: Promise<any>[] = [];

        // 4.a Actualizar Items (Eliminar antiguos, insertar nuevos con precios congelados)
        const updatedItemIds = data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id);
        dbOps.push(
            db.from('quote_items')
              .delete()
              .eq('quote_id', quote.id)
              .not('id', 'in', `(${updatedItemIds.join(',') || 'NULL'})`) as any
        );

        const newItems = data.items.map(item => ({
            quote_id: quote.id,
            product_id: item.product_id,
            product_name: item.product_name,
            size: item.size,
            quantity: item.quantity,
            price_at_time: item.price_at_time,
            offer_price_at_time: item.offer_price_at_time,
            size_value: item.size_value,
            unit_id: item.unit_id,
            is_disposable: item.is_disposable
        }));
        
        if (newItems.length > 0) {
            dbOps.push(db.from('quote_items').upsert(newItems, { onConflict: 'quote_id,product_id,size' }) as any);
        }

        // 4.b Actualizar Cliente
        if (quote.client_id) {
            const clientUpdate: any = {};
            if (data.client_lastname?.trim()) clientUpdate.last_name = data.client_lastname.trim();
            if (data.client_phone?.trim()) clientUpdate.phone = data.client_phone.trim();
            if (Object.keys(clientUpdate).length > 0) {
                dbOps.push(db.from('clients').update(clientUpdate).eq('id', quote.client_id) as any);
            }
        }

        // 4.c Actualizar Cotización Principal (Estado CONFIRMED)
        // Agregamos todos los campos editables que antes se perdían
        dbOps.push(db.from('quotes').update({
            client_lastname: data.client_lastname || quote.client_lastname,
            client_phone: data.client_phone || quote.client_phone,
            client_address: data.client_address,
            comuna_name: data.comuna_name,
            comuna_other: data.comuna_other || null,
            event_date: data.event_date,
            start_time: data.start_time || null,
            pickup_date: data.pickup_date || null,
            pickup_time: data.pickup_time || null,
            guests: data.guests ?? quote.guests,
            event_type_id: data.event_type_id || null,
            event_type_other: data.event_type_other || null,
            comments: data.comments || null,
            dispenser: data.dispenser,
            total_normal_price: finalNormalPrice,
            total_offer_price: finalOfferPrice,
            shipping_cost: finalShippingCost,
            installation_cost: finalInstallationCost,
            total_price: finalTotalPrice,
            total_liters: summary.totalLiters,
            status: 'confirmed', 
            updated_at: new Date().toISOString()
        }).eq('token', data.token) as any);

        console.log('[ConfirmQuote] Ejecutando operaciones de DB...');
        const dbResults = await Promise.all(dbOps);
        const hasDbError = dbResults.some(r => r.error);
        if (hasDbError) {
            const firstError = dbResults.find(r => r.error)?.error;
            throw firstError;
        }

        // 5. PREPARAR OBJETO COMPLETO PARA SINCRONIZACIÓN
        const fullQuote: Quote & { quote_items: QuoteItem[] } = {
            ...quote,
            client_lastname: data.client_lastname || quote.client_lastname,
            client_phone: data.client_phone || quote.client_phone,
            client_address: data.client_address,
            comuna_name: data.comuna_name,
            comuna_other: data.comuna_other || null,
            event_date: data.event_date,
            start_time: data.start_time || null,
            pickup_date: data.pickup_date || null,
            pickup_time: data.pickup_time || null,
            guests: data.guests ?? quote.guests,
            event_type_id: data.event_type_id || null,
            event_type_other: data.event_type_other || null,
            comments: data.comments || null,
            dispenser: data.dispenser,
            total_normal_price: finalNormalPrice,
            total_offer_price: finalOfferPrice,
            shipping_cost: finalShippingCost,
            installation_cost: finalInstallationCost,
            total_price: finalTotalPrice,
            total_liters: summary.totalLiters,
            status: 'confirmed',
            quote_items: data.items as any[]
        };

        // 6. TAREAS EN SEGUNDO PLANO (Evitar Timeout de Vercel)
        after(async () => {
            console.log('[ConfirmQuote:Background] Iniciando tareas asíncronas...');
            
            // 6.a Sincronización Google
            try {
                console.log('[ConfirmQuote:Background] Sincronizando con Google...');
                await GoogleSyncService.updateContactConfirmedStatus(fullQuote);
                const { eventId, pickupEventId } = await GoogleSyncService.scheduleCalendarEvents(fullQuote, { isDirectSaleOverride: isDirect });
                
                if (eventId || pickupEventId) {
                    console.log('[ConfirmQuote:Background] Google Sync OK. IDs:', { eventId, pickupEventId });
                    await db.from('quotes').update({
                        ...(eventId && { google_event_id: eventId }),
                        ...(pickupEventId && { google_pickup_event_id: pickupEventId }),
                    }).eq('id', fullQuote.id);
                }
            } catch (syncError: any) {
                console.error('[ConfirmQuote:Background] Error crítico en Google Sync:', syncError);
                await db.from('quotes').update({ 
                    comments: (fullQuote.comments || '') + `\n[LOG ERROR GOOGLE ${new Date().toISOString()}]: ${syncError.message || 'Error desconocido'}`
                }).eq('id', fullQuote.id);
            }

            // 6.b Envío de Emails
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
                try {
                    console.log('[ConfirmQuote:Background] Iniciando envío de emails...');
                    const resend = new Resend(resendKey);
                    const { render } = await import('@react-email/components');
                    const ConfirmationEmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;

                    const fullName = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();
                    const eventDate = fullQuote.event_date ? formatEventDate(fullQuote.event_date) : 'S/F';
                    const emailVars = { full_name: fullName, event_date: eventDate };

                    const [adminHtml, clientHtml, adminSubject, clientSubject] = await Promise.all([
                        render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: true })),
                        render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote, isAdmin: false })),
                        SettingsService.getResolvedValue('email_quote_confirmed_admin_subject', emailVars, `✅ [Reserva Confirmada] ${fullName} – ${eventDate}`),
                        SettingsService.getResolvedValue('email_quote_confirmed_subject', emailVars, `✅ Reserva confirmada – ${eventDate}`)
                    ]);

                    const emailResults = await Promise.allSettled([
                        resend.emails.send({
                            from: 'Cocktails on Tap <contacto@cocktailsontap.cl>',
                            to: ['faru1983@gmail.com'],
                            subject: adminSubject,
                            html: adminHtml
                        }),
                        resend.emails.send({
                            from: 'Cocktails on Tap <contacto@cocktailsontap.cl>',
                            to: [fullQuote.client_email!],
                            subject: clientSubject,
                            html: clientHtml
                        })
                    ]);
                    console.log('[ConfirmQuote:Background] Resultado envíos:', emailResults);
                } catch (emailError: any) {
                    console.error('[ConfirmQuote:Background] Error crítico en Emails:', emailError);
                }
            }
        });

        // 8. FINALIZAR
        console.log('[ConfirmQuote] Flujo finalizado con éxito para:', data.token);
        revalidatePath(`/cotizar/${data.token}`);
        return { success: true, token: data.token };

    } catch (error: any) {
        console.error('Error in confirmQuote Server Action:', error);
        return { success: false, error: 'Ocurrió un error inesperado al confirmar la reserva.' };
    }
}
