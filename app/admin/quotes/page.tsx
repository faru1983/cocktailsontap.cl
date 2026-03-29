import { createServerClient } from '@/lib/supabaseServer';
import QuotesListClient from './QuotesListClient';

type SearchParams = Promise<{ status?: string; q?: string; sort?: string; order?: string; sort_order?: string }>;

async function getQuotes(status?: string, search?: string, sort = 'event_date', order = 'asc') {
    const db = createServerClient();
    let query = db.from('quotes')
        .select('id, token, status, client_name, client_lastname, client_email, event_date, total_price, created_at, comuna_name');
    if (status && status !== 'all') query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_lastname.ilike.%${search}%`);
    query = query.order(sort, { ascending: order === 'asc' });
    const { data } = await query;
    return data || [];
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
    const rawParams = await searchParams;
    let { status = 'confirmed', q, sort = 'event_date', order = 'asc', sort_order } = rawParams as any;
    
    // Handle the combined sort-order param if present
    if (sort_order) {
        const [s, o] = sort_order.split('-');
        sort = s;
        order = o;
    }

    const quotes = await getQuotes(status, q, sort, order);

    return (
        <QuotesListClient 
            initialQuotes={quotes} 
            status={status} 
            q={q} 
            sort={sort} 
            order={order} 
        />
    );
}
