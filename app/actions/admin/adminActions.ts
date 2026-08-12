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
import { normalizePhoneE164 } from '@/lib/phone';

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
            let value = v;
            if (k === 'client_phone' && typeof v === 'string') {
                value = normalizePhoneE164(v) || v || null;
            }
            clientFields[k] = value;
            quoteFields[k] = value; // Field exists in both tables
        } else {
            quoteFields[k] = v;
        }
    }

    const { data: quote, error: fetchErr } = await db.from('quotes').select('client_id, google_event_id, google_pickup_event_id, status').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    // Update quote
    const { error } = await db.from('quotes').update(quoteFields).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // Update client (identifiers + primary mirror) and Google Contact
    if (quote.client_id && Object.keys(clientFields).length > 0) {
        try {
            const { syncClientFromContact } = await import('@/lib/services/clientService');
            await syncClientFromContact(
                quote.client_id,
                {
                    firstName: clientFields.client_name,
                    lastName: clientFields.client_lastname,
                    email: clientFields.client_email,
                    phone: clientFields.client_phone,
                },
                'admin'
            );
        } catch (e: any) {
            console.error('Error syncing client identifiers in updateQuoteAdmin:', e);
        }

        const { data: updatedClient } = await db.from('clients')
            .select('id, first_name, last_name, email, phone, google_contact_id')
            .eq('id', quote.client_id)
            .single();

        if (updatedClient) {
            try {
                const { syncGoogleContact } = await import('@/lib/googleSync');
                await syncGoogleContact({
                    resourceName: updatedClient.google_contact_id || undefined,
                    firstName: updatedClient.first_name,
                    lastName: updatedClient.last_name || '',
                    email: updatedClient.email || '',
                    phone: updatedClient.phone || '',
                });
            } catch (e: any) {
                console.error('Error syncing Google Contact in updateQuoteAdmin:', e);
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

export type ClientQuoteAddress = {
    address: string;
    comuna: string;
    otherComuna: string;
    lastUsed: string;
};

/** Direcciones únicas del historial de cotizaciones de un cliente (admin). */
export async function getClientAddressesFromQuotes(
    clientId: string
): Promise<{ success: boolean; addresses?: ClientQuoteAddress[]; error?: string }> {
    await checkAuth();
    if (!clientId) return { success: false, error: 'clientId requerido' };

    const db = createServerClient();
    const { data, error } = await db
        .from('quotes')
        .select('client_address, comuna_name, comuna_other, created_at')
        .eq('client_id', clientId)
        .not('client_address', 'is', null)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    const seen = new Map<string, ClientQuoteAddress>();
    for (const row of data ?? []) {
        const address = (row.client_address || '').trim();
        if (address.length < 5) continue;

        const comuna = (row.comuna_name || '').trim();
        const otherComuna = (row.comuna_other || '').trim();
        const key = `${address.toLowerCase()}|${comuna.toLowerCase()}|${otherComuna.toLowerCase()}`;
        if (seen.has(key)) continue;

        seen.set(key, {
            address,
            comuna,
            otherComuna,
            lastUsed: row.created_at,
        });
    }

    return { success: true, addresses: Array.from(seen.values()) };
}

// ── Update Client Admin ──────────────────────────────────────────────────
export async function updateClientAdmin(clientId: string, data: { first_name: string; last_name?: string; email: string; phone?: string }): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    const normalizedPhone = data.phone ? (normalizePhoneE164(data.phone) || data.phone) : (data.phone || '');

    try {
        const { syncClientFromContact } = await import('@/lib/services/clientService');
        await syncClientFromContact(
            clientId,
            {
                firstName: data.first_name,
                lastName: data.last_name,
                email: data.email,
                phone: normalizedPhone || null,
            },
            'admin'
        );
    } catch (e: any) {
        return { success: false, error: e?.message || 'No se pudo actualizar el cliente.' };
    }

    // Proactive Sync: Update client info in ALL quotes with this client_id
    await db.from('quotes').update({
        client_name: data.first_name,
        client_lastname: data.last_name || '',
        client_email: data.email,
        client_phone: normalizedPhone || '',
        updated_at: new Date().toISOString()
    }).eq('client_id', clientId);

    // Sync Google Contact
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
                email: fullClient.email || undefined,
                phone: fullClient.phone || '',
            });
        }
    } catch (e) {
        console.error('Error syncing Google contact after client edit:', e);
    }

    revalidatePath('/admin/clients');
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath('/admin/quotes'); 
    
    return { success: true };
}

// ── Delete Client Permanent ──────────────────────────────────────────────
export async function deleteClientPermanent(clientId: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();

    try {
        // Confirmamos que el cliente todavía existe antes de iniciar una eliminación irreversible.
        const { data: client, error: clientError } = await db
            .from('clients')
            .select('id')
            .eq('id', clientId)
            .single();

        if (clientError || !client) {
            return { success: false, error: 'Cliente no encontrado.' };
        }

        // Obtenemos todas sus cotizaciones para limpiar primero las tablas que dependen de ellas.
        const { data: quotes, error: quotesError } = await db
            .from('quotes')
            .select('id')
            .eq('client_id', clientId);

        if (quotesError) throw quotesError;
        const quoteIds = (quotes || []).map((quote) => quote.id);

        // Los eventos de etapa apuntan al cliente, cotizaciones y touchpoints; deben salir primero.
        const { error: stageEventsError } = await db
            .from('client_stage_events')
            .delete()
            .eq('client_id', clientId);
        if (stageEventsError) throw stageEventsError;

        if (quoteIds.length > 0) {
            // Borramos los hijos de cada cotización antes de eliminar la cotización principal.
            const quoteDependencies = await Promise.all([
                db.from('quote_items').delete().in('quote_id', quoteIds),
                db.from('sync_logs').delete().in('quote_id', quoteIds),
                db.from('reminder_logs').delete().in('quote_id', quoteIds),
            ]);
            const dependencyError = quoteDependencies.find((result) => result.error)?.error;
            if (dependencyError) throw dependencyError;

            const { error: deleteQuotesError } = await db
                .from('quotes')
                .delete()
                .in('id', quoteIds);
            if (deleteQuotesError) throw deleteQuotesError;
        }

        // Quitamos las relaciones restantes del CRM para no dejar datos personales huérfanos.
        const clientDependencies = await Promise.all([
            db.from('client_identifiers').delete().eq('client_id', clientId),
            db.from('client_touchpoints').delete().eq('client_id', clientId),
            db.from('client_merge_logs').delete().or(`from_client_id.eq.${clientId},into_client_id.eq.${clientId}`),
            db.from('clients').update({ merged_into_id: null }).eq('merged_into_id', clientId),
        ]);
        const clientDependencyError = clientDependencies.find((result) => result.error)?.error;
        if (clientDependencyError) throw clientDependencyError;

        const { error: deleteClientError } = await db
            .from('clients')
            .delete()
            .eq('id', clientId);
        if (deleteClientError) throw deleteClientError;

        revalidatePath('/admin/clients');
        revalidatePath('/admin/quotes');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting client permanently:', error);
        return {
            success: false,
            error: error instanceof Error
                ? error.message
                : 'No se pudo eliminar el cliente y sus cotizaciones.',
        };
    }
}

export async function setClientPrimaryIdentifierAdmin(
    clientId: string,
    identifierId: string
): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const { setPrimaryIdentifier } = await import('@/lib/services/clientService');
    const res = await setPrimaryIdentifier(clientId, identifierId);
    if (!res.success) return res;
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath('/admin/clients');
    return { success: true };
}

export async function updateClientCrmAdmin(
    clientId: string,
    data: {
        lifecycle_stage?: string;
        notes?: string | null;
        tags?: string[];
        intent?: string | null;
    }
): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const lifecycle = await import('@/lib/services/clientLifecycleService');

    try {
        if (data.lifecycle_stage) {
            if (!(lifecycle.LIFECYCLE_STAGES as string[]).includes(data.lifecycle_stage)) {
                return { success: false, error: 'Etapa inválida.' };
            }
            await lifecycle.advanceClientStage(
                clientId,
                data.lifecycle_stage as import('@/lib/services/clientLifecycleService').ClientLifecycleStage,
                {
                    reason: 'Manual admin stage change',
                    source: 'admin',
                    force: true,
                    intent: (data.intent ?? undefined) as
                        | import('@/lib/services/clientLifecycleService').ClientIntent
                        | undefined,
                }
            );
        }

        const patch: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
        };
        if (data.notes !== undefined) patch.notes = data.notes;
        if (data.tags !== undefined) patch.tags = data.tags;
        if (data.intent !== undefined && !data.lifecycle_stage) {
            patch.intent = data.intent;
        }

        if (data.notes !== undefined || data.tags !== undefined || (data.intent !== undefined && !data.lifecycle_stage)) {
            const { error } = await db.from('clients').update(patch).eq('id', clientId);
            if (error) return { success: false, error: error.message };
        }

        revalidatePath(`/admin/clients/${clientId}`);
        revalidatePath('/admin/clients');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'No se pudo actualizar el CRM.' };
    }
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

    const reviewLink = linkRes.data?.value || '';
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
    revalidatePath('/admin/quotes');
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
          <a href="${reviewLink || ''}" style="background: #E2A049; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px;">⭐ Dejar reseña</a>
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
export async function saveReminderTemplate(data: {
    id?: string;
    name: string;
    subject?: string;
    content: string;
    type: string;
    trigger?: string;
    auto_enabled?: boolean;
    days_before?: number;
}): Promise<{ success: boolean; error?: string; template?: any }> {
    await checkAuth();
    const db = createServerClient();
    const trigger = data.trigger || 'draft_event';
    const allowed = new Set(['draft_event', 'anniversary_event', 'anniversary_direct']);
    if (!allowed.has(trigger)) return { success: false, error: 'Trigger inválido.' };

    const days = Math.min(365, Math.max(0, Math.trunc(Number(data.days_before ?? 7))));
    const payload: Record<string, unknown> = {
        name: data.name.trim(),
        subject: data.subject || '',
        content: data.content,
        type: data.type || 'both',
        trigger,
        auto_enabled: Boolean(data.auto_enabled),
        days_before: days,
        auto_channel: 'email',
    };
    if (data.id) payload.id = data.id;

    const { data: saved, error } = await db.from('reminder_templates').upsert(payload).select().single();
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true, template: saved };
}

export async function deleteReminderTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { data: tpl } = await db.from('reminder_templates').select('name').eq('id', id).maybeSingle();
    // Congela el nombre en logs antes del SET NULL de la FK
    if (tpl?.name) {
        const { snapshotTemplateNameOnLogs } = await import('@/lib/services/reminderService');
        await snapshotTemplateNameOnLogs(id, tpl.name);
    }
    const { error } = await db.from('reminder_templates').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

// ── Batch Send Email Reminders ──────────────────────────────────────────
export async function sendBatchReminders(
    quoteIds: string[],
    templateId: string
): Promise<{ success: boolean; results?: any; error?: string }> {
    await checkAuth();
    const { sendManualBatchReminders } = await import('@/lib/services/reminderService');
    const res = await sendManualBatchReminders(quoteIds, templateId);
    revalidatePath('/admin/reminders');
    return res;
}

// ── Send Test Reminder Email ──────────────────────────────────────────
export async function sendTestReminderEmail(
    toEmail: string,
    template: { subject: string; content: string }
): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const { sendTestReminderEmailService } = await import('@/lib/services/reminderService');
    return sendTestReminderEmailService(toEmail, template);
}

// ── Log Reminder Send ────────────────────────────────────────────────────
export async function logReminderSend(
    quoteId: string,
    templateId: string,
    channel: 'email' | 'whatsapp'
) {
    await checkAuth();
    const db = createServerClient();
    const { data: quote } = await db
        .from('quotes')
        .select('client_id, client_email, event_date')
        .eq('id', quoteId)
        .maybeSingle();
    const { data: template } = await db
        .from('reminder_templates')
        .select('trigger, name')
        .eq('id', templateId)
        .maybeSingle();

    const { error } = await db.from('reminder_logs').insert({
        quote_id: quoteId,
        template_id: templateId,
        template_name: template?.name || null,
        channel,
        client_id: quote?.client_id || null,
        recipient_email: quote?.client_email || null,
        status: 'sent',
        trigger: template?.trigger || null,
        target_date: quote?.event_date || null,
        source: 'manual',
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

export async function clearReminderLogsAction(): Promise<{
    success: boolean;
    deleted?: number;
    error?: string;
}> {
    await checkAuth();
    const { clearReminderLogs } = await import('@/lib/services/reminderService');
    const res = await clearReminderLogs();
    if (res.success) revalidatePath('/admin/reminders');
    return res;
}

// ── Reminder suppressions ────────────────────────────────────────────────
export async function addReminderSuppression(
    email: string,
    note?: string
): Promise<{ success: boolean; error?: string; suppression?: any }> {
    await checkAuth();
    const { normalizeReminderEmail } = await import('@/lib/services/reminderService');
    const normalized = normalizeReminderEmail(email);
    if (!normalized || !normalized.includes('@')) {
        return { success: false, error: 'Email inválido.' };
    }
    const db = createServerClient();
    const { data, error } = await db
        .from('reminder_suppressions')
        .insert({
            email: normalized,
            note: note?.trim() || null,
        })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') return { success: false, error: 'Ese email ya está en omitidos.' };
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/reminders');
    return { success: true, suppression: data };
}

export async function deleteReminderSuppression(id: string): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('reminder_suppressions').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

// ── Reminder automation settings + run now ───────────────────────────────
export async function updateReminderCronSettings(data: {
    enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db
        .from('site_settings')
        .update({ value: data.enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('key', 'reminders_cron_enabled');
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/reminders');
    return { success: true };
}

export async function runRemindersNow(): Promise<{
    success: boolean;
    summary?: any;
    error?: string;
}> {
    await checkAuth();
    const { runReminderJob } = await import('@/lib/services/reminderService');
    try {
        const summary = await runReminderJob({ respectSchedule: false });
        revalidatePath('/admin/reminders');
        return { success: true, summary };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Error al ejecutar' };
    }
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

    // Same auto-review path as single updateQuoteStatus
    if (status === 'completed') {
        await Promise.allSettled(ids.map((id) => maybeAutoSendReview(id, db)));
    }

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

// Helper: auto-send review if setting is 'auto' (skips if already sent via sendReviewEmail)
async function maybeAutoSendReview(quoteId: string, db: any) {
    try {
        const { data } = await db.from('admin_settings').select('value').eq('key', 'review_mode').single();
        if (data?.value === 'auto') {
            await sendReviewEmail(quoteId);
        }
    } catch (err) {
        // Never block status updates if review email fails
        console.error(`[maybeAutoSendReview] quote ${quoteId}:`, err);
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
        const isDirectSale = quote.service_type === 'direct' || quote.dispenser === 'desechable';
        const isConfirmation = emailType === 'confirmation';
        const useConfirmationTemplate = isDirectSale || isConfirmation;

        if (useConfirmationTemplate) {
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

        let clientSubjectKey, adminSubjectKey, defaultClientSubject, defaultAdminSubject;

        if (isDirectSale) {
            clientSubjectKey = 'email_direct_sale_subject';
            adminSubjectKey = 'email_direct_sale_admin_subject';
            defaultClientSubject = `✅ Tu pedido ha sido confirmado – ${eventDate}`;
            defaultAdminSubject = `[Pedido Confirmado] ${fullName} – ${eventDate}`;
        } else if (isConfirmation) {
            clientSubjectKey = 'email_quote_confirmed_subject';
            adminSubjectKey = 'email_quote_confirmed_admin_subject';
            defaultClientSubject = `✅ Reserva confirmada – ${eventDate}`;
            defaultAdminSubject = `[Nueva Reserva] ${fullName} – ${eventDate}`;
        } else {
            clientSubjectKey = 'email_quote_draft_subject';
            adminSubjectKey = 'email_quote_draft_admin_subject';
            defaultClientSubject = `🍸 Tu cotización – ${eventDate}`;
            defaultAdminSubject = `[Nueva Cotización] ${fullName} – ${eventDate}`;
        }

        const [clientHtml, adminHtml, clientSubject, adminSubject] = await Promise.all([
            render(React.createElement(EmailComponent, { quote, isAdmin: false })),
            render(React.createElement(EmailComponent, { quote, isAdmin: true })),
            SettingsService.getResolvedValue(clientSubjectKey, emailVars, defaultClientSubject),
            SettingsService.getResolvedValue(adminSubjectKey, emailVars, defaultAdminSubject)
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
