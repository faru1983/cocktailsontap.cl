import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import StatsClient from './StatsClient';

export const metadata: Metadata = {
    title: 'Estadisticas - Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ month?: string }>;
type RawExpense = {
    id: string;
    amount: number;
    expense_date: string;
    expense_categories?: { name: string } | { name: string }[] | null;
    expense_subcategories?: { name: string } | { name: string }[] | null;
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

function getRelationName(relation: RawExpense['expense_categories'] | RawExpense['expense_subcategories'], fallback: string) {
    if (Array.isArray(relation)) return relation[0]?.name || fallback;
    return relation?.name || fallback;
}

export default async function EstadisticasPage({ searchParams }: { searchParams: SearchParams }) {
    const db = createServerClient();
    const rawParams = await searchParams;
    const currentMonth = getCurrentMonthKey();
    const selectedMonth = rawParams.month && MONTH_KEY_RE.test(rawParams.month) ? rawParams.month : currentMonth;

    const [quotesRes, itemsRes, expensesRes] = await Promise.all([
        db.from('quotes')
            .select('id, status, total_price, event_date, created_at, client_id, client_name, client_lastname, comuna_name, comuna_other'),
        db.from('quote_items')
            .select('quote_id, product_name, quantity, offer_price_at_time, size'),
        db.from('expenses')
            .select('id, amount, expense_date, expense_categories(name), expense_subcategories(name)')
    ]);

    const allQuotes = quotesRes.data || [];
    const allQuoteItems = itemsRes.data || [];
    const allExpenses = ((expensesRes.data || []) as RawExpense[]).map((e) => ({
        ...e,
        category_name: getRelationName(e.expense_categories, 'Otro'),
        subcategory_name: getRelationName(e.expense_subcategories, 'General')
    }));

    return (
        <main className="p-0 animate-fade-in">
            <StatsClient
                allQuotes={allQuotes}
                allQuoteItems={allQuoteItems}
                allExpenses={allExpenses}
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
                monthLabel={getMonthLabel(selectedMonth)}
                previousMonth={shiftMonth(selectedMonth, -1)}
                nextMonth={shiftMonth(selectedMonth, 1)}
            />
        </main>
    );
}
