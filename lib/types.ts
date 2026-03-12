export interface SupabaseProduct {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    categories: { name: string } | null;
    product_prices: {
        size: string;
        price: number;
        offer_price: number | null;
    }[];
}

export interface ProductPrice {
    size: string;
    price: number;
    offerPrice: number;
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
    prices: Record<string, { price: number; offerPrice: number }>;
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
}

export interface WizardSelection {
    id: string;
    size: string;
    quantity: number;
}

export interface WizardState {
    step: number;
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
    dispenser: 'portatil' | 'muro';
    expandedCocktailId: string | null;
    expandedCategoryId: string;
}

export interface CartItem {
    productId: string;
    productName: string;
    size: string;
    price: number;
    offerPrice: number;
    quantity: number;
}

export interface ICart {
    addItem: (productId: string, productName: string, size: string, price: number, offerPrice: number) => void;
    removeItem: (productId: string, size: string) => void;
    updateQuantity: (productId: string, size: string, quantity: number) => void;
    getQuantity: (productId: string, size: string) => number;
}

// ─── Sistema de Cotizaciones Persistente ──────────────────────────────────────

export type QuoteStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

export interface QuoteItem {
    id: string;
    quote_id?: string;
    product_id: string | null;
    product_name: string;
    size: string;
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
    dispenser: 'portatil' | 'muro';

    // Precios
    total_normal_price: number;
    total_offer_price: number;
    shipping_cost: number;
    installation_cost: number;
    total_price: number;
    total_liters: number | null;

    // Items (cargados por join)
    quote_items?: QuoteItem[];
}
