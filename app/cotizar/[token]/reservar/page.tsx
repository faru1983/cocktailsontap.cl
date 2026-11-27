import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData } from '@/lib/serverData';
import type { Quote, QuoteItem } from '@/lib/types';
import EventReservationFlow from '@/components/quote/EventReservationFlow';

interface Props {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const db = createServerClient();
    const { data } = await db
        .from('quotes')
        .select('client_name, client_lastname')
        .eq('token', token)
        .single();
    if (!data) return { title: 'Reserva no encontrada' };
    const fullName = `${data.client_name}${data.client_lastname ? ' ' + data.client_lastname : ''}`;
    return {
        title: `Reservar fecha · ${fullName} – Cocktails on Tap`,
        description: 'Completa los datos de tu evento paso a paso para confirmar tu reserva en Cocktails on Tap.',
        robots: { index: false, follow: false },
    };
}

export default async function EventReservePage({ params, searchParams }: Props) {
    const { token } = await params;
    const { from } = await searchParams;
    const fromWizard = from === 'wizard';

    const db = createServerClient();

    const PUBLIC_QUOTE_SELECT = `
        id, token, status, service_type, dispenser, glassware_type, source,
        client_name, client_lastname, client_email, client_phone, client_address,
        region_name, comuna_name, comuna_other,
        event_date, start_time, pickup_date, pickup_time,
        guests, drinks_per_person, event_type_id, event_type_other,
        total_normal_price, total_offer_price, shipping_cost, installation_cost, manual_discount, total_price, total_liters,
        shipping_label, comments, payments, created_at, updated_at,
        quote_items (
            id, quote_id, product_id, product_name, size, size_value, unit_id, is_disposable, quantity, variant, price_at_time, offer_price_at_time
        )
    `;

    const [{ data, error }, { cocktails, comunas, regions, eventTypes }] = await Promise.all([
        db.from('quotes').select(PUBLIC_QUOTE_SELECT).eq('token', token).single(),
        fetchAllProductData(),
    ]);

    if (error || !data) {
        notFound();
    }

    const quote = data as Quote & { quote_items: QuoteItem[] };

    if (quote.service_type === 'direct' || quote.status !== 'draft') {
        redirect(`/cotizar/${token}`);
    }

    return (
        <main className="min-h-screen bg-brand-bg py-5 sm:py-10 px-3 sm:px-4 pb-28 w-full overflow-x-hidden">
            <div className="w-full max-w-3xl mx-auto">
                <EventReservationFlow
                    quote={quote}
                    comunas={comunas}
                    regions={regions}
                    availableCocktails={cocktails}
                    eventTypes={eventTypes}
                    fromWizard={fromWizard}
                />
            </div>
        </main>
    );
}
