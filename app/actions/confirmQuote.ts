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
import { ADMIN_EMAIL, FROM_EMAIL, PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import { normalizePhoneE164 } from '@/lib/phone';

interface ConfirmQuoteResult {
    success: boolean;
    token?: string;
    error?: string;
}

export async function confirmQuote(formData: unknown): Promise<ConfirmQuoteResult> {
    const token = typeof formData === 'object' && formData !== null && 'token' in formData ? String((formData as Record<string, unknown>).token) : '';
    console.log('[ConfirmQuote] 🚀 Iniciando confirmación para:', token);
    
    const db = createServerClient();
    let quoteToSync: (Quote & { quote_items: QuoteItem[] }) | null = null;
    let isDirectSale = false;
 
    // 1. FASE DE BASE DE DATOS (CRÍTICA)
    try {
        const validation = ConfirmQuoteSchema.safeParse(formData);
        if (!validation.success) return { success: false, error: 'Datos inválidos.' };
        const data = validation.data;
 
        const [quoteRes, catalogRes] = await Promise.all([
            db.from('quotes').select('*').eq('token', data.token).single(),
            fetchAllProductData()
        ]);
 
        if (quoteRes.error || !quoteRes.data) return { success: false, error: 'Reserva no encontrada.' };
        const quote = quoteRes.data;
        if (quote.status === 'confirmed') return { success: false, error: 'Ya confirmada.' };
 
        isDirectSale = quote.service_type === 'direct' || quote.dispenser === 'desechable';
 
        const summary = calculateSummaryData({
            ...quote,
            selections: data.items.map(i => ({ id: i.product_id || 'manual', size: i.size, quantity: i.quantity, customPrice: i.offer_price_at_time })),
            serviceType: isDirectSale ? 'direct' : 'event',
            contact: { ...quote, lastName: data.client_lastname, phone: data.client_phone, address: data.client_address, comuna: data.comuna_name },
            dispenser: data.dispenser,
            eventData: { date: data.event_date, startTime: data.start_time, pickupDate: data.pickup_date, pickupTime: data.pickup_time }
        } as unknown as Parameters<typeof calculateSummaryData>[0], catalogRes.cocktails, catalogRes.comunas);

        // Validaciones Zero Trust en el servidor
        if (!isDirectSale) {
            const minRequiredLiters = data.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
            if (summary.totalLiters < minRequiredLiters) {
                return { success: false, error: `La reserva no cumple con el mínimo de litros requerido para el dispensador seleccionado (${minRequiredLiters}L).` };
            }
            if (data.dispenser === 'muro' && !summary.canHaveMuro) {
                return { success: false, error: 'El Muro de Coctelería requiere al menos 30L y solo barriles de 10L, 20L o 30L.' };
            }
        }

        const total = summary.totalOfferPrice + summary.shippingCost + summary.installationCost - (quote.manual_discount || 0);

        const deleteResult = await db.from('quote_items').delete().eq('quote_id', quote.id);
        if (deleteResult.error) throw new Error(deleteResult.error.message);

        const insertResult = await db.from('quote_items').insert(data.items.map(item => ({
            quote_id: quote.id,
            product_id: item.product_id,
            product_name: item.product_name,
            size: item.size,
            quantity: item.quantity,
            price_at_time: item.price_at_time,
            offer_price_at_time: item.offer_price_at_time,
            size_value: item.size_value,
            unit_id: item.unit_id,
            is_disposable: item.is_disposable ?? false
        })));
        if (insertResult.error) throw new Error(insertResult.error.message);

        const normalizedPhone = normalizePhoneE164(data.client_phone) || data.client_phone;

        const updateResult = await db.from('quotes').update({
            status: 'confirmed', client_lastname: data.client_lastname, client_phone: normalizedPhone,
            client_address: data.client_address, comuna_name: data.comuna_name, event_date: data.event_date,
            start_time: data.start_time, pickup_date: data.pickup_date, pickup_time: data.pickup_time,
            dispenser: data.dispenser, total_price: total, total_liters: summary.totalLiters,
            total_normal_price: summary.totalNormalPrice,
            total_offer_price: summary.totalOfferPrice,
            shipping_cost: summary.shippingCost,
            installation_cost: summary.installationCost,
            updated_at: new Date().toISOString()
        }).eq('token', data.token);
        if (updateResult.error) throw new Error(updateResult.error.message);

        // Keep clients + identifiers in sync with confirmation contact data
        if (quote.client_id) {
            try {
                const { syncClientFromContact } = await import('@/lib/services/clientService');
                await syncClientFromContact(
                    quote.client_id,
                    {
                        firstName: quote.client_name,
                        lastName: data.client_lastname,
                        email: quote.client_email,
                        phone: normalizedPhone,
                    },
                    'web'
                );
            } catch (syncErr) {
                console.error('[ConfirmQuote] client sync error:', syncErr);
            }

            try {
                const { advanceClientStage } = await import('@/lib/services/clientLifecycleService');
                await advanceClientStage(quote.client_id, 'customer', {
                    reason: isDirectSale ? 'Direct sale confirmed' : 'Event quote confirmed',
                    source: 'web',
                    quoteId: quote.id,
                    intent: isDirectSale ? 'direct' : 'event',
                });
            } catch (stageErr) {
                console.error('[ConfirmQuote] CRM stage advance error:', stageErr);
            }
        }

        quoteToSync = {
            ...quote,
            ...data,
            status: 'confirmed',
            quote_items: data.items,
            total_price: total,
            total_liters: summary.totalLiters,
            total_normal_price: summary.totalNormalPrice,
            total_offer_price: summary.totalOfferPrice,
            shipping_cost: summary.shippingCost,
            installation_cost: summary.installationCost
        };

    } catch (err) {
        console.error('[ConfirmQuote] ❌ Error en Fase DB:', err);
        return { success: false, error: 'Ocurrió un error al confirmar la reserva.' };
    }

    // 2. FASE DE FONDO (Usando "after" para que Vercel no mate el proceso)
    after(async () => {
        console.log('[ConfirmQuote] ☁️ Ejecutando tareas post-respuesta...');
        if (!quoteToSync) return;
        try {
            // Sincronización Google
            try {
                await GoogleSyncService.updateContactConfirmedStatus(quoteToSync);
                const cal = await GoogleSyncService.scheduleCalendarEvents(quoteToSync, { isDirectSaleOverride: isDirectSale });
                if (cal?.eventId || cal?.pickupEventId) {
                    const supabase = createServerClient();
                    await supabase.from('quotes').update({ google_event_id: cal.eventId, google_pickup_event_id: cal.pickupEventId }).eq('id', quoteToSync.id);
                }
            } catch (e) { console.error('[ConfirmQuote] Error Google:', e); }

            // Envío de Emails
            try {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const { render } = await import('@react-email/components');
                const EmailComp = (await import('@/components/emails/ConfirmationEmail')).default;
                
                const vars = { 
                    full_name: `${quoteToSync.client_name} ${quoteToSync.client_lastname || ''}`.trim(), 
                    event_date: quoteToSync.event_date ? formatEventDate(quoteToSync.event_date) : '' 
                };

                const [htmlClient, htmlAdmin, subClient, subAdmin] = await Promise.all([
                    render(React.createElement(EmailComp, { quote: quoteToSync, isAdmin: false })),
                    render(React.createElement(EmailComp, { quote: quoteToSync, isAdmin: true })),
                    SettingsService.getResolvedValue('email_quote_confirmed_subject', vars, 'Reserva confirmada'),
                    SettingsService.getResolvedValue('email_quote_confirmed_admin_subject', vars, 'Nueva reserva confirmada')
                ]);

                const emailsToSend = [
                    resend.emails.send({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject: subAdmin, html: htmlAdmin })
                ];
                if (quoteToSync.client_email) {
                    emailsToSend.push(
                        resend.emails.send({ from: FROM_EMAIL, to: [quoteToSync.client_email], subject: subClient, html: htmlClient })
                    );
                }
                await Promise.all(emailsToSend);
            } catch (e) { console.error('[ConfirmQuote] Error Emails:', e); }

            // Meta CAPI Purchase (same event_id as Pixel: purchase_{token})
            if (quoteToSync.client_id) {
                try {
                    const { sendQuotePurchaseCapi } = await import('@/lib/services/metaCapiService');
                    await sendQuotePurchaseCapi({
                        clientId: quoteToSync.client_id,
                        token: quoteToSync.token,
                        value: quoteToSync.total_price,
                        contentName: 'Reserva de Evento Confirmada',
                    });
                } catch (e) {
                    console.error('[ConfirmQuote] Error CAPI Purchase:', e);
                }
            }

            revalidatePath(`/cotizar/${quoteToSync.token}`);
        } catch (e) {
            console.error('[ConfirmQuote] Error general en after():', e);
        }
    });

    return { success: true, token };
}
