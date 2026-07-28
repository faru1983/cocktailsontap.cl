'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/adminAuth';
import { PROJECT_TIMEZONE } from '@/lib/config';
import {
    IngredientSaveSchema,
    IngredientPatchSchema,
    RecipeSaveSchema,
    type IngredientSaveInput,
    type IngredientPatchInput,
    type RecipeSaveInput,
} from '@/lib/types';
import { rangeFor, type QuoteRange } from '@/lib/services/productionService';

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

function revalidateRecetario() {
    revalidatePath('/admin/recetario');
}

export async function saveIngredient(raw: IngredientSaveInput) {
    await checkAuth();
    const parsed = IngredientSaveSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' };
    }
    const data = parsed.data;
    const db = createServerClient();

    const payload = {
        name: data.name.trim(),
        category: data.category,
        format_qty: data.format_qty,
        format_unit: data.format_unit,
        format_price: data.format_price,
        supplier: data.supplier?.trim() ? data.supplier.trim() : null,
        is_active: data.is_active ?? true,
        updated_at: new Date().toISOString(),
    };

    if (data.id) {
        const { error } = await db.from('ingredients').update(payload).eq('id', data.id);
        if (error) {
            console.error('saveIngredient update:', error);
            return { success: false, error: error.code === '23505' ? 'Ya existe un insumo con ese nombre.' : 'No se pudo actualizar el insumo.' };
        }
    } else {
        const { error } = await db.from('ingredients').insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) {
            console.error('saveIngredient insert:', error);
            return { success: false, error: error.code === '23505' ? 'Ya existe un insumo con ese nombre.' : 'No se pudo crear el insumo.' };
        }
    }

    revalidateRecetario();
    return { success: true };
}

export async function toggleIngredientStatus(id: string, isActive: boolean) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db
        .from('ingredients')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) {
        console.error('toggleIngredientStatus:', error);
        return { success: false, error: 'No se pudo cambiar el estado.' };
    }
    revalidateRecetario();
    return { success: true };
}

export async function deleteIngredient(id: string) {
    await checkAuth();
    const db = createServerClient();

    const { count, error: countError } = await db
        .from('recipe_items')
        .select('id', { count: 'exact', head: true })
        .eq('ingredient_id', id);

    if (countError) {
        console.error('deleteIngredient count:', countError);
        return { success: false, error: 'No se pudo verificar el uso del insumo.' };
    }
    if ((count ?? 0) > 0) {
        return { success: false, error: 'El insumo está en una o más recetas. Desactívalo en su lugar.' };
    }

    const { error } = await db.from('ingredients').delete().eq('id', id);
    if (error) {
        console.error('deleteIngredient:', error);
        return { success: false, error: 'No se pudo eliminar el insumo.' };
    }
    revalidateRecetario();
    return { success: true };
}

export async function updateIngredientPrice(id: string, formatPrice: number) {
    return patchIngredient({ id, format_price: formatPrice });
}

export async function patchIngredient(raw: IngredientPatchInput) {
    await checkAuth();
    const parsed = IngredientPatchSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' };
    }
    const { id, ...fields } = parsed.data;
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.name !== undefined) payload.name = fields.name.trim();
    if (fields.category !== undefined) payload.category = fields.category;
    if (fields.format_qty !== undefined) payload.format_qty = fields.format_qty;
    if (fields.format_unit !== undefined) payload.format_unit = fields.format_unit;
    if (fields.format_price !== undefined) payload.format_price = fields.format_price;
    if (fields.supplier !== undefined) {
        payload.supplier = fields.supplier?.trim() ? fields.supplier.trim() : null;
    }
    if (fields.is_active !== undefined) payload.is_active = fields.is_active;

    if (Object.keys(payload).length <= 1) {
        return { success: false, error: 'Sin cambios.' };
    }

    const db = createServerClient();
    const { error } = await db.from('ingredients').update(payload).eq('id', id);
    if (error) {
        console.error('patchIngredient:', error);
        return {
            success: false,
            error: error.code === '23505' ? 'Ya existe un insumo con ese nombre.' : 'No se pudo actualizar el insumo.',
        };
    }
    revalidateRecetario();
    return { success: true };
}

export async function saveRecipe(raw: RecipeSaveInput) {
    await checkAuth();
    const parsed = RecipeSaveSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' };
    }
    const data = parsed.data;
    const db = createServerClient();

    // Deduplicate ingredient lines (keep last qty)
    const itemMap = new Map<string, number>();
    for (const item of data.items) {
        itemMap.set(item.ingredient_id, item.qty_base);
    }
    const uniqueItems = Array.from(itemMap.entries()).map(([ingredient_id, qty_base]) => ({
        ingredient_id,
        qty_base,
    }));

    let recipeId = data.id || null;

    if (recipeId) {
        const { error } = await db
            .from('recipes')
            .update({
                product_id: data.product_id,
                base_liters: data.base_liters,
                notes: data.notes ?? null,
                is_active: data.is_active ?? true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', recipeId);
        if (error) {
            console.error('saveRecipe update:', error);
            return {
                success: false,
                error: error.code === '23505' ? 'Ese producto ya tiene una receta.' : 'No se pudo actualizar la receta.',
            };
        }
        await db.from('recipe_items').delete().eq('recipe_id', recipeId);
    } else {
        const { data: inserted, error } = await db
            .from('recipes')
            .insert([{
                product_id: data.product_id,
                base_liters: data.base_liters,
                notes: data.notes ?? null,
                is_active: data.is_active ?? true,
            }])
            .select('id')
            .single();
        if (error || !inserted) {
            console.error('saveRecipe insert:', error);
            return {
                success: false,
                error: error?.code === '23505' ? 'Ese producto ya tiene una receta.' : 'No se pudo crear la receta.',
            };
        }
        recipeId = inserted.id;
    }

    const { error: itemsError } = await db.from('recipe_items').insert(
        uniqueItems.map((item) => ({
            recipe_id: recipeId,
            ingredient_id: item.ingredient_id,
            qty_base: item.qty_base,
        }))
    );
    if (itemsError) {
        console.error('saveRecipe items:', itemsError);
        return { success: false, error: 'No se pudieron guardar los insumos de la receta.' };
    }

    revalidateRecetario();
    return { success: true, id: recipeId };
}

export async function toggleRecipeStatus(id: string, isActive: boolean) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db
        .from('recipes')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) {
        console.error('toggleRecipeStatus:', error);
        return { success: false, error: 'No se pudo cambiar el estado.' };
    }
    revalidateRecetario();
    return { success: true };
}

export async function deleteRecipe(id: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('recipes').delete().eq('id', id);
    if (error) {
        console.error('deleteRecipe:', error);
        return { success: false, error: 'No se pudo eliminar la receta.' };
    }
    revalidateRecetario();
    return { success: true };
}

export type ProductionQuoteRow = {
    id: string;
    client_name: string;
    client_lastname: string | null;
    event_date: string;
    total_liters: number | null;
    quote_items: {
        product_id: string | null;
        product_name: string;
        quantity: number;
        size_value: number | null;
        size: string;
    }[];
};

export async function getConfirmedQuotesForProduction(range: QuoteRange = 'week'): Promise<{
    success: boolean;
    quotes?: ProductionQuoteRow[];
    from?: string;
    to?: string;
    error?: string;
}> {
    await checkAuth();
    const { from, to } = rangeFor(range, PROJECT_TIMEZONE);
    const db = createServerClient();

    const { data, error } = await db
        .from('quotes')
        .select(`
            id,
            client_name,
            client_lastname,
            event_date,
            total_liters,
            quote_items (
                product_id,
                product_name,
                quantity,
                size_value,
                size
            )
        `)
        .eq('status', 'confirmed')
        .gte('event_date', from)
        .lte('event_date', to)
        .order('event_date', { ascending: true });

    if (error) {
        console.error('getConfirmedQuotesForProduction:', error);
        return { success: false, error: 'No se pudieron cargar las cotizaciones.' };
    }

    return { success: true, quotes: (data as ProductionQuoteRow[]) || [], from, to };
}
