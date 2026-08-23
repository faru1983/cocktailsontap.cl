import { unstable_cache } from 'next/cache';
import { supabase } from './supabase';
import { createServerClient } from './supabaseServer';
import type {
    Product,
    CocktailForWizard,
    EventType,
    Comuna,
    Region,
    SupabaseProduct,
    MeasurementUnit,
} from './types';
import { isBlueExpressZone, parseBlueExpressRates, type BlueExpressHomeRates } from './blueExpress';

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

function numOrNull(v: number | null | undefined): number | null {
    return v === null || v === undefined ? null : Number(v);
}

// ─── Fetch con caché (revalida cada 5 minutos) ────────────────────────────────

export const fetchAllProductData = unstable_cache(
    async (): Promise<{
        products: Product[];
        cocktails: CocktailForWizard[];
        categories: string[];
        eventTypes: EventType[];
        regions: Region[];
        comunas: Comuna[];
        measurementUnits: MeasurementUnit[];
        blueExpressRates: BlueExpressHomeRates;
    }> => {
        const db = createServerClient();
        const [
            { data: catData, error: catError },
            { data: eventData, error: eventError },
            { data: regionsData, error: regionsError },
            { data: comunasData, error: comunasError },
            { data: productsData, error: productsError },
            { data: unitsData, error: unitsError },
            { data: beRatesRow },
        ] = await Promise.all([
            supabase.from('categories').select('name').eq('is_active', true).order('display_order', { ascending: true }),
            supabase.from('event_types').select('id, name, icon').order('display_order', { ascending: true }),
            supabase
                .from('regions')
                .select(
                    'id, name, short_name, code, display_order, is_active, available_for_events, available_for_direct, cost, direct_sale_delivery_cost, free_from, shipping_carrier, blue_express_zone'
                )
                .order('display_order', { ascending: true }),
            supabase
                .from('comunas')
                .select('id, name, cost, free_from, direct_sale_delivery_cost, display_order, is_active, region_id, shipping_carrier, blue_express_zone')
                .eq('is_active', true)
                .order('display_order', { ascending: true }),
            supabase
                .from('products')
                .select(
                    `
                id, name, description, image_url,
                categories ( name ),
                product_prices ( 
                    size, size_value, unit_id, is_disposable, price, offer_price, display_order, is_active, image_url,
                    measurement_units ( id, name, abbreviation )
                )
            `
                )
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .order('display_order', { foreignTable: 'product_prices', ascending: true }),
            supabase.from('measurement_units').select('*').eq('is_active', true).order('display_order', { ascending: true }),
            db.from('site_settings').select('value').eq('key', 'blue_express_home_rates').maybeSingle(),
        ]);

        if (catError) throw new Error(`categories: ${catError.message}`);
        if (eventError) throw new Error(`event_types: ${eventError.message}`);
        if (regionsError) throw new Error(`regions: ${regionsError.message}`);
        if (comunasError) throw new Error(`comunas: ${comunasError.message}`);
        if (productsError) throw new Error(`products: ${productsError.message}`);
        if (unitsError) throw new Error(`measurement_units: ${unitsError.message}`);

        const categories: string[] = (catData ?? []).map((c: { name: string }) => c.name);

        const regions: Region[] = ((regionsData ?? []) as any[]).map((r) => ({
            id: r.id,
            name: r.name,
            shortName: r.short_name,
            code: r.code,
            displayOrder: Number(r.display_order ?? 0),
            isActive: r.is_active !== false,
            availableForEvents: Boolean(r.available_for_events),
            availableForDirect: r.available_for_direct !== false,
            shippingCarrier: r.shipping_carrier === 'blue_express' ? 'blue_express' : 'own',
            blueExpressZone: isBlueExpressZone(r.blue_express_zone) ? r.blue_express_zone : null,
            cost: numOrNull(r.cost),
            directSaleDeliveryCost: numOrNull(r.direct_sale_delivery_cost),
            freeFrom: numOrNull(r.free_from),
        }));

        const regionsById = new Map(regions.map((r) => [r.id, r]));
        const blueExpressRates = parseBlueExpressRates(beRatesRow?.value);

        const comunas: Comuna[] = ((comunasData ?? []) as any[])
            .map((c) => {
                const region = regionsById.get(c.region_id);
                if (!region || !region.isActive) return null;
                return {
                    name: c.name as string,
                    cost: numOrNull(c.cost),
                    freeFrom: numOrNull(c.free_from),
                    directSaleDeliveryCost: numOrNull(c.direct_sale_delivery_cost),
                    regionId: c.region_id as string,
                    regionCode: region.code,
                    regionName: region.name,
                    regionShortName: region.shortName,
                    isActive: c.is_active !== false,
                    regionCost: region.cost,
                    regionDirectSaleDeliveryCost: region.directSaleDeliveryCost,
                    regionFreeFrom: region.freeFrom,
                    regionShippingCarrier: region.shippingCarrier,
                    regionBlueExpressZone: region.blueExpressZone,
                    shippingCarrier:
                        c.shipping_carrier === 'own' || c.shipping_carrier === 'blue_express'
                            ? c.shipping_carrier
                            : null,
                    blueExpressZone: isBlueExpressZone(c.blue_express_zone) ? c.blue_express_zone : null,
                    blueExpressRates,
                } satisfies Comuna;
            })
            .filter((c): c is Comuna => c !== null)
            .sort((a, b) => {
                if (a.regionCode !== b.regionCode) {
                    const ra = regionsById.get(a.regionId)?.displayOrder ?? 0;
                    const rb = regionsById.get(b.regionId)?.displayOrder ?? 0;
                    if (ra !== rb) return ra - rb;
                }
                if (a.name === 'Otra') return 1;
                if (b.name === 'Otra') return -1;
                return a.name.localeCompare(b.name, 'es');
            });

        const products: Product[] = ((productsData as unknown as SupabaseProduct[]) ?? []).map((p) => {
            const sizes = (p.product_prices ?? [])
                .filter((s) => s.is_active !== false)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((s) => {
                    const unitAbbr = s.measurement_units?.abbreviation || 'L';
                    const sizeLabel = `${s.size_value}${unitAbbr}${s.is_disposable ? ' - Desechable' : ''}`;
                    const sizeImg = s.image_url ? resolveImage(s.image_url) : undefined;

                    return {
                        size: sizeLabel,
                        sizeValue: s.size_value ? Number(s.size_value) : 0,
                        unit: unitAbbr,
                        unitId: s.unit_id,
                        isDisposable: s.is_disposable ?? false,
                        price: s.price,
                        offerPrice: s.offer_price ?? s.price,
                        image: sizeImg,
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
                        image: s.image,
                    };
                    return acc;
                },
                {} as Record<string, any>
            ),
        }));

        return {
            products,
            cocktails,
            categories,
            eventTypes: eventData ?? [],
            regions,
            comunas,
            measurementUnits: unitsData ?? [],
            blueExpressRates,
        };
    },
    ['product-data-v5-be-rates'],
    { revalidate: 300, tags: ['product-data'] }
);

export const fetchAllClients = unstable_cache(
    async () => {
        const db = createServerClient();
        const { data, error } = await db
            .from('clients')
            .select('id, first_name, last_name, email, phone')
            .is('merged_into_id', null)
            .order('first_name', { ascending: true });
        if (error) throw new Error(`clients: ${error.message}`);
        return data ?? [];
    },
    ['clients-data'],
    { revalidate: 60 }
);
