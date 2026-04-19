import { unstable_cache } from 'next/cache';
import { supabase } from './supabase';
import { createServerClient } from './supabaseServer';
import type { Product, CocktailForWizard, EventType, Comuna, SupabaseProduct, MeasurementUnit } from './types';

// ─── Helpers de transformación ───────────────────────────────────────────────

const STORAGE_BASE_URL =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') + '/storage/v1/object/public/product-images/';
const DEFAULT_IMAGE = '/assets/barril_sin_imagen.webp';

function resolveImage(imageUrl: string | null): string {
    if (!imageUrl || imageUrl.trim() === '') return DEFAULT_IMAGE;
    if (!imageUrl.startsWith('http')) {
        const fileName = imageUrl.split('/').pop();
        return STORAGE_BASE_URL + fileName;
    }
    return imageUrl;
}

// ─── Fetch con caché (revalida cada 5 minutos) ────────────────────────────────

export const fetchAllProductData = unstable_cache(
    async (): Promise<{
        products: Product[];
        cocktails: CocktailForWizard[];
        categories: string[];
        eventTypes: EventType[];
        comunas: Comuna[];
        measurementUnits: MeasurementUnit[];
    }> => {
        const [
            { data: catData, error: catError },
            { data: eventData, error: eventError },
            { data: comunasData, error: comunasError },
            { data: productsData, error: productsError },
            { data: unitsData, error: unitsError },
        ] = await Promise.all([
            supabase.from('categories').select('name').eq('is_active', true).order('display_order', { ascending: true }),
            supabase.from('event_types').select('id, name, icon').order('display_order', { ascending: true }),
            supabase.from('comunas').select('name, cost, free_from, direct_sale_delivery_cost').order('display_order', { ascending: true }),
            supabase.from('products').select(`
                id, name, description, image_url,
                categories ( name ),
                product_prices ( 
                    size, size_value, unit_id, is_disposable, price, offer_price, display_order, is_active,
                    measurement_units ( id, name, abbreviation )
                )
            `).eq('is_active', true)
              .order('display_order', { ascending: true })
              .order('display_order', { foreignTable: 'product_prices', ascending: true }),
            supabase.from('measurement_units').select('*').eq('is_active', true).order('display_order', { ascending: true }),
        ]);

        if (catError) throw new Error(`categories: ${catError.message}`);
        if (eventError) throw new Error(`event_types: ${eventError.message}`);
        if (comunasError) throw new Error(`comunas: ${comunasError.message}`);
        if (productsError) throw new Error(`products: ${productsError.message}`);
        if (unitsError) throw new Error(`measurement_units: ${unitsError.message}`);

        const categories: string[] = (catData ?? []).map((c: { name: string }) => c.name);

        const comunas: Comuna[] = ((comunasData ?? []) as { name: string; cost: number | null; free_from: number | null; direct_sale_delivery_cost: number | null }[])
            .map((c) => ({
                name: c.name,
                cost: c.cost === null ? null : Number(c.cost),
                freeFrom: c.free_from === null ? null : Number(c.free_from),
                directSaleDeliveryCost: c.direct_sale_delivery_cost === null ? null : Number(c.direct_sale_delivery_cost),
            }))
            .sort((a, b) =>
                a.name === 'Otra' ? 1 : b.name === 'Otra' ? -1 : a.name.localeCompare(b.name)
            );

        const products: Product[] = ((productsData as unknown as SupabaseProduct[]) ?? []).map((p) => {
            const sizes = (p.product_prices ?? [])
                .filter(s => s.is_active !== false)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((s) => {
                    const unitAbbr = s.measurement_units?.abbreviation || 'L';
                    const sizeLabel = `${s.size_value}${unitAbbr}${s.is_disposable ? ' - Desechable' : ''}`;
                    return {
                        size: sizeLabel, 
                        sizeValue: s.size_value ? Number(s.size_value) : 0,
                        unit: unitAbbr,
                        unitId: s.unit_id,
                        isDisposable: s.is_disposable ?? false,
                        price: s.price,
                        offerPrice: s.offer_price ?? s.price,
                        image: resolveImage(s.image_url ?? null),
                    };
                });

            return {
                id: p.id,
                name: p.name,
                description: p.description,
                image: resolveImage(p.image_url),
                category: p.categories?.name ?? 'Uncategorized',
                sizes,
                selectedSize: sizes[0]?.size ?? '',
            };
        });

        const cocktails: CocktailForWizard[] = products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            desc: p.description,
            image: p.image,
            prices: p.sizes.reduce(
                (acc, s) => {
                    acc[s.size] = { 
                        price: s.price, 
                        offerPrice: s.offerPrice,
                        sizeValue: s.sizeValue,
                        unit: s.unit,
                        unitId: s.unitId,
                        isDisposable: s.isDisposable,
                        image: s.image
                    };
                    return acc;
                },
                {} as Record<string, any>
            ),
        }));

        return { products, cocktails, categories, eventTypes: eventData ?? [], comunas, measurementUnits: unitsData ?? [] };
    },
    ['product-data'],           // cache key
    { revalidate: 300 }         // revalida cada 5 minutos
);
export const fetchAllClients = unstable_cache(
    async () => {
        const db = createServerClient();
        const { data, error } = await db.from('clients').select('id, first_name, last_name, email, phone').order('first_name', { ascending: true });
        if (error) throw new Error(`clients: ${error.message}`);
        return data ?? [];
    },
    ['clients-data'],
    { revalidate: 60 } // Revalidar cada 1 minuto para clientes (más dinámico)
);
