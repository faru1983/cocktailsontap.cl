'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { FROM_EMAIL, SITE_URL } from '@/lib/config';
import { GoogleSyncService } from '@/lib/services/googleSyncService';

// ── Update Quote Status ──────────────────────────────────────────────────────
export async function updateQuoteStatus(quoteId: string, status: string): Promise<{ success: boolean; error?: string }> {
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

// ── Mark Deposit Paid ──────────────────────────────────────────────────────
export async function markDepositPaid(quoteId: string): Promise<{ success: boolean; error?: string }> {
    return updateQuoteStatus(quoteId, 'deposit_paid');
}

// ── Update Quote (Master Editor) ──────────────────────────────────────────
export async function updateQuoteAdmin(quoteId: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    const db = createServerClient();

    // Separate client fields
    const clientFields: Record<string, any> = {};
    const quoteFields: Record<string, any> = { updated_at: new Date().toISOString() };

    const clientMap = ['client_name', 'client_lastname', 'client_email', 'client_phone'];
    for (const [k, v] of Object.entries(data)) {
        if (clientMap.includes(k)) clientFields[k] = v;
        else quoteFields[k] = v;
    }

    const { data: quote, error: fetchErr } = await db.from('quotes').select('client_id, google_event_id, google_pickup_event_id').eq('id', quoteId).single();
    if (fetchErr || !quote) return { success: false, error: 'Cotización no encontrada.' };

    // Update quote
    const { error } = await db.from('quotes').update(quoteFields).eq('id', quoteId);
    if (error) return { success: false, error: error.message };

    // Update client
    if (quote.client_id && Object.keys(clientFields).length > 0) {
        await db.from('clients').update(clientFields).eq('id', quote.client_id);
    }

    // Sync Google Calendar if event IDs exist
    if (quote.google_event_id || quote.google_pickup_event_id) {
        try {
            const { data: fullQuote } = await db.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();
            if (fullQuote) {
                await GoogleSyncService.scheduleCalendarEvents(fullQuote, {
                    updateEventId: quote.google_event_id,
                    updatePickupEventId: quote.google_pickup_event_id,
                });
            }
        } catch (e) {
            console.error('Admin: Error syncing calendar after update', e);
        }
    }

    revalidatePath('/admin/quotes');
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
}

// ── Send Direct Email ────────────────────────────────────────────────────
export async function sendDirectEmail(quoteId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
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
    const db = createServerClient();
    const [quoteRes, templateRes] = await Promise.all([
        db.from('quotes').select('client_email, client_name, client_lastname, review_email_sent').eq('id', quoteId).single(),
        db.from('admin_settings').select('value').eq('key', 'review_template').single(),
    ]);

    if (!quoteRes.data?.client_email) return { success: false, error: 'Sin email de cliente.' };
    if (quoteRes.data.review_email_sent) return { success: false, error: 'El email de review ya fue enviado.' };

    const fullName = `${quoteRes.data.client_name} ${quoteRes.data.client_lastname || ''}`.trim();
    const template = (templateRes.data?.value || '').replace('{nombre}', fullName);
    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px;">
        <p style="font-size: 15px; line-height: 1.7; color: #334155;">${template.replace(/\n/g, '<br/>')}</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://cocktailsontap.cl/google" style="background: #E2A049; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px;">⭐ Dejar reseña en Google</a>
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

// ── Save Admin Settings ──────────────────────────────────────────────────
export async function saveAdminSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const db = createServerClient();
    const reviewMode = formData.get('review_mode') as string;
    const reviewTemplate = formData.get('review_template') as string;

    await Promise.all([
        db.from('admin_settings').upsert({ key: 'review_mode', value: reviewMode }),
        db.from('admin_settings').upsert({ key: 'review_template', value: reviewTemplate }),
    ]);
    revalidatePath('/admin/settings');
    return { success: true };
}

// ── Retry Sync Log ───────────────────────────────────────────────────────
export async function retrySyncLog(logId: string): Promise<{ success: boolean; error?: string }> {
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

// Helper: auto-send review if setting is 'auto'
async function maybeAutoSendReview(quoteId: string, db: any) {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'review_mode').single();
    if (data?.value === 'auto') {
        await sendReviewEmail(quoteId);
    }
}
