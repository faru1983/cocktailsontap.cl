import { createServerClient } from '@/lib/supabaseServer';

export interface QuickExpenseCategory {
    id: string;
    name: string;
}

export interface QuickExpenseSubcategory {
    id: string;
    category_id: string;
    name: string;
}

export interface QuickExpensePaymentMethod {
    id: string;
    name: string;
}

export interface QuickExpensePreset {
    key: string;
    category_id: string;
    category_name: string;
    subcategory_id: string;
    subcategory_name: string;
    payment_method: string;
    count: number;
}

export interface QuickExpenseMeta {
    categories: QuickExpenseCategory[];
    subcategories: QuickExpenseSubcategory[];
    paymentMethods: QuickExpensePaymentMethod[];
    presets: QuickExpensePreset[];
}

/** Obtiene categorías, subcategorías, medios de pago activos y los 4 combos más frecuentes para Gasto Rápido móvil. */
export async function getQuickExpenseMeta(): Promise<QuickExpenseMeta> {
    const db = createServerClient();

    const [catRes, subRes, payRes, recentRes] = await Promise.all([
        db.from('expense_categories').select('id, name').eq('is_active', true).order('name'),
        db.from('expense_subcategories').select('id, category_id, name').eq('is_active', true).order('name'),
        db.from('expense_payment_methods').select('id, name').eq('is_active', true).order('name'),
        db
            .from('expenses')
            .select('category_id, subcategory_id, payment_method')
            .order('created_at', { ascending: false })
            .limit(60),
    ]);

    const categories: QuickExpenseCategory[] = catRes.data || [];
    const subcategories: QuickExpenseSubcategory[] = subRes.data || [];
    const paymentMethods: QuickExpensePaymentMethod[] = payRes.data || [];

    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const subMap = new Map(subcategories.map((s) => [s.id, s]));
    const activePaymentNames = new Set(paymentMethods.map((p) => p.name));

    const freq = new Map<string, QuickExpensePreset>();
    for (const row of recentRes.data || []) {
        const catName = catMap.get(row.category_id);
        const sub = subMap.get(row.subcategory_id);
        if (!catName || !sub || sub.category_id !== row.category_id) continue;
        if (!row.payment_method || (activePaymentNames.size > 0 && !activePaymentNames.has(row.payment_method))) {
            continue;
        }
        const key = `${row.category_id}:${row.subcategory_id}:${row.payment_method}`;
        const existing = freq.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            freq.set(key, {
                key,
                category_id: row.category_id,
                category_name: catName,
                subcategory_id: row.subcategory_id,
                subcategory_name: sub.name,
                payment_method: row.payment_method,
                count: 1,
            });
        }
    }

    const presets = Array.from(freq.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

    return {
        categories,
        subcategories,
        paymentMethods,
        presets,
    };
}
