'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/adminAuth';

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

export async function saveCategory(category: any) {
    await checkAuth();
    const db = createServerClient();
    const { id, _idx, ...data } = category;
    
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
    await checkAuth();
    const db = createServerClient();
    await db.from('categories').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
}

export async function saveProduct(product: any, prices: any[]) {
    await checkAuth();
    const db = createServerClient();
    const { id, _idx, categories, product_prices, ...pData } = product;
    
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
        // Handle prices: 1. Get existing to delete ones not in 'prices'
        const { data: existingPrices } = await db.from('product_prices').select('id').eq('product_id', productId);
        const existingIds = (existingPrices || []).map(p => p.id);
        const currentIds = prices.filter(p => !!p.id).map(p => p.id as string);
        
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
            await db.from('product_prices').delete().in('id', toDelete);
        }

        // 2. Optimized Batch Upsert for all current prices
        const priceUpdates = prices.map((pr, index) => {
            const { measurement_units, ...pClean } = pr; // Remove join data if present
            return {
                ...pClean,
                product_id: productId,
                display_order: index // Use the array index as the order
            };
        });
        
        if (priceUpdates.length > 0) {
            const { error: priceErr } = await db.from('product_prices').upsert(priceUpdates);
            if (priceErr) throw new Error('Error al guardar precios: ' + priceErr.message);
        }
    }
    revalidatePath('/admin/products');
}

export async function saveUnit(unit: any) {
    await checkAuth();
    const db = createServerClient();
    const { id, ...data } = unit;
    
    if (id) {
        const { error } = await db.from('measurement_units').update(data).eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await db.from('measurement_units').insert(data);
        if (error) throw new Error(error.message);
    }
    revalidatePath('/admin/products');
}

export async function toggleUnitStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('measurement_units').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
}

export async function toggleProductStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('products').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
}

export async function reorderItems(type: 'products' | 'categories' | 'measurement_units', updates: { id: string; display_order: number }[]) {
    await checkAuth();
    const db = createServerClient();
    
    const results = await Promise.all(
        updates.map(u => 
            db.from(type as any)
              .update({ display_order: u.display_order })
              .eq('id', u.id)
        )
    );
    
    const firstError = results.find(r => r.error);
    if (firstError) throw new Error('Error al reordenar: ' + firstError.error?.message);
    
    revalidatePath('/admin/products');
}
