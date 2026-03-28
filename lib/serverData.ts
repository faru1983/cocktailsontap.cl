import { unstable_cache } from 'next/cache';
import { supabase } from './supabase';
import type { Product, CocktailForWizard, EventType, Comuna, SupabaseProduct } from './types';

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
    }> => {
        const [
            { data: catData, error: catError },
            { data: eventData, error: eventError },
            { data: comunasData, error: comunasError },
            { data: productsData, error: productsError },
        ] = await Promise.all([
            supabase.from('categories').select('name').eq('is_active', true).order('display_order', { ascending: true }),
            supabase.from('event_types').select('id, name, icon').order('display_order', { ascending: true }),
            supabase.from('comunas').select('name, cost, free_from').order('display_order', { ascending: true }),
            supabase.from('products').select(`
                id, name, description, image_url,
                categories ( name ),
                product_prices ( size, price, offer_price )
            `).eq('is_active', true).order('display_order', { ascending: true }),
        ]);

        if (catError) throw new Error(`categories: ${catError.message}`);
        if (eventError) throw new Error(`event_types: ${eventError.message}`);
        if (comunasError) throw new Error(`comunas: ${comunasError.message}`);
        if (productsError) throw new Error(`products: ${productsError.message}`);

        const categories: string[] = (catData ?? []).map((c: { name: string }) => c.name);

        const comunas: Comuna[] = ((comunasData ?? []) as { name: string; cost: number | null; free_from: number | null }[])
            .map((c) => ({
                name: c.name,
                cost: c.cost === null ? null : Number(c.cost),
                freeFrom: c.free_from === null ? null : Number(c.free_from),
            }))
            .sort((a, b) =>
                a.name === 'Otra' ? 1 : b.name === 'Otra' ? -1 : a.name.localeCompare(b.name)
            );

        const products: Product[] = ((productsData as unknown as SupabaseProduct[]) ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: resolveImage(p.image_url),
            category: p.categories?.name ?? 'Uncategorized',
            sizes: (p.product_prices ?? []).map((s) => ({
                size: s.size,
                price: s.price,
                offerPrice: s.offer_price ?? s.price,
            })),
            selectedSize: p.product_prices?.[0]?.size ?? '',
        }));

        const cocktails: CocktailForWizard[] = products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            desc: p.description,
            image: p.image,
            prices: p.sizes.reduce(
                (acc, s) => {
                    const match = s.size.match(/\d+/);
                    const key = match ? match[0] + 'L' : s.size;
                    acc[key] = { price: s.price, offerPrice: s.offerPrice };
                    return acc;
                },
                {} as Record<string, { price: number; offerPrice: number }>
            ),
        }));

        return { products, cocktails, categories, eventTypes: eventData ?? [], comunas };
    },
    ['product-data'],           // cache key
    { revalidate: 300 }         // revalida cada 5 minutos
);
