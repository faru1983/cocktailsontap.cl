'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath, revalidateTag } from 'next/cache';
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
    revalidateTag('product-data', 'max');
}

export async function toggleCategoryStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('categories').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
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
    revalidateTag('product-data', 'max');
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
    revalidateTag('product-data', 'max');
}

export async function toggleUnitStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('measurement_units').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}

export async function toggleProductStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    const nextActive = !current;
    if (nextActive) {
        const { count, error } = await db
            .from('product_prices')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', id)
            .eq('is_active', true);
        if (error) throw new Error(error.message);
        if (!count) {
            throw new Error(
                'No se puede publicar: agrega al menos un precio/formato en Productos (el recetario no crea precios).'
            );
        }
    }
    await db.from('products').update({ is_active: nextActive }).eq('id', id);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
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
    revalidateTag('product-data', 'max');
}

export async function listProductImages(): Promise<{
    success: boolean;
    images?: { name: string; id: string; publicUrl: string }[];
    error?: string;
}> {
    await checkAuth();
    const db = createServerClient();
    const { data, error } = await db.storage.from('product-images').list('', {
        sortBy: { column: 'created_at', order: 'desc' },
        limit: 200,
    });
    if (error) {
        console.error('listProductImages:', error);
        return { success: false, error: error.message };
    }
    const images = (data || [])
        .filter((f) => f.id && f.name && !f.name.startsWith('.'))
        .map((f) => ({
            name: f.name,
            id: f.id,
            publicUrl: db.storage.from('product-images').getPublicUrl(f.name).data.publicUrl,
        }));
    return { success: true, images };
}

export async function uploadImage(formData: FormData) {
    await checkAuth();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No se encontró el archivo');

    const db = createServerClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    
    const buffer = await file.arrayBuffer();
    
    const { error } = await db.storage
        .from('product-images')
        .upload(fileName, buffer, {
            contentType: file.type,
            upsert: true
        });

    if (error) throw new Error('Error al subir imagen: ' + error.message);

    const { data: { publicUrl } } = db.storage.from('product-images').getPublicUrl(fileName);
    return { publicUrl, fileName };
}

export async function deleteImage(fileName: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.storage.from('product-images').remove([fileName]);
    if (error) throw new Error('Error al eliminar imagen: ' + error.message);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}

export async function updateQuickPrice(priceId: string, updates: { price?: number; offer_price?: number | null }) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('product_prices').update(updates).eq('id', priceId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}
