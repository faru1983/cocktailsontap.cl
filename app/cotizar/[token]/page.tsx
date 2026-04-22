import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import type { Quote, QuoteItem } from '@/lib/types';
import EventQuoteView from '@/components/quote/EventQuoteView';
import DirectQuoteView from '@/components/quote/DirectQuoteView';

interface Props {
    params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const db = createServerClient();
    const { data } = await db.from('quotes').select('client_name, client_lastname, event_date').eq('token', token).single();
    if (!data) return { title: 'Cotización no encontrada' };
    const fullName = `${data.client_name}${data.client_lastname ? ' ' + data.client_lastname : ''}`;
    return {
        title: `Cotización de ${fullName} – Cocktails on Tap`,
        description: 'Revisa y confirma tu cotización de Cocktails on Tap.',
        robots: { index: false, follow: false },
    };
}

import { fetchAllProductData } from '@/lib/serverData';

export default async function QuoteTokenPage({ params }: Props) {
    const { token } = await params;
    const db = createServerClient();

    const [
        { data, error },
        { cocktails, comunas, categories, eventTypes }
    ] = await Promise.all([
        db.from('quotes').select('*, quote_items(*)').eq('token', token).single(),
        fetchAllProductData()
    ]);

    if (error || !data) {
        notFound();
    }

    const quote = data as Quote & { quote_items: QuoteItem[] };
    const isDirectSale = quote.service_type === 'direct';

    return (
        <main className="min-h-screen bg-brand-bg py-12 px-4 pb-32">
            <div className="max-w-4xl mx-auto">
                {isDirectSale ? (
                    <DirectQuoteView
                        quote={quote}
                        comunas={comunas}
                        availableCocktails={cocktails}
                        categories={categories}
                        eventTypes={eventTypes}
                    />
                ) : (
                    <EventQuoteView
                        quote={quote}
                        comunas={comunas}
                        availableCocktails={cocktails}
                        categories={categories}
                        eventTypes={eventTypes}
                    />
                )}
            </div>
        </main>
    );
}
