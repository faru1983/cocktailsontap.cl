import { createServerClient } from '@/lib/supabaseServer';
import RetryButton from './RetryButton';

async function getSyncLogs() {
    const db = createServerClient();
    const { data } = await db.from('sync_logs')
        .select('*, quotes(client_name, client_lastname)')
        .order('created_at', { ascending: false })
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

export default async function LogsPage() {
    const logs = await getSyncLogs();
    const failed = logs.filter((l: any) => l.status === 'failed');

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Monitor de Sincronización</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    {logs.length} registros · <span style={{ color: failed.length > 0 ? '#f87171' : '#34d399' }}>{failed.length} errores</span>
                </p>
            </div>

            {failed.length === 0 && (
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
                    ✅ Todo sincronizando correctamente — sin errores detectados.
                </div>
            )}

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['Fecha', 'Cliente', 'Tipo', 'Estado', 'Error', ''].map(h => (
                                    <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                                ))}
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
        </div>
    );
}
