import { createServerClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminAuth';
import { getMonthBounds, shiftMonthKey, santiagoDateParts } from '@/lib/adminStats';
import { buildDashboardPayload } from '@/lib/adminStatsServer';
import { getEventOccupancyByDateRange } from '@/lib/services/eventCapacityService';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

const QUOTE_SELECT =
    'id, client_id, status, total_price, event_date, client_name, client_lastname, comuna_name, comuna_other, service_type, dispenser, payments, created_at';

async function getDashboardData() {
    const db = createServerClient();
    const { year, month, day } = santiagoDateParts();
    const todayYmd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const nextMonthKey = shiftMonthKey(monthKey, 1);
    const { endDate: nextEnd } = getMonthBounds(nextMonthKey);
    const fetchStart = `${year - 2}-01-01`;

    const [quotesRes, expensesRes, recentRes, capacityData] = await Promise.all([
        db.from('quotes').select(QUOTE_SELECT).gte('event_date', fetchStart).lte('event_date', nextEnd),
        db.from('expenses').select('amount, expense_date').gte('expense_date', fetchStart),
        db
            .from('quotes')
            .select('id, status, client_name, client_lastname, event_date, total_price, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        getEventOccupancyByDateRange(todayYmd, nextEnd),
    ]);

    const allQuotes = (quotesRes.data || []).map((q) => ({
        ...q,
        payments: Array.isArray(q.payments) ? q.payments : [],
    }));

    const payload = buildDashboardPayload(allQuotes, expensesRes.data || []);

    const upcomingCapacityDays = Object.values(capacityData.days).sort((a, b) => a.date.localeCompare(b.date));

    return {
        ...payload,
        recentQuotes: recentRes.data || [],
        capacityConfig: capacityData.config,
        upcomingCapacityDays,
    };
}

export default async function AdminDashboardPage() {
    await requireAdmin();
    const data = await getDashboardData();

    return (
        <DashboardClient
            monthLabel={data.monthLabel}
            nextMonthLabel={data.nextMonthLabel}
            lastYear={data.lastYear}
            kpis={data.kpis}
            trendSeries={data.trendSeries}
            upcomingEvents={data.upcomingEvents}
            upcomingDirectSales={data.upcomingDirectSales}
            nextMonthEvents={data.nextMonthEvents}
            nextMonthDirectSales={data.nextMonthDirectSales}
            recentQuotes={data.recentQuotes}
            capacityConfig={data.capacityConfig}
            upcomingCapacityDays={data.upcomingCapacityDays}
        />
    );
}
