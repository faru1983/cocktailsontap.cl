import { createServerClient } from '@/lib/supabaseServer';
import ProductsClient from './ProductsClient';

export default async function ProductsPage() {
    const db = createServerClient();
    
    // Fetch categories
    const { data: categories } = await db
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

    // Fetch measurement units
    const { data: units } = await db
        .from('measurement_units')
        .select('*')
        .order('display_order', { ascending: true });

    // Fetch products with their prices
    const { data: products } = await db
        .from('products')
        .select(`
            *,
            categories(name),
            product_prices(
                *,
                measurement_units(*)
            )
        `)
        .order('display_order', { ascending: true });

    return (
        <div style={{ paddingBottom: '40px' }}>
            <ProductsClient 
                products={products || []} 
                categories={categories || []}
                measurementUnits={units || []}
            />
        </div>
    );
}
