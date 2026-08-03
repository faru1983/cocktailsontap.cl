import { z } from 'zod';
import { normalizePhoneE164, isValidPhoneE164 } from '@/lib/phone';

const OptionalPhoneSchema = z.preprocess(
    (v) => {
        if (v == null || v === '') return '';
        return normalizePhoneE164(String(v)) ?? '';
    },
    z.union([
        z.literal(''),
        z.string().refine(isValidPhoneE164, {
            message: 'Celular inválido. Usa formato +56 9 1234 5678',
        }),
    ])
);

const IntegrationClientSchema = z.object({
    firstName: z.string().min(2, 'Nombre muy corto'),
    lastName: z.string().min(2, 'Apellido muy corto'),
    email: z.string().email('Email inválido'),
    phone: OptionalPhoneSchema.optional().default(''),
    address: z.string().optional().default(''),
    comuna: z.string().min(1, 'Selecciona una comuna'),
    otherComuna: z.string().optional().default(''),
    comments: z.string().optional().default(''),
});

const IntegrationItemSchema = z.object({
    productId: z.string().min(1),
    size: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
});

/** POST /api/v1/quotes — cotización evento (draft). */
export const IntegrationEventQuoteSchema = z.object({
    source: z.string().min(1).max(64).optional(),
    client: IntegrationClientSchema,
    event: z.object({
        type: z.string().optional().default(''),
        otherType: z.string().optional().default(''),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
        startTime: z.string().optional().default(''),
        pickupDate: z.string().optional().default(''),
        pickupTime: z.string().optional().default(''),
    }),
    consumption: z
        .object({
            guests: z.coerce.number().min(0).optional().default(0),
            drinksPerPerson: z.coerce.number().min(0).optional().default(0),
        })
        .optional()
        .default({ guests: 0, drinksPerPerson: 0 }),
    dispenser: z.enum(['portatil', 'muro']),
    items: z.array(IntegrationItemSchema).min(1, 'Selecciona al menos un producto'),
});

/** POST /api/v1/direct-sales — venta desechable (confirmed). */
export const IntegrationDirectSaleSchema = z.object({
    source: z.string().min(1).max(64).optional(),
    client: IntegrationClientSchema,
    event: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
        startTime: z.string().optional().default(''),
        pickupDate: z.string().optional().default(''),
        pickupTime: z.string().optional().default(''),
    }),
    items: z.array(IntegrationItemSchema).min(1, 'Selecciona al menos un producto'),
    comments: z.string().optional().default(''),
});

/** POST /api/v1/contacts — primer contacto / upsert persona (phone-first). */
export const IntegrationContactSchema = z.object({
    phone: z.preprocess(
        (v) => normalizePhoneE164(String(v ?? '')) ?? '',
        z.string().refine(isValidPhoneE164, {
            message: 'Celular inválido. Usa formato +56 9 1234 5678',
        })
    ),
    firstName: z.string().min(1).max(120).optional(),
    lastName: z.string().max(120).optional().default(''),
    email: z.preprocess(
        (v) => {
            if (v == null || v === '') return undefined;
            return String(v).trim().toLowerCase();
        },
        z.string().email('Email inválido').optional()
    ),
    source: z.enum(['whatsapp', 'web', 'admin', 'meta']).optional().default('whatsapp'),
    touchpointType: z.string().min(1).max(64).optional().default('bot_started'),
    ctwaClid: z.string().max(512).optional(),
    fbc: z.string().max(512).optional(),
    fbp: z.string().max(512).optional(),
    sendCapiLead: z.boolean().optional().default(true),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type IntegrationEventQuoteInput = z.infer<typeof IntegrationEventQuoteSchema>;
export type IntegrationDirectSaleInput = z.infer<typeof IntegrationDirectSaleSchema>;
export type IntegrationContactInput = z.infer<typeof IntegrationContactSchema>;
