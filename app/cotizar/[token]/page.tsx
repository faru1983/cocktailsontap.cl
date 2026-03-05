import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import type { Quote, QuoteItem } from '@/lib/types';
import QuoteView from '@/components/quote/QuoteView';

interface Props {
    params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const db = createServerClient();
    const { data } = await db.from('quotes').select('client_name, event_date').eq('token', token).single();
    if (!data) return { title: 'Cotización no encontrada' };
    return {
        title: `Cotización de ${data.client_name} – Cocktails on Tap`,
        description: 'Revisa y confirma tu cotización de Cocktails on Tap.',
        robots: { index: false, follow: false },
    };
}

export default async function QuoteTokenPage({ params }: Props) {
    const { token } = await params;
    const db = createServerClient();

    const { data, error } = await db
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('token', token)
        .single();

    if (error || !data) {
        notFound();
    }

    const quote = data as Quote & { quote_items: QuoteItem[] };

    return (
        <main className="min-h-screen bg-brand-bg py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <QuoteView quote={quote} />
            </div>
        </main>
    );
}
