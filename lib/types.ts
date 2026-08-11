import { z } from 'zod';
import { normalizePhoneE164, isValidPhoneE164 } from '@/lib/phone';

/** Celular opcional: vacío OK; si hay valor debe ser E.164 válido (CL/CO/PE/VE). */
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

/** Celular obligatorio en E.164. */
export const RequiredPhoneSchema = z.preprocess(
    (v) => normalizePhoneE164(String(v ?? '')) ?? '',
    z.string().refine(isValidPhoneE164, {
        message: 'Celular inválido. Usa formato +56 9 1234 5678',
    })
);

export interface MeasurementUnit {
    id: string;
    name: string;
    abbreviation: string;
    is_active: boolean;
}

export interface SupabaseProduct {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    categories: { name: string } | null;
    product_prices: {
        size: string;
        size_value: number | null;
        unit_id: string | null;
        is_disposable: boolean | null;
        price: number;
        offer_price: number | null;
        display_order: number | null;
        is_active: boolean;
        image_url?: string | null;
        measurement_units?: {
            id: string;
            name: string;
            abbreviation: string;
        } | null;
    }[];
}

export interface ProductPrice {
    size: string;
    sizeValue: number;
    unit: string;
    unitId: string | null;
    isDisposable: boolean;
    price: number;
    offerPrice: number;
    image?: string;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    image: string;
    category: string;
    sizes: ProductPrice[];
    selectedSize?: string;
}

export interface CocktailForWizard {
    id: string;
    name: string;
    category: string;
    desc: string;
    image: string;
    prices: Record<string, { 
        price: number; 
        offerPrice: number;
        sizeValue: number;
        unit: string;
        unitId: string | null;
        isDisposable: boolean;
        image?: string;
    }>;
}

export interface EventType {
    id: string;
    name: string;
    icon: string;
}

export interface Comuna {
    name: string;
    cost: number | null;
    freeFrom: number | null;
    directSaleDeliveryCost: number | null;
}

export interface WizardSelection {
    id: string;
    size: string;
    quantity: number;
    customPrice?: number;
}

export interface WizardState {
    step: number;
    serviceType: 'event' | 'direct' | '';
    eventData: {
        type: string;
        otherType: string;
        date: string;
        startTime: string;
        pickupDate: string;
        pickupTime: string;
    };
    consumption: {
        guests: number;
        drinksPerPerson: number;
    };
    contact: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        address: string;
        comuna: string;
        otherComuna: string;
        comments: string;
    };
    selections: WizardSelection[];
    dispenser: 'portatil' | 'muro' | 'desechable' | '';
    expandedCocktailId: string | null;
    expandedCategoryId: string;
}

export interface CartItem {
    productId: string;
    productName: string;
    size: string;
    sizeValue: number;
    unitId: string | null;
    isDisposable: boolean;
    price: number;
    offerPrice: number;
    quantity: number;
}

export interface ICart {
    addItem: (productId: string, productName: string, size: string, price: number, offerPrice: number, sizeValue: number, unitId: string | null, isDisposable: boolean, image?: string) => void;
    removeItem: (productId: string, size: string) => void;
    updateQuantity: (productId: string, size: string, quantity: number) => void;
    getQuantity: (productId: string, size: string) => number;
}

// ─── Sistema de Cotizaciones Persistente ──────────────────────────────────────

export type QuoteStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

/** Re-export: fuente de verdad en `lib/quoteSource.ts`. */
import type { QuoteSource } from '@/lib/quoteSource';
export type { QuoteSource };

export interface Client {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
    google_contact_id?: string | null;
    first_touch_source?: string | null;
    first_touch_at?: string | null;
    merged_into_id?: string | null;
    possible_duplicate?: boolean | null;
    updated_at?: string | null;
}

export interface ClientIdentifier {
    id: string;
    client_id: string;
    type: 'email' | 'phone';
    value: string;
    is_primary: boolean;
    source: string | null;
    created_at: string;
}

export interface QuoteItem {
    id: string;
    quote_id?: string;
    product_id: string | null;
    product_name: string;
    size: string;
    size_value: number | null;
    unit_id: string | null;
    is_disposable: boolean | null;
    quantity: number;
    price_at_time: number;
    offer_price_at_time: number;
}

export interface Quote {
    id: string;
    created_at: string;
    updated_at: string;
    token: string;
    status: QuoteStatus;

    // Cliente
    client_name: string;
    client_lastname: string | null;
    client_email: string | null;
    client_phone: string | null;
    client_address: string | null;
    comments: string | null;

    // Evento
    event_type_id: string | null;
    event_type_other: string | null;
    event_date: string;
    start_time: string | null;
    pickup_date: string | null;
    pickup_time: string | null;

    // Ubicación
    comuna_name: string | null;
    comuna_other: string | null;

    // Consumo
    guests: number;
    drinks_per_person: number;

    // Dispensador
    dispenser: 'portatil' | 'muro' | 'desechable';

    // Precios
    total_normal_price: number;
    total_offer_price: number;
    shipping_cost: number;
    installation_cost: number;
    manual_discount: number;
    total_price: number;
    total_liters: number | null;

    service_type?: 'event' | 'direct' | null;
    source?: QuoteSource;
    google_event_id?: string | null;
    google_pickup_event_id?: string | null;
    // Items y Relaciones
    client_id?: string | null;
    quote_items?: QuoteItem[];
    payments?: { date: string; amount: number; note: string }[];
}

// ─── Esquemas de Validación (Zod) ─────────────────────────────────────────────

export const CreateQuoteSchema = z
    .object({
        state: z
            .object({
                contact: z.object({
                    firstName: z.string().min(2, 'Nombre muy corto'),
                    lastName: z.string().min(2, 'Apellido muy corto'),
                    email: z.string().email('Email inválido'),
                    phone: OptionalPhoneSchema,
                    address: z.string().nullable().optional().or(z.literal('')),
                    comuna: z.string().min(1, 'Selecciona una comuna'),
                    otherComuna: z.string().nullable().optional().or(z.literal('')),
                    comments: z.string().nullable().optional().or(z.literal('')),
                }),
                eventData: z.object({
                    type: z.string().nullable().optional().or(z.literal('')),
                    otherType: z.string().nullable().optional().or(z.literal('')),
                    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
                    startTime: z.string().nullable().optional().or(z.literal('')),
                    pickupDate: z.string().nullable().optional().or(z.literal('')),
                    pickupTime: z.string().nullable().optional().or(z.literal('')),
                }),
                consumption: z.object({
                    guests: z.number().nullable().optional().or(z.number().min(0)),
                    drinksPerPerson: z.number().nullable().optional().or(z.number().min(0)),
                }),
                selections: z
                    .array(
                        z.object({
                            id: z.string(),
                            size: z.string(),
                            quantity: z.number().min(1),
                        })
                    )
                    .min(1, 'Selecciona al menos un producto'),
                dispenser: z.enum(['portatil', 'muro', 'desechable']),
            })
            .passthrough(),
        cocktails: z.array(z.any()).optional(),
        comunas: z.array(z.any()).optional(),
        confirmNow: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        if (!data.confirmNow || data.state.dispenser === 'desechable') return;
        const address = (data.state.contact.address || '').trim();
        if (address.length < 5) {
            ctx.addIssue({
                code: 'custom',
                message: 'Dirección obligatoria (mín. 5 caracteres)',
                path: ['state', 'contact', 'address'],
            });
        }
        if (!(data.state.eventData.startTime || '').trim()) {
            ctx.addIssue({
                code: 'custom',
                message: 'Hora de inicio obligatoria',
                path: ['state', 'eventData', 'startTime'],
            });
        }
        const pickupDate = (data.state.eventData.pickupDate || '').trim();
        if (!pickupDate) {
            ctx.addIssue({
                code: 'custom',
                message: 'Fecha de retiro obligatoria',
                path: ['state', 'eventData', 'pickupDate'],
            });
        }
        const sameDay = pickupDate === data.state.eventData.date;
        if (!sameDay && !(data.state.eventData.pickupTime || '').trim()) {
            ctx.addIssue({
                code: 'custom',
                message: 'Hora de retiro obligatoria',
                path: ['state', 'eventData', 'pickupTime'],
            });
        }
        if (data.state.contact.comuna === 'Otra' && !(data.state.contact.otherComuna || '').trim()) {
            ctx.addIssue({
                code: 'custom',
                message: 'Especifica la comuna',
                path: ['state', 'contact', 'otherComuna'],
            });
        }
    });

export const ConfirmQuoteSchema = z.object({
    token: z.string(),
    client_phone: RequiredPhoneSchema,
    client_lastname: z.string().min(2, 'Apellido es obligatorio'),
    client_address: z.string().min(5, 'Dirección inválida'),
    comuna_name: z.string().min(1, 'Comuna es obligatoria'),
    comuna_other: z.string().nullable(),
    guests: z.coerce.number().min(0),
    event_type_id: z.string().nullable(),
    event_type_other: z.string().nullable(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    start_time: z.string().nullable(),
    pickup_date: z.string().nullable(),
    pickup_time: z.string().nullable(),
    comments: z.string().nullable(),
    dispenser: z.enum(['portatil', 'muro', 'desechable']),
    items: z.array(z.object({
        id: z.string().optional(),
        product_id: z.string().nullable(),
        product_name: z.string(),
        size: z.string(),
        size_value: z.coerce.number().nullable().optional(),
        unit_id: z.string().nullable().optional(),
        is_disposable: z.boolean().nullable().optional().transform((value) => value ?? false),
        quantity: z.coerce.number().min(1),
        price_at_time: z.coerce.number(),
        offer_price_at_time: z.coerce.number(),
    })).min(1, 'Debe haber al menos un producto'),
});

/** Recetario — insumos y recetas */
export const IngredientCategorySchema = z.enum(['Licor', 'Bebida', 'Endulzante', 'Jugo', 'Otros']);
export const FormatUnitSchema = z.enum(['ml', 'g']);

export const IngredientSaveSchema = z.object({
    id: z.string().uuid().optional().nullable(),
    name: z.string().min(1, 'Nombre requerido').max(120),
    category: IngredientCategorySchema,
    format_qty: z.coerce.number().positive('Formato debe ser > 0'),
    format_unit: FormatUnitSchema,
    format_price: z.coerce.number().min(0, 'Precio inválido'),
    supplier: z.string().max(120).nullable().optional(),
    is_active: z.boolean().optional().default(true),
});

export const IngredientPatchSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    category: IngredientCategorySchema.optional(),
    format_qty: z.coerce.number().positive().optional(),
    format_unit: FormatUnitSchema.optional(),
    format_price: z.coerce.number().min(0).optional(),
    supplier: z.string().max(120).nullable().optional(),
    is_active: z.boolean().optional(),
});

export const RecipeItemSaveSchema = z.object({
    ingredient_id: z.string().uuid(),
    qty_base: z.coerce.number().positive('Cantidad debe ser > 0'),
});

export const RecipeSaveSchema = z.object({
    id: z.string().uuid().optional().nullable(),
    product_id: z.string().uuid(),
    base_liters: z.coerce.number().positive().default(5),
    notes: z.string().nullable().optional(),
    is_active: z.boolean().optional().default(true),
    items: z.array(RecipeItemSaveSchema).min(1, 'Agrega al menos un insumo'),
});

export type IngredientSaveInput = z.infer<typeof IngredientSaveSchema>;
export type IngredientPatchInput = z.infer<typeof IngredientPatchSchema>;
export type RecipeSaveInput = z.infer<typeof RecipeSaveSchema>;
