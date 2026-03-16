import { createServerClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import QuoteDetailClient from './QuoteDetailClient';

type Params = Promise<{ id: string }>;

export default async function QuoteDetailPage({ params }: { params: Params }) {
    const { id } = await params;
    const db = createServerClient();

    const { data: quote } = await db
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', id)
        .single();

    if (!quote) notFound();

    return <QuoteDetailClient quote={quote} />;
}
