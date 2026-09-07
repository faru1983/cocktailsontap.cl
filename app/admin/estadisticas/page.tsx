import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import StatsClient from './StatsClient';
import {
    getCurrentMonthKey,
    getMonthBounds,
    getMonthLabel,
    getYearBounds,
    shiftMonthKey,
} from '@/lib/adminStats';
import {
    buildOperationsPayload,
    buildStatsBundleForPeriod,
    type LaneFilter,
    type RawQuoteRow,
} from '@/lib/adminStatsServer';

export const metadata: Metadata = {
    title: 'Estadisticas - Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ month?: string; tab?: string; lane?: string }>;
type RawExpense = {
    id: string;
    amount: number;
    expense_date: string;
    expense_categories?: { name: string } | { name: string }[] | null;
    expense_subcategories?: { name: string } | { name: string }[] | null;
};

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const LANES: LaneFilter[] = ['all', 'event', 'direct'];

function getRelationName(
    relation: RawExpense['expense_categories'] | RawExpense['expense_subcategories'],
    fallback: string
) {
    if (Array.isArray(relation)) return relation[0]?.name || fallback;
    return relation?.name || fallback;
}

function periodRanges(selectedMonth: string, tab: string) {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (tab === 'anual') {
        const { startDate, endDate } = getYearBounds(year);
        const prev = getYearBounds(year - 1);
        return { startDate, endDate, prevStart: prev.startDate, prevEnd: prev.endDate, yoyStart: prev.startDate, yoyEnd: prev.endDate };
    }
    const { startDate, endDate } = getMonthBounds(selectedMonth);
    const prevKey = shiftMonthKey(selectedMonth, -1);
    const prevBounds = getMonthBounds(prevKey);
    const yoyKey = `${year - 1}-${String(month).padStart(2, '0')}`;
    const yoyBounds = getMonthBounds(yoyKey);
    return {
        startDate,
        endDate,
        prevStart: prevBounds.startDate,
        prevEnd: prevBounds.endDate,
        yoyStart: yoyBounds.startDate,
        yoyEnd: yoyBounds.endDate,
    };
}

export default async function EstadisticasPage({ searchParams }: { searchParams: SearchParams }) {
    const db = createServerClient();
    const rawParams = await searchParams;
    const currentMonth = getCurrentMonthKey();
    const selectedMonth = rawParams.month && MONTH_KEY_RE.test(rawParams.month) ? rawParams.month : currentMonth;
    const tab = rawParams.tab === 'anual' || rawParams.tab === 'operaciones' ? rawParams.tab : 'mensual';
    const initialLane = LANES.includes(rawParams.lane as LaneFilter) ? (rawParams.lane as LaneFilter) : 'all';

    const [year] = selectedMonth.split('-').map(Number);
    const fetchStart = `${year - 2}-01-01`;
    const fetchEnd = getYearBounds(year).endDate;

    const [quotesRes, itemsRes, expensesRes] = await Promise.all([
        db
            .from('quotes')
            .select(
                'id, client_id, status, total_price, event_date, created_at, client_name, client_lastname, comuna_name, comuna_other, dispenser, service_type'
            )
            .gte('event_date', fetchStart)
            .lte('event_date', fetchEnd),
        db.from('quote_items').select('quote_id, product_name, quantity, offer_price_at_time, size'),
        db
            .from('expenses')
            .select('id, amount, expense_date, expense_categories(name), expense_subcategories(name)')
            .gte('expense_date', fetchStart),
    ]);

    const quotes = (quotesRes.data || []) as RawQuoteRow[];
    const quoteItems = itemsRes.data || [];
    const expenses = ((expensesRes.data || []) as RawExpense[]).map((e) => ({
        ...e,
        category_name: getRelationName(e.expense_categories, 'Otro'),
        subcategory_name: getRelationName(e.expense_subcategories, 'General'),
    }));

    const ranges = periodRanges(selectedMonth, tab);
    const mode = tab === 'anual' ? 'annual' : 'monthly';

    const bundles = {
        all: buildStatsBundleForPeriod(
            quotes,
            expenses,
            quoteItems,
            ranges.startDate,
            ranges.endDate,
            ranges.prevStart,
            ranges.prevEnd,
            ranges.yoyStart,
            ranges.yoyEnd,
            'all',
            mode === 'annual' ? 'annual' : 'weekly'
        ),
        event: buildStatsBundleForPeriod(
            quotes,
            expenses,
            quoteItems,
            ranges.startDate,
            ranges.endDate,
            ranges.prevStart,
            ranges.prevEnd,
            ranges.yoyStart,
            ranges.yoyEnd,
            'event',
            mode === 'annual' ? 'annual' : 'weekly'
        ),
        direct: buildStatsBundleForPeriod(
            quotes,
            expenses,
            quoteItems,
            ranges.startDate,
            ranges.endDate,
            ranges.prevStart,
            ranges.prevEnd,
            ranges.yoyStart,
            ranges.yoyEnd,
            'direct',
            mode === 'annual' ? 'annual' : 'weekly'
        ),
    };

    const laneComparison = {
        event: bundles.all.metrics.eventRevenue,
        direct: bundles.all.metrics.directRevenue,
        eventCount: bundles.all.metrics.eventCount,
        directCount: bundles.all.metrics.directCount,
        yoyEvent: bundles.all.yoyMetrics.eventRevenue,
        yoyDirect: bundles.all.yoyMetrics.directRevenue,
    };

    const operations = buildOperationsPayload(quotes, quoteItems);

    return (
        <main className="p-0 animate-fade-in">
            <StatsClient
                bundles={bundles}
                laneComparison={laneComparison}
                operations={operations}
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
                monthLabel={getMonthLabel(selectedMonth)}
                previousMonth={shiftMonthKey(selectedMonth, -1)}
                nextMonth={shiftMonthKey(selectedMonth, 1)}
                initialTab={tab}
                initialLane={initialLane}
                lastYear={year - 1}
            />
        </main>
    );
}
