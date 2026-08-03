import { createHash } from 'crypto';
import {
    META_PIXEL_ID,
    META_CAPI_ACCESS_TOKEN,
    META_CAPI_API_VERSION,
    META_CAPI_TEST_EVENT_CODE,
    SITE_URL,
} from '@/lib/config';
import { getClientIdentifiersForCapi } from '@/lib/services/clientService';
import { createServerClient } from '@/lib/supabaseServer';
import { digitsOnly } from '@/lib/phone';

function sha256Normalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    return createHash('sha256').update(normalized).digest('hex');
}

function hashPhoneE164(e164: string): string {
    // Meta expects digits only with country code, no +
    const digits = digitsOnly(e164);
    return createHash('sha256').update(digits).digest('hex');
}

export type MetaCapiEventName = 'Lead' | 'Contact' | 'Purchase' | 'CompleteRegistration';

export interface SendMetaCapiInput {
    eventName: MetaCapiEventName;
    eventId: string;
    clientId: string;
    eventTime?: number;
    actionSource?: 'website' | 'chat' | 'other';
    eventSourceUrl?: string;
    customData?: Record<string, unknown>;
    /** Override attribution from a specific touchpoint */
    touchpointId?: string;
    ctwaClid?: string | null;
    fbc?: string | null;
    fbp?: string | null;
}

/** Read Meta browser cookies when available (Server Actions / RSC). */
export async function readMetaBrowserCookies(): Promise<{ fbc?: string; fbp?: string }> {
    try {
        const { cookies } = await import('next/headers');
        const jar = await cookies();
        return {
            fbc: jar.get('_fbc')?.value,
            fbp: jar.get('_fbp')?.value,
        };
    } catch {
        return {};
    }
}

/**
 * Send a Meta Conversions API event. No-ops (success:false) if token missing.
 * Uses all client identifiers for EMQ + clients.id as external_id.
 */
export async function sendMetaCapiEvent(
    input: SendMetaCapiInput
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    if (!META_CAPI_ACCESS_TOKEN) {
        return { success: false, skipped: true, error: 'META_CAPI_ACCESS_TOKEN no configurado.' };
    }

    const db = createServerClient();
    const { emails, phones } = await getClientIdentifiersForCapi(input.clientId);

    const { data: client } = await db
        .from('clients')
        .select('first_name, last_name')
        .eq('id', input.clientId)
        .maybeSingle();

    let ctwaClid = input.ctwaClid || null;
    let fbc = input.fbc || null;
    let fbp = input.fbp || null;

    if (input.touchpointId) {
        const { data: tp } = await db
            .from('client_touchpoints')
            .select('meta_ctwa_clid, meta_fbc, meta_fbp')
            .eq('id', input.touchpointId)
            .maybeSingle();
        if (tp) {
            ctwaClid = ctwaClid || tp.meta_ctwa_clid;
            fbc = fbc || tp.meta_fbc;
            fbp = fbp || tp.meta_fbp;
        }
    } else if (!ctwaClid && !fbc) {
        // Latest attribution touchpoint for this client
        const { data: tp } = await db
            .from('client_touchpoints')
            .select('meta_ctwa_clid, meta_fbc, meta_fbp')
            .eq('client_id', input.clientId)
            .or('meta_ctwa_clid.not.is.null,meta_fbc.not.is.null')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (tp) {
            ctwaClid = tp.meta_ctwa_clid;
            fbc = fbc || tp.meta_fbc;
            fbp = fbp || tp.meta_fbp;
        }
    }

    const userData: Record<string, unknown> = {
        external_id: [sha256Normalize(input.clientId)],
        country: [sha256Normalize('cl')],
    };

    if (emails.length) userData.em = emails.map(sha256Normalize);
    if (phones.length) userData.ph = phones.map(hashPhoneE164);
    if (client?.first_name) userData.fn = [sha256Normalize(client.first_name)];
    if (client?.last_name) userData.ln = [sha256Normalize(client.last_name)];
    if (fbc) userData.fbc = fbc;
    if (fbp) userData.fbp = fbp;

    // ctwa_clid goes in custom_data / app data for Click-to-WhatsApp
    const customData: Record<string, unknown> = { ...(input.customData || {}) };
    if (ctwaClid) customData.ctwa_clid = ctwaClid;

    const event: Record<string, unknown> = {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource ?? 'chat',
        user_data: userData,
        custom_data: customData,
    };

    if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;

    const body: Record<string, unknown> = {
        data: [event],
    };
    if (META_CAPI_TEST_EVENT_CODE) {
        body.test_event_code = META_CAPI_TEST_EVENT_CODE;
    }

    const url = `https://graph.facebook.com/${META_CAPI_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('Meta CAPI error:', res.status, json);
            return { success: false, error: JSON.stringify(json) };
        }
        return { success: true };
    } catch (err: any) {
        console.error('Meta CAPI fetch failed:', err);
        return { success: false, error: err?.message || 'CAPI request failed' };
    }
}

/**
 * Mirror browser Pixel events for quotes (same event_id → Meta dedupe).
 * - Event draft → Lead `lead_{token}`
 * - Direct sale → Purchase `purchase_{token}`
 */
export async function sendQuoteCreatedCapi(opts: {
    clientId: string;
    token: string;
    isDirect: boolean;
    source: 'web' | 'admin' | 'whatsapp';
    value?: number;
    contentName?: string;
}): Promise<void> {
    if (opts.source === 'admin') return;

    const cookies = opts.source === 'web' ? await readMetaBrowserCookies() : {};
    const isDirect = opts.isDirect;
    const eventName = isDirect ? 'Purchase' : 'Lead';
    const eventId = isDirect ? `purchase_${opts.token}` : `lead_${opts.token}`;

    await sendMetaCapiEvent({
        eventName,
        eventId,
        clientId: opts.clientId,
        actionSource: opts.source === 'whatsapp' ? 'chat' : 'website',
        eventSourceUrl: `${SITE_URL}/cotizar/${opts.token}`,
        fbc: cookies.fbc,
        fbp: cookies.fbp,
        customData: {
            content_name:
                opts.contentName ||
                (isDirect ? 'Pedido de Barril Desechable' : 'Cotización de Evento (Borrador)'),
            content_category: isDirect ? 'Venta Directa' : 'Servicio de Eventos',
            currency: 'CLP',
            value: opts.value,
            order_id: opts.token,
            content_type: 'product',
        },
    });
}

/** Mirror Pixel Purchase on event confirmation (`purchase_{token}`). */
export async function sendQuotePurchaseCapi(opts: {
    clientId: string;
    token: string;
    value?: number;
    contentName?: string;
}): Promise<void> {
    const cookies = await readMetaBrowserCookies();
    await sendMetaCapiEvent({
        eventName: 'Purchase',
        eventId: `purchase_${opts.token}`,
        clientId: opts.clientId,
        actionSource: 'website',
        eventSourceUrl: `${SITE_URL}/cotizar/${opts.token}`,
        fbc: cookies.fbc,
        fbp: cookies.fbp,
        customData: {
            content_name: opts.contentName || 'Reserva de Evento Confirmada',
            content_category: 'Servicio de Eventos',
            currency: 'CLP',
            value: opts.value,
            order_id: opts.token,
            content_type: 'product',
        },
    });
}
