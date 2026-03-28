import { createServerClient } from '@/lib/supabaseServer';
import ProductsClient from './ProductsClient';

export default async function ProductsPage() {
    const db = createServerClient();
    
    // Fetch categories
    const { data: categories } = await db
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

    // Fetch products with their prices
    const { data: products } = await db
        .from('products')
        .select(`
            *,
            categories(name),
            product_prices(*)
        `)
        .order('display_order', { ascending: true });

    return (
        <div style={{ paddingBottom: '40px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 900, margin: '0 0 4px' }}>Mantenedor de Productos</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    Administra tu catálogo de productos y categorías de forma centralizada.
                </p>
            </div>

            <ProductsClient 
                products={products || []} 
                categories={categories || []} 
            />
        </div>
    );
}
