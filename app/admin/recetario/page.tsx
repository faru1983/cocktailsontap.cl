import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import RecetarioClient from './RecetarioClient';

export const metadata: Metadata = {
    title: 'Recetario – Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

export default async function RecetarioPage() {
    const db = createServerClient();

    const [ingredientsRes, recipesRes, productsRes, categoriesRes] = await Promise.all([
        db.from('ingredients').select('*').order('name', { ascending: true }),
        db.from('recipes').select(`
            *,
            products ( id, name, is_active ),
            recipe_items (
                id,
                ingredient_id,
                qty_base,
                ingredients ( id, name, category, format_qty, format_unit, format_price, is_active )
            )
        `).order('created_at', { ascending: true }),
        db.from('products').select(`
            id,
            name,
            is_active,
            product_prices ( id, size, size_value, price, offer_price, is_active, display_order )
        `).order('display_order', { ascending: true }),
        db.from('categories').select('id, name, is_active').eq('is_active', true).order('display_order', { ascending: true }),
    ]);

    if (ingredientsRes.error) console.error('recetario ingredients:', ingredientsRes.error);
    if (recipesRes.error) console.error('recetario recipes:', recipesRes.error);
    if (productsRes.error) console.error('recetario products:', productsRes.error);

    return (
        <div className="pb-16 w-full">
            <RecetarioClient
                ingredients={ingredientsRes.data || []}
                recipes={recipesRes.data || []}
                products={productsRes.data || []}
                categories={categoriesRes.data || []}
            />
        </div>
    );
}
