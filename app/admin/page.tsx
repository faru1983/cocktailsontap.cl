import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import { DashboardRow } from './DashboardRow';
import { 
    CircleDollarSign, 
    Receipt, 
    Gem, 
    TrendingUp, 
    Award, 
    Sparkles, 
    ChevronRight,
    Search
} from 'lucide-react';

async function getDashboardData() {
    const db = createServerClient();
    const now = new Date();
    
    // 1. Date Calculations
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfMonthSQL = startOfMonth.toISOString().split('T')[0];
    const todaySQL = now.toISOString().split('T')[0];
    const endOfMonthSQL = endOfMonth.toISOString().split('T')[0];

    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const startOfNextMonthSQL = startOfNextMonth.toISOString().split('T')[0];
    const endOfNextMonthSQL = endOfNextMonth.toISOString().split('T')[0];

    const startOfYearSQL = `${now.getFullYear()}-01-01`;
    const endOfYearSQL = `${now.getFullYear()}-12-31`;
    const startOfLastYearSQL = `${now.getFullYear() - 1}-01-01`;
    const endOfLastYearSQL = `${now.getFullYear() - 1}-12-31`;

    // 2. Fetch Data in Parallel
    const [
        monthlyResults, 
        monthlyDrafts, 
        allClients, 
        recentQuotes, 
        upcomingEvents, 
        historicalRevData, 
        yearlyResults, 
        lastYearResults,
        topQuoteItems,
        nextMonthResults,
        monthlyExpensesRes
    ] = await Promise.all([
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfMonthSQL).lte('event_date', endOfMonthSQL),
        db.from('quotes').select('total_price').eq('status', 'draft').gte('event_date', startOfMonthSQL).lte('event_date', endOfMonthSQL),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes').select('id, token, status, client_name, client_lastname, event_date, total_price, created_at').order('created_at', { ascending: false }).limit(5),
        db.from('quotes').select('id, client_name, client_lastname, event_date, start_time, total_price, guests, status, comuna_name, comuna_other').in('status', ['confirmed', 'completed']).gte('event_date', todaySQL).lte('event_date', endOfMonthSQL).order('event_date', { ascending: true }).limit(8),
        db.from('quotes').select('total_price, client_id, client_name, client_lastname, comuna_name, comuna_other').in('status', ['confirmed', 'completed']),
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfYearSQL).lte('event_date', endOfYearSQL),
        db.from('quotes').select('total_price').in('status', ['confirmed', 'completed']).gte('event_date', startOfLastYearSQL).lte('event_date', endOfLastYearSQL),
        db.from('quote_items').select('product_name, quantity').order('quantity', { ascending: false }).limit(150),
        db.from('quotes').select('id, client_name, client_lastname, event_date, start_time, total_price, guests, status, comuna_name, comuna_other').in('status', ['confirmed', 'completed']).gte('event_date', startOfNextMonthSQL).lte('event_date', endOfNextMonthSQL).order('event_date', { ascending: true }).limit(8),
        db.from('expenses').select('amount').gte('expense_date', startOfMonthSQL).lte('expense_date', endOfMonthSQL)
    ]);

    const monthlyRevenue = (monthlyResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const monthlyExpenses = (monthlyExpensesRes.data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const monthlyProfit = monthlyRevenue - monthlyExpenses;

    const projectedRevenue = (monthlyDrafts.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const historicalRevenue = (historicalRevData.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const yearlyRevenue = (yearlyResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);
    const lastYearRevenue = (lastYearResults.data || []).reduce((s: number, q: any) => s + Number(q.total_price), 0);

    const clientStats: Record<string, { id: string; name: string; total: number; count: number }> = {};
    const comunaStats: Record<string, number> = {};
    (historicalRevData.data || []).forEach((q: any) => {
        const key = q.client_id || q.client_name;
        if (!clientStats[key]) clientStats[key] = { id: q.client_id, name: `${q.client_name} ${q.client_lastname || ''}`, total: 0, count: 0 };
        clientStats[key].total += Number(q.total_price);
        clientStats[key].count += 1;
        const com = q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name;
        if (com) comunaStats[com] = (comunaStats[com] || 0) + 1;
    });
    
    const productStats: Record<string, number> = {};
    (topQuoteItems.data || []).forEach((item: any) => {
        productStats[item.product_name] = (productStats[item.product_name] || 0) + (item.quantity || 0);
    });

    return {
        monthlyRevenue,
        monthlyExpenses,
        monthlyProfit,
        projectedRevenue,
        historicalRevenue,
        yearlyRevenue,
        lastYearRevenue,
        confirmedCount: monthlyResults.data?.length || 0,
        totalHistoricalCount: historicalRevData.data?.length || 0,
        recentQuotes: recentQuotes.data || [],
        upcomingEvents: upcomingEvents.data || [],
        nextMonthEvents: nextMonthResults.data || [],
        topClients: Object.values(clientStats).sort((a, b) => b.total - a.total).slice(0, 5),
        topProducts: Object.entries(productStats).sort((a, b) => b[1] - a[1]).slice(0, 5),
        currentMonthName: now.toLocaleDateString('es-CL', { month: 'long' }),
        nextMonthName: startOfNextMonth.toLocaleDateString('es-CL', { month: 'long' }),
        currentYear: now.getFullYear()
    };
}

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    confirmed: { label: 'Confirmada', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    completed: { label: 'Completada', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    cancelled: { label: 'Cancelada', color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

export default async function AdminDashboardPage() {
    const data = await getDashboardData();

    const kpis = [
        { label: 'Ingresos del Mes',       value: formatCLP(data.monthlyRevenue),   icon: <CircleDollarSign size={20} />, sub: `${data.confirmedCount} confirmadas`, color: 'text-emerald-400', border: 'border-emerald-500/20' },
        { label: 'Gastos del Mes',         value: formatCLP(data.monthlyExpenses),  icon: <Receipt size={20} />, sub: 'Egresos registrados',                     color: 'text-rose-400', border: 'border-rose-500/20' },
        { label: 'Utilidad Real',          value: formatCLP(data.monthlyProfit),    icon: <Gem size={20} />, sub: 'Ingresos - Egresos',                      color: 'text-sky-400', border: 'border-sky-500/20' },
        { label: `Ventas ${data.currentYear}`, value: formatCLP(data.yearlyRevenue), icon: <TrendingUp size={20} />, sub: 'Eventos del año actual', color: 'text-blue-400', border: 'border-blue-500/20' },
        { label: 'Ingresos Históricos',     value: formatCLP(data.historicalRevenue), icon: <Award size={20} />, sub: `${data.totalHistoricalCount} ventas`, color: 'text-amber-400', border: 'border-amber-500/20' },
        { label: 'Proyección',              value: formatCLP(data.projectedRevenue), icon: <Sparkles size={20} />, sub: 'Potencial borradores',             color: 'text-pink-400', border: 'border-pink-500/20' },
    ];

    return (
        <div className="pb-16 px-4 md:px-0">
            {/* Header */}
            <div className="mb-8 p-1">
                <h1 className="text-white text-3xl font-black mb-1">Bienvenido</h1>
                <p className="text-slate-500 text-sm capitalize">
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 mb-10 md:grid-cols-3 md:gap-5">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className={`bg-[#1e2433] border-t-2 ${kpi.border} border-x border-b border-white/5 rounded-2xl p-5 transition-all hover:border-[#E2A049]/30 shadow-xl shadow-black/20`}>
                        <div className={`mb-3 ${kpi.color}`}>{kpi.icon}</div>
                        <div className="text-2xl font-black text-white leading-tight mb-1">{kpi.value}</div>
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{kpi.label}</div>
                        <div className="text-slate-600 text-[10px] mt-1 italic">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* UPCOMING & NEXT MONTH */}
                <div className="space-y-10">
                    <section>
                         <div className="flex items-center gap-3 mb-5 px-1">
                            <div className="bg-emerald-500 w-1 h-5 rounded-full" />
                            <h2 className="text-white text-lg font-extrabold capitalize">Eventos de {data.currentMonthName}</h2>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                             <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                {data.upcomingEvents.length === 0 ? (
                                    <div className="p-10 text-center text-slate-500 text-sm italic">Sin eventos próximos este mes.</div>
                                ) : (
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            {data.upcomingEvents.map((q: any) => (
                                                <DashboardRow key={q.id} href={`/admin/quotes/${q.id}`} className="group hover:bg-white/[0.02]">
                                                    <td className="py-4 px-6 text-emerald-400 font-bold text-xs">{new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</td>
                                                    <td className="py-4 px-6 text-slate-200 text-xs font-semibold">{q.client_name} {q.client_lastname}</td>
                                                    <td className="py-4 px-6 text-slate-500 text-[11px]">{q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name}</td>
                                                </DashboardRow>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-5 px-1">
                            <div className="bg-sky-500 w-1 h-5 rounded-full" />
                            <h2 className="text-white text-lg font-extrabold capitalize">Eventos de {data.nextMonthName}</h2>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                {data.nextMonthEvents.length === 0 ? (
                                    <div className="p-10 text-center text-slate-500 text-sm italic">Sin reservas aún para {data.nextMonthName}.</div>
                                ) : (
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            {data.nextMonthEvents.map((q: any) => (
                                                <DashboardRow key={q.id} href={`/admin/quotes/${q.id}`} className="group hover:bg-white/[0.02]">
                                                    <td className="py-4 px-6 text-sky-400 font-bold text-xs">{new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</td>
                                                    <td className="py-4 px-6 text-slate-200 text-xs font-semibold">{q.client_name} {q.client_lastname}</td>
                                                    <td className="py-4 px-6 text-slate-500 text-[11px]">{q.comuna_name === 'Otra' ? q.comuna_other : q.comuna_name}</td>
                                                </DashboardRow>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Últimas Cotizaciones */}
                <div className="space-y-8">
                    <section>
                        <div className="flex items-center gap-3 mb-5 px-1">
                            <div className="bg-purple-500 w-1 h-5 rounded-full" />
                            <h2 className="text-white text-lg font-extrabold">Últimas Cotizaciones</h2>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                            {data.recentQuotes.map((q: any) => (
                                <Link key={q.id} href={`/admin/quotes#${q.id}`} className="flex items-center justify-between p-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors no-underline group">
                                    <div className="flex flex-col">
                                        <span className="text-slate-200 text-xs font-bold w-40 truncate">{q.client_name} {q.client_lastname}</span>
                                        <span className="text-slate-600 text-[10px]">{new Date(q.created_at).toLocaleDateString('es-CL')}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-1 ${
                                            statusBadge[q.status as keyof typeof statusBadge]?.bg + ' ' + 
                                            statusBadge[q.status as keyof typeof statusBadge]?.color
                                        }`}>
                                            {statusBadge[q.status as keyof typeof statusBadge]?.label.toUpperCase()}
                                        </span>
                                        <span className="text-white text-xs font-black group-hover:text-[#E2A049] transition-colors">{formatCLP(q.total_price)}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
