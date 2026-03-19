import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import GastosClient from './GastosClient';

export const metadata: Metadata = {
    title: 'Gastos – Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

export default async function GastosPage() {
    const db = createServerClient();

    const [catRes, subRes, expRes] = await Promise.all([
        db.from('expense_categories').select('*').eq('is_active', true).order('name'),
        db.from('expense_subcategories').select('*').eq('is_active', true).order('name'),
        db.from('expenses').select(`
            *,
            expense_categories (name),
            expense_subcategories (name)
        `).order('expense_date', { ascending: false }).limit(200)
    ]);

    // Formatting for client
    const expenses = (expRes.data || []).map((exp: any) => ({
        id: exp.id,
        amount: Number(exp.amount),
        expense_date: exp.expense_date,
        payment_method: exp.payment_method,
        notes: exp.notes || '',
        category_name: exp.expense_categories?.name || 'Desconocida',
        subcategory_name: exp.expense_subcategories?.name || 'General'
    }));

    return (
        <main style={{ padding: '0', animation: 'fadeIn 0.3s ease-out' }}>
            <GastosClient 
                categories={catRes.data || []}
                subcategories={subRes.data || []}
                initialExpenses={expenses}
            />
        </main>
    );
}
