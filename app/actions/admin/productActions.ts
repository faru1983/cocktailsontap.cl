'use server';

import path from 'path';
import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath, revalidateTag } from 'next/cache';
import { validateSession } from '@/lib/adminAuth';
import {
    CategorySaveSchema,
    ProductPriceSaveSchema,
    ProductSaveSchema,
} from '@/lib/types';

const ALLOWED_IMAGE_MIME: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

export async function saveCategory(category: unknown) {
    await checkAuth();
    const parsed = CategorySaveSchema.safeParse(category);
    if (!parsed.success) throw new Error('Datos de categoría inválidos.');

    const db = createServerClient();
    const { id, ...data } = parsed.data;

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

export async function saveProduct(product: unknown, prices: unknown[]) {
    await checkAuth();
    const parsedProduct = ProductSaveSchema.safeParse(product);
    if (!parsedProduct.success) throw new Error('Datos de producto inválidos.');

    const parsedPrices = prices.map((p, i) => {
        const r = ProductPriceSaveSchema.safeParse(p);
        if (!r.success) throw new Error(`Precio inválido en fila ${i + 1}.`);
        return r.data;
    });

    const db = createServerClient();
    const { id, ...pData } = parsedProduct.data;

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
        const { data: existingPrices } = await db.from('product_prices').select('id').eq('product_id', productId);
        const existingIds = (existingPrices || []).map((p) => p.id);
        const currentIds = parsedPrices.filter((p) => !!p.id).map((p) => p.id as string);

        const toDelete = existingIds.filter((pid) => !currentIds.includes(pid));
        if (toDelete.length > 0) {
            await db.from('product_prices').delete().in('id', toDelete);
        }

        const priceUpdates = parsedPrices.map((pr, index) => ({
            ...pr,
            product_id: productId,
            display_order: pr.display_order ?? index,
        }));

        if (priceUpdates.length > 0) {
            const { error: priceErr } = await db.from('product_prices').upsert(priceUpdates);
            if (priceErr) throw new Error('Error al guardar precios: ' + priceErr.message);
        }
    }
    revalidatePath('/admin/products');
    revalidatePath('/admin/recetario');
    revalidateTag('product-data', 'max');
}

export async function toggleProductStatus(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('products').update({ is_active: !current }).eq('id', id);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}

export async function toggleProductHideFromRecipes(id: string, current: boolean) {
    await checkAuth();
    const db = createServerClient();
    await db.from('products').update({ hide_from_recipes: !current }).eq('id', id);
    revalidatePath('/admin/products');
    revalidatePath('/admin/recetario');
    revalidateTag('product-data', 'max');
}

export async function reorderItems(table: 'categories' | 'products' | 'measurement_units', items: { id: string; display_order: number }[]) {
    await checkAuth();
    const db = createServerClient();
    for (const item of items) {
        await db.from(table).update({ display_order: item.display_order }).eq('id', item.id);
    }
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}

export async function saveUnit(unit: { id?: string; name: string; abbreviation: string; display_order?: number; is_active?: boolean }) {
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

    const ext = ALLOWED_IMAGE_MIME[file.type];
    if (!ext) throw new Error('Tipo de archivo no permitido. Usa WebP, JPEG, PNG o GIF.');

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('La imagen no puede superar 2 MB.');
    }

    const db = createServerClient();
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error } = await db.storage.from('product-images').upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
    });

    if (error) throw new Error('Error al subir imagen: ' + error.message);

    const {
        data: { publicUrl },
    } = db.storage.from('product-images').getPublicUrl(fileName);
    return { publicUrl, fileName };
}

export async function deleteImage(fileName: string) {
    await checkAuth();
    const safeName = path.basename(fileName);
    if (!safeName || safeName !== fileName || safeName.includes('..')) {
        throw new Error('Nombre de archivo inválido.');
    }

    const db = createServerClient();
    const { error } = await db.storage.from('product-images').remove([safeName]);
    if (error) throw new Error('Error al eliminar imagen: ' + error.message);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}

export async function updateQuickPrice(priceId: string, updates: { price?: number; offer_price?: number | null }) {
    await checkAuth();
    const db = createServerClient();
    const patch: { price?: number; offer_price?: number | null } = {};
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.offer_price !== undefined) patch.offer_price = updates.offer_price;
    const { error } = await db.from('product_prices').update(patch).eq('id', priceId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/products');
    revalidateTag('product-data', 'max');
}
