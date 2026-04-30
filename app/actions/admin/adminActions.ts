'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import * as React from 'react';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { FROM_EMAIL, SITE_URL } from '@/lib/config';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { validateSession } from '@/lib/adminAuth';
import type { Quote, QuoteItem } from '@/lib/types';

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

// ── Update Quote Status ──────────────────────────────────────────────────────
export async function updateQuoteStatus(quoteId: string, status: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // If marking as completed, check review settings for auto mode
    if (status === 'completed') {
        await maybeAutoSendReview(quoteId, db);
    }

    revalidatePath('/admin/quotes');
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

// ── Delete Quote Permanent ──────────────────────────────────────────────────
export async function deleteQuotePermanent(quoteId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    // 0. Obtener el client_id antes de borrar para revalidar su perfil
    const { data: quote } = await db.from('quotes').select('client_id').eq('id', quoteId).single();

    // 1. Limpieza manual de tablas relacionadas (cascada manual)
    await db.from('quote_items').delete().eq('quote_id', quoteId);
    await db.from('sync_logs').delete().eq('quote_id', quoteId);
    await db.from('reminder_logs').delete().eq('quote_id', quoteId);
    
    // 2. Borrar pagos asociados si existen
    await db.from('quotes').update({ payments: [] }).eq('id', quoteId);

    // 3. Borrar la cotización
    const { error } = await db.from('quotes').delete().eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/quotes');
    const target = quote?.client_id ? `/admin/clients/${quote.client_id}` : '/admin/quotes';
    
    // Al usar redirect() desde el servidor, Next.js cancela el renderizado de la página actual
    // y realiza la navegación inmediatamente, evitando el flash del 404.
    redirect(target);
}

// ── Update Items, Prices & Costs ───────────────────────────────────────────
export async function updateQuoteItemsAdmin(
    quoteId: string,
    data: {
        items: {
            id?: string;
            product_id: string | null;
            product_name: string;
            size: string;
            quantity: number;
            price_at_time: number;
            offer_price_at_time: number;
        }[];
        manual_discount: number;
        shipping_cost: number;
        installation_cost: number;
        dispenser: string;
    }
): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    try {
        // 1. Get current items to find which ones to delete
        const { data: existingItems } = await db.from('quote_items').select('id').eq('quote_id', quoteId);
        const existingIds = existingItems?.map(i => i.id) || [];
        const incomingIds = data.items.map(i => i.id).filter(Boolean);
        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

        // 2. Perform DB operations with accurate volume calculation
        const { fetchAllProductData } = await import('@/lib/serverData');
        const { cocktails } = await fetchAllProductData();
        
        let totalLiters = 0;
        let subtotal = 0;

        data.items.forEach(item => {
            subtotal += item.offer_price_at_time * item.quantity;
            
            // Calculate liters using structured price metadata
            const cocktail = cocktails.find(c => c.id === item.product_id);
            const priceData = cocktail?.prices[item.size];
            if (priceData && priceData.unit === 'L') {
                totalLiters += priceData.sizeValue * item.quantity;
            }
        });

        const newTotal = subtotal + Number(data.shipping_cost) + Number(data.installation_cost) - Number(data.manual_discount);

        const promises: Promise<any>[] = [];

        // Deletions
        if (idsToDelete.length > 0) {
            promises.push(db.from('quote_items').delete().in('id', idsToDelete) as any);
        }

        // Upserts (Inserts/Updates)
        data.items.forEach(item => {
            const itemData = {
                ...item,
                quote_id: quoteId,
            };
            promises.push(db.from('quote_items').upsert(itemData) as any);
        });

        // Update Quote Total and Costs
        promises.push(db.from('quotes').update({
            total_price: newTotal,
            total_liters: totalLiters,
            manual_discount: data.manual_discount,
            shipping_cost: data.shipping_cost,
            installation_cost: data.installation_cost,
            dispenser: data.dispenser,
            updated_at: new Date().toISOString()
        }).eq('id', quoteId) as any);

        await Promise.all(promises);

        // 3. Sync Calendar
        const { data: quote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
        if (quote && (quote.google_event_id || quote.google_pickup_event_id)) {
            await GoogleSyncService.scheduleCalendarEvents(quote, {
                updateEventId: quote.google_event_id,
                updatePickupEventId: quote.google_pickup_event_id,
                isDirectSaleOverride: quote.service_type === 'direct' || quote.dispenser === 'desechable'
            });
        }

        revalidatePath(`/admin/quotes/${quoteId}`);
        return { success: true };

    } catch (e: any) {
        console.error('Error updating items admin:', e);
        // Log Error in sync_logs for visibility in the dashboard
        try {
            await db.from('sync_logs').insert({
                quote_id: quoteId,
                type: 'google_calendar',
                status: 'error',
                error_msg: `Error sincronizando items: ${e.message || 'Error desconocido'}`
            });
        } catch (logErr) { console.error('Error writing to sync_logs:', logErr); }
        
        return { success: false, error: e.message };
    }
}

// ── Manage Payments ────────────────────────────────────────────────────────
export async function addQuotePayment(quoteId: string, payment: { date: string; amount: number; note: string }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: quote, error: fetchErr } = await db.from('quotes').select('payments, google_event_id, google_pickup_event_id').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    const currentPayments = Array.isArray(quote.payments) ? quote.payments : [];
    const newPayments = [...currentPayments, payment];

    const { error } = await db.from('quotes').update({ payments: newPayments }).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // Sync Calendar if event IDs exist
    if (quote.google_event_id || quote.google_pickup_event_id) {
        try {
            const { data: fullQuote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
            if (fullQuote) {
                await GoogleSyncService.scheduleCalendarEvents(fullQuote, {
                    updateEventId: quote.google_event_id,
                    updatePickupEventId: quote.google_pickup_event_id,
                });
            }
        } catch (e) { console.error('Error syncing calendar after payment', e); }
    }

    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

export async function deleteQuotePayment(quoteId: string, index: number): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: quote, error: fetchErr } = await db.from('quotes').select('payments, google_event_id, google_pickup_event_id').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    const currentPayments = Array.isArray(quote.payments) ? [...quote.payments] : [];
    currentPayments.splice(index, 1);

    const { error } = await db.from('quotes').update({ payments: currentPayments }).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // Sync Calendar
    if (quote.google_event_id || quote.google_pickup_event_id) {
        try {
            const { data: fullQuote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
            if (fullQuote) {
                await GoogleSyncService.scheduleCalendarEvents(fullQuote, {
                    updateEventId: quote.google_event_id,
                    updatePickupEventId: quote.google_pickup_event_id,
                });
            }
        } catch (e) { console.error('Error syncing calendar after del-payment', e); }
    }

    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

// ── Update Quote (Master Editor) ──────────────────────────────────────────
export async function updateQuoteAdmin(quoteId: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    // Separate client fields
    const clientFields: Record<string, any> = {};
    const quoteFields: Record<string, any> = { updated_at: new Date().toISOString() };

    const clientMap = ['client_name', 'client_lastname', 'client_email', 'client_phone'];
    const excludeFields = ['event_types', 'quote_items', 'id', 'created_at', 'client_id'];

    for (const [k, v] of Object.entries(data)) {
        if (excludeFields.includes(k)) continue;
        
        // Skip objects/arrays unless it's the payments JSONB field
        if (typeof v === 'object' && v !== null && k !== 'payments') continue;

        if (clientMap.includes(k)) {
            clientFields[k] = v;
            quoteFields[k] = v; // Field exists in both tables
        } else {
            quoteFields[k] = v;
        }
    }

    const { data: quote, error: fetchErr } = await db.from('quotes').select('client_id, google_event_id, google_pickup_event_id, status').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    // Update quote
    const { error } = await db.from('quotes').update(quoteFields).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // Update client and Google Contact
    if (quote.client_id && Object.keys(clientFields).length > 0) {
        // Map quote fields to clients table fields
        const clientsUpdate: Record<string, any> = {};
        if (clientFields.client_name !== undefined) clientsUpdate.first_name = clientFields.client_name;
        if (clientFields.client_lastname !== undefined) clientsUpdate.last_name = clientFields.client_lastname;
        if (clientFields.client_email !== undefined) clientsUpdate.email = clientFields.client_email;
        if (clientFields.client_phone !== undefined) clientsUpdate.phone = clientFields.client_phone;

        // Note: No updated_at in clients table. We select specific fields to avoid schema cache issues.
        const { data: updatedClient } = await db.from('clients')
            .update(clientsUpdate)
            .eq('id', quote.client_id)
            .select('id, first_name, last_name, email, phone, google_contact_id')
            .single();
        
        // Trigger Google Contact Sync
        if (updatedClient) {
            try {
                const { syncGoogleContact } = await import('@/lib/googleSync');
                await syncGoogleContact({
                    resourceName: updatedClient.google_contact_id || undefined,
                    firstName: updatedClient.first_name,
                    lastName: updatedClient.last_name || '',
                    email: updatedClient.email,
                    phone: updatedClient.phone || '',
                });
            } catch (e: any) {
                console.error('Error syncing Google Contact in updateQuoteAdmin:', e);
                // Log Contact Sync Error
                try {
                    await db.from('sync_logs').insert({
                        quote_id: quoteId,
                        type: 'google_contact',
                        status: 'error',
                        error_msg: `Error actualizando contacto: ${e.message || 'Error desconocido'}`
                    });
                } catch (logErr) { console.error('Error writing to sync_logs:', logErr); }
            }
        }
    }

    // Sync Google Calendar if quote is confirmed OR if it already has event IDs
    if (quote.status === 'confirmed' || quote.google_event_id || quote.google_pickup_event_id) {
        try {
            const { data: fullQuote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
            if (fullQuote) {
                const { GoogleSyncService } = await import('@/lib/services/googleSyncService');
                const result = await GoogleSyncService.scheduleCalendarEvents(fullQuote, {
                    updateEventId: quote.google_event_id || undefined,
                    updatePickupEventId: quote.google_pickup_event_id || undefined,
                });
                
                // Save new IDs if they were just created
                const dbUpdates: any = {};
                if (result.eventId && result.eventId !== quote.google_event_id) {
                    dbUpdates.google_event_id = result.eventId;
                }
                if (result.pickupEventId && result.pickupEventId !== quote.google_pickup_event_id) {
                    dbUpdates.google_pickup_event_id = result.pickupEventId;
                }
                
                if (Object.keys(dbUpdates).length > 0) {
                    await db.from('quotes').update(dbUpdates).eq('id', quoteId);
                }
            }
        } catch (e: any) {
            console.error('Admin: Error syncing calendar after update', e);
            // Log Calendar Sync Error
            try {
                await db.from('sync_logs').insert({
                    quote_id: quoteId,
                    type: 'google_calendar',
                    status: 'error',
                    error_msg: `Error actualizando calendario: ${e.message || 'Error desconocido'}`
                });
            } catch (logErr) { console.error('Error writing to sync_logs:', logErr); }
        }
    }

    revalidatePath('/admin/quotes');
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

// ── Update Client Admin ──────────────────────────────────────────────────
export async function updateClientAdmin(clientId: string, data: { first_name: string; last_name?: string; email: string; phone?: string }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    // 1. Update Client Table (removed updated_at as it doesn't exist)
    const { error: clientErr } = await db.from('clients').update(data).eq('id', clientId);
    if (clientErr) return { success: false, error: clientErr.message };

    // 2. Proactive Sync: Update client info in ALL quotes with this client_id
    // This addresses the user's request for "entrelazamiento"
    await db.from('quotes').update({
        client_name: data.first_name,
        client_lastname: data.last_name || '',
        client_email: data.email,
        client_phone: data.phone || '',
        updated_at: new Date().toISOString()
    }).eq('client_id', clientId);

    // 3. Sync Google Contact
    try {
        const { syncGoogleContact } = await import('@/lib/googleSync');
        const { data: fullClient } = await db.from('clients')
            .select('id, first_name, last_name, email, phone, google_contact_id')
            .eq('id', clientId)
            .single();

        if (fullClient) {
            await syncGoogleContact({
                resourceName: fullClient.google_contact_id || undefined,
                firstName: fullClient.first_name,
                lastName: fullClient.last_name || '',
                email: fullClient.email,
                phone: fullClient.phone || '',
            });
        }
    } catch (e) {
        console.error('Error syncing Google contact after client edit:', e);
    }

    revalidatePath('/admin/clients');
    revalidatePath(`/admin/clients/${clientId}`);
    // Also revalidate quotes since they might be affected
    revalidatePath('/admin/quotes'); 
    
    return { success: true };
}

// ── Sync Client With Google ─────────────────────────────────────────────
export async function syncClientWithGoogle(clientId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    try {
        const { data: client } = await db.from('clients')
            .select('id, first_name, last_name, email, phone, google_contact_id')
            .eq('id', clientId)
            .single();

        if (!client) return { success: false, error: 'Cliente no encontrado.' };

        // Fetch their latest quote for context (address, etc)
        const { data: latestQuote } = await db.from('quotes')
            .select('client_address, comuna_name, comuna_other, event_date, token')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const { syncGoogleContact } = await import('@/lib/googleSync');

        const comunaDisplay = latestQuote?.comuna_name === 'Otra' ? latestQuote?.comuna_other : latestQuote?.comuna_name;
        const fullAddress = latestQuote ? [latestQuote.client_address, comunaDisplay].filter(Boolean).join(', ') : undefined;
        const quoteUrl = latestQuote ? `${SITE_URL}/cotizar/${latestQuote.token}` : undefined;

        const clientAddress = latestQuote?.client_address?.trim() || '';
        // Rule: Only sync if address is not empty and contains at least one letter (avoiding just ZIP codes or numbers)
        const isAddressComplete = clientAddress.length > 0 && /[a-zA-Z]/.test(clientAddress);

        const googleId = await syncGoogleContact({
            resourceName: client.google_contact_id || undefined,
            firstName: client.first_name,
            lastName: client.last_name || '',
            email: client.email,
            phone: client.phone || '',
            address: isAddressComplete ? fullAddress : undefined,
            eventDate: latestQuote?.event_date,
            quoteUrl: quoteUrl,
            confirmed: false
        });

        if (googleId && googleId !== client.google_contact_id) {
            await db.from('clients').update({ google_contact_id: googleId }).eq('id', clientId);
        }

        revalidatePath(`/admin/clients/${clientId}`);
        return { success: true };
    } catch (e: any) {
        console.error('Error in syncClientWithGoogle:', e);
        return { success: false, error: e.message };
    }
}

// ── Send Direct Email ────────────────────────────────────────────────────
export async function sendDirectEmail(quoteId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;

    if (!subject || !body) return { success: false, error: 'Asunto y mensaje son obligatorios.' };

    const db = createServerClient();
    const { data: quote } = await db.from('quotes').select('client_email, client_name, client_lastname').eq('id', quoteId).single();
    if (!quote?.client_email) return { success: false, error: 'El cliente no tiene email registrado.' };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fullName = `${quote.client_name} ${quote.client_lastname || ''}`.trim();
    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px;">
        <p style="font-size: 15px; line-height: 1.7; color: #334155;">${body.replace(/\n/g, '<br/>')}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
    </div>`;

    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: quote.client_email,
        subject,
        html,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Send Review Email ────────────────────────────────────────────────────
export async function sendReviewEmail(quoteId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const [quoteRes, templateRes, linkRes] = await Promise.all([
        db.from('quotes').select('client_email, client_name, client_lastname, review_email_sent').eq('id', quoteId).single(),
        db.from('admin_settings').select('value').eq('key', 'review_template').single(),
        db.from('admin_settings').select('value').eq('key', 'review_link').single(),
    ]);

    if (!quoteRes.data?.client_email) return { success: false, error: 'Sin email de cliente.' };
    if (quoteRes.data.review_email_sent) return { success: false, error: 'El email de review ya fue enviado.' };

    const reviewLink = linkRes.data?.value || `${SITE_URL}/google`;
    const fullName = `${quoteRes.data.client_name} ${quoteRes.data.client_lastname || ''}`.trim();
    const template = (templateRes.data?.value || '').replace('{nombre}', fullName);
    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px;">
        <p style="font-size: 15px; line-height: 1.7; color: #334155;">${template.replace(/\n/g, '<br/>')}</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${reviewLink}" style="background: #E2A049; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px;">⭐ Dejar reseña</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
    </div>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: quoteRes.data.client_email,
        subject: '¡Gracias por elegirnos! Deja tu opinión 🌟',
        html,
    });

    if (error) return { success: false, error: error.message };

    await db.from('quotes').update({ review_email_sent: true }).eq('id', quoteId);
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

// ── Send Test Review Email ───────────────────────────────────────────────
export async function sendTestReviewEmail(toEmail: string, template: string, reviewLink: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    if (!toEmail) return { success: false, error: 'Email de prueba es obligatorio.' };
    
    const fullName = 'Nombre del Cliente (Prueba)';
    const processedTemplate = (template || '').replace('{nombre}', fullName);
    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px;">
        <p style="font-size: 15px; line-height: 1.7; color: #334155;"><strong>[EMAIL DE PRUEBA]</strong></p>
        <p style="font-size: 15px; line-height: 1.7; color: #334155;">${processedTemplate.replace(/\n/g, '<br/>')}</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${reviewLink || SITE_URL + '/google'}" style="background: #E2A049; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px;">⭐ Dejar reseña</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
    </div>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        subject: '¡Gracias por elegirnos! Deja tu opinión 🌟 (Prueba)',
        html,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Resend Original Order Email ──────────────────────────────────────────
export async function resendOrderEmail(quoteId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: quote, error: fetchErr } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };
    if (!quote.client_email) return { success: false, error: 'El cliente no tiene email registrado.' };

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { render } = await import('@react-email/components');
        const QuoteEmailComponent = (await import('@/components/emails/QuoteEmail')).default;

        const clientHtml = await render(React.createElement(QuoteEmailComponent, { quote, isAdmin: false }));
        
        const eventDate = quote.event_date
            ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
            : '';

        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: quote.client_email,
            subject: `🍸 Tu cotización – ${eventDate}`,
            html: clientHtml,
        });

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (e: any) {
        console.error('Error reenviando email:', e);
        return { success: false, error: e.message };
    }
}

// ── Save Admin Settings ──────────────────────────────────────────────────
export async function saveAdminSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const reviewMode = formData.get('review_mode') as string;
    const reviewTemplate = formData.get('review_template') as string;
    const reviewLink = formData.get('review_link') as string;

    await Promise.all([
        db.from('admin_settings').upsert({ key: 'review_mode', value: reviewMode }),
        db.from('admin_settings').upsert({ key: 'review_template', value: reviewTemplate }),
        db.from('admin_settings').upsert({ key: 'review_link', value: reviewLink }),
    ]);
    revalidatePath('/admin/settings');
    return { success: true };
}

// ── Retry Sync Log ───────────────────────────────────────────────────────
export async function retrySyncLog(logId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: log } = await db.from('sync_logs').select('quote_id, type').eq('id', logId).single();
    if (!log) return { success: false, error: 'Log no encontrado.' };

    const { data: quote } = await db.from('quotes').select('*, quote_items(*)').eq('id', log.quote_id).single();
    if (!quote) return { success: false, error: 'Cotización no encontrada.' };

    try {
        if (log.type === 'google_calendar') {
            await GoogleSyncService.scheduleCalendarEvents(quote);
        } else if (log.type === 'google_contact') {
            await GoogleSyncService.updateContactConfirmedStatus(quote);
        }
        await db.from('sync_logs').update({ status: 'retried' }).eq('id', logId);
        revalidatePath('/admin/logs');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ── Sync Client to Google ─────────────────────────────────────────────────
export async function syncClientToGoogle(clientId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: client } = await db.from('clients').select('*').eq('id', clientId).single();
    if (!client) return { success: false, error: 'Cliente no encontrado.' };
    // Minimal state to re-sync
    try {
        const { syncGoogleContact } = await import('@/lib/googleSync');
        await syncGoogleContact({
            resourceName: client.google_contact_id || undefined,
            firstName: client.first_name,
            lastName: client.last_name || '',
            email: client.email,
            phone: client.phone || '',
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ── Reminder Templates CRUD ──────────────────────────────────────────
export async function saveReminderTemplate(data: { id?: string; name: string; subject?: string; content: string; type: string }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('reminder_templates').upsert(data).select();
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

export async function deleteReminderTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('reminder_templates').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

// ── Batch Send Email Reminders ──────────────────────────────────────────
export async function sendBatchReminders(quoteIds: string[], templateId: string): Promise<{ success: boolean; results?: any; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    
    // 1. Fetch template
    const { data: template } = await db.from('reminder_templates').select('*').eq('id', templateId).single();
    if (!template) return { success: false, error: 'Plantilla no encontrada.' };

    // 2. Fetch quotes
    const { data: quotes } = await db.from('quotes').select('*, quote_items(*)').in('id', quoteIds);
    if (!quotes || quotes.length === 0) return { success: false, error: 'No se encontraron las cotizaciones.' };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const results = [];

    for (const quote of quotes) {
        if (!quote.client_email) {
            results.push({ quoteId: quote.id, success: false, error: 'Sin email' });
            continue;
        }

        // Reemplazar variables básicas
        const eventDateStr = quote.event_date 
            ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) 
            : 'por confirmar';
        const totalStr = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(quote.total_price);
        
        let content = template.content
            .replace(/\\n/g, '\n') // Fix literal \n
            .replace(/{nombre}/g, `<strong>${quote.client_name}</strong>`)
            .replace(/{fecha}/g, `<strong>${eventDateStr}</strong>`)
            .replace(/{total}/g, `<strong>${totalStr}</strong>`)
            .replace(/{link}/g, `<a href="${SITE_URL}/cotizar/${quote.token}" style="color: #E2A049; font-weight: 700;">${SITE_URL}/cotizar/${quote.token}</a>`);

        // Simple HTML layout for reminders
        const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px; color: #1e293b;">
            <div style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${content}</div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
        </div>`;

        try {
            const { error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: quote.client_email,
                subject: template.subject.replace(/{fecha}/g, eventDateStr).replace(/{nombre}/g, quote.client_name),
                html,
            });
            
            if (!error) {
                // Log the send
                await db.from('reminder_logs').insert({
                    quote_id: quote.id,
                    template_id: template.id,
                    channel: 'email'
                });
            }
            results.push({ quoteId: quote.id, success: !error, error: error?.message });
        } catch (e: any) {
            results.push({ quoteId: quote.id, success: false, error: e.message });
        }
    }

    return { success: true, results };
}

// ── Send Test Reminder Email ──────────────────────────────────────────
export async function sendTestReminderEmail(toEmail: string, template: { subject: string, content: string }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    if (!toEmail) return { success: false, error: 'Email de prueba es obligatorio.' };
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Test data
    const eventDateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    const totalStr = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(150000);
    const testLink = `${SITE_URL}/cotizar/test-token`;
    const testName = 'Cliente de Prueba';

    let content = template.content
        .replace(/\\n/g, '\n')
        .replace(/{nombre}/g, `<strong>${testName}</strong>`)
        .replace(/{fecha}/g, `<strong>${eventDateStr}</strong>`)
        .replace(/{total}/g, `<strong>${totalStr}</strong>`)
        .replace(/{link}/g, `<a href="${testLink}" style="color: #E2A049; font-weight: 700;">${testLink}</a>`);

    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px; color: #1e293b;">
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;"><strong>[EMAIL DE PRUEBA]</strong></p>
        <div style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${content}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
    </div>`;

    const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        subject: `[PRUEBA] ${template.subject.replace(/{fecha}/g, eventDateStr).replace(/{nombre}/g, testName)}`,
        html,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Log Reminder Send ────────────────────────────────────────────────────
export async function logReminderSend(quoteId: string, templateId: string, channel: 'email' | 'whatsapp') {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('reminder_logs').insert({
        quote_id: quoteId,
        template_id: templateId,
        channel
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Event Types Management ──────────────────────────────────────────────
export async function saveEventType(data: any) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('event_types').upsert(data);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
    revalidatePath('/cotizar');
    return { success: true };
}

export async function deleteEventType(id: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('event_types').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
    revalidatePath('/cotizar');
    return { success: true };
}

// ── Comunas Management ──────────────────────────────────────────────────
export async function saveComuna(data: any) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('comunas').upsert(data);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
    revalidatePath('/cotizar');
    return { success: true };
}

export async function deleteComuna(id: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('comunas').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
    revalidatePath('/cotizar');
    return { success: true };
}

export async function updateQuickComunaField(id: string, updates: { cost?: number; direct_sale_delivery_cost?: number; free_from?: number | null }) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('comunas').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/settings');
    revalidatePath('/cotizar');
    return { success: true };
}

// ── Bulk Actions ────────────────────────────────────────────────────────
export async function bulkUpdateQuoteStatus(ids: string[], status: string) {
    await checkAuth();
    if (!ids.length) return { success: false, error: 'No hay IDs seleccionados' };
    
    const db = createServerClient();
    const { error } = await db.from('quotes')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', ids);
        
    if (error) throw new Error(error.message);
    revalidatePath('/admin/quotes');
    return { success: true };
}


// ── Site Settings (Cerebro Central) Management ──────────────────────────────
export async function updateSiteSetting(id: string, data: { value: string; is_active: boolean }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('site_settings').update({ 
        value: data.value, 
        is_active: data.is_active,
        updated_at: new Date().toISOString() 
    }).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/settings');
    return { success: true };
}

// Helper: auto-send review if setting is 'auto'
async function maybeAutoSendReview(quoteId: string, db: any) {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'review_mode').single();
    if (data?.value === 'auto') {
        await sendReviewEmail(quoteId);
    }
}

// ── Manual Sync & Email Triggers ───────────────────────────────────────────
export async function sendQuoteEmailAdmin(quoteId: string, emailType: 'draft' | 'confirmation'): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: quote, error: fetchErr } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
    
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };
    if (!quote.client_email) return { success: false, error: 'El cliente no tiene email registrado.' };

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { render } = await import('@react-email/components');
        const { SettingsService } = await import('@/lib/services/settingsService');
        const { ADMIN_EMAIL } = await import('@/lib/config');

        let EmailComponent;
        const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable' || emailType === 'confirmation';

        if (isDirect) {
            EmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;
        } else {
            EmailComponent = (await import('@/components/emails/QuoteEmail')).default;
        }

        const eventDate = quote.event_date
            ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
            : '';
        const fullName = `${quote.client_name} ${quote.client_lastname || ''}`.trim();

        const emailVars = {
            full_name: fullName,
            event_date: eventDate
        };

        const [clientHtml, adminHtml, clientSubject, adminSubject] = await Promise.all([
            render(React.createElement(EmailComponent, { quote, isAdmin: false })),
            render(React.createElement(EmailComponent, { quote, isAdmin: true })),
            SettingsService.getResolvedValue(
                isDirect ? 'email_direct_sale_subject' : 'email_quote_draft_subject',
                emailVars,
                isDirect ? `✅ Tu pedido ha sido confirmado – ${eventDate}` : `🍸 Tu cotización – ${eventDate}`
            ),
            SettingsService.getResolvedValue(
                isDirect ? 'email_direct_sale_admin_subject' : 'email_quote_draft_admin_subject',
                emailVars,
                isDirect ? `[Pedido Confirmado] ${fullName} – ${eventDate}` : `[Nueva Cotización] ${fullName} – ${eventDate}`
            )
        ]);

        await Promise.allSettled([
            resend.emails.send({ from: FROM_EMAIL, to: quote.client_email, subject: clientSubject, html: clientHtml }),
            resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: adminSubject, html: adminHtml }),
        ]);

        revalidatePath(`/admin/quotes/${quoteId}`);
        return { success: true };
    } catch (e: any) {
        console.error('Error enviando email manual:', e);
        return { success: false, error: e.message };
    }
}

export async function syncQuoteToCalendarAdmin(quoteId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: quote, error: fetchErr } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
    
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    try {
        const { GoogleSyncService } = await import('@/lib/services/googleSyncService');
        const calResult = await GoogleSyncService.scheduleCalendarEvents(quote as any, {
            updateEventId: quote.google_event_id || undefined,
            updatePickupEventId: quote.google_pickup_event_id || undefined,
            isDirectSaleOverride: quote.service_type === 'direct' || quote.dispenser === 'desechable'
        });

        if (calResult.eventId || calResult.pickupEventId) {
            await db.from('quotes').update({
                google_event_id: calResult.eventId,
                google_pickup_event_id: calResult.pickupEventId
            }).eq('id', quoteId);
        }

        revalidatePath(`/admin/quotes/${quoteId}`);
        return { success: true };
    } catch (e: any) {
        console.error('Error sincronizando calendario manual:', e);
        return { success: false, error: e.message };
    }
}
