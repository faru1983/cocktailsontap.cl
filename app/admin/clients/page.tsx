import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';

async function getClients(search?: string) {
    const db = createServerClient();
    let query = db.from('clients').select('id, first_name, last_name, email, phone, google_contact_id, created_at').order('created_at', { ascending: false });
    if (search) query = query.or(`first_name.ilike.%${search}%,email.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data } = await query;
    return data || [];
}

type SearchParams = Promise<{ q?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
    const { q } = await searchParams;
    const clients = await getClients(q);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Clientes</h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{clients.length} registrados en CRM</p>
                </div>
                <form method="GET" action="/admin/clients">
                    <input name="q" defaultValue={q || ''} placeholder="Buscar cliente…"
                        style={{ padding: '9px 14px', background: '#1e2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '220px' }} />
                </form>
            </div>

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table width="100%" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['', 'Nombre', 'Email', 'Teléfono', 'Google Sync', ''].map(h => (
                                    <th key={h} align="left" style={{ padding: '14px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c: any) => (
                                <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #E2A049, #c8872e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a2e', fontWeight: 900, fontSize: '14px' }}>
                                            {c.first_name?.[0]?.toUpperCase()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {c.first_name} {c.last_name || ''}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{c.email}</td>
                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{c.phone || '—'}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{ fontSize: '12px', color: c.google_contact_id ? '#34d399' : '#94a3b8' }}>
                                            {c.google_contact_id ? '✅ Sincronizado' : '— Sin sync'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <Link href={`/admin/clients/${c.id}`} style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(226,160,73,0.3)', whiteSpace: 'nowrap' }}>
                                            Ver ficha →
                                        </Link>
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
