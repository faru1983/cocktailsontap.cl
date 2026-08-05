import { createServerClient } from '@/lib/supabaseServer';
import {
    sendMetaCapiEvent,
    readMetaBrowserCookies,
    type MetaCapiEventName,
} from '@/lib/services/metaCapiService';
import { SITE_URL } from '@/lib/config';

export type ClientLifecycleStage = 'curious' | 'engaged' | 'quoted' | 'customer' | 'lost';
export type ClientIntent = 'event' | 'direct' | 'unknown';

/** Monotonic order for automatic advances. `lost` is manual-only. */
const STAGE_RANK: Record<ClientLifecycleStage, number> = {
    curious: 0,
    engaged: 1,
    quoted: 2,
    customer: 3,
    lost: -1,
};

export const LIFECYCLE_STAGES: ClientLifecycleStage[] = [
    'curious',
    'engaged',
    'quoted',
    'customer',
    'lost',
];

export const STAGE_LABELS: Record<ClientLifecycleStage, string> = {
    curious: 'Curioso',
    engaged: 'Interesado',
    quoted: 'Cotizó',
    customer: 'Cliente',
    lost: 'Perdido',
};

export interface AdvanceStageOpts {
    reason: string;
    source?: string;
    quoteId?: string | null;
    touchpointId?: string | null;
    intent?: ClientIntent | null;
    /** Force set even when rank would not advance (admin / lost). */
    force?: boolean;
    /**
     * CRM lifecycle CAPI (engaged→Contact): only when `true`.
     * `curious` solo CRM/touchpoint — no Lead CAPI (señal de baja calidad en Meta).
     * Quote commerce CAPI (quoted→Lead / customer→Purchase with token): default on
     * when `quoteToken` is set; pass `false` to skip.
     */
    fireCapi?: boolean;
    /** Quote token → event_id `lead_{token}` / `purchase_{token}` (dedupe con Pixel). */
    quoteToken?: string | null;
    /** Monto CLP para Lead/Purchase de cotización. */
    value?: number | null;
    contentName?: string | null;
    ctwaClid?: string | null;
    fbc?: string | null;
    fbp?: string | null;
    /** Señales Meta Contact (Interesado WA con datos mínimos del flujo). */
    engagedGuests?: number | null;
    engagedComuna?: string | null;
}

export interface AdvanceStageResult {
    changed: boolean;
    fromStage: ClientLifecycleStage | null;
    toStage: ClientLifecycleStage;
    eventId: string | null;
    metaEventSent: string | null;
}

function isLifecycleStage(value: string | null | undefined): value is ClientLifecycleStage {
    return !!value && (LIFECYCLE_STAGES as string[]).includes(value);
}

function resolveActionSource(
    source?: string
): 'website' | 'chat' | 'phone_call' | 'other' {
    if (source === 'whatsapp') return 'chat';
    if (source === 'admin') return 'phone_call';
    if (source === 'web') return 'website';
    return 'other';
}

/**
 * Advance (or force-set) client lifecycle stage. Automatic path is monotonic:
 * curious < engaged < quoted < customer. `lost` only via force. From `lost`,
 * a new quote/sale can reopen to quoted/customer.
 *
 * **Única puerta de salida CAPI** del CRM:
 * - curious → solo etapa CRM (sin CAPI)
 * - engaged + fireCapi → Contact `contact_client_{id}` (una vez)
 * - quoted + quoteToken → Lead `lead_{token}` (+ value)
 * - customer + quoteToken → Purchase `purchase_{token}` (+ value)
 * Incluye web, whatsapp y admin (admin = canal manual real / teléfono).
 */
export async function advanceClientStage(
    clientId: string,
    toStage: ClientLifecycleStage,
    opts: AdvanceStageOpts
): Promise<AdvanceStageResult> {
    const db = createServerClient();
    const now = new Date().toISOString();

    const { data: client, error } = await db
        .from('clients')
        .select('id, lifecycle_stage, intent, merged_into_id')
        .eq('id', clientId)
        .maybeSingle();

    if (error || !client) {
        throw new Error(error?.message || 'Cliente no encontrado para avance de etapa.');
    }

    const canonicalId = client.merged_into_id || clientId;
    let row = client;
    if (client.merged_into_id) {
        const { data: survivor } = await db
            .from('clients')
            .select('id, lifecycle_stage, intent, merged_into_id')
            .eq('id', canonicalId)
            .maybeSingle();
        if (!survivor) throw new Error('Cliente canónico no encontrado.');
        row = survivor;
    }

    const fromStage = isLifecycleStage(row.lifecycle_stage) ? row.lifecycle_stage : 'curious';
    const force = opts.force === true;

    let shouldChange = false;
    if (force) {
        shouldChange = fromStage !== toStage;
    } else if (fromStage === 'lost') {
        // Reopen only toward quoted/customer (or engaged if somehow needed)
        shouldChange = STAGE_RANK[toStage] >= STAGE_RANK.engaged && toStage !== 'lost';
    } else if (toStage === 'lost') {
        shouldChange = false; // lost is manual-only
    } else {
        shouldChange = STAGE_RANK[toStage] > STAGE_RANK[fromStage];
    }

    const patch: Record<string, unknown> = {
        last_activity_at: now,
        updated_at: now,
    };

    if (opts.intent) {
        patch.intent = opts.intent;
    }

    let metaEventSent: string | null = null;
    let eventRowId: string | null = null;

    if (shouldChange) {
        patch.lifecycle_stage = toStage;
        patch.stage_changed_at = now;
    }

    await db.from('clients').update(patch).eq('id', row.id);

    const actionSource = resolveActionSource(opts.source);

    // ─── CAPI A: ciclo CRM (engaged) — una vez por persona ───────────────────
    // curious: solo CRM + touchpoint (ctwa_clid guardado); sin Lead CAPI en Meta.
    if (opts.fireCapi === true && toStage === 'engaged') {
        const eventName: MetaCapiEventName = 'Contact';
        const stableId = `contact_client_${row.id}`;
        const legacyLabel = eventName; // datos antiguos guardaban solo "Contact"

        const { count: priorCapi } = await db
            .from('client_stage_events')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', row.id)
            .or(`meta_event_sent.eq.${stableId},meta_event_sent.eq.${legacyLabel}`);

        if (!priorCapi) {
            try {
                const intent = opts.intent;
                const contentName =
                    intent === 'direct'
                        ? 'CRM Barriles Contact'
                        : intent === 'event'
                          ? 'CRM Eventos Contact'
                          : 'CRM Interesado Contact';
                const contentCategory =
                    intent === 'direct'
                        ? 'Venta Directa'
                        : intent === 'event'
                          ? 'Servicio de Eventos'
                          : 'CRM Lifecycle';

                const customData: Record<string, unknown> = {
                    content_name: contentName,
                    content_category: contentCategory,
                    lifecycle_stage: toStage,
                };
                if (opts.engagedGuests != null && opts.engagedGuests > 0) {
                    customData.num_guests = opts.engagedGuests;
                }

                const capi = await sendMetaCapiEvent({
                    eventName,
                    eventId: stableId,
                    clientId: row.id,
                    actionSource,
                    touchpointId: opts.touchpointId || undefined,
                    ctwaClid: opts.ctwaClid,
                    fbc: opts.fbc,
                    fbp: opts.fbp,
                    city: opts.engagedComuna,
                    customData,
                });
                if (capi.success) metaEventSent = stableId;
            } catch (err) {
                console.error('advanceClientStage CAPI lifecycle error:', err);
            }
        }
    }

    // ─── CAPI B: cotización / venta (quoted / customer + token) — por token ───
    // Incluye admin (teléfono / wizard manual). Se dispara aunque la etapa no cambie
    // (cliente recurrente → nueva Purchase).
    const fireQuoteCapi =
        !!opts.quoteToken &&
        (toStage === 'quoted' || toStage === 'customer') &&
        opts.fireCapi !== false;

    if (fireQuoteCapi && opts.quoteToken) {
        const eventName: MetaCapiEventName = toStage === 'quoted' ? 'Lead' : 'Purchase';
        const eventId =
            toStage === 'quoted' ? `lead_${opts.quoteToken}` : `purchase_${opts.quoteToken}`;

        // Dedupe por event_id (token único) — no reenviar el mismo Lead/Purchase
        const { count: priorQuoteCapi } = await db
            .from('client_stage_events')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', row.id)
            .eq('meta_event_sent', eventId);
        const alreadySent = (priorQuoteCapi ?? 0) > 0;

        if (!alreadySent) {
            try {
                const cookies =
                    opts.source === 'web' ? await readMetaBrowserCookies() : {};
                const isPurchase = eventName === 'Purchase';
                const defaultName = isPurchase
                    ? opts.intent === 'direct'
                        ? 'Pedido de Barril Desechable'
                        : 'Reserva de Evento Confirmada'
                    : 'Cotización de Evento (Borrador)';

                const capi = await sendMetaCapiEvent({
                    eventName,
                    eventId,
                    clientId: row.id,
                    actionSource,
                    eventSourceUrl: `${SITE_URL}/cotizar/${opts.quoteToken}`,
                    touchpointId: opts.touchpointId || undefined,
                    ctwaClid: opts.ctwaClid,
                    fbc: opts.fbc ?? cookies.fbc,
                    fbp: opts.fbp ?? cookies.fbp,
                    customData: {
                        content_name: opts.contentName || defaultName,
                        content_category:
                            opts.intent === 'direct' ? 'Venta Directa' : 'Servicio de Eventos',
                        currency: 'CLP',
                        value: opts.value ?? undefined,
                        order_id: opts.quoteToken,
                        content_type: 'product',
                        lifecycle_stage: toStage,
                        quote_source: opts.source || null,
                    },
                });
                if (capi.success) metaEventSent = eventId;
            } catch (err) {
                console.error('advanceClientStage CAPI quote error:', err);
            }
        }
    }

    if (shouldChange || metaEventSent) {
        const { data: stageEvent } = await db
            .from('client_stage_events')
            .insert({
                client_id: row.id,
                from_stage: fromStage,
                to_stage: shouldChange ? toStage : fromStage,
                reason: opts.reason,
                source: opts.source || null,
                quote_id: opts.quoteId || null,
                touchpoint_id: opts.touchpointId || null,
                meta_event_sent: metaEventSent,
            })
            .select('id')
            .single();
        eventRowId = stageEvent?.id ?? null;
    }

    return {
        changed: shouldChange,
        fromStage,
        toStage: shouldChange ? toStage : fromStage,
        eventId: eventRowId,
        metaEventSent,
    };
}

export async function listClientStageEvents(clientId: string, limit = 20) {
    const db = createServerClient();
    const { data } = await db
        .from('client_stage_events')
        .select('id, from_stage, to_stage, reason, source, quote_id, touchpoint_id, meta_event_sent, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

export async function touchClientActivity(clientId: string): Promise<void> {
    const db = createServerClient();
    await db
        .from('clients')
        .update({
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
}
