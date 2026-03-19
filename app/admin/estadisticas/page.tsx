import { createServerClient } from '@/lib/supabaseServer';
import type { Metadata } from 'next';
import StatsClient from './StatsClient';

export const metadata: Metadata = {
    title: 'Estadísticas – Admin | Cocktails on Tap',
};

// Force dynamic fetch to ensure latest data is always loaded for accurate stats
export const dynamic = 'force-dynamic';

export default async function EstadisticasPage() {
    const db = createServerClient();

    // Fetch all quotes and items for full historical BI analysis
    // Note: We only select fields needed for statistical aggregation to keep the payload very small
    const [quotesRes, itemsRes] = await Promise.all([
        db.from('quotes')
          .select('id, status, total_price, event_date, created_at, client_id, client_name, client_lastname, comuna_name, comuna_other'),
        db.from('quote_items')
          .select('quote_id, product_name, quantity, offer_price_at_time, size')
    ]);

    const allQuotes = quotesRes.data || [];
    const allQuoteItems = itemsRes.data || [];

    return (
        <main style={{ padding: '0', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Standardizing wrapper specifically for stats */}
            <StatsClient 
                allQuotes={allQuotes} 
                allQuoteItems={allQuoteItems} 
            />
        </main>
    );
}
