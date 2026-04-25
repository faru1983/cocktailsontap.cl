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
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';

interface ConfirmQuoteResult {
    success: boolean;
    token?: string;
    error?: string;
}

/**
 * SERVER ACTION: Confirmación de Reserva
 * 
 * Filosofía: El usuario NO debe esperar a Google ni a los Emails.
 * Si la DB se actualiza, la reserva es un ÉXITO.
 */
export async function confirmQuote(formData: any): Promise<ConfirmQuoteResult> {
    console.log('[ConfirmQuote] 🚀 Iniciando confirmación para:', formData?.token);
    
    const db = createServerClient();
    let quoteToSync: any = null;
    let isDirectSale = false;

    // 1. FASE DE BASE DE DATOS (Lo único que puede hacer fallar la respuesta al usuario)
    try {
        const validation = ConfirmQuoteSchema.safeParse(formData);
        if (!validation.success) return { success: false, error: 'Datos inválidos.' };
        const data = validation.data;

        // Fetch inicial
        const [quoteRes, catalogRes] = await Promise.all([
            db.from('quotes').select('*').eq('token', data.token).single(),
            fetchAllProductData()
        ]);

        if (quoteRes.error || !quoteRes.data) return { success: false, error: 'Reserva no encontrada.' };
        const quote = quoteRes.data;

        if (quote.status === 'confirmed') return { success: false, error: 'Ya confirmada.' };

        isDirectSale = quote.service_type === 'direct' || quote.dispenser === 'desechable';

        // Recálculo de totales
        const summary = calculateSummaryData({
            ...quote,
            selections: data.items.map(i => ({ id: i.product_id || 'manual', size: i.size, quantity: i.quantity, customPrice: i.offer_price_at_time })),
            serviceType: isDirectSale ? 'direct' : 'event',
            contact: { ...quote, lastName: data.client_lastname, phone: data.client_phone, address: data.client_address, comuna: data.comuna_name },
            dispenser: data.dispenser as any,
            eventData: { date: data.event_date, startTime: data.start_time, pickupDate: data.pickup_date, pickupTime: data.pickup_time }
        } as any, catalogRes.cocktails, catalogRes.comunas);

        const total = summary.totalOfferPrice + summary.shippingCost + summary.installationCost - (quote.manual_discount || 0);

        // --- UPDATE DB (Banda ancha: todo en paralelo) ---
        const dbOps = [
            // Items
            db.from('quote_items').delete().eq('quote_id', quote.id).not('id', 'in', `(${data.items.filter(i => i.id && !i.id.includes('temp-')).map(i => i.id).join(',') || 'NULL'})`),
            db.from('quote_items').upsert(data.items.map(item => ({
                quote_id: quote.id, product_id: item.product_id, product_name: item.product_name,
                size: item.size, quantity: item.quantity, price_at_time: item.price_at_time,
                offer_price_at_time: item.offer_price_at_time, size_value: item.size_value, unit_id: item.unit_id
            }))),
            // Quote Principal
            db.from('quotes').update({
                status: 'confirmed', client_lastname: data.client_lastname, client_phone: data.client_phone,
                client_address: data.client_address, comuna_name: data.comuna_name, event_date: data.event_date,
                start_time: data.start_time, pickup_date: data.pickup_date, pickup_time: data.pickup_time,
                dispenser: data.dispenser, total_price: total, total_liters: summary.totalLiters,
                updated_at: new Date().toISOString()
            }).eq('token', data.token)
        ];

        console.log('[ConfirmQuote] 💾 Guardando en base de datos...');
        const results = await Promise.all(dbOps);
        if (results.some(r => r.error)) throw new Error('Error en DB');

        // Preparamos los datos para la Fase 2 antes de salir del try
        quoteToSync = { ...quote, ...data, status: 'confirmed', quote_items: data.items };
        console.log('[ConfirmQuote] ✅ DB Actualizada correctamente.');

    } catch (err) {
        console.error('[ConfirmQuote] ❌ Error crítico en Fase DB:', err);
        return { success: false, error: 'Ocurrió un error al procesar la reserva.' };
    }

    // 2. FASE DE INTEGRACIONES (BACKGROUND / FIRE & FORGET)
    // No usamos 'await' para que la respuesta al usuario salga YA.
    (async () => {
        console.log('[ConfirmQuote] ☁️ Iniciando tareas de fondo (Google/Email)...');
        try {
            // Google Sync
            try {
                await GoogleSyncService.updateContactConfirmedStatus(quoteToSync);
                const cal = await GoogleSyncService.scheduleCalendarEvents(quoteToSync, { isDirectSaleOverride: isDirectSale });
                if (cal?.eventId || cal?.pickupEventId) {
                    await db.from('quotes').update({ google_event_id: cal.eventId, google_pickup_event_id: cal.pickupEventId }).eq('id', quoteToSync.id);
                }
                console.log('[ConfirmQuote] 📅 Google Sync completado.');
            } catch (e) { console.error('[ConfirmQuote] Falló Google Sync (no crítico):', e); }

            // Emails
            try {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const { render } = await import('@react-email/components');
                const EmailComp = (await import('@/components/emails/ConfirmationEmail')).default;
                
                const dateStr = quoteToSync.event_date ? formatEventDate(quoteToSync.event_date) : '';
                const name = `${quoteToSync.client_name} ${quoteToSync.client_lastname || ''}`.trim();
                const vars = { full_name: name, event_date: dateStr };

                const [htmlClient, htmlAdmin, subClient, subAdmin] = await Promise.all([
                    render(React.createElement(EmailComp, { quote: quoteToSync, isAdmin: false })),
                    render(React.createElement(EmailComp, { quote: quoteToSync, isAdmin: true })),
                    SettingsService.getResolvedValue('email_quote_confirmed_subject', vars, 'Reserva confirmada'),
                    SettingsService.getResolvedValue('email_quote_confirmed_admin_subject', vars, 'Nueva reserva confirmada')
                ]);

                await Promise.all([
                    resend.emails.send({ from: FROM_EMAIL, to: [quoteToSync.client_email], subject: subClient, html: htmlClient }),
                    resend.emails.send({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject: subAdmin, html: htmlAdmin })
                ]);
                console.log('[ConfirmQuote] 📧 Emails enviados.');
            } catch (e) { console.error('[ConfirmQuote] Falló envío de emails (no crítico):', e); }

            revalidatePath(`/cotizar/${formData.token}`);
        } catch (globalBgErr) {
            console.error('[ConfirmQuote] Error en proceso de fondo:', globalBgErr);
        }
    })();

    // RESPUESTA INMEDIATA AL USUARIO
    console.log('[ConfirmQuote] 🏁 Respondiendo éxito al usuario.');
    return { success: true, token: formData.token };
}
