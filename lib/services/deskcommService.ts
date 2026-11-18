/**
 * Integración server-only con DeskcommCRM (https://crm.cocktailsontap.cl):
 * - Lee interruptores desde site_settings (categoría 'whatsapp').
 * - Sincroniza contacto y lead en el embudo Pedidos vía Webhook Source.
 * - Actualiza monto CLP y mueve etapa cuando corresponde.
 * - Envía mensajes de WhatsApp por la sesión productiva (56962046212) con Idempotency-Key.
 * - Registra cada envío/omisión/fallo en whatsapp_notification_logs.
 *
 * Todas las funciones automáticas son best-effort: registran errores en log y nunca
 * interrumpen el flujo principal de cotización, confirmación o administración.
 */
import { createHash } from 'node:crypto';
import { getBankTransferCopyText, SITE_URL } from '@/lib/config';
import { buildBlueExpressTrackingUrl, getQuoteBalance } from '@/lib/directSaleFulfillment';
import { normalizePhoneE164 } from '@/lib/phone';
import { createServerClient } from '@/lib/supabaseServer';
import type { Quote, QuoteItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { buildWhatsAppMessageFromQuote, formatEventDate } from '@/lib/wizardLogic';

const PEDIDOS_STAGE_QUOTED_ID = '4efb5192-f37f-408c-80e7-e23c0b4fa798'; // Cotización enviada
const PEDIDOS_STAGE_WON_ID = 'cf99a7c4-5f58-4a80-890e-f13d844e20b3'; // Reserva / Pedido confirmado
const DEFAULT_CHANNEL_SESSION_ID = '86ee3fcc-2521-4649-ba75-01d665d1d6ea'; // 56962046212
const REQUEST_TIMEOUT_MS = 10_000;

type QuoteWithOptionalItems = Quote & { quote_items?: QuoteItem[] };

export type WhatsappEventType =
    | 'web_event_quote'
    | 'web_direct_order'
    | 'event_confirmed'
    | 'payment_registered'
    | 'direct_dispatched'
    | 'reminder_auto'
    | 'reminder_manual'
    | 'manual_resend'
    | 'test';

export type WhatsappLogStatus = 'sent' | 'failed' | 'skipped';
export type WhatsappLogSource = 'auto' | 'manual' | 'cron';

export interface WhatsappNotificationSettings {
    enabled: boolean;
    webEventQuote: boolean;
    webDirectOrder: boolean;
    eventConfirmed: boolean;
    paymentRegistered: boolean;
    directDispatched: boolean;
    syncDeskcommLeads: boolean;
}

export interface WhatsappNotificationLogRow {
    id: string;
    quote_id: string | null;
    event_type: string;
    recipient_phone: string | null;
    recipient_name: string | null;
    message_preview: string | null;
    status: WhatsappLogStatus;
    error: string | null;
    source: WhatsappLogSource;
    created_at: string;
    quotes?: {
        token: string | null;
        service_type: string | null;
        status: string | null;
        client_name: string | null;
        client_lastname: string | null;
    } | null;
}

const SETTING_KEYS = {
    enabled: 'wa_notify_enabled',
    webEventQuote: 'wa_notify_web_event_quote',
    webDirectOrder: 'wa_notify_web_direct_order',
    eventConfirmed: 'wa_notify_event_confirmed',
    paymentRegistered: 'wa_notify_payment_registered',
    directDispatched: 'wa_notify_direct_dispatched',
    syncDeskcommLeads: 'wa_sync_deskcomm_leads',
} as const;

const SETTING_DESCRIPTIONS: Record<keyof WhatsappNotificationSettings, string> = {
    enabled: 'Interruptor maestro para envíos automáticos de WhatsApp desde cocktailsontap.cl',
    webEventQuote: 'Enviar copia por WhatsApp al cotizar un evento en la web',
    webDirectOrder: 'Enviar resumen y datos bancarios por WhatsApp al pedir barriles 5L en la web',
    eventConfirmed: 'Enviar confirmación y datos bancarios por WhatsApp al confirmar una reserva de evento',
    paymentRegistered: 'Enviar comprobante por WhatsApp al registrar un pago o abono en /admin',
    directDispatched: 'Enviar aviso de despacho y seguimiento por WhatsApp al marcar pedido en reparto',
    syncDeskcommLeads: 'Registrar y avanzar leads en el embudo Pedidos de DeskcommCRM',
};

const DEFAULT_SETTINGS: WhatsappNotificationSettings = {
    enabled: true,
    webEventQuote: true,
    webDirectOrder: true,
    eventConfirmed: true,
    paymentRegistered: true,
    directDispatched: true,
    syncDeskcommLeads: true,
};

interface DeskcommConfig {
    crmUrl: string;
    apiToken: string;
    channelSessionId: string;
    webhookUrl: string | null;
}

function getDeskcommConfig(): DeskcommConfig | null {
    const crmUrl = (process.env.DESKCOMM_CRM_URL || '').trim().replace(/\/+$/, '');
    const apiToken = (process.env.DESKCOMM_CRM_API_TOKEN || '').trim();
    if (!crmUrl || !apiToken) return null;

    const channelSessionId =
        (process.env.DESKCOMM_CRM_CHANNEL_SESSION_ID || '').trim() || DEFAULT_CHANNEL_SESSION_ID;
    const webhookUrl = (process.env.DESKCOMM_CRM_WEBHOOK_URL || '').trim() || null;

    return { crmUrl, apiToken, channelSessionId, webhookUrl };
}

export function isDeskcommConfigured(): { configured: boolean; hasWebhook: boolean; crmUrl: string | null } {
    const cfg = getDeskcommConfig();
    return {
        configured: Boolean(cfg),
        hasWebhook: Boolean(cfg?.webhookUrl),
        crmUrl: cfg?.crmUrl ?? null,
    };
}

/** Lee todos los interruptores de WhatsApp desde site_settings (default true si falta alguno). */
export async function getWhatsappNotificationSettings(): Promise<WhatsappNotificationSettings> {
    try {
        const db = createServerClient();
        const { data, error } = await db
            .from('site_settings')
            .select('key, value, is_active')
            .eq('category', 'whatsapp');

        if (error || !data) return { ...DEFAULT_SETTINGS };

        const map = new Map<string, { value: string; is_active: boolean }>();
        for (const row of data as Array<{ key: string; value: string; is_active: boolean }>) {
            map.set(row.key, row);
        }

        const readBool = (key: string, fallback: boolean): boolean => {
            const row = map.get(key);
            if (!row) return fallback;
            if (!row.is_active) return false;
            return String(row.value).trim().toLowerCase() === 'true';
        };

        return {
            enabled: readBool(SETTING_KEYS.enabled, DEFAULT_SETTINGS.enabled),
            webEventQuote: readBool(SETTING_KEYS.webEventQuote, DEFAULT_SETTINGS.webEventQuote),
            webDirectOrder: readBool(SETTING_KEYS.webDirectOrder, DEFAULT_SETTINGS.webDirectOrder),
            eventConfirmed: readBool(SETTING_KEYS.eventConfirmed, DEFAULT_SETTINGS.eventConfirmed),
            paymentRegistered: readBool(SETTING_KEYS.paymentRegistered, DEFAULT_SETTINGS.paymentRegistered),
            directDispatched: readBool(SETTING_KEYS.directDispatched, DEFAULT_SETTINGS.directDispatched),
            syncDeskcommLeads: readBool(SETTING_KEYS.syncDeskcommLeads, DEFAULT_SETTINGS.syncDeskcommLeads),
        };
    } catch (err) {
        console.error('[DeskcommCRM] Error leyendo settings WhatsApp:', err);
        return { ...DEFAULT_SETTINGS };
    }
}

export async function saveWhatsappNotificationSettings(
    next: Partial<WhatsappNotificationSettings>
): Promise<{ success: boolean; settings?: WhatsappNotificationSettings; error?: string }> {
    try {
        const current = await getWhatsappNotificationSettings();
        const merged: WhatsappNotificationSettings = { ...current, ...next };
        const db = createServerClient();

        const rows = (Object.keys(SETTING_KEYS) as Array<keyof WhatsappNotificationSettings>).map((field) => ({
            key: SETTING_KEYS[field],
            value: merged[field] ? 'true' : 'false',
            category: 'whatsapp',
            is_active: true,
            description: SETTING_DESCRIPTIONS[field],
            updated_at: new Date().toISOString(),
        }));

        const { error } = await db.from('site_settings').upsert(rows, { onConflict: 'key' });
        if (error) return { success: false, error: error.message };
        return { success: true, settings: merged };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

async function logWhatsappNotification(entry: {
    quoteId?: string | null;
    eventType: WhatsappEventType;
    recipientPhone?: string | null;
    recipientName?: string | null;
    messagePreview?: string | null;
    status: WhatsappLogStatus;
    error?: string | null;
    source: WhatsappLogSource;
}): Promise<void> {
    try {
        const db = createServerClient();
        const preview = entry.messagePreview
            ? entry.messagePreview.replace(/\s+/g, ' ').trim().slice(0, 220)
            : null;
        await db.from('whatsapp_notification_logs').insert({
            quote_id: entry.quoteId ?? null,
            event_type: entry.eventType,
            recipient_phone: entry.recipientPhone ?? null,
            recipient_name: entry.recipientName ?? null,
            message_preview: preview,
            status: entry.status,
            error: entry.error ? entry.error.slice(0, 500) : null,
            source: entry.source,
        });
    } catch (err) {
        console.error('[DeskcommCRM] Error guardando whatsapp_notification_logs:', err);
    }
}

export async function listWhatsappNotificationLogs(limit = 80): Promise<WhatsappNotificationLogRow[]> {
    try {
        const db = createServerClient();
        const { data, error } = await db
            .from('whatsapp_notification_logs')
            .select('*, quotes(token, service_type, status, client_name, client_lastname)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('[DeskcommCRM] listWhatsappNotificationLogs:', error.message);
            return [];
        }
        return (data || []) as WhatsappNotificationLogRow[];
    } catch (err) {
        console.error('[DeskcommCRM] listWhatsappNotificationLogs exception:', err);
        return [];
    }
}

export async function clearWhatsappNotificationLogs(): Promise<{
    success: boolean;
    deleted?: number;
    error?: string;
}> {
    try {
        const db = createServerClient();
        const { error, count } = await db
            .from('whatsapp_notification_logs')
            .delete({ count: 'exact' })
            .not('id', 'is', null);
        if (error) return { success: false, error: error.message };
        return { success: true, deleted: count ?? 0 };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/** Genera un UUID v4 determinístico a partir de una semilla para Idempotency-Key. */
export function deterministicUuid(seed: string): string {
    const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function fetchJsonWithTimeout(
    url: string,
    init: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; rawText: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const rawText = await res.text();
        let data: Record<string, unknown> | null = null;
        try {
            data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
        } catch {
            data = null;
        }
        return { ok: res.ok, status: res.status, data, rawText };
    } finally {
        clearTimeout(timer);
    }
}

function unwrapData(payload: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!payload) return null;
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        return payload.data as Record<string, unknown>;
    }
    return payload;
}

function extractReadableError(
    status: number,
    data: Record<string, unknown> | null,
    rawText: string
): string {
    const errObj = data?.error;
    if (errObj && typeof errObj === 'object' && 'message' in errObj) {
        const msg = String((errObj as { message?: unknown }).message || '').trim();
        if (msg) return `HTTP ${status}: ${msg}`;
    }
    if (typeof data?.message === 'string' && data.message.trim()) {
        return `HTTP ${status}: ${data.message.trim()}`;
    }
    return `HTTP ${status}: ${rawText.slice(0, 180) || 'Error desconocido'}`;
}

function getClientFullName(quote: Quote): string {
    return [quote.client_name, quote.client_lastname].filter(Boolean).join(' ').trim() || 'Cliente Web';
}

function getClientFirstName(quote: Quote): string {
    const first = (quote.client_name || '').trim().split(/\s+/)[0];
    return first || 'hola';
}

function getQuoteTitle(quote: Quote): string {
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const fullName = getClientFullName(quote);
    if (isDirect) return `Barriles 5L · ${fullName}`;
    const datePart = quote.event_date ? ` (${quote.event_date})` : '';
    return `Evento · ${fullName}${datePart}`;
}

function getQuoteUrl(token: string): string {
    return `${SITE_URL}/cotizar/${token}`;
}

function buildBankTransferWhatsappBlock(amount: number): string {
    return [
        '*DATOS PARA TRANSFERENCIA:*',
        `Monto a transferir (100%): *${formatCurrency(amount)}*`,
        getBankTransferCopyText(),
        '',
        'Cuando realices la transferencia, envíanos el comprobante por este mismo chat o al correo para validar tu fecha.',
    ].join('\n');
}

function buildQuoteCreatedMessage(quote: QuoteWithOptionalItems): string {
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const firstName = getClientFirstName(quote);
    const items = quote.quote_items || [];
    const summaryText = buildWhatsAppMessageFromQuote({ ...quote, quote_items: items });

    const intro = isDirect
        ? `¡Hola ${firstName}! 👋\nRecibimos tu pedido de barriles en *Cocktails on Tap*. Aquí tienes el resumen y los datos para transferir:`
        : `¡Hola ${firstName}! 👋\nAquí tienes una copia de tu cotización en *Cocktails on Tap*:`;

    const parts = [intro, '', summaryText.trim()];
    if (isDirect) {
        parts.push('', buildBankTransferWhatsappBlock(quote.total_price || 0));
    }
    return parts.join('\n');
}

function buildEventConfirmedMessage(quote: QuoteWithOptionalItems): string {
    const firstName = getClientFirstName(quote);
    const items = quote.quote_items || [];
    const summaryText = buildWhatsAppMessageFromQuote({ ...quote, quote_items: items });

    return [
        `¡Hola ${firstName}! ✅\nTu reserva en *Cocktails on Tap* quedó confirmada. Para asegurar tu fecha, realiza la transferencia del total:`,
        '',
        summaryText.trim(),
        '',
        buildBankTransferWhatsappBlock(quote.total_price || 0),
    ].join('\n');
}

function buildPaymentRegisteredMessage(
    quote: Quote,
    paymentAmount: number,
    balanceAfter: number
): string {
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const firstName = getClientFirstName(quote);
    const paidInFull = balanceAfter <= 0;
    const itemLabel = isDirect ? 'tu pedido de barriles' : 'tu reserva';
    const dateLine = quote.event_date
        ? `📅 ${isDirect ? 'Fecha estimada' : 'Evento'}: ${formatEventDate(quote.event_date)}`
        : null;

    const statusLine = paidInFull
        ? `Tu ${isDirect ? 'pedido' : 'reserva'} quedó *100% pagado* ✅.`
        : `Saldo pendiente actual: *${formatCurrency(balanceAfter)}*.`;

    return [
        `¡Hola ${firstName}! 💸`,
        `Registramos un pago por *${formatCurrency(paymentAmount)}* para ${itemLabel}.`,
        statusLine,
        ...(dateLine ? [dateLine] : []),
        '',
        `*Ver comprobante actualizado:*\n${getQuoteUrl(quote.token)}`,
    ].join('\n');
}

function buildDirectDispatchedMessage(quote: Quote): string {
    const firstName = getClientFirstName(quote);
    const trackingUrl =
        quote.dispatch_tracking_url ||
        (quote.dispatch_tracking_number
            ? buildBlueExpressTrackingUrl(quote.dispatch_tracking_number)
            : null);

    const lines = [
        `¡Hola ${firstName}! 📦`,
        quote.dispatch_mode === 'own'
            ? 'Tu pedido de *Cocktails on Tap* ya salió a reparto con nuestro equipo.'
            : `Tu pedido de *Cocktails on Tap* fue despachado vía *${quote.dispatch_carrier_name || 'envío'}*.`,
    ];

    if (quote.dispatch_tracking_number) {
        lines.push(`🔢 Código de seguimiento: *${quote.dispatch_tracking_number}*`);
    }
    if (trackingUrl) {
        lines.push(`🔎 Seguir envío:\n${trackingUrl}`);
    }

    lines.push('', `*Detalle de tu pedido:*\n${getQuoteUrl(quote.token)}`);
    return lines.join('\n');
}

async function moveLeadStageViaMcp(
    config: DeskcommConfig,
    leadId: string,
    toStageId: string,
    reason: string
): Promise<void> {
    const res = await fetchJsonWithTimeout(`${config.crmUrl}/api/mcp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'crm_move_lead_stage',
                arguments: {
                    lead_id: leadId,
                    to_stage_id: toStageId,
                    reason,
                },
            },
        }),
    });
    if (!res.ok) {
        console.warn('[DeskcommCRM] crm_move_lead_stage no OK:', res.status, res.rawText.slice(0, 300));
    }
}

async function syncQuoteLeadToDeskcomm(
    config: DeskcommConfig,
    quote: Quote,
    targetStage: 'quoted' | 'won'
): Promise<string | null> {
    if (!config.webhookUrl) return null;

    const normalizedPhone = normalizePhoneE164(quote.client_phone || '');
    if (!normalizedPhone && !quote.client_email) return null;

    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const stageId = targetStage === 'won' ? PEDIDOS_STAGE_WON_ID : PEDIDOS_STAGE_QUOTED_ID;
    const stageName = targetStage === 'won' ? 'Reserva / Pedido confirmado' : 'Cotización enviada';
    const fullName = getClientFullName(quote);
    const quoteUrl = getQuoteUrl(quote.token);

    const webhookPayload: Record<string, unknown> = {
        external_id: quote.id,
        name: fullName,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        ...(quote.client_email ? { email: quote.client_email.trim() } : {}),
        stage: stageName,
        quote_token: quote.token,
        quote_url: quoteUrl,
        service_type: isDirect ? 'direct' : 'event',
        total_clp: String(Math.round(quote.total_price || 0)),
        ...(quote.event_date ? { event_date: quote.event_date } : {}),
        ...(quote.comuna_name ? { comuna: quote.comuna_name } : {}),
        ...(quote.guests ? { guests: String(quote.guests) } : {}),
    };

    const whRes = await fetchJsonWithTimeout(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
    });

    if (!whRes.ok) {
        console.error('[DeskcommCRM] Error en webhook source:', whRes.status, whRes.rawText.slice(0, 300));
        return null;
    }

    const whData = unwrapData(whRes.data);
    const leadId = typeof whData?.lead_id === 'string' ? whData.lead_id : null;
    if (!leadId) return null;

    const totalClp = Math.max(0, Math.round(quote.total_price || 0));
    const patchBody: Record<string, unknown> = {
        title: getQuoteTitle(quote),
        value_cents: totalClp * 100,
        currency: 'CLP',
        ...(quote.event_date ? { expected_close_date: quote.event_date } : {}),
    };

    const patchRes = await fetchJsonWithTimeout(`${config.crmUrl}/api/v1/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
        console.warn('[DeskcommCRM] Error actualizando lead PATCH:', patchRes.status, patchRes.rawText.slice(0, 300));
    }

    if (targetStage === 'won') {
        await moveLeadStageViaMcp(
            config,
            leadId,
            stageId,
            isDirect ? 'Pedido confirmado / pagado en cocktailsontap.cl' : 'Reserva confirmada en cocktailsontap.cl'
        );
    }

    return leadId;
}

export async function sendWhatsappMessageViaDeskcomm(params: {
    phone: string;
    name?: string | null;
    body: string;
    idempotencySeed: string;
    logMeta?: {
        quoteId?: string | null;
        eventType: WhatsappEventType;
        source: WhatsappLogSource;
    };
}): Promise<{ ok: boolean; error?: string }> {
    const config = getDeskcommConfig();
    if (!config) {
        const error = 'DeskcommCRM no configurado';
        if (params.logMeta) {
            await logWhatsappNotification({
                ...params.logMeta,
                recipientPhone: params.phone,
                recipientName: params.name,
                messagePreview: params.body,
                status: 'failed',
                error,
            });
        }
        return { ok: false, error };
    }

    const normalizedPhone = normalizePhoneE164(params.phone);
    if (!normalizedPhone) {
        const error = 'Teléfono inválido para WhatsApp';
        if (params.logMeta) {
            await logWhatsappNotification({
                ...params.logMeta,
                recipientPhone: params.phone,
                recipientName: params.name,
                messagePreview: params.body,
                status: 'failed',
                error,
            });
        }
        return { ok: false, error };
    }

    try {
        const openRes = await fetchJsonWithTimeout(
            `${config.crmUrl}/api/v1/conversations/open-with-contact`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiToken}`,
                },
                body: JSON.stringify({
                    channel_session_id: config.channelSessionId,
                    phone_number: normalizedPhone,
                    ...(params.name?.trim() ? { name: params.name.trim() } : {}),
                }),
            }
        );

        if (!openRes.ok) {
            const msg = extractReadableError(openRes.status, openRes.data, openRes.rawText);
            console.error('[DeskcommCRM] open-with-contact:', msg);
            if (params.logMeta) {
                await logWhatsappNotification({
                    ...params.logMeta,
                    recipientPhone: normalizedPhone,
                    recipientName: params.name,
                    messagePreview: params.body,
                    status: 'failed',
                    error: msg,
                });
            }
            return { ok: false, error: msg };
        }

        const openData = unwrapData(openRes.data);
        const conversationId =
            typeof openData?.conversation_id === 'string' ? openData.conversation_id : null;
        if (!conversationId) {
            const msg = 'Sin conversation_id desde DeskcommCRM';
            if (params.logMeta) {
                await logWhatsappNotification({
                    ...params.logMeta,
                    recipientPhone: normalizedPhone,
                    recipientName: params.name,
                    messagePreview: params.body,
                    status: 'failed',
                    error: msg,
                });
            }
            return { ok: false, error: msg };
        }

        const idempotencyKey = deterministicUuid(params.idempotencySeed);
        const msgRes = await fetchJsonWithTimeout(`${config.crmUrl}/api/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiToken}`,
                'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                type: 'text',
                body: params.body,
            }),
        });

        if (!msgRes.ok) {
            const msg = extractReadableError(msgRes.status, msgRes.data, msgRes.rawText);
            console.error('[DeskcommCRM] messages:', msg);
            if (params.logMeta) {
                await logWhatsappNotification({
                    ...params.logMeta,
                    recipientPhone: normalizedPhone,
                    recipientName: params.name,
                    messagePreview: params.body,
                    status: 'failed',
                    error: msg,
                });
            }
            return { ok: false, error: msg };
        }

        if (params.logMeta) {
            await logWhatsappNotification({
                ...params.logMeta,
                recipientPhone: normalizedPhone,
                recipientName: params.name,
                messagePreview: params.body,
                status: 'sent',
                error: null,
            });
        }
        return { ok: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[DeskcommCRM] Excepción enviando WhatsApp:', msg);
        if (params.logMeta) {
            await logWhatsappNotification({
                ...params.logMeta,
                recipientPhone: normalizedPhone,
                recipientName: params.name,
                messagePreview: params.body,
                status: 'failed',
                error: msg,
            });
        }
        return { ok: false, error: msg };
    }
}

/**
 * Notifica por WhatsApp y registra Lead en DeskcommCRM al crear una cotización/pedido web.
 * Solo debe llamarse cuando source === 'web'.
 */
export async function notifyWebQuoteCreated(quote: QuoteWithOptionalItems): Promise<void> {
    const config = getDeskcommConfig();
    if (!config) return;

    const settings = await getWhatsappNotificationSettings();
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const eventType: WhatsappEventType = isDirect ? 'web_direct_order' : 'web_event_quote';

    if (settings.syncDeskcommLeads) {
        try {
            await syncQuoteLeadToDeskcomm(config, quote, 'quoted');
        } catch (err) {
            console.error('[DeskcommCRM] Error sincronizando lead en creación:', err);
        }
    }

    if (!quote.client_phone) return;

    const flagEnabled = isDirect ? settings.webDirectOrder : settings.webEventQuote;
    if (!settings.enabled || !flagEnabled) {
        await logWhatsappNotification({
            quoteId: quote.id,
            eventType,
            recipientPhone: quote.client_phone,
            recipientName: getClientFullName(quote),
            status: 'skipped',
            error: 'Desactivado en configuración de WhatsApp',
            source: 'auto',
        });
        return;
    }

    const body = buildQuoteCreatedMessage(quote);
    await sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `quote-created:${quote.id}`,
        logMeta: { quoteId: quote.id, eventType, source: 'auto' },
    });
}

/**
 * Notifica por WhatsApp y mueve el Lead a "Reserva / Pedido confirmado" cuando se confirma un evento.
 */
export async function notifyEventQuoteConfirmed(quote: QuoteWithOptionalItems): Promise<void> {
    const config = getDeskcommConfig();
    if (!config) return;

    const settings = await getWhatsappNotificationSettings();

    if (settings.syncDeskcommLeads) {
        try {
            await syncQuoteLeadToDeskcomm(config, quote, 'won');
        } catch (err) {
            console.error('[DeskcommCRM] Error sincronizando lead en confirmación:', err);
        }
    }

    if (!quote.client_phone) return;

    if (!settings.enabled || !settings.eventConfirmed) {
        await logWhatsappNotification({
            quoteId: quote.id,
            eventType: 'event_confirmed',
            recipientPhone: quote.client_phone,
            recipientName: getClientFullName(quote),
            status: 'skipped',
            error: 'Desactivado en configuración de WhatsApp',
            source: 'auto',
        });
        return;
    }

    const body = buildEventConfirmedMessage(quote);
    await sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `quote-confirmed:${quote.id}`,
        logMeta: { quoteId: quote.id, eventType: 'event_confirmed', source: 'auto' },
    });
}

/**
 * Notifica por WhatsApp al registrar un pago/abono desde /admin y avanza el lead si corresponde.
 */
export async function notifyQuotePaymentRegistered(
    quote: Quote,
    paymentAmount: number,
    balanceAfter: number,
    paymentCount: number
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    const config = getDeskcommConfig();
    if (!config) return { ok: false, error: 'DeskcommCRM no configurado' };

    const settings = await getWhatsappNotificationSettings();
    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';

    if (settings.syncDeskcommLeads && (isDirect || balanceAfter <= 0)) {
        try {
            await syncQuoteLeadToDeskcomm(config, quote, 'won');
        } catch (err) {
            console.error('[DeskcommCRM] Error moviendo lead tras pago:', err);
        }
    }

    if (!quote.client_phone) return { ok: false, error: 'Sin teléfono de cliente' };

    if (!settings.enabled || !settings.paymentRegistered) {
        await logWhatsappNotification({
            quoteId: quote.id,
            eventType: 'payment_registered',
            recipientPhone: quote.client_phone,
            recipientName: getClientFullName(quote),
            status: 'skipped',
            error: 'Desactivado en configuración de WhatsApp',
            source: 'auto',
        });
        return { ok: true, skipped: true };
    }

    const body = buildPaymentRegisteredMessage(quote, paymentAmount, balanceAfter);
    return sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `payment-registered:${quote.id}:${paymentCount}:${Math.round(paymentAmount)}`,
        logMeta: { quoteId: quote.id, eventType: 'payment_registered', source: 'auto' },
    });
}

/**
 * Notifica por WhatsApp al marcar un pedido directo (Barriles 5L) en reparto desde /admin.
 */
export async function notifyDirectSaleDispatched(
    quote: Quote
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    if (!quote.client_phone) return { ok: false, error: 'Sin teléfono de cliente' };

    const settings = await getWhatsappNotificationSettings();
    if (!settings.enabled || !settings.directDispatched) {
        await logWhatsappNotification({
            quoteId: quote.id,
            eventType: 'direct_dispatched',
            recipientPhone: quote.client_phone,
            recipientName: getClientFullName(quote),
            status: 'skipped',
            error: 'Desactivado en configuración de WhatsApp',
            source: 'auto',
        });
        return { ok: true, skipped: true };
    }

    const body = buildDirectDispatchedMessage(quote);
    return sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `direct-dispatched:${quote.id}:${quote.dispatch_tracking_number || 'own'}`,
        logMeta: { quoteId: quote.id, eventType: 'direct_dispatched', source: 'auto' },
    });
}

/**
 * Envía un recordatorio (cron o lote manual desde /admin/reminders) por WhatsApp vía DeskcommCRM.
 */
export async function sendReminderWhatsappViaDeskcomm(params: {
    quoteId: string;
    phone: string;
    name: string;
    body: string;
    idempotencySeed: string;
    source: 'cron' | 'manual';
}): Promise<{ ok: boolean; error?: string }> {
    if (params.source === 'cron') {
        const settings = await getWhatsappNotificationSettings();
        if (!settings.enabled) {
            const error = 'Notificaciones WhatsApp pausadas (interruptor maestro)';
            await logWhatsappNotification({
                quoteId: params.quoteId,
                eventType: 'reminder_auto',
                recipientPhone: params.phone,
                recipientName: params.name,
                messagePreview: params.body,
                status: 'skipped',
                error,
                source: 'cron',
            });
            return { ok: false, error };
        }
    }

    return sendWhatsappMessageViaDeskcomm({
        phone: params.phone,
        name: params.name,
        body: params.body,
        idempotencySeed: params.idempotencySeed,
        logMeta: {
            quoteId: params.quoteId,
            eventType: params.source === 'cron' ? 'reminder_auto' : 'reminder_manual',
            source: params.source,
        },
    });
}

/** Envío de prueba desde /admin/whatsapp. */
export async function sendTestWhatsappViaDeskcomm(
    phone: string,
    customMessage?: string
): Promise<{ ok: boolean; error?: string }> {
    const body =
        customMessage?.trim() ||
        '✅ *Prueba de notificación Cocktails on Tap*\nEste mensaje confirma que el envío automático desde tu panel /admin hacia WhatsApp está operativo.';

    return sendWhatsappMessageViaDeskcomm({
        phone,
        name: 'Prueba Admin',
        body,
        idempotencySeed: `test-wa:${phone}:${Date.now()}`,
        logMeta: { quoteId: null, eventType: 'test', source: 'manual' },
    });
}

export type ResendQuoteWhatsappMode = 'auto' | 'quote' | 'confirmed' | 'payment' | 'dispatch';

/**
 * Reenvío manual explícito desde /admin/quotes/[id] o desde el historial /admin/whatsapp.
 * Ignora el bloqueo de interruptores automáticos (es acción humana explícita) y usa semilla fresca.
 */
export async function resendQuoteWhatsapp(
    quote: QuoteWithOptionalItems,
    mode: ResendQuoteWhatsappMode = 'auto'
): Promise<{ ok: boolean; sentKind?: string; error?: string }> {
    if (!quote.client_phone) {
        return { ok: false, error: 'El cliente no tiene número de teléfono registrado.' };
    }

    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const payments = Array.isArray(quote.payments) ? quote.payments : [];
    const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
    const balance = getQuoteBalance(quote);

    let effectiveMode: Exclude<ResendQuoteWhatsappMode, 'auto'>;
    if (mode !== 'auto') {
        effectiveMode = mode;
    } else if (isDirect && quote.status === 'in_delivery') {
        effectiveMode = 'dispatch';
    } else if (lastPayment && balance <= 0) {
        effectiveMode = 'payment';
    } else if (!isDirect && quote.status === 'confirmed') {
        effectiveMode = 'confirmed';
    } else if (lastPayment) {
        effectiveMode = 'payment';
    } else {
        effectiveMode = 'quote';
    }

    let body = '';
    let sentKind = 'cotización';
    if (effectiveMode === 'dispatch') {
        body = buildDirectDispatchedMessage(quote);
        sentKind = 'aviso de despacho';
    } else if (effectiveMode === 'payment') {
        if (!lastPayment) {
            return { ok: false, error: 'Esta cotización aún no tiene pagos registrados para reenviar.' };
        }
        body = buildPaymentRegisteredMessage(quote, Number(lastPayment.amount) || 0, balance);
        sentKind = 'comprobante de pago';
    } else if (effectiveMode === 'confirmed' && !isDirect) {
        body = buildEventConfirmedMessage(quote);
        sentKind = 'confirmación de reserva';
    } else {
        body = buildQuoteCreatedMessage(quote);
        sentKind = isDirect ? 'resumen de pedido' : 'cotización';
    }

    const res = await sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `manual-resend:${quote.id}:${effectiveMode}:${Date.now()}`,
        logMeta: {
            quoteId: quote.id,
            eventType: 'manual_resend',
            source: 'manual',
        },
    });

    return { ...res, sentKind };
}
