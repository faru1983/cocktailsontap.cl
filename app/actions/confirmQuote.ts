'use server';

import { revalidatePath } from 'next/cache';
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
 * 
 * ARQUITECTURA EN DOS FASES:
 * - FASE 1 (Crítica): Validar, recalcular y confirmar en DB. Si falla → error al usuario.
 * - FASE 2 (Best effort): Google Sync + Emails. Si falla → el usuario YA vio éxito.
 */
export async function confirmQuote(formData: any): Promise<ConfirmQuoteResult> {
    console.log('[ConfirmQuote] ══════════════════════════════════════');
    console.log('[ConfirmQuote] Iniciando para token:', formData?.token);

    // Variables compartidas entre fases
    let confirmedToken: string | null = null;
    let fullQuote: (Quote & { quote_items: QuoteItem[] }) | null = null;
    let isDirect = false;
    let db: ReturnType<typeof createServerClient> | null = null;

    // ═══════════════════════════════════════════════════════════════
    // FASE 1: CONFIRMACIÓN EN BASE DE DATOS (CRÍTICA)
    // Si cualquier cosa aquí falla, retornamos error al usuario.
    // ═══════════════════════════════════════════════════════════════
    try {
        // 1. Validar datos del formulario
        const validation = ConfirmQuoteSchema.safeParse(formData);
        if (!validation.success) {
            console.error('[ConfirmQuote] Validación Zod fallida:', validation.error.flatten());
            return { success: false, error: 'Datos de confirmación inválidos.' };
        }
        const data = validation.data;

        // 2. Fetch cotización actual + catálogo para recálculo
        db = createServerClient();
        const [quoteResult, catalogResult] = await Promise.all([
            db.from('quotes').select('*').eq('token', data.token).single(),
            fetchAllProductData()
        ]);

        if (quoteResult.error || !quoteResult.data) {
            console.error('[ConfirmQuote] Quote no encontrada:', quoteResult.error);
            return { success: false, error: 'Cotización no encontrada.' };
        }

        const quote = quoteResult.data;
        const { cocktails, comunas } = catalogResult;
        console.log('[ConfirmQuote] Quote encontrada:', quote.id, '| Status actual:', quote.status);

        // 3. Guardia: no confirmar dos veces
        if (quote.status === 'confirmed') {
            return { success: false, error: 'Esta cotización ya fue confirmada anteriormente.' };
        }

        // 4. Determinar tipo de servicio
        isDirect = quote.service_type === 'direct' || (quote.service_type === undefined && quote.dispenser === 'desechable');

        // 5. Recálculo Zero Trust (server-side)
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
                firstName: quote.client_name,
                lastName: data.client_lastname || quote.client_lastname,
                email: quote.client_email,
                phone: data.client_phone || quote.client_phone,
                address: data.client_address,
                comuna: data.comuna_name,
                otherComuna: data.comuna_other,
                comments: data.comments
            },
            dispenser: data.dispenser as any,
            eventData: {
                date: data.event_date,
                startTime: data.start_time,
                pickupDate: data.pickup_date,
                pickupTime: data.pickup_time,
                type: data.event_type_id
            }
        } as any, cocktails, comunas);

        const finalNormalPrice = summary.totalNormalPrice;
        const finalOfferPrice = summary.totalOfferPrice;
        const finalShippingCost = summary.shippingCost;
        const finalInstallationCost = summary.installationCost;
        const finalTotalPrice = finalOfferPrice + finalShippingCost + finalInstallationCost - (quote.manual_discount || 0);

        console.log('[ConfirmQuote] Totales recalculados:', { finalOfferPrice, finalShippingCost, finalInstallationCost, finalTotalPrice });

        // 6. Operaciones atómicas en DB
        const dbOps: Promise<any>[] = [];

        // 6.a Eliminar items que el usuario removió
        const keepItemIds = data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id);
        dbOps.push(
            db.from('quote_items')
              .delete()
              .eq('quote_id', quote.id)
              .not('id', 'in', `(${keepItemIds.join(',') || 'NULL'})`) as any
        );

        // 6.b Upsert items con precios congelados
        const itemsToUpsert = data.items.map(item => ({
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
        if (itemsToUpsert.length > 0) {
            dbOps.push(db.from('quote_items').upsert(itemsToUpsert, { onConflict: 'quote_id,product_id,size' }) as any);
        }

        // 6.c Actualizar cliente
        if (quote.client_id) {
            const clientFields: Record<string, string> = {};
            if (data.client_lastname?.trim()) clientFields.last_name = data.client_lastname.trim();
            if (data.client_phone?.trim()) clientFields.phone = data.client_phone.trim();
            if (Object.keys(clientFields).length > 0) {
                dbOps.push(db.from('clients').update(clientFields).eq('id', quote.client_id) as any);
            }
        }

        // 6.d Actualizar cotización: estado CONFIRMED + TODOS los campos editables
        dbOps.push(db.from('quotes').update({
            status: 'confirmed',
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
            updated_at: new Date().toISOString()
        }).eq('token', data.token) as any);

        console.log('[ConfirmQuote] Ejecutando', dbOps.length, 'operaciones de DB...');
        const results = await Promise.all(dbOps);
        const dbError = results.find(r => r.error)?.error;
        if (dbError) {
            console.error('[ConfirmQuote] Error en DB:', dbError);
            throw new Error(dbError.message || 'Error de base de datos');
        }

        console.log('[ConfirmQuote] ✅ FASE 1 COMPLETA - Quote confirmada en DB');

        // Preparar objeto completo para Fase 2
        confirmedToken = data.token;
        fullQuote = {
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
            status: 'confirmed' as const,
            quote_items: data.items as any[]
        };

    } catch (phase1Error: any) {
        console.error('[ConfirmQuote] ❌ FASE 1 FALLÓ:', phase1Error);
        return { success: false, error: 'Ocurrió un error inesperado al confirmar la reserva.' };
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 2: INTEGRACIONES EXTERNAS (BEST EFFORT)
    // La quote YA está confirmada en DB. Nada aquí puede causar
    // un error al usuario. Cada bloque tiene su propio try/catch.
    // ═══════════════════════════════════════════════════════════════
    console.log('[ConfirmQuote] Iniciando FASE 2 (integraciones externas)...');

    // --- Google Sync ---
    try {
        console.log('[ConfirmQuote] Google: Actualizando contacto...');
        await GoogleSyncService.updateContactConfirmedStatus(fullQuote!);
        console.log('[ConfirmQuote] Google: Contacto actualizado OK');
    } catch (contactErr: any) {
        console.error('[ConfirmQuote] Google Contacts falló:', contactErr?.message);
    }

    try {
        console.log('[ConfirmQuote] Google: Creando eventos de calendario...');
        const calResult = await GoogleSyncService.scheduleCalendarEvents(fullQuote!, { isDirectSaleOverride: isDirect });

        if (calResult?.eventId || calResult?.pickupEventId) {
            console.log('[ConfirmQuote] Google Calendar OK:', calResult);
            await db!.from('quotes').update({
                ...(calResult.eventId && { google_event_id: calResult.eventId }),
                ...(calResult.pickupEventId && { google_pickup_event_id: calResult.pickupEventId }),
            }).eq('id', fullQuote!.id);
        } else {
            console.log('[ConfirmQuote] Google Calendar: no retornó IDs');
        }
    } catch (calErr: any) {
        console.error('[ConfirmQuote] Google Calendar falló:', calErr?.message);
        try {
            await db!.from('quotes').update({
                comments: (fullQuote!.comments || '') + `\n[LOG ERROR GOOGLE ${new Date().toISOString()}]: ${calErr?.message || 'Error desconocido'}`
            }).eq('id', fullQuote!.id);
        } catch (_) { /* silenciar */ }
    }

    // --- Emails ---
    try {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && fullQuote!.client_email) {
            console.log('[ConfirmQuote] Preparando emails...');
            const resend = new Resend(resendKey);
            const { render } = await import('@react-email/components');
            const ConfirmationEmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;

            const clientFullName = `${fullQuote!.client_name} ${fullQuote!.client_lastname || ''}`.trim();
            const eventDateStr = fullQuote!.event_date ? formatEventDate(fullQuote!.event_date) : 'S/F';
            const emailVars = { full_name: clientFullName, event_date: eventDateStr };

            const [adminHtml, clientHtml, adminSubject, clientSubject] = await Promise.all([
                render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote!, isAdmin: true })),
                render(React.createElement(ConfirmationEmailComponent, { quote: fullQuote!, isAdmin: false })),
                SettingsService.getResolvedValue('email_quote_confirmed_admin_subject', emailVars, `✅ [Reserva Confirmada] ${clientFullName} – ${eventDateStr}`),
                SettingsService.getResolvedValue('email_quote_confirmed_subject', emailVars, `✅ Reserva confirmada – ${eventDateStr}`)
            ]);

            console.log('[ConfirmQuote] Enviando emails...');
            const emailResults = await Promise.allSettled([
                resend.emails.send({
                    from: 'Cocktails on Tap <contacto@cocktailsontap.cl>',
                    to: ['faru1983@gmail.com'],
                    subject: adminSubject,
                    html: adminHtml
                }),
                resend.emails.send({
                    from: 'Cocktails on Tap <contacto@cocktailsontap.cl>',
                    to: [fullQuote!.client_email!],
                    subject: clientSubject,
                    html: clientHtml
                })
            ]);
            console.log('[ConfirmQuote] Emails resultado:', emailResults.map(r => r.status));
        } else {
            console.log('[ConfirmQuote] Emails omitidos (sin API key o sin email de cliente)');
        }
    } catch (emailErr: any) {
        console.error('[ConfirmQuote] Emails fallaron:', emailErr?.message);
    }

    // --- Finalizar ---
    try {
        revalidatePath(`/cotizar/${confirmedToken}`);
    } catch (_) { /* silenciar */ }

    console.log('[ConfirmQuote] ✅ FASE 2 COMPLETA');
    console.log('[ConfirmQuote] ══════════════════════════════════════');
    return { success: true, token: confirmedToken! };
}
