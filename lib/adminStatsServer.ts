import {
    ACTIVE_STATUSES,
    REVENUE_STATUSES,
    buildPeriodMetrics,
    buildRollingMonthlySeries,
    buildMonthlyTrendSeries,
    buildWeeklyTrendSeries,
    filterQuotesByLane,
    getMonthBounds,
    getYearBounds,
    monthName,
    pctDelta,
    shiftMonthKey,
    santiagoDateParts,
    splitByLane,
    ymd,
    lastDayOfMonth,
    type QuoteLaneRow,
    type ExpenseRow,
} from '@/lib/adminStats';
import { isDirectSaleQuote } from '@/lib/directSaleFulfillment';

export type RawQuoteRow = QuoteLaneRow & {
    id: string;
    client_id?: string | null;
    status: string;
    event_date: string;
    client_name: string;
    client_lastname: string | null;
    comuna_name: string | null;
    comuna_other: string | null;
    payments?: { amount: number }[] | null;
    service_type?: string | null;
    dispenser?: string | null;
};

export type RawExpenseRow = ExpenseRow & {
    category_name?: string;
};

function inRange(date: string, start: string, end: string) {
    return date >= start && date <= end;
}

function filterRevenueQuotes(rows: RawQuoteRow[], start: string, end: string) {
    return rows.filter(
        (q) =>
            REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number]) &&
            inRange(q.event_date, start, end)
    );
}

export function buildDashboardPayload(
    allQuotes: RawQuoteRow[],
    allExpenses: RawExpenseRow[],
    anchor = santiagoDateParts()
) {
    const { year, month, day } = anchor;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const { startDate: monthStart, endDate: monthEnd } = getMonthBounds(monthKey);
    const today = ymd(year, month, day);

    const prevMonthKey = shiftMonthKey(monthKey, -1);
    const { startDate: prevMonthStart, endDate: prevMonthEnd } = getMonthBounds(prevMonthKey);

    const lastYearMonthKey = `${year - 1}-${String(month).padStart(2, '0')}`;
    const { startDate: lyMonthStart, endDate: lyMonthEnd } = getMonthBounds(lastYearMonthKey);

    const { startDate: ytdStart } = getYearBounds(year);
    const ytdEnd = today;
    const lyYtdStart = `${year - 1}-01-01`;
    const lyYtdEnd = ymd(year - 1, month, Math.min(day, lastDayOfMonth(year - 1, month)));

    const nextMonthKey = shiftMonthKey(monthKey, 1);
    const { startDate: nextMonthStart, endDate: nextMonthEnd } = getMonthBounds(nextMonthKey);
    const [nextYear, nextMonthNum] = nextMonthKey.split('-').map(Number);

    const revenueQuotes = allQuotes.filter((q) =>
        REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number])
    );

    const monthQuotes = filterRevenueQuotes(allQuotes, monthStart, monthEnd);
    const prevMonthQuotes = filterRevenueQuotes(allQuotes, prevMonthStart, prevMonthEnd);
    const lyMonthQuotes = filterRevenueQuotes(allQuotes, lyMonthStart, lyMonthEnd);
    const ytdQuotes = filterRevenueQuotes(allQuotes, ytdStart, ytdEnd);
    const lyYtdQuotes = filterRevenueQuotes(allQuotes, lyYtdStart, lyYtdEnd);

    const monthExpenses = allExpenses.filter((e) => inRange(e.expense_date, monthStart, monthEnd));
    const lyMonthExpenses = allExpenses.filter((e) => inRange(e.expense_date, lyMonthStart, lyMonthEnd));

    const monthMetrics = buildPeriodMetrics(monthQuotes, monthExpenses);
    const lyMonthMetrics = buildPeriodMetrics(lyMonthQuotes, lyMonthExpenses);
    const ytdSplit = splitByLane(ytdQuotes);
    const lyYtdSplit = splitByLane(lyYtdQuotes);

    const trendSeries = buildRollingMonthlySeries(revenueQuotes, allExpenses, revenueQuotes, year, month, 12);

    const activeThisMonth = allQuotes.filter(
        (q) =>
            ACTIVE_STATUSES.includes(q.status as (typeof ACTIVE_STATUSES)[number]) &&
            inRange(q.event_date, today, monthEnd)
    );
    const nextMonthActive = allQuotes.filter(
        (q) =>
            ACTIVE_STATUSES.includes(q.status as (typeof ACTIVE_STATUSES)[number]) &&
            inRange(q.event_date, nextMonthStart, nextMonthEnd)
    );

    const monthlyDrafts = allQuotes.filter(
        (q) => q.status === 'draft' && inRange(q.event_date, monthStart, monthEnd)
    );
    const projectedRevenue = monthlyDrafts.reduce((s, q) => s + (Number(q.total_price) || 0), 0);

    return {
        monthLabel: monthName(year, month),
        nextMonthLabel: monthName(nextYear, nextMonthNum),
        lastYear: year - 1,
        kpis: {
            monthlyRevenue: monthMetrics.revenue,
            monthlyEventRevenue: monthMetrics.eventRevenue,
            monthlyDirectRevenue: monthMetrics.directRevenue,
            monthlyEventCount: monthMetrics.eventCount,
            monthlyDirectCount: monthMetrics.directCount,
            monthlyExpenses: monthMetrics.expenses,
            monthlyProfit: monthMetrics.profit,
            monthlyMargin: monthMetrics.margin,
            monthlyOrderCount: monthMetrics.orderCount,
            prevMonthRevenue: buildPeriodMetrics(prevMonthQuotes, []).revenue,
            lastYearMonthlyRevenue: lyMonthMetrics.revenue,
            lastYearMonthlyExpenses: lyMonthMetrics.expenses,
            lastYearMonthlyProfit: lyMonthMetrics.profit,
            lastYearMonthlyEventRevenue: lyMonthMetrics.eventRevenue,
            lastYearMonthlyDirectRevenue: lyMonthMetrics.directRevenue,
            yoyRevenueDelta: pctDelta(monthMetrics.revenue, lyMonthMetrics.revenue),
            yoyEventDelta: pctDelta(monthMetrics.eventRevenue, lyMonthMetrics.eventRevenue),
            yoyDirectDelta: pctDelta(monthMetrics.directRevenue, lyMonthMetrics.directRevenue),
            yoyExpensesDelta: pctDelta(monthMetrics.expenses, lyMonthMetrics.expenses),
            yoyProfitDelta: pctDelta(monthMetrics.profit, lyMonthMetrics.profit),
            prevRevenueDelta: pctDelta(monthMetrics.revenue, buildPeriodMetrics(prevMonthQuotes, []).revenue),
            projectedRevenue,
            ytdEventRevenue: ytdSplit.event,
            ytdDirectRevenue: ytdSplit.direct,
            ytdEventCount: ytdSplit.eventCount,
            ytdDirectCount: ytdSplit.directCount,
            ytdRevenue: ytdSplit.total,
            ytdOrderCount: ytdSplit.count,
            ytdPrevRevenue: lyYtdSplit.total,
            ytdRevenueDelta: pctDelta(ytdSplit.total, lyYtdSplit.total),
            ytdEventPrev: lyYtdSplit.event,
            ytdDirectPrev: lyYtdSplit.direct,
            ytdEventDelta: pctDelta(ytdSplit.event, lyYtdSplit.event),
            ytdDirectDelta: pctDelta(ytdSplit.direct, lyYtdSplit.direct),
        },
        trendSeries,
        upcomingEvents: activeThisMonth.filter((q) => !isDirectSaleQuote(q)),
        upcomingDirectSales: activeThisMonth.filter((q) => isDirectSaleQuote(q)),
        nextMonthEvents: nextMonthActive.filter((q) => !isDirectSaleQuote(q)),
        nextMonthDirectSales: nextMonthActive.filter((q) => isDirectSaleQuote(q)),
    };
}

export type LaneFilter = 'all' | 'event' | 'direct';

export type StatsPeriodBundle = {
    metrics: ReturnType<typeof buildPeriodMetrics>;
    prevMetrics: ReturnType<typeof buildPeriodMetrics>;
    yoyMetrics: ReturnType<typeof buildPeriodMetrics>;
    trend: ReturnType<typeof buildWeeklyTrendSeries>;
    expenseCategories: { name: string; value: number }[];
    topProducts: { name: string; value: number; qty: number }[];
    topClients: { name: string; value: number; count: number }[];
    topComunas: { name: string; value: number }[];
    alerts: string[];
};

export function buildStatsBundleForPeriod(
    quotes: RawQuoteRow[],
    expenses: RawExpenseRow[],
    quoteItems: { quote_id: string; product_name: string; quantity: number; offer_price_at_time: number }[],
    start: string,
    end: string,
    prevStart: string,
    prevEnd: string,
    yoyStart: string,
    yoyEnd: string,
    lane: LaneFilter,
    mode: 'weekly' | 'annual'
): StatsPeriodBundle {
    const rev = (s: string, e: string) =>
        filterQuotesByLane(
            quotes.filter(
                (q) =>
                    REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number]) &&
                    inRange(q.event_date, s, e)
            ),
            lane
        );
    const exp = (s: string, e: string) => expenses.filter((x) => inRange(x.expense_date, s, e));

    const currentQuotes = rev(start, end);
    const prevQuotes = rev(prevStart, prevEnd);
    const yoyQuotes = rev(yoyStart, yoyEnd);
    const currentExpenses = exp(start, end);

    const metrics = buildPeriodMetrics(currentQuotes, currentExpenses);
    const prevMetrics = buildPeriodMetrics(prevQuotes, exp(prevStart, prevEnd));
    const yoyMetrics = buildPeriodMetrics(yoyQuotes, exp(yoyStart, yoyEnd));

    const trend =
        mode === 'weekly'
            ? buildWeeklyTrendSeries(currentQuotes, currentExpenses, yoyQuotes)
            : buildMonthlyTrendSeries(
                  filterQuotesByLane(
                      quotes.filter((q) => REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number])),
                      lane
                  ),
                  expenses.filter((e) => inRange(e.expense_date, start, end)),
                  filterQuotesByLane(
                      quotes.filter((q) => REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number])),
                      lane
                  ),
                  expenses.filter((e) => inRange(e.expense_date, yoyStart, yoyEnd)),
                  Number(start.slice(0, 4))
              );

    const ids = new Set(currentQuotes.map((q) => q.id));
    const items = quoteItems.filter((i) => ids.has(i.quote_id));

    const productMap: Record<string, { value: number; qty: number }> = {};
    items.forEach((i) => {
        if (!productMap[i.product_name]) productMap[i.product_name] = { value: 0, qty: 0 };
        productMap[i.product_name].value += i.offer_price_at_time * i.quantity;
        productMap[i.product_name].qty += i.quantity;
    });

    const clientMap: Record<string, { name: string; value: number; count: number }> = {};
    currentQuotes.forEach((q) => {
        const key = q.client_id || q.id;
        if (!clientMap[key]) {
            clientMap[key] = {
                name: `${q.client_name} ${q.client_lastname || ''}`.trim(),
                value: 0,
                count: 0,
            };
        }
        clientMap[key].value += Number(q.total_price) || 0;
        clientMap[key].count += 1;
    });

    const comunaMap: Record<string, number> = {};
    currentQuotes.forEach((q) => {
        const c = q.comuna_name === 'Otra' && q.comuna_other ? q.comuna_other : q.comuna_name || 'Desconocida';
        comunaMap[c] = (comunaMap[c] || 0) + 1;
    });

    const expenseCategories = Object.entries(
        currentExpenses.reduce<Record<string, number>>((acc, e) => {
            const cat = e.category_name || 'Otro';
            acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0);
            return acc;
        }, {})
    )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const costRatio = metrics.revenue > 0 ? (metrics.expenses / metrics.revenue) * 100 : 0;
    const alerts: string[] = [];
    if (metrics.margin < 25) alerts.push(`Margen bajo: ${metrics.margin.toFixed(1)}%`);
    if (costRatio > 65) alerts.push(`Costo sobre ingreso alto: ${costRatio.toFixed(1)}%`);
    if (expenseCategories[0] && metrics.expenses > 0) {
        const share = (expenseCategories[0].value / metrics.expenses) * 100;
        if (share > 45) alerts.push(`Concentración alta en ${expenseCategories[0].name} (${share.toFixed(1)}%)`);
    }

    return {
        metrics,
        prevMetrics,
        yoyMetrics,
        trend,
        expenseCategories,
        topProducts: Object.entries(productMap)
            .map(([name, v]) => ({ name, value: v.value, qty: v.qty }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10),
        topClients: Object.values(clientMap)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        topComunas: Object.entries(comunaMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        alerts,
    };
}

export function buildOperationsPayload(quotes: RawQuoteRow[], quoteItems: { quote_id: string; product_name: string; quantity: number; size: string }[]) {
    const confirmed = quotes.filter((q) =>
        REVENUE_STATUSES.includes(q.status as (typeof REVENUE_STATUSES)[number])
    );
    const ids = new Set(confirmed.map((q) => q.id));
    const items = quoteItems.filter((i) => ids.has(i.quote_id));

    let event = 0;
    let direct = 0;
    let muro = 0;
    let portatil = 0;
    const comunaMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};

    confirmed.forEach((q) => {
        if (isDirectSaleQuote(q)) direct++;
        else event++;
        if (q.dispenser === 'muro') muro++;
        else portatil++;
        const c = q.comuna_name === 'Otra' && q.comuna_other ? q.comuna_other : q.comuna_name || 'Desconocida';
        comunaMap[c] = (comunaMap[c] || 0) + 1;
    });

    items.forEach((i) => {
        if (i.size) sizeMap[i.size] = (sizeMap[i.size] || 0) + i.quantity;
    });

    return {
        service: { event, direct },
        dispenser: { muro, portatil },
        comunas: Object.entries(comunaMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        sizes: Object.entries(sizeMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0)),
    };
}
