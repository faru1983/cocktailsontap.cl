/**
 * Recordatorios: plantillas, audiencias (draft / aniversario), omitidos,
 * envío Resend y job de cron. WhatsApp sigue siendo solo manual (UI).
 */
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabaseServer';
import { FROM_EMAIL, PROJECT_TIMEZONE, SITE_URL, WHATSAPP_LABEL, WHATSAPP_URL } from '@/lib/config';
import { SettingsService } from '@/lib/services/settingsService';
import { formatCurrency } from '@/lib/utils';

export type ReminderTrigger = 'draft_event' | 'anniversary_event' | 'anniversary_direct';
export type ReminderLogStatus = 'sent' | 'failed' | 'skipped';
export type ReminderSource = 'manual' | 'cron';

export interface ReminderTemplate {
    id: string;
    name: string;
    subject: string | null;
    content: string;
    type: string;
    trigger: ReminderTrigger;
    auto_enabled: boolean;
    days_before: number;
    auto_channel: string;
}

export interface ReminderSuppression {
    id: string;
    email: string;
    note: string | null;
    created_at: string;
}

export interface ReminderLogRow {
    id: string;
    quote_id: string | null;
    template_id: string | null;
    channel: string;
    sent_at: string;
    client_id: string | null;
    recipient_email: string | null;
    status: ReminderLogStatus;
    error: string | null;
    trigger: string | null;
    target_date: string | null;
    source: ReminderSource;
    reminder_templates?: { name: string } | null;
}

export interface ReminderCronSettings {
    enabled: boolean;
    hour: number;
    lastRunAt: string;
    lastRunSummary: string;
}

export interface ReminderCandidate {
    quoteId: string;
    clientId: string | null;
    email: string | null;
    name: string;
    eventDate: string;
    totalPrice: number;
    token: string | null;
    targetDate: string;
    template: ReminderTemplate;
}

export interface ReminderJobSummary {
    ran: boolean;
    reason?: string;
    sent: number;
    failed: number;
    skipped: number;
    processed: number;
    at: string;
}

type QuoteRow = {
    id: string;
    client_id: string | null;
    client_name: string;
    client_lastname: string | null;
    client_email: string | null;
    event_date: string;
    total_price: number;
    token: string;
    status: string;
    service_type: string | null;
    dispenser: string | null;
};

/** Normaliza email para omitidos / dedup. */
export function normalizeReminderEmail(email: string | null | undefined): string {
    return (email || '').trim().toLowerCase();
}

/** Fecha calendario YYYY-MM-DD en America/Santiago. */
export function todayYmdInSantiago(now = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: PROJECT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hora 0–23 en America/Santiago. */
export function hourInSantiago(now = new Date()): number {
    const hour = new Intl.DateTimeFormat('en-GB', {
        timeZone: PROJECT_TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now).find((p) => p.type === 'hour')?.value;
    return Number(hour ?? 0);
}

/** Suma/resta días a una fecha YYYY-MM-DD (calendario, sin TZ). */
export function shiftYmd(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

/** Fecha larga en español para emails (solo server). */
function formatEventDateLong(ymd: string): string {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function displayName(q: Pick<QuoteRow, 'client_name' | 'client_lastname'>): string {
    return [q.client_name, q.client_lastname].filter(Boolean).join(' ').trim() || 'Cliente';
}

function isEventQuote(q: QuoteRow): boolean {
    if (q.service_type === 'event') return true;
    if (q.service_type === 'direct') return false;
    return q.dispenser === 'portatil' || q.dispenser === 'muro';
}

function isDirectQuote(q: QuoteRow): boolean {
    if (q.service_type === 'direct') return true;
    if (q.service_type === 'event') return false;
    return q.dispenser === 'desechable';
}

/**
 * Próximo aniversario (≥ 1 año después de la reserva) cuyo día de envío
 * (aniversario - daysBefore) cae en `todayYmd`. Devuelve la fecha ancla del ciclo.
 */
export function anniversaryTargetIfDue(
    lastEventYmd: string,
    daysBefore: number,
    todayYmd: string
): string | null {
    const [y0, m0, d0] = lastEventYmd.split('-').map(Number);
    const todayYear = Number(todayYmd.slice(0, 4));

    for (let year = Math.max(todayYear - 1, y0 + 1); year <= todayYear + 1; year++) {
        if (year <= y0) continue;
        const day = m0 === 2 && d0 === 29 && !isLeapYear(year) ? 28 : d0;
        const anniversary = `${year}-${String(m0).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const sendOn = shiftYmd(anniversary, -daysBefore);
        if (sendOn === todayYmd) return anniversary;
    }
    return null;
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export async function getReminderCronSettings(): Promise<ReminderCronSettings> {
    const rows = await SettingsService.getByCategory('reminders');
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const hour = Number(map.reminders_cron_hour ?? 9);
    return {
        enabled: String(map.reminders_cron_enabled ?? 'false') === 'true',
        hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.trunc(hour))) : 9,
        lastRunAt: map.reminders_last_run_at || '',
        lastRunSummary: map.reminders_last_run_summary || '',
    };
}

async function setReminderSetting(key: string, value: string) {
    const db = createServerClient();
    const { error } = await db
        .from('site_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
    if (error) console.error(`[reminderService] setSetting ${key}:`, error.message);
}

export async function listSuppressions(): Promise<ReminderSuppression[]> {
    const db = createServerClient();
    const { data, error } = await db
        .from('reminder_suppressions')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[reminderService] listSuppressions:', error.message);
        return [];
    }
    return (data || []) as ReminderSuppression[];
}

export async function getSuppressedEmailSet(): Promise<Set<string>> {
    const rows = await listSuppressions();
    return new Set(rows.map((r) => normalizeReminderEmail(r.email)));
}

async function alreadySent(opts: {
    templateId: string;
    targetDate: string;
    quoteId?: string | null;
    clientId?: string | null;
}): Promise<boolean> {
    const db = createServerClient();
    let q = db
        .from('reminder_logs')
        .select('id')
        .eq('template_id', opts.templateId)
        .eq('target_date', opts.targetDate)
        .eq('channel', 'email')
        .eq('status', 'sent')
        .limit(1);

    if (opts.clientId) q = q.eq('client_id', opts.clientId);
    else if (opts.quoteId) q = q.eq('quote_id', opts.quoteId);
    else return false;

    const { data } = await q;
    return (data?.length || 0) > 0;
}

async function insertLog(row: {
    quote_id?: string | null;
    template_id: string;
    channel: string;
    client_id?: string | null;
    recipient_email?: string | null;
    status: ReminderLogStatus;
    error?: string | null;
    trigger?: string | null;
    target_date?: string | null;
    source: ReminderSource;
}) {
    const db = createServerClient();
    const { error } = await db.from('reminder_logs').insert(row);
    if (error) console.error('[reminderService] insertLog:', error.message);
}

function buildEmailHtml(contentHtml: string): string {
    return `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px; color: #1e293b;">
            <div style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${contentHtml}</div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
        </div>`;
}

/** Renderiza variables {nombre} {fecha} {total} {link} {whatsapp} → HTML email. */
export function renderReminderEmailHtml(template: { content: string }, vars: {
    nombre: string;
    fecha: string;
    total: string;
    link: string;
    linkHref: string;
}): string {
    const content = template.content
        .replace(/\\n/g, '\n')
        .replace(/{nombre}/g, `<strong>${vars.nombre}</strong>`)
        .replace(/{fecha}/g, `<strong>${vars.fecha}</strong>`)
        .replace(/{total}/g, `<strong>${vars.total}</strong>`)
        .replace(
            /{link}/g,
            `<a href="${vars.linkHref}" style="color: #E2A049; font-weight: 700;">${vars.link}</a>`
        )
        .replace(
            /{whatsapp}/g,
            `<a href="${WHATSAPP_URL}" style="color: #E2A049; font-weight: 700;">${WHATSAPP_LABEL}</a>`
        );
    return buildEmailHtml(content);
}

export function renderReminderSubject(subject: string | null | undefined, vars: { nombre: string; fecha: string }): string {
    return (subject || 'Recordatorio Cocktails on Tap')
        .replace(/{fecha}/g, vars.fecha)
        .replace(/{nombre}/g, vars.nombre);
}

async function sendOneEmail(opts: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ ok: boolean; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' };
    const resend = new Resend(key);
    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: opts.to,
            subject: opts.subject,
            html: opts.html,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Error al enviar' };
    }
}

/** Envío manual por lote (Pendientes). Respeta omitidos. */
export async function sendManualBatchReminders(
    quoteIds: string[],
    templateId: string
): Promise<{ success: boolean; results?: Array<{ quoteId: string; success: boolean; error?: string }>; error?: string }> {
    const db = createServerClient();
    const { data: template } = await db.from('reminder_templates').select('*').eq('id', templateId).single();
    if (!template) return { success: false, error: 'Plantilla no encontrada.' };

    const { data: quotes } = await db.from('quotes').select('*').in('id', quoteIds);
    if (!quotes?.length) return { success: false, error: 'No se encontraron las cotizaciones.' };

    const suppressed = await getSuppressedEmailSet();
    const today = todayYmdInSantiago();
    const results: Array<{ quoteId: string; success: boolean; error?: string }> = [];

    for (const quote of quotes as QuoteRow[]) {
        const email = normalizeReminderEmail(quote.client_email);
        if (!email) {
            await insertLog({
                quote_id: quote.id,
                template_id: template.id,
                channel: 'email',
                client_id: quote.client_id,
                status: 'skipped',
                error: 'Sin email',
                trigger: template.trigger,
                target_date: quote.event_date || today,
                source: 'manual',
            });
            results.push({ quoteId: quote.id, success: false, error: 'Sin email' });
            continue;
        }
        if (suppressed.has(email)) {
            await insertLog({
                quote_id: quote.id,
                template_id: template.id,
                channel: 'email',
                client_id: quote.client_id,
                recipient_email: email,
                status: 'skipped',
                error: 'Email en lista de omitidos',
                trigger: template.trigger,
                target_date: quote.event_date || today,
                source: 'manual',
            });
            results.push({ quoteId: quote.id, success: false, error: 'Email omitido' });
            continue;
        }

        const eventDateStr = quote.event_date ? formatEventDateLong(quote.event_date) : 'por confirmar';
        const totalStr = formatCurrency(Number(quote.total_price) || 0);
        const linkHref = `${SITE_URL}/cotizar/${quote.token}`;
        const nombre = displayName(quote);
        const html = renderReminderEmailHtml(template, {
            nombre,
            fecha: eventDateStr,
            total: totalStr,
            link: linkHref,
            linkHref,
        });
        const subject = renderReminderSubject(template.subject, { nombre, fecha: eventDateStr });
        const sent = await sendOneEmail({ to: email, subject, html });

        await insertLog({
            quote_id: quote.id,
            template_id: template.id,
            channel: 'email',
            client_id: quote.client_id,
            recipient_email: email,
            status: sent.ok ? 'sent' : 'failed',
            error: sent.error || null,
            trigger: template.trigger,
            target_date: quote.event_date || today,
            source: 'manual',
        });
        results.push({ quoteId: quote.id, success: sent.ok, error: sent.error });
    }

    return { success: true, results };
}

export async function sendTestReminderEmailService(
    toEmail: string,
    template: { subject: string; content: string }
): Promise<{ success: boolean; error?: string }> {
    if (!toEmail) return { success: false, error: 'Email de prueba es obligatorio.' };
    const eventDateStr = formatEventDateLong(todayYmdInSantiago());
    const totalStr = formatCurrency(150000);
    const testLink = `${SITE_URL}/cotizar/test-token`;
    const testName = 'Cliente de Prueba';
    const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #fff; border-radius: 12px; color: #1e293b;">
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;"><strong>[EMAIL DE PRUEBA]</strong></p>
        <div style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${template.content
            .replace(/\\n/g, '\n')
            .replace(/{nombre}/g, `<strong>${testName}</strong>`)
            .replace(/{fecha}/g, `<strong>${eventDateStr}</strong>`)
            .replace(/{total}/g, `<strong>${totalStr}</strong>`)
            .replace(/{link}/g, `<a href="${testLink}" style="color: #E2A049; font-weight: 700;">${testLink}</a>`)
            .replace(
                /{whatsapp}/g,
                `<a href="${WHATSAPP_URL}" style="color: #E2A049; font-weight: 700;">${WHATSAPP_LABEL}</a>`
            )}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Cocktails on Tap — <a href="${SITE_URL}" style="color: #E2A049;">cocktailsontap.cl</a></p>
    </div>`;

    const sent = await sendOneEmail({
        to: toEmail,
        subject: `[PRUEBA] ${renderReminderSubject(template.subject, { nombre: testName, fecha: eventDateStr })}`,
        html,
    });
    if (!sent.ok) return { success: false, error: sent.error };
    return { success: true };
}

async function loadAutoTemplates(): Promise<ReminderTemplate[]> {
    const db = createServerClient();
    const { data, error } = await db
        .from('reminder_templates')
        .select('*')
        .eq('auto_enabled', true);
    if (error) {
        console.error('[reminderService] loadAutoTemplates:', error.message);
        return [];
    }
    return (data || []) as ReminderTemplate[];
}

async function resolveDraftCandidates(
    template: ReminderTemplate,
    today: string,
    suppressed: Set<string>
): Promise<ReminderCandidate[]> {
    const targetEventDate = shiftYmd(today, template.days_before);
    const db = createServerClient();
    const { data, error } = await db
        .from('quotes')
        .select('id, client_id, client_name, client_lastname, client_email, event_date, total_price, token, status, service_type, dispenser')
        .eq('status', 'draft')
        .eq('event_date', targetEventDate);
    if (error) {
        console.error('[reminderService] draft audience:', error.message);
        return [];
    }

    const out: ReminderCandidate[] = [];
    for (const q of (data || []) as QuoteRow[]) {
        out.push({
            quoteId: q.id,
            clientId: q.client_id,
            email: normalizeReminderEmail(q.client_email) || null,
            name: displayName(q),
            eventDate: q.event_date,
            totalPrice: Number(q.total_price) || 0,
            token: q.token,
            targetDate: q.event_date,
            template,
        });
    }
    // suppressed handled at send time with skipped logs
    void suppressed;
    return out;
}

async function resolveAnniversaryCandidates(
    template: ReminderTemplate,
    today: string,
    kind: 'event' | 'direct'
): Promise<ReminderCandidate[]> {
    const db = createServerClient();
    const { data, error } = await db
        .from('quotes')
        .select('id, client_id, client_name, client_lastname, client_email, event_date, total_price, token, status, service_type, dispenser')
        .in('status', ['confirmed', 'completed'])
        .not('event_date', 'is', null)
        .order('event_date', { ascending: false });
    if (error) {
        console.error('[reminderService] anniversary audience:', error.message);
        return [];
    }

    const latestByKey = new Map<string, QuoteRow>();
    for (const q of (data || []) as QuoteRow[]) {
        const match = kind === 'event' ? isEventQuote(q) : isDirectQuote(q);
        if (!match) continue;
        const key = q.client_id || `email:${normalizeReminderEmail(q.client_email)}` || `quote:${q.id}`;
        if (!q.client_id && !normalizeReminderEmail(q.client_email)) continue;
        if (!latestByKey.has(key)) latestByKey.set(key, q);
    }

    const out: ReminderCandidate[] = [];
    for (const q of latestByKey.values()) {
        const target = anniversaryTargetIfDue(q.event_date, template.days_before, today);
        if (!target) continue;
        out.push({
            quoteId: q.id,
            clientId: q.client_id,
            email: normalizeReminderEmail(q.client_email) || null,
            name: displayName(q),
            eventDate: q.event_date,
            totalPrice: Number(q.total_price) || 0,
            token: q.token,
            targetDate: target,
            template,
        });
    }
    return out;
}

async function processCandidate(
    c: ReminderCandidate,
    suppressed: Set<string>,
    source: ReminderSource
): Promise<'sent' | 'failed' | 'skipped'> {
    const tpl = c.template;

    if (await alreadySent({
        templateId: tpl.id,
        targetDate: c.targetDate,
        quoteId: c.quoteId,
        clientId: c.clientId,
    })) {
        return 'skipped';
    }

    if (!c.email) {
        await insertLog({
            quote_id: c.quoteId,
            template_id: tpl.id,
            channel: 'email',
            client_id: c.clientId,
            status: 'skipped',
            error: 'Sin email',
            trigger: tpl.trigger,
            target_date: c.targetDate,
            source,
        });
        return 'skipped';
    }

    if (suppressed.has(c.email)) {
        await insertLog({
            quote_id: c.quoteId,
            template_id: tpl.id,
            channel: 'email',
            client_id: c.clientId,
            recipient_email: c.email,
            status: 'skipped',
            error: 'Email en lista de omitidos',
            trigger: tpl.trigger,
            target_date: c.targetDate,
            source,
        });
        return 'skipped';
    }

    const fecha = formatEventDateLong(c.eventDate);
    const linkHref = c.token ? `${SITE_URL}/cotizar/${c.token}` : `${SITE_URL}/cotizar`;
    const linkLabel = c.token ? linkHref : `${SITE_URL}/cotizar`;
    const html = renderReminderEmailHtml(tpl, {
        nombre: c.name,
        fecha,
        total: formatCurrency(c.totalPrice),
        link: linkLabel,
        linkHref,
    });
    const subject = renderReminderSubject(tpl.subject, { nombre: c.name, fecha });
    const sent = await sendOneEmail({ to: c.email, subject, html });

    await insertLog({
        quote_id: c.quoteId,
        template_id: tpl.id,
        channel: 'email',
        client_id: c.clientId,
        recipient_email: c.email,
        status: sent.ok ? 'sent' : 'failed',
        error: sent.error || null,
        trigger: tpl.trigger,
        target_date: c.targetDate,
        source,
    });
    return sent.ok ? 'sent' : 'failed';
}

/**
 * Job diario de recordatorios automáticos (solo email).
 * @param respectSchedule si true, respeta enabled + hora Santiago.
 */
export async function runReminderJob(opts: {
    respectSchedule?: boolean;
    now?: Date;
} = {}): Promise<ReminderJobSummary> {
    const now = opts.now ?? new Date();
    const at = now.toISOString();
    const settings = await getReminderCronSettings();
    const respect = opts.respectSchedule !== false;

    if (respect) {
        if (!settings.enabled) {
            return { ran: false, reason: 'Cron deshabilitado', sent: 0, failed: 0, skipped: 0, processed: 0, at };
        }
        // Hobby: Vercel solo admite 1 cron/día (vercel.json ~12:00 UTC).
        // La hora configurada es un filtro opcional: si no coincide con Santiago, no-op
        // (en Pro se puede volver a cron horario y esta puerta sigue sirviendo).
        const hour = hourInSantiago(now);
        if (hour !== settings.hour) {
            return {
                ran: false,
                reason: `Hora Santiago ${hour} ≠ configurada ${settings.hour}. En Hobby el cron corre ~12:00 UTC; ajusta la hora a la de Chile en ese momento (suele ser 8 o 9).`,
                sent: 0,
                failed: 0,
                skipped: 0,
                processed: 0,
                at,
            };
        }
    }

    const today = todayYmdInSantiago(now);
    const templates = await loadAutoTemplates();
    const suppressed = await getSuppressedEmailSet();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;

    for (const tpl of templates) {
        let candidates: ReminderCandidate[] = [];
        if (tpl.trigger === 'draft_event') {
            candidates = await resolveDraftCandidates(tpl, today, suppressed);
        } else if (tpl.trigger === 'anniversary_event') {
            candidates = await resolveAnniversaryCandidates(tpl, today, 'event');
        } else if (tpl.trigger === 'anniversary_direct') {
            candidates = await resolveAnniversaryCandidates(tpl, today, 'direct');
        }

        for (const c of candidates) {
            processed += 1;
            const result = await processCandidate(c, suppressed, 'cron');
            if (result === 'sent') sent += 1;
            else if (result === 'failed') failed += 1;
            else skipped += 1;
        }
    }

    const summary: ReminderJobSummary = { ran: true, sent, failed, skipped, processed, at };
    await setReminderSetting('reminders_last_run_at', at);
    await setReminderSetting('reminders_last_run_summary', JSON.stringify(summary));
    return summary;
}

export async function listRecentReminderLogs(limit = 100): Promise<ReminderLogRow[]> {
    const db = createServerClient();
    const { data, error } = await db
        .from('reminder_logs')
        .select('*, reminder_templates(name)')
        .order('sent_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('[reminderService] listRecentReminderLogs:', error.message);
        return [];
    }
    return (data || []) as ReminderLogRow[];
}
