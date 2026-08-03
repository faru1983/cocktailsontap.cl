import { createServerClient } from '@/lib/supabaseServer';
import ClientDetailClient from './ClientDetailClient';

type Params = Promise<{ id: string }>;

export default async function ClientDetailPage({ params }: { params: Params }) {
    const { id } = await params;
    const db = createServerClient();

    const [clientRes, quotesRes, identifiersRes, mergesRes, stageEventsRes] = await Promise.all([
        db.from('clients').select('*').eq('id', id).single(),
        db.from('quotes')
            .select('id, token, status, event_date, total_price, created_at')
            .eq('client_id', id)
            .order('created_at', { ascending: false }),
        db.from('client_identifiers')
            .select('id, client_id, type, value, is_primary, source, created_at')
            .eq('client_id', id)
            .order('type')
            .order('is_primary', { ascending: false }),
        db.from('client_merge_logs')
            .select('id, from_client_id, into_client_id, reason, source, details, created_at')
            .or(`into_client_id.eq.${id},from_client_id.eq.${id}`)
            .order('created_at', { ascending: false })
            .limit(10),
        db.from('client_stage_events')
            .select('id, from_stage, to_stage, reason, source, meta_event_sent, created_at')
            .eq('client_id', id)
            .order('created_at', { ascending: false })
            .limit(20),
    ]);

    if (!clientRes.data) return <div style={{ color: '#f1f5f9', padding: '20px' }}>Cliente no encontrado.</div>;

    return (
        <ClientDetailClient
            client={clientRes.data}
            quotes={quotesRes.data || []}
            identifiers={identifiersRes.data || []}
            merges={mergesRes.data || []}
            stageEvents={stageEventsRes.data || []}
        />
    );
}
