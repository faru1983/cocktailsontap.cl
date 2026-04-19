import { z } from 'zod';

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
    dispenser: 'portatil' | 'muro' | 'desechable';
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
    addItem: (productId: string, productName: string, size: string, price: number, offerPrice: number, sizeValue: number, unitId: string | null, isDisposable: boolean) => void;
    removeItem: (productId: string, size: string) => void;
    updateQuantity: (productId: string, size: string, quantity: number) => void;
    getQuantity: (productId: string, size: string) => number;
}

// ─── Sistema de Cotizaciones Persistente ──────────────────────────────────────

export type QuoteStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

export interface Client {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
    phone: string | null;
    created_at: string;
}

export interface QuoteItem {
    id: string;
    quote_id?: string;
    product_id: string | null;
    product_name: string;
    size: string;
    size_value: number;
    unit_id: string | null;
    is_disposable: boolean;
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

    // Items y Relaciones
    client_id?: string | null;
    quote_items?: QuoteItem[];
    payments?: { date: string; amount: number; note: string }[];
}

// ─── Esquemas de Validación (Zod) ─────────────────────────────────────────────

export const CreateQuoteSchema = z.object({
    state: z.object({
        contact: z.object({
            firstName: z.string().min(2, 'Nombre muy corto'),
            lastName: z.string().min(2, 'Apellido muy corto'),
            email: z.string().email('Email inválido'),
            phone: z.string().nullable().optional().or(z.literal('')),
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
        selections: z.array(z.object({
            id: z.string(),
            size: z.string(),
            quantity: z.number().min(1),
        })).min(1, 'Selecciona al menos un producto'),
        dispenser: z.enum(['portatil', 'muro', 'desechable']),
    }).passthrough(),
    cocktails: z.array(z.any()).optional(),
    comunas: z.array(z.any()).optional(),
});

export const ConfirmQuoteSchema = z.object({
    token: z.string(),
    client_phone: z.string().min(8, 'Teléfono inválido'),
    client_lastname: z.string().nullable().optional(),
    client_address: z.string().min(5, 'Dirección inválida'),
    comuna_name: z.string().min(1, 'Comuna es obligatoria'),
    comuna_other: z.string().nullable().optional(),
    guests: z.number().min(0).optional(),
    event_type_id: z.string().nullable().optional(),
    event_type_other: z.string().nullable().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    start_time: z.string().nullable().optional(),
    pickup_date: z.string().nullable().optional(),
    pickup_time: z.string().nullable().optional(),
    comments: z.string().nullable().optional(),
    dispenser: z.enum(['portatil', 'muro', 'desechable']),
    items: z.array(z.object({
        id: z.string().optional(),
        product_id: z.string().nullable(),
        product_name: z.string(),
        size: z.string(),
        size_value: z.number().optional(),
        unit_id: z.string().nullable().optional(),
        is_disposable: z.boolean().optional(),
        quantity: z.number().min(1),
        price_at_time: z.number(),
        offer_price_at_time: z.number(),
    })).min(1, 'Debe haber al menos un producto'),
});
