import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import type { Quote, QuoteItem } from '@/lib/types';
import EventQuoteView from '@/components/quote/EventQuoteView';
import DirectQuoteView from '@/components/quote/DirectQuoteView';

interface Props {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

export default async function QuoteTokenPage({ params, searchParams }: Props) {
    const { token } = await params;
    const { new: isNewParam } = await searchParams;
    const isNew = isNewParam === 'true';
    
    const db = createServerClient();

    const PUBLIC_QUOTE_SELECT = `
        id, token, status, service_type, dispenser, source,
        client_name, client_lastname, client_email, client_phone, client_address,
        region_name, comuna_name, comuna_other,
        event_date, start_time, pickup_date, pickup_time,
        guests, drinks_per_person, event_type_id, event_type_other,
        total_normal_price, total_offer_price, shipping_cost, installation_cost, manual_discount, total_price, total_liters,
        shipping_label, comments, payments, created_at, updated_at,
        quote_items (
            id, quote_id, product_id, product_name, size, size_value, unit_id, is_disposable, quantity, price_at_time, offer_price_at_time
        )
    `;

    const [
        { data, error },
        { cocktails, comunas, regions, categories, eventTypes }
    ] = await Promise.all([
        db.from('quotes').select(PUBLIC_QUOTE_SELECT).eq('token', token).single(),
        fetchAllProductData()
    ]);

    if (error || !data) {
        notFound();
    }

    const quote = data as Quote & { quote_items: QuoteItem[] };
    const isDirectSale = quote.service_type === 'direct';

    return (
        <main className="min-h-screen bg-brand-bg py-6 sm:py-12 px-2 sm:px-4 pb-32 w-full overflow-x-hidden">
            <div className="w-full max-w-4xl mx-auto">
                {isDirectSale ? (
                    <DirectQuoteView
                        quote={quote}
                        comunas={comunas}
                        regions={regions}
                        availableCocktails={cocktails}
                        categories={categories}
                        eventTypes={eventTypes}
                        isNew={isNew}
                    />
                ) : (
                    <EventQuoteView
                        quote={quote}
                        comunas={comunas}
                        regions={regions}
                        availableCocktails={cocktails}
                        categories={categories}
                        eventTypes={eventTypes}
                        isNew={isNew}
                    />
                )}
            </div>
        </main>
    );
}
