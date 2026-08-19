import { createServerClient } from '@/lib/supabaseServer';
import QuotesListClient from './QuotesListClient';

type SearchParams = Promise<{
    status?: string;
    type?: string;
    source?: string;
    q?: string;
    sort?: string;
    order?: string;
    sort_order?: string;
    page?: string;
}>;

const ITEMS_PER_PAGE = 25;

async function getQuotes(
    status?: string,
    type?: string,
    source?: string,
    search?: string,
    sort = 'event_date',
    order = 'asc',
    page = 1
) {
    const db = createServerClient();
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = db.from('quotes')
        .select('id, token, status, client_name, client_lastname, client_email, event_date, total_price, payments, created_at, comuna_name, comuna_other, dispenser, service_type, review_email_sent, source', { count: 'exact' });
    
    if (status && status !== 'all') query = query.eq('status', status);

    if (source && source !== 'all') query = query.eq('source', source);

    // Eventos / Desechables (service_type). Sin .or() para no chocar con el .or() de búsqueda.
    if (type === 'direct') {
        query = query.eq('service_type', 'direct');
    } else if (type === 'event') {
        query = query.eq('service_type', 'event');
    }

    if (search) query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_lastname.ilike.%${search}%`);
    
    query = query.order(sort, { ascending: order === 'asc' });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) console.error('Error fetching quotes:', error);

    return {
        quotes: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
    };
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
    const rawParams = await searchParams;
    let { status = 'confirmed', type = 'all', source = 'all', q, sort = 'event_date', order = 'asc', sort_order, page = '1' } = rawParams as any;
    const currentPage = parseInt(page) || 1;
    
    if (sort_order) {
        const [s, o] = sort_order.split('-');
        sort = s;
        order = o;
    }

    const { quotes, totalCount, totalPages } = await getQuotes(status, type, source, q, sort, order, currentPage);

    return (
        <QuotesListClient 
            initialQuotes={quotes} 
            status={status}
            type={type}
            source={source}
            q={q} 
            sort={sort} 
            order={order} 
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
        />
    );
}
