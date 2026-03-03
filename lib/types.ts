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
