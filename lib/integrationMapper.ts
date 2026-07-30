import type { WizardState, CocktailForWizard } from '@/lib/types';
import type {
    IntegrationEventQuoteInput,
    IntegrationDirectSaleInput,
} from '@/lib/integrationSchemas';

function withSourceComments(comments: string | undefined, source?: string): string {
    const body = (comments || '').trim();
    if (!source) return body;
    const tag = `[${source}]`;
    if (!body) return tag;
    if (body.startsWith(tag)) return body;
    return `${tag} ${body}`;
}

function baseWizardState(): WizardState {
    return {
        step: 0,
        serviceType: '',
        eventData: {
            type: '',
            otherType: '',
            date: '',
            startTime: '',
            pickupDate: '',
            pickupTime: '',
        },
        consumption: { guests: 0, drinksPerPerson: 0 },
        contact: {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            address: '',
            comuna: '',
            otherComuna: '',
            comments: '',
        },
        selections: [],
        dispenser: '',
        expandedCocktailId: null,
        expandedCategoryId: '',
    };
}

/**
 * Valida que cada item exista en catálogo con ese size.
 * Devuelve mensaje de error o null si OK.
 */
export function validateItemsAgainstCatalog(
    items: { productId: string; size: string; quantity: number }[],
    cocktails: CocktailForWizard[]
): string | null {
    const byId = new Map(cocktails.map((c) => [c.id, c]));
    for (const item of items) {
        const product = byId.get(item.productId);
        if (!product) {
            return `Producto no encontrado: ${item.productId}`;
        }
        if (!product.prices[item.size]) {
            return `Tamaño "${item.size}" no válido para ${product.name}`;
        }
    }
    return null;
}

export function mapEventQuoteToWizardState(dto: IntegrationEventQuoteInput): WizardState {
    const state = baseWizardState();
    state.serviceType = 'event';
    state.dispenser = dto.dispenser;
    state.contact = {
        firstName: dto.client.firstName,
        lastName: dto.client.lastName,
        email: dto.client.email,
        phone: dto.client.phone || '',
        address: dto.client.address || '',
        comuna: dto.client.comuna,
        otherComuna: dto.client.otherComuna || '',
        comments: withSourceComments(dto.client.comments, dto.source),
    };
    state.eventData = {
        type: dto.event.type || '',
        otherType: dto.event.otherType || '',
        date: dto.event.date,
        startTime: dto.event.startTime || '',
        pickupDate: dto.event.pickupDate || '',
        pickupTime: dto.event.pickupTime || '',
    };
    state.consumption = {
        guests: dto.consumption?.guests ?? 0,
        drinksPerPerson: dto.consumption?.drinksPerPerson ?? 0,
    };
    state.selections = dto.items.map((i) => ({
        id: i.productId,
        size: i.size,
        quantity: i.quantity,
    }));
    return state;
}

export function mapDirectSaleToWizardState(dto: IntegrationDirectSaleInput): WizardState {
    const state = baseWizardState();
    state.serviceType = 'direct';
    state.dispenser = 'desechable';
    const mergedComments = [dto.client.comments, dto.comments].filter(Boolean).join('\n').trim();
    state.contact = {
        firstName: dto.client.firstName,
        lastName: dto.client.lastName,
        email: dto.client.email,
        phone: dto.client.phone || '',
        address: dto.client.address || '',
        comuna: dto.client.comuna,
        otherComuna: dto.client.otherComuna || '',
        comments: withSourceComments(mergedComments, dto.source),
    };
    state.eventData = {
        type: '',
        otherType: '',
        date: dto.event.date,
        startTime: dto.event.startTime || '',
        pickupDate: dto.event.pickupDate || '',
        pickupTime: dto.event.pickupTime || '',
    };
    state.consumption = { guests: 0, drinksPerPerson: 0 };
    state.selections = dto.items.map((i) => ({
        id: i.productId,
        size: i.size,
        quantity: i.quantity,
    }));
    return state;
}
