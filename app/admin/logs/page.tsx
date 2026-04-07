import { createServerClient } from '@/lib/supabaseServer';
import RetryButton from './RetryButton';
import Link from 'next/link';

async function getSyncLogs(sort: string = 'created_at', order: string = 'desc') {
    const db = createServerClient();
    const { data } = await db.from('sync_logs')
        .select('*, quotes(client_name, client_lastname)')
        .order(sort, { ascending: order === 'asc' })
        .limit(100);
    return data || [];
}

const typeLabels: Record<string, string> = {
    email_client: '✉️ Email Cliente',
    email_admin: '✉️ Email Admin',
    google_calendar: '📅 Google Calendar',
    google_pickup: '📅 Calendar Retiro',
    google_contact: '👤 Google Contact',
};

type SearchParams = Promise<{ sort?: string; order?: string }>;

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
    const { sort = 'created_at', order = 'desc' } = await searchParams;
    const logs = await getSyncLogs(sort, order);
    const failed = logs.filter((l: any) => l.status === 'failed');

    const sortFields = [
        { label: 'Fecha', field: 'created_at' },
        { label: 'Cliente', field: 'quote_id' }, // Simplified: sort by quote association
        { label: 'Tipo', field: 'type' },
        { label: 'Estado', field: 'status' }
    ];

    const getSortLink = (field: string) => {
        const isCurrent = sort === field;
        const nextOrder = isCurrent && order === 'desc' ? 'asc' : 'desc';
        return `/admin/logs?sort=${field}&order=${nextOrder}`;
    };

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Sincronización</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    {logs.length} registros · <span style={{ color: failed.length > 0 ? '#f87171' : '#34d399' }}>{failed.length} errores</span>
                </p>
            </div>

            {failed.length === 0 && (
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
                    ✅ Todo sincronizando correctamente — sin errores detectados.
                </div>
            )}

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }} className="desktop-only">
                <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {sortFields.map(h => (
                                    <th key={h.field} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <Link href={getSortLink(h.field)} style={{ textDecoration: 'none', color: sort === h.field ? '#E2A049' : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {h.label}
                                            {sort === h.field && (order === 'asc' ? ' 🔼' : ' 🔽')}
                                        </Link>
                                    </th>
                                ))}
                                <th style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Error</th>
                                <th style={{ padding: '14px 20px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>Sin registros de sincronización.</td></tr>
                            ) : logs.map((log: any) => (
                                <tr key={log.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '12px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString('es-CL')}
                                    </td>
                                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                        {log.quotes?.client_name} {log.quotes?.client_lastname || ''}
                                    </td>
                                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                        {typeLabels[log.type] || log.type}
                                    </td>
                                    <td style={{ padding: '12px 20px' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                            color: log.status === 'success' ? '#34d399' : log.status === 'retried' ? '#60a5fa' : '#f87171',
                                            background: log.status === 'success' ? 'rgba(52,211,153,0.1)' : log.status === 'retried' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)',
                                        }}>
                                            {log.status === 'success' ? 'OK' : log.status === 'retried' ? 'Reintentado' : '⚠️ Error'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 20px', color: '#475569', fontSize: '12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.error_msg || '—'}
                                    </td>
                                    <td style={{ padding: '12px 20px' }}>
                                        {log.status === 'failed' && <RetryButton logId={log.id} />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-only">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {logs.length === 0 ? (
                         <div style={{ padding: '40px 20px', textAlign: 'center', color: '#475569', fontSize: '14px', background: '#1e2433', borderRadius: '16px' }}>Sin registros.</div>
                    ) : logs.map((log: any) => (
                        <div key={log.id} style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{new Date(log.created_at).toLocaleString('es-CL')}</div>
                                <span style={{
                                    display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                                    color: log.status === 'success' ? '#34d399' : log.status === 'retried' ? '#60a5fa' : '#f87171',
                                    background: log.status === 'success' ? 'rgba(52,211,153,0.1)' : log.status === 'retried' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)',
                                }}>
                                    {log.status === 'success' ? 'OK' : log.status === 'retried' ? 'Reintentado' : '⚠️ Error'}
                                </span>
                            </div>
                            <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                                {log.quotes?.client_name} {log.quotes?.client_lastname || ''}
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                                {typeLabels[log.type] || log.type}
                            </div>
                            {log.error_msg && (
                                <div style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.05)', padding: '8px', borderRadius: '8px', marginTop: '8px', border: '1px solid rgba(248,113,113,0.1)' }}>
                                    {log.error_msg}
                                </div>
                            )}
                            {log.status === 'failed' && (
                                <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                                    <RetryButton logId={log.id} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @media (max-width: 767px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                }
                @media (min-width: 768px) {
                    .desktop-only { display: block !important; }
                    .mobile-only { display: none !important; }
                }
            `}</style>
        </div>
    );
}
