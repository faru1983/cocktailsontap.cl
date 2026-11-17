/**
 * Integración server-only con DeskcommCRM (https://crm.cocktailsontap.cl):
 * - Sincroniza contacto y lead en el embudo Pedidos vía Webhook Source.
 * - Actualiza monto CLP y mueve etapa cuando corresponde.
 * - Envía mensajes de WhatsApp por la sesión productiva (56962046212) con Idempotency-Key.
 *
 * Todas las funciones son best-effort: registran errores en log y nunca
 * interrumpen el flujo principal de cotización, confirmación o administración.
 */
import { createHash } from 'node:crypto';
import { getBankTransferCopyText, SITE_URL } from '@/lib/config';
import { buildBlueExpressTrackingUrl } from '@/lib/directSaleFulfillment';
import { normalizePhoneE164 } from '@/lib/phone';
import type { Quote, QuoteItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { buildWhatsAppMessageFromQuote, formatEventDate } from '@/lib/wizardLogic';

const PEDIDOS_STAGE_QUOTED_ID = '4efb5192-f37f-408c-80e7-e23c0b4fa798'; // Cotización enviada
const PEDIDOS_STAGE_WON_ID = 'cf99a7c4-5f58-4a80-890e-f13d844e20b3'; // Reserva / Pedido confirmado
const DEFAULT_CHANNEL_SESSION_ID = '86ee3fcc-2521-4649-ba75-01d665d1d6ea'; // 56962046212
const REQUEST_TIMEOUT_MS = 10_000;

type QuoteWithOptionalItems = Quote & { quote_items?: QuoteItem[] };

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
}): Promise<{ ok: boolean; error?: string }> {
    const config = getDeskcommConfig();
    if (!config) {
        return { ok: false, error: 'DeskcommCRM no configurado' };
    }

    const normalizedPhone = normalizePhoneE164(params.phone);
    if (!normalizedPhone) {
        return { ok: false, error: 'Teléfono inválido para WhatsApp' };
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
            const msg = `open-with-contact ${openRes.status}: ${openRes.rawText.slice(0, 200)}`;
            console.error('[DeskcommCRM]', msg);
            return { ok: false, error: msg };
        }

        const openData = unwrapData(openRes.data);
        const conversationId =
            typeof openData?.conversation_id === 'string' ? openData.conversation_id : null;
        if (!conversationId) {
            return { ok: false, error: 'Sin conversation_id desde DeskcommCRM' };
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
            const msg = `messages ${msgRes.status}: ${msgRes.rawText.slice(0, 200)}`;
            console.error('[DeskcommCRM]', msg);
            return { ok: false, error: msg };
        }

        return { ok: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[DeskcommCRM] Excepción enviando WhatsApp:', msg);
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

    try {
        await syncQuoteLeadToDeskcomm(config, quote, 'quoted');
    } catch (err) {
        console.error('[DeskcommCRM] Error sincronizando lead en creación:', err);
    }

    if (!quote.client_phone) return;

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

    await sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body: parts.join('\n'),
        idempotencySeed: `quote-created:${quote.id}`,
    });
}

/**
 * Notifica por WhatsApp y mueve el Lead a "Reserva / Pedido confirmado" cuando se confirma un evento.
 */
export async function notifyEventQuoteConfirmed(quote: QuoteWithOptionalItems): Promise<void> {
    const config = getDeskcommConfig();
    if (!config) return;

    try {
        await syncQuoteLeadToDeskcomm(config, quote, 'won');
    } catch (err) {
        console.error('[DeskcommCRM] Error sincronizando lead en confirmación:', err);
    }

    if (!quote.client_phone) return;

    const firstName = getClientFirstName(quote);
    const items = quote.quote_items || [];
    const summaryText = buildWhatsAppMessageFromQuote({ ...quote, quote_items: items });

    const body = [
        `¡Hola ${firstName}! ✅\nTu reserva en *Cocktails on Tap* quedó confirmada. Para asegurar tu fecha, realiza la transferencia del total:`,
        '',
        summaryText.trim(),
        '',
        buildBankTransferWhatsappBlock(quote.total_price || 0),
    ].join('\n');

    await sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body,
        idempotencySeed: `quote-confirmed:${quote.id}`,
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
): Promise<{ ok: boolean; error?: string }> {
    const config = getDeskcommConfig();
    if (!config) return { ok: false, error: 'DeskcommCRM no configurado' };

    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    if (isDirect || balanceAfter <= 0) {
        try {
            await syncQuoteLeadToDeskcomm(config, quote, 'won');
        } catch (err) {
            console.error('[DeskcommCRM] Error moviendo lead tras pago:', err);
        }
    }

    if (!quote.client_phone) return { ok: false, error: 'Sin teléfono de cliente' };

    const firstName = getClientFirstName(quote);
    const paidInFull = balanceAfter <= 0;
    const itemLabel = isDirect ? 'tu pedido de barriles' : 'tu reserva';
    const dateLine = quote.event_date
        ? `📅 ${isDirect ? 'Fecha estimada' : 'Evento'}: ${formatEventDate(quote.event_date)}`
        : null;

    const statusLine = paidInFull
        ? `Tu ${isDirect ? 'pedido' : 'reserva'} quedó *100% pagado* ✅.`
        : `Saldo pendiente actual: *${formatCurrency(balanceAfter)}*.`;

    const lines = [
        `¡Hola ${firstName}! 💸`,
        `Registramos un pago por *${formatCurrency(paymentAmount)}* para ${itemLabel}.`,
        statusLine,
        ...(dateLine ? [dateLine] : []),
        '',
        `*Ver comprobante actualizado:*\n${getQuoteUrl(quote.token)}`,
    ];

    return sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body: lines.join('\n'),
        idempotencySeed: `payment-registered:${quote.id}:${paymentCount}:${Math.round(paymentAmount)}`,
    });
}

/**
 * Notifica por WhatsApp al marcar un pedido directo (Barriles 5L) en reparto desde /admin.
 */
export async function notifyDirectSaleDispatched(quote: Quote): Promise<{ ok: boolean; error?: string }> {
    if (!quote.client_phone) return { ok: false, error: 'Sin teléfono de cliente' };

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

    return sendWhatsappMessageViaDeskcomm({
        phone: quote.client_phone,
        name: getClientFullName(quote),
        body: lines.join('\n'),
        idempotencySeed: `direct-dispatched:${quote.id}:${quote.dispatch_tracking_number || 'own'}`,
    });
}
