import { isDirectSaleQuote } from '@/lib/directSaleFulfillment';

export type LaneFilter = 'all' | 'event' | 'direct';

export type LaneSplit = {
    event: number;
    direct: number;
    eventCount: number;
    directCount: number;
    total: number;
    count: number;
};

export type TrendPoint = {
    key: string;
    label: string;
    event: number;
    direct: number;
    revenue: number;
    expenses: number;
    prevRevenue: number;
};

export type PeriodMetrics = {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    ticketAvg: number;
    orderCount: number;
    eventRevenue: number;
    directRevenue: number;
    eventCount: number;
    directCount: number;
};

export type QuoteLaneRow = {
    total_price: number | string;
    service_type?: string | null;
    dispenser?: string | null;
    event_date?: string;
    status?: string;
};

export type ExpenseRow = {
    amount: number | string;
    expense_date: string;
};

export const REVENUE_STATUSES = ['confirmed', 'completed'] as const;
export const ACTIVE_STATUSES = ['confirmed', 'in_delivery', 'completed'] as const;

export const MONTH_OPTIONS = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
];

export const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export const pctDelta = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : 0;

export const formatPctDelta = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export function santiagoDateParts(d = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    return {
        year: Number(parts.find((p) => p.type === 'year')?.value),
        month: Number(parts.find((p) => p.type === 'month')?.value),
        day: Number(parts.find((p) => p.type === 'day')?.value),
    };
}

export function ymd(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function lastDayOfMonth(year: number, month: number) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthName(year: number, month: number) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-CL', {
        month: 'long',
        timeZone: 'UTC',
    });
}

export function shiftMonthKey(monthKey: string, offset: number) {
    const [year, month] = monthKey.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthKey() {
    const { year, month } = santiagoDateParts();
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function getMonthBounds(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    return {
        startDate: `${monthKey}-01`,
        endDate: ymd(year, month, lastDayOfMonth(year, month)),
    };
}

export function getYearBounds(year: number) {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export function getMonthLabel(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    return monthName(year, month) + ` ${year}`;
}

export function splitByLane(rows: QuoteLaneRow[]): LaneSplit {
    let event = 0;
    let direct = 0;
    let eventCount = 0;
    let directCount = 0;
    for (const q of rows) {
        const amount = Number(q.total_price) || 0;
        if (isDirectSaleQuote(q)) {
            direct += amount;
            directCount += 1;
        } else {
            event += amount;
            eventCount += 1;
        }
    }
    return { event, direct, eventCount, directCount, total: event + direct, count: eventCount + directCount };
}

export function filterQuotesByLane<T extends QuoteLaneRow>(rows: T[], lane: LaneFilter): T[] {
    if (lane === 'all') return rows;
    if (lane === 'direct') return rows.filter((q) => isDirectSaleQuote(q));
    return rows.filter((q) => !isDirectSaleQuote(q));
}

export function sumExpenses(rows: ExpenseRow[]) {
    return rows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function buildPeriodMetrics(quotes: QuoteLaneRow[], expenses: ExpenseRow[]): PeriodMetrics {
    const split = splitByLane(quotes);
    const revenue = split.total;
    const expenseTotal = sumExpenses(expenses);
    const profit = revenue - expenseTotal;
    return {
        revenue,
        expenses: expenseTotal,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        ticketAvg: split.count > 0 ? revenue / split.count : 0,
        orderCount: split.count,
        eventRevenue: split.event,
        directRevenue: split.direct,
        eventCount: split.eventCount,
        directCount: split.directCount,
    };
}

export function buildMonthlyTrendSeries(
    quotes: QuoteLaneRow[],
    expenses: ExpenseRow[],
    prevQuotes: QuoteLaneRow[],
    prevExpenses: ExpenseRow[],
    year: number
): TrendPoint[] {
    const monthMap: Record<string, TrendPoint> = {};
    MONTH_OPTIONS.forEach((m) => {
        monthMap[m.value] = {
            key: m.value,
            label: m.label.substring(0, 3),
            event: 0,
            direct: 0,
            revenue: 0,
            expenses: 0,
            prevRevenue: 0,
        };
    });

    quotes.forEach((q) => {
        const month = q.event_date?.split('-')[1];
        if (!month || !monthMap[month]) return;
        const amount = Number(q.total_price) || 0;
        monthMap[month].revenue += amount;
        if (isDirectSaleQuote(q)) monthMap[month].direct += amount;
        else monthMap[month].event += amount;
    });

    expenses.forEach((e) => {
        const month = e.expense_date.split('-')[1];
        if (monthMap[month]) monthMap[month].expenses += Number(e.amount) || 0;
    });

    prevQuotes.forEach((q) => {
        const month = q.event_date?.split('-')[1];
        if (month && monthMap[month]) monthMap[month].prevRevenue += Number(q.total_price) || 0;
    });

    prevExpenses.forEach((e) => {
        const month = e.expense_date.split('-')[1];
        if (monthMap[month]) {
            // prev expenses tracked separately if needed; prevRevenue line only for YoY revenue
        }
    });

    return MONTH_OPTIONS.map((m) => monthMap[m.value]);
}

export function buildWeeklyTrendSeries(
    quotes: QuoteLaneRow[],
    expenses: ExpenseRow[],
    prevQuotes: QuoteLaneRow[]
): TrendPoint[] {
    const weekMap: Record<string, TrendPoint> = {};
    const ensure = (key: string, label: string) => {
        if (!weekMap[key]) {
            weekMap[key] = { key, label, event: 0, direct: 0, revenue: 0, expenses: 0, prevRevenue: 0 };
        }
        return weekMap[key];
    };

    quotes.forEach((q) => {
        if (!q.event_date) return;
        const day = Number(q.event_date.split('-')[2]);
        const bucket = Math.min(Math.floor((day - 1) / 7) + 1, 5);
        const key = `S${bucket}`;
        const point = ensure(key, `Sem ${bucket}`);
        const amount = Number(q.total_price) || 0;
        point.revenue += amount;
        if (isDirectSaleQuote(q)) point.direct += amount;
        else point.event += amount;
    });

    expenses.forEach((e) => {
        const day = Number(e.expense_date.split('-')[2]);
        const bucket = Math.min(Math.floor((day - 1) / 7) + 1, 5);
        const key = `S${bucket}`;
        ensure(key, `Sem ${bucket}`).expenses += Number(e.amount) || 0;
    });

    prevQuotes.forEach((q) => {
        if (!q.event_date) return;
        const day = Number(q.event_date.split('-')[2]);
        const bucket = Math.min(Math.floor((day - 1) / 7) + 1, 5);
        const key = `S${bucket}`;
        ensure(key, `Sem ${bucket}`).prevRevenue += Number(q.total_price) || 0;
    });

    return ['S1', 'S2', 'S3', 'S4', 'S5']
        .filter((key) => weekMap[key])
        .map((key) => weekMap[key]);
}

export function buildRollingMonthlySeries(
    quotes: QuoteLaneRow[],
    expenses: ExpenseRow[],
    prevQuotes: QuoteLaneRow[],
    anchorYear: number,
    anchorMonth: number,
    count = 12
): TrendPoint[] {
    const points: TrendPoint[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(anchorYear, anchorMonth - 1 - i, 1));
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const monthKey = `${y}-${String(m).padStart(2, '0')}`;
        const { startDate, endDate } = getMonthBounds(monthKey);
        const prevMonthKey = `${y - 1}-${String(m).padStart(2, '0')}`;
        const prevBounds = getMonthBounds(prevMonthKey);

        const monthQuotes = quotes.filter((q) => q.event_date && q.event_date >= startDate && q.event_date <= endDate);
        const monthExpenses = expenses.filter((e) => e.expense_date >= startDate && e.expense_date <= endDate);
        const prevMonthQuotes = prevQuotes.filter(
            (q) => q.event_date && q.event_date >= prevBounds.startDate && q.event_date <= prevBounds.endDate
        );
        const split = splitByLane(monthQuotes);

        points.push({
            key: monthKey,
            label: monthName(y, m).substring(0, 3),
            event: split.event,
            direct: split.direct,
            revenue: split.total,
            expenses: sumExpenses(monthExpenses),
            prevRevenue: splitByLane(prevMonthQuotes).total,
        });
    }
    return points;
}

export function formatListDate(eventDate: string) {
    return new Date(eventDate + 'T12:00:00')
        .toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
        .replace(/ /g, '-')
        .replace('.', '');
}
