'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/adminAuth';

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

export async function addExpense(data: {
    amount: number;
    payment_method: string;
    expense_date: string;
    category_id: string;
    subcategory_id: string;
    notes?: string;
}) {
    await checkAuth();
    const db = createServerClient();
    
    const { error } = await db.from('expenses').insert([{
        amount: data.amount,
        payment_method: data.payment_method,
        expense_date: data.expense_date,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id,
        notes: data.notes || null
    }]);

    if (error) {
        console.error('Error adding expense:', error);
        return { success: false, error: 'No se pudo guardar el gasto.' };
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/estadisticas');
    
    return { success: true };
}

export async function deleteExpense(id: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expenses').delete().eq('id', id);
    
    if (error) {
        console.error('Error deleting expense:', error);
        throw new Error('No se pudo eliminar el gasto.');
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/estadisticas');
    return { success: true };
}

export async function updateExpense(id: string, data: {
    amount: number;
    payment_method: string;
    expense_date: string;
    category_id: string;
    subcategory_id: string;
    notes?: string;
}) {
    await checkAuth();
    const db = createServerClient();
    
    const { error } = await db.from('expenses').update({
        amount: data.amount,
        payment_method: data.payment_method,
        expense_date: data.expense_date,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id,
        notes: data.notes || null,
        updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
        console.error('Error updating expense:', error);
        throw new Error('No se pudo actualizar el gasto.');
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/estadisticas');
    return { success: true };
}

/** 📂 Gestión de Categorías (Familias) **/

export async function addExpenseCategory(name: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_categories').insert([{ name }]);
    if (error) return { success: false, error: 'Error al crear categoría' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

export async function updateExpenseCategory(id: string, data: { name?: string; is_active?: boolean }) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_categories').update(data).eq('id', id);
    if (error) return { success: false, error: 'Error al actualizar categoría' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

/** 🏷️ Gestión de Subcategorías (Ítems) **/

export async function addExpenseSubcategory(categoryId: string, name: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_subcategories').insert([{ category_id: categoryId, name }]);
    if (error) return { success: false, error: 'Error al crear ítem' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

export async function updateExpenseSubcategory(id: string, data: { name?: string; is_active?: boolean }) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_subcategories').update(data).eq('id', id);
    if (error) return { success: false, error: 'Error al actualizar ítem' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

/** 💳 Gestión de Formas de Pago **/

export async function addPaymentMethod(name: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_payment_methods').insert([{ name }]);
    if (error) return { success: false, error: 'Error al crear forma de pago' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

export async function updatePaymentMethod(id: string, data: { name?: string; is_active?: boolean }) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_payment_methods').update(data).eq('id', id);
    if (error) return { success: false, error: 'Error al actualizar forma de pago' };
    revalidatePath('/admin/gastos');
    return { success: true };
}

export async function deletePaymentMethod(id: string) {
    await checkAuth();
    const db = createServerClient();
    const { error } = await db.from('expense_payment_methods').delete().eq('id', id);
    if (error) throw new Error('Error al eliminar forma de pago');
    revalidatePath('/admin/gastos');
    return { success: true };
}
