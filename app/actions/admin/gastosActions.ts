'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export async function addExpense(data: {
    amount: number;
    payment_method: string;
    expense_date: string;
    category_id: string;
    subcategory_id: string;
    notes?: string;
}) {
    const db = createServerClient();
    
    // Using service key implicitly via createServerClient bypasses RLS
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
        throw new Error('No se pudo guardar el gasto.');
    }

    revalidatePath('/admin/gastos');
    revalidatePath('/admin/estadisticas');
    return { success: true };
}

export async function deleteExpense(id: string) {
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
