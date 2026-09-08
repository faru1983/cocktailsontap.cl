import type { CocktailForWizard, QuoteItem } from '@/lib/types';

export type ConfirmLineInput = {
    product_id: string | null;
    size: string;
    quantity: number;
};

/**
 * Resuelve líneas de cotización contra el catálogo del servidor (Zero Trust).
 */
export function resolveQuoteItemsFromCatalog(
    lines: ConfirmLineInput[],
    cocktails: CocktailForWizard[]
): { items: Omit<QuoteItem, 'id' | 'quote_id'>[]; error?: string } {
    const byId = new Map(cocktails.map((c) => [c.id, c]));
    const resolved: Omit<QuoteItem, 'id' | 'quote_id'>[] = [];

    for (const line of lines) {
        if (!line.product_id) {
            return { items: [], error: 'Producto inválido en la cotización.' };
        }
        const cocktail = byId.get(line.product_id);
        if (!cocktail) {
            return { items: [], error: `Producto no encontrado: ${line.product_id}` };
        }
        const priceData = cocktail.prices[line.size];
        if (!priceData) {
            return { items: [], error: `Tamaño "${line.size}" no válido para ${cocktail.name}.` };
        }
        resolved.push({
            product_id: line.product_id,
            product_name: cocktail.name,
            size: line.size,
            size_value: priceData.sizeValue,
            unit_id: priceData.unitId,
            is_disposable: priceData.isDisposable,
            quantity: line.quantity,
            price_at_time: priceData.price,
            offer_price_at_time: priceData.offerPrice,
        });
    }

    return { items: resolved };
}

/** Elimina customPrice de selecciones cuando el caller no es admin. */
export function stripClientPricing<T extends { customPrice?: number }>(selections: T[]): T[] {
    return selections.map(({ customPrice: _ignored, ...rest }) => rest as T);
}
