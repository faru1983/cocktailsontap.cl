import { z } from 'zod';

export const ExportDatasetSchema = z.enum(['clients', 'quotes']);
export const ExportFormatTypeSchema = z.enum(['csv', 'txt', 'json']);
export const CsvSeparatorSchema = z.enum([';', ',']);
export const ExportDateFormatSchema = z.enum(['iso', 'es-cl']);
export const ExportAmountFormatSchema = z.enum(['plain', 'formatted']);
export const ExportSaleTypeFilterSchema = z.enum(['all', 'event', 'direct']);
export const ExportSourceFilterSchema = z.enum(['all', 'web', 'admin', 'whatsapp']);
export const ExportClientDateFieldSchema = z.enum(['created_at', 'last_purchase']);
export const ExportQuoteDateFieldSchema = z.enum(['created_at', 'event_date']);

export const ExportFormatOptionsSchema = z.object({
    type: ExportFormatTypeSchema,
    csvSeparator: CsvSeparatorSchema.optional().default(';'),
    csvBom: z.boolean().optional().default(true),
    dateFormat: ExportDateFormatSchema.optional().default('iso'),
    amountFormat: ExportAmountFormatSchema.optional().default('plain'),
    hashPii: z.boolean().optional().default(false),
});

export const ExportClientFiltersSchema = z.object({
    stages: z.array(z.string()).optional().default([]),
    intent: z.enum(['all', 'event', 'direct', 'unknown']).optional().default('all'),
    hasEmail: z.boolean().nullable().optional().default(null),
    hasPhone: z.boolean().nullable().optional().default(null),
    minOrders: z.coerce.number().min(0).optional().default(0),
    minTotalAmount: z.coerce.number().min(0).optional().default(0),
    dateField: ExportClientDateFieldSchema.optional().default('created_at'),
    dateFrom: z.string().nullable().optional().default(null),
    dateTo: z.string().nullable().optional().default(null),
    excludeDuplicates: z.boolean().optional().default(false),
    onlyEventBuyers: z.boolean().optional().default(false),
    onlyDirectBuyers: z.boolean().optional().default(false),
});

export const ExportQuoteFiltersSchema = z.object({
    statuses: z.array(z.string()).optional().default([]),
    saleType: ExportSaleTypeFilterSchema.optional().default('all'),
    source: ExportSourceFilterSchema.optional().default('all'),
    dateField: ExportQuoteDateFieldSchema.optional().default('created_at'),
    dateFrom: z.string().nullable().optional().default(null),
    dateTo: z.string().nullable().optional().default(null),
    comuna: z.string().nullable().optional().default(null),
    minAmount: z.coerce.number().min(0).optional().default(0),
    maxAmount: z.coerce.number().nullable().optional().default(null),
    hasEmail: z.boolean().nullable().optional().default(null),
    withBalance: z.boolean().optional().default(false),
});

export const ExportConfigSchema = z.object({
    dataset: ExportDatasetSchema,
    fields: z.array(z.string()).min(1, 'Selecciona al menos un campo'),
    filters: z.union([ExportClientFiltersSchema, ExportQuoteFiltersSchema]).optional(),
    format: ExportFormatOptionsSchema,
});

export type ExportDataset = z.infer<typeof ExportDatasetSchema>;
export type ExportConfig = z.infer<typeof ExportConfigSchema>;
export type ExportFormatOptions = z.infer<typeof ExportFormatOptionsSchema>;
export type ExportClientFilters = z.infer<typeof ExportClientFiltersSchema>;
export type ExportQuoteFilters = z.infer<typeof ExportQuoteFiltersSchema>;

export type ExportPreset = {
    id: string;
    name: string;
    builtin?: boolean;
    config: ExportConfig;
};

export function parseExportConfig(raw: unknown): { success: true; data: ExportConfig } | { success: false; error: string } {
    const parsed = ExportConfigSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'Configuración inválida' };
    }
    return { success: true, data: parsed.data };
}

export function encodeExportConfig(config: ExportConfig): string {
    const json = JSON.stringify(config);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(json, 'utf8').toString('base64url');
    }
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeExportConfig(encoded: string): { success: true; data: ExportConfig } | { success: false; error: string } {
    try {
        let json: string;
        if (typeof Buffer !== 'undefined') {
            json = Buffer.from(encoded, 'base64url').toString('utf8');
        } else {
            const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
                    .join('')
            );
        }
        return parseExportConfig(JSON.parse(json));
    } catch {
        return { success: false, error: 'Configuración de export inválida' };
    }
}
