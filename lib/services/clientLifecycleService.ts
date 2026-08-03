import { createServerClient } from '@/lib/supabaseServer';
import { sendMetaCapiEvent } from '@/lib/services/metaCapiService';

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
    engaged: 'Engaged',
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
    /** Fire CAPI Lead/Contact with stable per-client event_id when advancing to curious/engaged. */
    fireCapi?: boolean;
    ctwaClid?: string | null;
    fbc?: string | null;
    fbp?: string | null;
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

/**
 * Advance (or force-set) client lifecycle stage. Automatic path is monotonic:
 * curious < engaged < quoted < customer. `lost` only via force. From `lost`,
 * a new quote/sale can reopen to quoted/customer.
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

    // CAPI Lead/Contact once per client (stable event_id). Fire even when stage
    // unchanged — e.g. new client defaults to curious then contacts with bot_started.
    if (opts.fireCapi && (toStage === 'curious' || toStage === 'engaged')) {
        const eventName = toStage === 'curious' ? 'Lead' : 'Contact';
        const { count: priorCapi } = await db
            .from('client_stage_events')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', row.id)
            .eq('meta_event_sent', eventName);

        if (!priorCapi) {
            const stableId =
                toStage === 'curious'
                    ? `lead_client_${row.id}`
                    : `contact_client_${row.id}`;
            try {
                const capi = await sendMetaCapiEvent({
                    eventName,
                    eventId: stableId,
                    clientId: row.id,
                    actionSource: opts.source === 'web' ? 'website' : 'chat',
                    touchpointId: opts.touchpointId || undefined,
                    ctwaClid: opts.ctwaClid,
                    fbc: opts.fbc,
                    fbp: opts.fbp,
                    customData: {
                        content_name:
                            toStage === 'curious' ? 'CRM Curious Lead' : 'CRM Engaged Contact',
                        content_category: 'CRM Lifecycle',
                        lifecycle_stage: toStage,
                    },
                });
                if (capi.success) metaEventSent = eventName;
            } catch (err) {
                console.error('advanceClientStage CAPI error:', err);
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
