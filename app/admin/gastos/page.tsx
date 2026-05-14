import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import GastosClient from './GastosClient';

export const metadata: Metadata = {
    title: 'Gastos – Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ month?: string; tab?: string }>;
type NamedRelation = { name: string } | { name: string }[] | null | undefined;
type ExpenseRow = {
    id: string;
    amount: number | string;
    expense_date: string;
    payment_method: string;
    notes: string | null;
    category_id: string;
    subcategory_id: string;
    expense_categories?: NamedRelation;
    expense_subcategories?: NamedRelation;
};
type MonthlyStatRow = {
    amount: number | string;
    expense_categories?: NamedRelation;
};
type RevenueRow = {
    total_price: number | string;
};

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonthKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    return `${year}-${month}`;
}

function getMonthBounds(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    const startDate = `${monthKey}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    return { startDate, endDate };
}

function getMonthLabel(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-CL', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

function shiftMonth(monthKey: string, offset: number) {
    const [year, month] = monthKey.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getRelationName(relation: NamedRelation, fallback: string) {
    if (Array.isArray(relation)) return relation[0]?.name || fallback;
    return relation?.name || fallback;
}

export default async function GastosPage({ searchParams }: { searchParams: SearchParams }) {
    const db = createServerClient();
    const rawParams = await searchParams;
    const currentMonth = getCurrentMonthKey();
    const selectedMonth = rawParams.month && MONTH_KEY_RE.test(rawParams.month) ? rawParams.month : currentMonth;
    const { startDate, endDate } = getMonthBounds(selectedMonth);

    // Categories and payment methods include inactive records for admin management.
    // Expenses are scoped to one month to keep Supabase payloads small.
    const [catRes, subRes, expRes, payRes, statsRes, revenueRes] = await Promise.all([
        db.from('expense_categories').select('id, name, is_active').order('name'),
        db.from('expense_subcategories').select('id, category_id, name, is_active').order('name'),
        db.from('expenses').select(`
            id,
            amount,
            expense_date,
            payment_method,
            notes,
            category_id,
            subcategory_id,
            expense_categories (name),
            expense_subcategories (name)
        `).gte('expense_date', startDate).lte('expense_date', endDate).order('expense_date', { ascending: false }),
        db.from('expense_payment_methods').select('id, name, is_active').order('name'),
        db.from('expenses').select('amount, expense_categories (name)').gte('expense_date', startDate).lte('expense_date', endDate),
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startDate).lte('event_date', endDate)
    ]);

    // Formatting for client
    const expenses = ((expRes.data || []) as ExpenseRow[]).map(exp => ({
        id: exp.id,
        amount: Number(exp.amount),
        expense_date: exp.expense_date,
        payment_method: exp.payment_method,
        notes: exp.notes || '',
        category_name: getRelationName(exp.expense_categories, 'Desconocida'),
        subcategory_name: getRelationName(exp.expense_subcategories, 'General'),
        category_id: exp.category_id,
        subcategory_id: exp.subcategory_id
    }));
    const statsRows = ((statsRes.data || []) as MonthlyStatRow[]);
    const monthlyTotal = statsRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const monthlyCount = statsRows.length;
    const monthlyAverage = monthlyCount ? Math.round(monthlyTotal / monthlyCount) : 0;
    const monthlyRevenue = ((revenueRes.data || []) as RevenueRow[]).reduce((sum, row) => sum + Number(row.total_price), 0);
    const monthlyProfit = monthlyRevenue - monthlyTotal;
    const categoryTotalsMap = statsRows.reduce<Record<string, number>>((acc, row) => {
        const name = getRelationName(row.expense_categories, 'Desconocida');
        acc[name] = (acc[name] || 0) + Number(row.amount);
        return acc;
    }, {});
    const categoryTotals = Object.entries(categoryTotalsMap).sort((a, b) => b[1] - a[1]);
    const topCategory = categoryTotals[0];

    return (
        <main className="p-0 animate-fade-in">
            <GastosClient 
                categories={catRes.data || []}
                subcategories={subRes.data || []}
                initialExpenses={expenses}
                paymentMethods={payRes.data || []}
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
                monthLabel={getMonthLabel(selectedMonth)}
                previousMonth={shiftMonth(selectedMonth, -1)}
                nextMonth={shiftMonth(selectedMonth, 1)}
                monthlyStats={{
                    total: monthlyTotal,
                    count: monthlyCount,
                    average: monthlyAverage,
                    revenue: monthlyRevenue,
                    profit: monthlyProfit,
                    topCategoryName: topCategory?.[0] || 'Sin datos',
                    topCategoryAmount: topCategory?.[1] || 0,
                    categoryTotals
                }}
            />
        </main>
    );
}
