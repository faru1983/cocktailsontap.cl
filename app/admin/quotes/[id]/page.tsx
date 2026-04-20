import { createServerClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import QuoteDetailClient from './QuoteDetailClient';

type Params = Promise<{ id: string }>;

export default async function QuoteDetailPage({ params }: { params: Params }) {
    const { id } = await params;
    const db = createServerClient();

    const { data: quote } = await db
        .from('quotes')
        .select('*, quote_items(*), event_types(name)')
        .eq('id', id)
        .single();

    if (!quote) notFound();

    const { data: eventTypes } = await db.from('event_types').select('*').order('display_order');
    const { fetchAllProductData } = await import('@/lib/serverData');
    const { products, comunas } = await fetchAllProductData();

    return <QuoteDetailClient quote={quote} allProducts={products} eventTypes={eventTypes || []} comunas={comunas} />;
}
