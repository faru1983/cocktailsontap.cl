import { createServerClient } from '@/lib/supabaseServer';
import ClientDetailClient from './ClientDetailClient';

type Params = Promise<{ id: string }>;

export default async function ClientDetailPage({ params }: { params: Params }) {
    const { id } = await params;
    const db = createServerClient();

    const [clientRes, quotesRes] = await Promise.all([
        db.from('clients').select('*').eq('id', id).single(),
        db.from('quotes')
            .select('id, token, status, event_date, total_price, created_at')
            .eq('client_id', id)
            .order('created_at', { ascending: false }),
    ]);

    if (!clientRes.data) return <div style={{ color: '#f1f5f9', padding: '20px' }}>Cliente no encontrado.</div>;

    return <ClientDetailClient client={clientRes.data} quotes={quotesRes.data || []} />;
}
