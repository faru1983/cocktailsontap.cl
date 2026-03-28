'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export async function saveCategory(category: { id?: string; name: string; display_order: number; is_active: boolean }) {
    const db = createServerClient();
    const { id, ...data } = category;
    
    if (id) {
        const { error } = await db.from('categories').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await db.from('categories').insert(data);
        if (error) throw new Error(error.message);
    }
    revalidatePath('/admin/products');
}

export async function toggleCategoryStatus(id: string, current: boolean) {
    const db = createServerClient();
    await db.from('categories').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
}

export async function saveProduct(
    product: { id?: string; name: string; description: string; image_url: string; display_order: number; category_id: string; is_active: boolean },
    prices: { id?: string; size: string; price: number; offer_price: number | null }[]
) {
    const db = createServerClient();
    const { id, ...pData } = product;
    
    let productId = id;
    if (id) {
        const { error } = await db.from('products').update(pData).eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const { data, error } = await db.from('products').insert(pData).select().single();
        if (error) throw new Error(error.message);
        productId = data?.id;
    }
    
    if (productId) {
        // We handle prices: upsert functionality
        // 1. Get existing price IDs for this product
        const { data: existingPrices } = await db.from('product_prices').select('id').eq('product_id', productId);
        const existingIds = (existingPrices || []).map(p => p.id);
        const currentIds = prices.filter(p => !!p.id).map(p => p.id as string);
        
        // 2. Delete prices that are no longer in the list
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
            await db.from('product_prices').delete().in('id', toDelete);
        }

        // 3. Upsert current prices
        for (const pr of prices) {
            const { id: priceId, ...prData } = pr;
            if (priceId) {
                await db.from('product_prices').update(prData).eq('id', priceId);
            } else {
                await db.from('product_prices').insert({ ...prData, product_id: productId });
            }
        }
    }
    revalidatePath('/admin/products');
}

export async function toggleProductStatus(id: string, current: boolean) {
    const db = createServerClient();
    await db.from('products').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
}

export async function reorderItems(type: 'products' | 'categories', updates: { id: string; display_order: number }[]) {
    const db = createServerClient();
    for (const item of updates) {
        await db.from(type).update({ display_order: item.display_order }).eq('id', item.id);
    }
    revalidatePath('/admin/products');
}
