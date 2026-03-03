'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, CocktailForWizard, EventType, Comuna, SupabaseProduct } from '@/lib/types';

const STORAGE_BASE_URL =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') + '/storage/v1/object/public/product-images/';
const DEFAULT_IMAGE = STORAGE_BASE_URL + 'barril_sin_imagen.webp';

function resolveImage(imageUrl: string | null): string {
    if (!imageUrl || imageUrl.trim() === '') return DEFAULT_IMAGE;
    if (!imageUrl.startsWith('http')) {
        const fileName = imageUrl.split('/').pop();
        return STORAGE_BASE_URL + fileName;
    }
    return imageUrl;
}

export function useProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [cocktails, setCocktails] = useState<CocktailForWizard[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [comunas, setComunas] = useState<Comuna[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetched = useRef(false);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;

        async function fetch() {
            try {
                const [
                    { data: catData, error: catError },
                    { data: eventData, error: eventError },
                    { data: comunasData, error: comunasError },
                    { data: productsData, error: productsError },
                ] = await Promise.all([
                    supabase.from('categories').select('name').order('display_order', { ascending: true }),
                    supabase.from('event_types').select('id, name, icon').order('display_order', { ascending: true }),
                    supabase.from('comunas').select('name, cost, free_from').order('display_order', { ascending: true }),
                    supabase.from('products').select(`
            id, name, description, image_url,
            categories ( name ),
            product_prices ( size, price, offer_price )
          `).order('display_order', { ascending: true }),
                ]);

                if (catError) throw catError;
                if (eventError) throw eventError;
                if (comunasError) throw comunasError;
                if (productsError) throw productsError;

                const allCategories: string[] = (catData ?? []).map((c: { name: string }) => c.name);

                const allComunas: Comuna[] = (comunasData ?? [])
                    .map((c: { name: string; cost: number | null; free_from: number | null }) => ({
                        name: c.name,
                        cost: c.cost === null ? null : Number(c.cost),
                        freeFrom: c.free_from === null ? null : Number(c.free_from),
                    }))
                    .sort((a: Comuna, b: Comuna) =>
                        a.name === 'Otra' ? 1 : b.name === 'Otra' ? -1 : a.name.localeCompare(b.name)
                    );

                const allProducts: Product[] = (productsData as unknown as SupabaseProduct[] ?? []).map((p) => ({
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
                }));

                const allCocktails: CocktailForWizard[] = allProducts.map((p) => ({
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

                setCategories(allCategories);
                setEventTypes(eventData ?? []);
                setComunas(allComunas);
                setProducts(allProducts.map((p) => ({ ...p, selectedSize: p.sizes[0]?.size ?? '' })));
                setCocktails(allCocktails);
            } catch (err) {
                console.error('Error fetching products:', err);
                setError('No pudimos cargar los productos. Por favor, intenta recargar la página.');
            } finally {
                setIsLoading(false);
            }
        }

        fetch();
    }, []);

    return { products, cocktails, categories, eventTypes, comunas, isLoading, error };
}
