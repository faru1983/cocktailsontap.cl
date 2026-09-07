/**
 * Exportación configurable de clientes y cotizaciones (admin).
 */

import { createHash } from 'crypto';
import { createServerClient } from '@/lib/supabaseServer';
import { PROJECT_TIMEZONE, SITE_URL } from '@/lib/config';
import { formatQuoteAddress, resolveComunaDisplay } from '@/lib/geo';
import {
    getQuoteBalance,
    isDirectSaleQuote,
    sumQuotePayments,
} from '@/lib/directSaleFulfillment';
import { digitsOnly } from '@/lib/phone';
import type { Quote } from '@/lib/types';
import type {
    ExportClientFilters,
    ExportConfig,
    ExportDataset,
    ExportFormatOptions,
    ExportPreset,
    ExportQuoteFilters,
} from '@/lib/exportSchemas';
import {
    ExportClientFiltersSchema,
    ExportQuoteFiltersSchema,
} from '@/lib/exportSchemas';

const PAGE_SIZE = 1000;
const PREVIEW_LIMIT = 20;

export type ExportFieldDef = {
    key: string;
    label: string;
    header?: string;
    metaHash?: boolean;
};

export type ExportFieldGroup = {
    id: string;
    label: string;
    fields: ExportFieldDef[];
};

export const CLIENT_FIELD_GROUPS: ExportFieldGroup[] = [
    {
        id: 'identity',
        label: 'Identidad',
        fields: [
            { key: 'id', label: 'ID cliente' },
            { key: 'first_name', label: 'Nombre', header: 'fn', metaHash: true },
            { key: 'last_name', label: 'Apellido', header: 'ln', metaHash: true },
            { key: 'full_name', label: 'Nombre completo' },
            { key: 'email', label: 'Email', header: 'email', metaHash: true },
            { key: 'phone', label: 'Celular (E.164)', header: 'phone', metaHash: true },
            { key: 'phone_digits', label: 'Celular solo dígitos' },
            { key: 'extra_emails', label: 'Emails adicionales' },
            { key: 'extra_phones', label: 'Teléfonos adicionales' },
        ],
    },
    {
        id: 'crm',
        label: 'CRM',
        fields: [
            { key: 'lifecycle_stage', label: 'Etapa' },
            { key: 'intent', label: 'Intent' },
            { key: 'tags', label: 'Tags' },
            { key: 'notes', label: 'Notas' },
            { key: 'first_touch_source', label: 'Origen primer contacto' },
            { key: 'first_touch_at', label: 'Fecha primer contacto' },
            { key: 'created_at', label: 'Fecha creación' },
            { key: 'last_activity_at', label: 'Última actividad' },
            { key: 'possible_duplicate', label: 'Posible duplicado' },
        ],
    },
    {
        id: 'metrics',
        label: 'Métricas de pedidos',
        fields: [
            { key: 'total_orders', label: 'Total pedidos' },
            { key: 'confirmed_orders', label: 'Pedidos confirmados+' },
            { key: 'total_amount', label: 'Monto total pedidos' },
            { key: 'paid_amount', label: 'Monto pagado' },
            { key: 'avg_ticket', label: 'Ticket promedio' },
            { key: 'first_purchase', label: 'Primera compra' },
            { key: 'last_purchase', label: 'Última compra' },
            { key: 'bought_events', label: 'Compró eventos' },
            { key: 'bought_direct', label: 'Compró directas' },
            { key: 'preferred_channel', label: 'Canal preferido' },
            { key: 'value', label: 'Valor (Meta)', header: 'value' },
            { key: 'currency', label: 'Moneda', header: 'currency' },
            { key: 'external_id', label: 'External ID (Meta)', header: 'external_id' },
            { key: 'country', label: 'País', header: 'country' },
        ],
    },
    {
        id: 'address',
        label: 'Dirección (último pedido)',
        fields: [
            { key: 'address', label: 'Dirección', header: 'address' },
            { key: 'comuna', label: 'Comuna', header: 'ct', metaHash: true },
            { key: 'region', label: 'Región' },
            { key: 'full_address', label: 'Dirección completa' },
        ],
    },
];

export const QUOTE_FIELD_GROUPS: ExportFieldGroup[] = [
    {
        id: 'order',
        label: 'Pedido',
        fields: [
            { key: 'id', label: 'ID pedido' },
            { key: 'token', label: 'Token' },
            { key: 'public_url', label: 'URL pública' },
            { key: 'status', label: 'Estado' },
            { key: 'source', label: 'Origen' },
            { key: 'sale_type', label: 'Tipo (Evento / Directa)' },
            { key: 'dispenser', label: 'Dispensador' },
            { key: 'created_at', label: 'Fecha creación' },
            { key: 'updated_at', label: 'Fecha actualización' },
        ],
    },
    {
        id: 'client',
        label: 'Cliente',
        fields: [
            { key: 'client_id', label: 'ID cliente' },
            { key: 'client_name', label: 'Nombre' },
            { key: 'client_lastname', label: 'Apellido' },
            { key: 'client_full_name', label: 'Nombre completo' },
            { key: 'client_email', label: 'Email' },
            { key: 'client_phone', label: 'Celular' },
        ],
    },
    {
        id: 'dates',
        label: 'Fechas evento / entrega',
        fields: [
            { key: 'event_date', label: 'Fecha evento / entrega' },
            { key: 'start_time', label: 'Hora inicio' },
            { key: 'pickup_date', label: 'Fecha retiro' },
            { key: 'pickup_time', label: 'Hora retiro' },
            { key: 'event_type', label: 'Tipo de evento' },
        ],
    },
    {
        id: 'location',
        label: 'Ubicación',
        fields: [
            { key: 'client_address', label: 'Dirección' },
            { key: 'comuna', label: 'Comuna' },
            { key: 'region', label: 'Región' },
            { key: 'full_address', label: 'Dirección completa' },
        ],
    },
    {
        id: 'amounts',
        label: 'Montos',
        fields: [
            { key: 'total_normal_price', label: 'Precio normal' },
            { key: 'total_offer_price', label: 'Precio oferta' },
            { key: 'shipping_cost', label: 'Transporte' },
            { key: 'shipping_label', label: 'Etiqueta transporte' },
            { key: 'installation_cost', label: 'Instalación' },
            { key: 'manual_discount', label: 'Descuento' },
            { key: 'total_price', label: 'Total' },
            { key: 'paid_amount', label: 'Pagado' },
            { key: 'balance', label: 'Saldo' },
            { key: 'total_liters', label: 'Litros' },
        ],
    },
    {
        id: 'products',
        label: 'Productos',
        fields: [
            { key: 'products_summary', label: 'Resumen productos' },
            { key: 'line_count', label: 'Cantidad líneas' },
            { key: 'barrel_count', label: 'Total barriles' },
        ],
    },
    {
        id: 'dispatch',
        label: 'Despacho',
        fields: [
            { key: 'dispatch_mode', label: 'Modo despacho' },
            { key: 'dispatch_carrier', label: 'Carrier' },
            { key: 'dispatch_tracking', label: 'Tracking' },
            { key: 'dispatched_at', label: 'Fecha despacho' },
        ],
    },
    {
        id: 'other',
        label: 'Otros',
        fields: [
            { key: 'comments', label: 'Comentarios' },
            { key: 'review_email_sent', label: 'Email reseña enviado' },
        ],
    },
];

export function getFieldGroups(dataset: ExportDataset): ExportFieldGroup[] {
    return dataset === 'clients' ? CLIENT_FIELD_GROUPS : QUOTE_FIELD_GROUPS;
}

export function getAllFieldKeys(dataset: ExportDataset): string[] {
    return getFieldGroups(dataset).flatMap((g) => g.fields.map((f) => f.key));
}

export function getFieldDef(dataset: ExportDataset, key: string): ExportFieldDef | undefined {
    for (const group of getFieldGroups(dataset)) {
        const found = group.fields.find((f) => f.key === key);
        if (found) return found;
    }
    return undefined;
}

export const BUILTIN_PRESETS: ExportPreset[] = [
    {
        id: 'meta_ads',
        name: 'Meta Ads — Públicos personalizados',
        builtin: true,
        config: {
            dataset: 'clients',
            fields: [
                'email',
                'phone',
                'first_name',
                'last_name',
                'comuna',
                'country',
                'external_id',
                'value',
                'currency',
            ],
            filters: ExportClientFiltersSchema.parse({}),
            format: {
                type: 'csv',
                csvSeparator: ',',
                csvBom: true,
                dateFormat: 'iso',
                amountFormat: 'plain',
                hashPii: false,
            },
        },
    },
    {
        id: 'mailchimp',
        name: 'Mailchimp — Lista de contactos',
        builtin: true,
        config: {
            dataset: 'clients',
            fields: ['email', 'first_name', 'last_name', 'phone', 'address', 'comuna', 'region', 'tags'],
            filters: ExportClientFiltersSchema.parse({ hasEmail: true }),
            format: {
                type: 'csv',
                csvSeparator: ',',
                csvBom: true,
                dateFormat: 'iso',
                amountFormat: 'plain',
                hashPii: false,
            },
        },
    },
    {
        id: 'accounting',
        name: 'Contabilidad — Ventas del periodo',
        builtin: true,
        config: {
            dataset: 'quotes',
            fields: [
                'id',
                'client_full_name',
                'event_date',
                'sale_type',
                'total_price',
                'paid_amount',
                'balance',
                'comuna',
            ],
            filters: ExportQuoteFiltersSchema.parse({
                statuses: ['confirmed', 'in_delivery', 'completed'],
            }),
            format: {
                type: 'csv',
                csvSeparator: ';',
                csvBom: true,
                dateFormat: 'es-cl',
                amountFormat: 'plain',
                hashPii: false,
            },
        },
    },
];

type DbClient = ReturnType<typeof createServerClient>;

type ClientRow = {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    lifecycle_stage: string | null;
    intent: string | null;
    tags: string[] | null;
    notes: string | null;
    first_touch_source: string | null;
    first_touch_at: string | null;
    created_at: string;
    last_activity_at: string | null;
    possible_duplicate: boolean | null;
};

type QuoteRow = Quote & {
    quote_items?: QuoteItemRow[];
    review_email_sent?: boolean | null;
};

type QuoteItemRow = {
    product_name: string;
    size: string;
    quantity: number;
};

type ClientMetrics = {
    totalOrders: number;
    confirmedOrders: number;
    totalAmount: number;
    paidAmount: number;
    firstPurchase: string | null;
    lastPurchase: string | null;
    boughtEvents: boolean;
    boughtDirect: boolean;
    preferredChannel: string;
    lastAddress: { address: string; comuna: string; region: string } | null;
};

type IdentifierMap = Record<string, { emails: string[]; phones: string[] }>;

function normalizeMetaEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeMetaPhone(phone: string): string {
    const d = digitsOnly(phone);
    if (!d) return '';
    if (d.startsWith('56')) return d;
    if (d.startsWith('9') && d.length === 9) return `56${d}`;
    return d;
}

function normalizeMetaText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function formatDateValue(value: string | null | undefined, dateFormat: ExportFormatOptions['dateFormat']): string {
    if (!value) return '';
    const raw = value.length === 10 ? `${value}T12:00:00` : value;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(value);

    if (dateFormat === 'es-cl') {
        return new Intl.DateTimeFormat('es-CL', {
            timeZone: PROJECT_TIMEZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(d);
    }

    if (value.length === 10 && !value.includes('T')) return value;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: PROJECT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
    return value.slice(0, 10);
}

function formatDateTimeValue(value: string | null | undefined, dateFormat: ExportFormatOptions['dateFormat']): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    if (dateFormat === 'es-cl') {
        return new Intl.DateTimeFormat('es-CL', {
            timeZone: PROJECT_TIMEZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    }
    return d.toISOString();
}

function formatAmountValue(value: number | null | undefined, amountFormat: ExportFormatOptions['amountFormat']): string {
    const n = Number(value) || 0;
    if (amountFormat === 'formatted') {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
    }
    return String(Math.round(n));
}

function yesNo(value: boolean): string {
    return value ? 'Sí' : 'No';
}

function escapeCsvCell(value: string, separator: string): string {
    let cell = value ?? '';
    if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
    if (cell.includes('"') || cell.includes('\n') || cell.includes('\r') || cell.includes(separator) || cell.includes('\t')) {
        return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
}

function getClientFilters(config: ExportConfig): ExportClientFilters {
    if (config.dataset !== 'clients') return ExportClientFiltersSchema.parse({});
    return ExportClientFiltersSchema.parse(config.filters ?? {});
}

function getQuoteFilters(config: ExportConfig): ExportQuoteFilters {
    if (config.dataset !== 'quotes') return ExportQuoteFiltersSchema.parse({});
    return ExportQuoteFiltersSchema.parse(config.filters ?? {});
}

async function fetchIdentifiersForClients(db: DbClient, clientIds: string[]): Promise<IdentifierMap> {
    const map: IdentifierMap = {};
    if (clientIds.length === 0) return map;

    const { data } = await db
        .from('client_identifiers')
        .select('client_id, type, value, is_primary')
        .in('client_id', clientIds);

    for (const row of data || []) {
        if (!map[row.client_id]) map[row.client_id] = { emails: [], phones: [] };
        const bucket = row.type === 'email' ? map[row.client_id].emails : map[row.client_id].phones;
        if (!row.is_primary) bucket.push(row.value);
    }
    return map;
}

function computeClientMetrics(quotes: QuoteRow[]): ClientMetrics {
    const metrics: ClientMetrics = {
        totalOrders: 0,
        confirmedOrders: 0,
        totalAmount: 0,
        paidAmount: 0,
        firstPurchase: null,
        lastPurchase: null,
        boughtEvents: false,
        boughtDirect: false,
        preferredChannel: '',
        lastAddress: null,
    };

    const channelCounts: Record<string, number> = {};
    let lastAddressDate = '';

    for (const q of quotes) {
        metrics.totalOrders += 1;
        const status = String(q.status || '');
        if (['confirmed', 'in_delivery', 'completed'].includes(status)) {
            metrics.confirmedOrders += 1;
        }
        metrics.totalAmount += Number(q.total_price) || 0;
        metrics.paidAmount += sumQuotePayments(q as Parameters<typeof sumQuotePayments>[0]);

        const eventDate = q.event_date ? String(q.event_date) : null;
        if (eventDate) {
            if (!metrics.firstPurchase || eventDate < metrics.firstPurchase) metrics.firstPurchase = eventDate;
            if (!metrics.lastPurchase || eventDate > metrics.lastPurchase) metrics.lastPurchase = eventDate;
        }

        if (isDirectSaleQuote(q as Parameters<typeof isDirectSaleQuote>[0])) metrics.boughtDirect = true;
        else metrics.boughtEvents = true;

        const src = String(q.source || 'unknown');
        channelCounts[src] = (channelCounts[src] || 0) + 1;

        const addr = String(q.client_address || '').trim();
        if (addr) {
            const ref = String(q.updated_at || q.created_at || q.event_date || '');
            if (ref >= lastAddressDate) {
                lastAddressDate = ref;
                metrics.lastAddress = {
                    address: addr,
                    comuna: resolveComunaDisplay(
                        q.comuna_name as string | null,
                        q.comuna_other as string | null
                    ),
                    region: String(q.region_name || ''),
                };
            }
        }
    }

    metrics.preferredChannel =
        Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return metrics;
}

async function fetchQuotesForClients(db: DbClient, clientIds: string[]): Promise<Record<string, QuoteRow[]>> {
    const byClient: Record<string, QuoteRow[]> = {};
    if (clientIds.length === 0) return byClient;

    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await db
            .from('quotes')
            .select(
                'id, client_id, status, source, service_type, dispenser, event_date, total_price, payments, client_address, comuna_name, comuna_other, region_name, created_at, updated_at'
            )
            .in('client_id', clientIds)
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw new Error(error.message);
        const batch = (data || []) as QuoteRow[];
        for (const q of batch) {
            const cid = q.client_id as string;
            if (!cid) continue;
            if (!byClient[cid]) byClient[cid] = [];
            byClient[cid].push(q);
        }
        if (batch.length < PAGE_SIZE) break;
    }
    return byClient;
}

function passesClientPostFilters(client: ClientRow, metrics: ClientMetrics, filters: ExportClientFilters): boolean {
    if (filters.minOrders > 0 && metrics.totalOrders < filters.minOrders) return false;
    if (filters.minTotalAmount > 0 && metrics.totalAmount < filters.minTotalAmount) return false;
    if (filters.onlyEventBuyers && !metrics.boughtEvents) return false;
    if (filters.onlyDirectBuyers && !metrics.boughtDirect) return false;

    if (filters.dateField === 'last_purchase') {
        if (filters.dateFrom && (!metrics.lastPurchase || metrics.lastPurchase < filters.dateFrom)) return false;
        if (filters.dateTo && (!metrics.lastPurchase || metrics.lastPurchase > filters.dateTo)) return false;
    }

    return true;
}

async function fetchClientRows(
    db: DbClient,
    config: ExportConfig,
    limit?: number
): Promise<{ rows: Record<string, string>[]; total: number }> {
    const filters = getClientFilters(config);
    const allRows: Record<string, string>[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
        let query = db
            .from('clients')
            .select(
                'id, first_name, last_name, email, phone, lifecycle_stage, intent, tags, notes, first_touch_source, first_touch_at, created_at, last_activity_at, possible_duplicate'
            )
            .is('merged_into_id', null)
            .order('created_at', { ascending: false });

        if (filters.stages.length > 0) query = query.in('lifecycle_stage', filters.stages);
        if (filters.intent !== 'all') query = query.eq('intent', filters.intent);
        if (filters.excludeDuplicates) query = query.eq('possible_duplicate', false);
        if (filters.hasEmail === true) query = query.not('email', 'is', null);
        if (filters.hasEmail === false) query = query.is('email', null);
        if (filters.hasPhone === true) query = query.not('phone', 'is', null);
        if (filters.hasPhone === false) query = query.is('phone', null);

        if (filters.dateField === 'created_at') {
            if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
            if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
        }

        query = query.range(offset, offset + PAGE_SIZE - 1);
        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const clients = (data || []) as ClientRow[];
        if (clients.length === 0) break;

        const ids = clients.map((c) => c.id);
        const [quotesByClient, idMap] = await Promise.all([
            fetchQuotesForClients(db, ids),
            fetchIdentifiersForClients(db, ids),
        ]);

        for (const client of clients) {
            const metrics = computeClientMetrics(quotesByClient[client.id] || []);
            if (!passesClientPostFilters(client, metrics, filters)) continue;

            allRows.push(buildClientExportRow(client, metrics, idMap[client.id], config));
        }

        if (clients.length < PAGE_SIZE) break;
    }

    return {
        rows: limit ? allRows.slice(0, limit) : allRows,
        total: allRows.length,
    };
}

function buildClientExportRow(
    client: ClientRow,
    metrics: ClientMetrics,
    identifiers: { emails: string[]; phones: string[] } | undefined,
    config: ExportConfig
): Record<string, string> {
    const format = config.format;
    const avgTicket =
        metrics.confirmedOrders > 0 ? metrics.totalAmount / metrics.confirmedOrders : 0;

    const raw: Record<string, string | number | boolean | null | undefined> = {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name || '',
        full_name: `${client.first_name} ${client.last_name || ''}`.trim(),
        email: client.email || '',
        phone: client.phone || '',
        phone_digits: client.phone ? digitsOnly(client.phone) : '',
        extra_emails: (identifiers?.emails || []).join('; '),
        extra_phones: (identifiers?.phones || []).join('; '),
        lifecycle_stage: client.lifecycle_stage || '',
        intent: client.intent || '',
        tags: Array.isArray(client.tags) ? client.tags.join(', ') : '',
        notes: client.notes || '',
        first_touch_source: client.first_touch_source || '',
        first_touch_at: formatDateTimeValue(client.first_touch_at, format.dateFormat),
        created_at: formatDateTimeValue(client.created_at, format.dateFormat),
        last_activity_at: formatDateTimeValue(client.last_activity_at, format.dateFormat),
        possible_duplicate: yesNo(Boolean(client.possible_duplicate)),
        total_orders: metrics.totalOrders,
        confirmed_orders: metrics.confirmedOrders,
        total_amount: formatAmountValue(metrics.totalAmount, format.amountFormat),
        paid_amount: formatAmountValue(metrics.paidAmount, format.amountFormat),
        avg_ticket: formatAmountValue(avgTicket, format.amountFormat),
        first_purchase: formatDateValue(metrics.firstPurchase, format.dateFormat),
        last_purchase: formatDateValue(metrics.lastPurchase, format.dateFormat),
        bought_events: yesNo(metrics.boughtEvents),
        bought_direct: yesNo(metrics.boughtDirect),
        preferred_channel: metrics.preferredChannel,
        address: metrics.lastAddress?.address || '',
        comuna: metrics.lastAddress?.comuna || '',
        region: metrics.lastAddress?.region || '',
        full_address: metrics.lastAddress
            ? formatQuoteAddress({
                  client_address: metrics.lastAddress.address,
                  comuna_name: metrics.lastAddress.comuna,
                  region_name: metrics.lastAddress.region,
              })
            : '',
        external_id: client.id,
        country: 'cl',
        value: formatAmountValue(metrics.totalAmount, 'plain'),
        currency: 'CLP',
    };

    return pickAndTransformFields(raw, config);
}

function buildProductsSummary(items: QuoteItemRow[]): { summary: string; lineCount: number; barrelCount: number } {
    const lines = items || [];
    const summary = lines
        .map((i) => `${Number(i.quantity) || 0}x ${i.product_name} ${i.size || ''}`.trim())
        .join(' | ');
    const barrelCount = lines.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    return { summary, lineCount: lines.length, barrelCount };
}

async function fetchQuoteRows(
    db: DbClient,
    config: ExportConfig,
    limit?: number
): Promise<{ rows: Record<string, string>[]; total: number }> {
    const filters = getQuoteFilters(config);
    const allRows: Record<string, string>[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
        let query = db
            .from('quotes')
            .select(`*, quote_items ( product_name, size, quantity, size_value )`)
            .order('created_at', { ascending: false });

        if (filters.statuses.length > 0) query = query.in('status', filters.statuses);
        if (filters.source !== 'all') query = query.eq('source', filters.source);
        if (filters.saleType === 'event') query = query.eq('service_type', 'event');
        if (filters.saleType === 'direct') query = query.eq('service_type', 'direct');
        if (filters.comuna) query = query.ilike('comuna_name', `%${filters.comuna}%`);
        if (filters.minAmount > 0) query = query.gte('total_price', filters.minAmount);
        if (filters.maxAmount != null && filters.maxAmount > 0) query = query.lte('total_price', filters.maxAmount);
        if (filters.hasEmail === true) query = query.not('client_email', 'is', null);
        if (filters.hasEmail === false) query = query.is('client_email', null);

        const dateCol = filters.dateField;
        if (filters.dateFrom) query = query.gte(dateCol, filters.dateFrom);
        if (filters.dateTo) query = query.lte(dateCol, filters.dateTo);

        query = query.range(offset, offset + PAGE_SIZE - 1);
        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const quotes = (data || []) as QuoteRow[];
        if (quotes.length === 0) break;

        for (const quote of quotes) {
            if (filters.withBalance && getQuoteBalance(quote) <= 0) {
                continue;
            }
            allRows.push(buildQuoteExportRow(quote, config));
        }

        if (quotes.length < PAGE_SIZE) break;
    }

    return {
        rows: limit ? allRows.slice(0, limit) : allRows,
        total: allRows.length,
    };
}

function buildQuoteExportRow(quote: QuoteRow, config: ExportConfig): Record<string, string> {
    const format = config.format;
    const items = (quote.quote_items || []) as QuoteItemRow[];
    const { summary, lineCount, barrelCount } = buildProductsSummary(items);
    const paid = sumQuotePayments(quote);
    const balance = getQuoteBalance(quote);
    const isDirect = isDirectSaleQuote(quote);
    const eventType =
        quote.event_type_other ||
        (quote.event_type_id ? String(quote.event_type_id) : '');

    const tracking = [quote.dispatch_tracking_number, quote.dispatch_tracking_url]
        .filter(Boolean)
        .join(' — ');

    const raw: Record<string, string | number | boolean | null | undefined> = {
        id: String(quote.id),
        token: String(quote.token || ''),
        public_url: quote.token ? `${SITE_URL}/cotizar/${quote.token}` : '',
        status: String(quote.status || ''),
        source: String(quote.source || ''),
        sale_type: isDirect ? 'Venta directa' : 'Evento',
        dispenser: String(quote.dispenser || ''),
        created_at: formatDateTimeValue(String(quote.created_at || ''), format.dateFormat),
        updated_at: formatDateTimeValue(String(quote.updated_at || ''), format.dateFormat),
        client_id: String(quote.client_id || ''),
        client_name: String(quote.client_name || ''),
        client_lastname: String(quote.client_lastname || ''),
        client_full_name: `${quote.client_name || ''} ${quote.client_lastname || ''}`.trim(),
        client_email: String(quote.client_email || ''),
        client_phone: String(quote.client_phone || ''),
        event_date: formatDateValue(String(quote.event_date || ''), format.dateFormat),
        start_time: String(quote.start_time || ''),
        pickup_date: formatDateValue(String(quote.pickup_date || ''), format.dateFormat),
        pickup_time: String(quote.pickup_time || ''),
        event_type: String(eventType),
        client_address: String(quote.client_address || ''),
        comuna: resolveComunaDisplay(
            quote.comuna_name as string | null,
            quote.comuna_other as string | null
        ),
        region: String(quote.region_name || ''),
        full_address: formatQuoteAddress({
            client_address: quote.client_address as string | null,
            comuna_name: quote.comuna_name as string | null,
            comuna_other: quote.comuna_other as string | null,
            region_name: quote.region_name as string | null,
        }),
        total_normal_price: formatAmountValue(Number(quote.total_normal_price), format.amountFormat),
        total_offer_price: formatAmountValue(Number(quote.total_offer_price), format.amountFormat),
        shipping_cost: formatAmountValue(Number(quote.shipping_cost), format.amountFormat),
        shipping_label: String(quote.shipping_label || ''),
        installation_cost: formatAmountValue(Number(quote.installation_cost), format.amountFormat),
        manual_discount: formatAmountValue(Number(quote.manual_discount), format.amountFormat),
        total_price: formatAmountValue(Number(quote.total_price), format.amountFormat),
        paid_amount: formatAmountValue(paid, format.amountFormat),
        balance: formatAmountValue(balance, format.amountFormat),
        total_liters: String(Number(quote.total_liters) || 0),
        products_summary: summary,
        line_count: lineCount,
        barrel_count: barrelCount,
        dispatch_mode: String(quote.dispatch_mode || ''),
        dispatch_carrier: String(quote.dispatch_carrier_name || ''),
        dispatch_tracking: tracking,
        dispatched_at: formatDateTimeValue(String(quote.dispatched_at || ''), format.dateFormat),
        comments: String(quote.comments || ''),
        review_email_sent: yesNo(Boolean(quote.review_email_sent)),
    };

    return pickAndTransformFields(raw, config);
}

function pickAndTransformFields(
    raw: Record<string, string | number | boolean | null | undefined>,
    config: ExportConfig
): Record<string, string> {
    const out: Record<string, string> = {};
    const hashPii = config.format.hashPii;

    for (const key of config.fields) {
        const def = getFieldDef(config.dataset, key);
        let value = String(raw[key] ?? '');

        if (hashPii && def?.metaHash && value) {
            if (key === 'email') value = hashSha256(normalizeMetaEmail(value));
            else if (key === 'phone') value = hashSha256(normalizeMetaPhone(value));
            else if (key === 'first_name') value = hashSha256(normalizeMetaText(value));
            else if (key === 'last_name') value = hashSha256(normalizeMetaText(value));
            else if (key === 'comuna') value = hashSha256(normalizeMetaText(value));
        }

        const colKey = hashPii && def?.header ? def.header : key;
        out[colKey] = value;
    }
    return out;
}

export function getExportHeaders(config: ExportConfig): string[] {
    return config.fields.map((key) => {
        const def = getFieldDef(config.dataset, key);
        if (config.format.hashPii && def?.header) return def.header;
        return def?.label || key;
    });
}

export function getExportColumnKeys(config: ExportConfig): string[] {
    return config.fields.map((key) => {
        const def = getFieldDef(config.dataset, key);
        if (config.format.hashPii && def?.header) return def.header;
        return key;
    });
}

export async function runExport(
    config: ExportConfig,
    options?: { limit?: number }
): Promise<{ rows: Record<string, string>[]; total: number; headers: string[]; columnKeys: string[] }> {
    const db = createServerClient();
    const limit = options?.limit;

    const result =
        config.dataset === 'clients'
            ? await fetchClientRows(db, config, limit)
            : await fetchQuoteRows(db, config, limit);

    return {
        ...result,
        headers: getExportHeaders(config),
        columnKeys: getExportColumnKeys(config),
    };
}

export async function previewExportData(config: ExportConfig) {
    return runExport(config, { limit: PREVIEW_LIMIT });
}

export async function countExportRows(config: ExportConfig): Promise<number> {
    const { total } = await runExport(config);
    return total;
}

export function serializeExport(
    rows: Record<string, string>[],
    columnKeys: string[],
    headers: string[],
    format: ExportFormatOptions
): { content: string; mimeType: string; extension: string } {
    if (format.type === 'json') {
        const arr = rows.map((row) => {
            const obj: Record<string, string> = {};
            columnKeys.forEach((key, i) => {
                obj[headers[i] || key] = row[key] ?? '';
            });
            return obj;
        });
        return {
            content: JSON.stringify(arr, null, 2),
            mimeType: 'application/json',
            extension: 'json',
        };
    }

    const eol = '\r\n';
    const separator = format.type === 'txt' ? '\t' : format.csvSeparator || ';';

    const headerLine =
        format.type === 'csv'
            ? headers.map((h) => escapeCsvCell(h, separator)).join(separator)
            : headers.join(separator);

    const bodyLines = rows.map((row) =>
        columnKeys
            .map((key) => {
                const cell = row[key] ?? '';
                return format.type === 'csv' ? escapeCsvCell(cell, separator) : cell.replace(/\t/g, ' ');
            })
            .join(separator)
    );

    let content = [headerLine, ...bodyLines].join(eol);
    if (format.type === 'csv' && format.csvBom) {
        content = `\uFEFF${content}`;
    }

    return {
        content,
        mimeType: format.type === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
        extension: format.type === 'csv' ? 'csv' : 'txt',
    };
}

export function buildExportFilename(config: ExportConfig): string {
    const today = formatDateValue(new Date().toISOString(), 'iso');
    const dataset = config.dataset === 'clients' ? 'clientes' : 'cotizaciones';
    let suffix = '';

    if (config.dataset === 'quotes') {
        const f = getQuoteFilters(config);
        if (f.saleType === 'event') suffix = '_eventos';
        else if (f.saleType === 'direct') suffix = '_directas';
    }

    const ext =
        config.format.type === 'json' ? 'json' : config.format.type === 'txt' ? 'txt' : 'csv';
    return `${dataset}${suffix}_${today}.${ext}`;
}

export function defaultExportConfig(dataset: ExportDataset = 'clients'): ExportConfig {
    const fields =
        dataset === 'clients'
            ? ['full_name', 'email', 'phone', 'lifecycle_stage', 'total_orders', 'total_amount']
            : ['id', 'client_full_name', 'event_date', 'sale_type', 'status', 'total_price', 'paid_amount'];

    return {
        dataset,
        fields,
        filters: dataset === 'clients' ? ExportClientFiltersSchema.parse({}) : ExportQuoteFiltersSchema.parse({}),
        format: {
            type: 'csv',
            csvSeparator: ';',
            csvBom: true,
            dateFormat: 'iso',
            amountFormat: 'plain',
            hashPii: false,
        },
    };
}

export async function loadSavedExportPresets(db: DbClient): Promise<ExportPreset[]> {
    const { data } = await db
        .from('site_settings')
        .select('key, value, description')
        .eq('category', 'exports')
        .eq('is_active', true);

    const saved: ExportPreset[] = [];
    for (const row of data || []) {
        if (!row.key?.startsWith('export_preset_')) continue;
        try {
            const config = JSON.parse(row.value) as ExportConfig;
            saved.push({
                id: row.key.replace(/^export_preset_/, ''),
                name: row.description || row.key,
                config,
            });
        } catch {
            /* skip invalid */
        }
    }
    return saved.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
