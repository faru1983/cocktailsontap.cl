'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { formatPhoneDisplay, normalizePhoneE164, toWhatsAppDigits } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import { updateClientAdmin, syncClientWithGoogle } from '@/app/actions/admin/adminActions';
import { useRouter } from 'next/navigation';
import { Edit2, Save, X, Phone, Mail, MessageCircle, RefreshCcw, User, ArrowLeft } from 'lucide-react';

interface Client {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
    phone: string | null;
    google_contact_id: string | null;
    created_at: string;
}

interface Quote {
    id: string;
    token: string;
    status: string;
    event_date: string | null;
    total_price: number;
    created_at: string;
}

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Borrador',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed:    { label: 'Confirmada',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    completed:    { label: 'Completada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled:    { label: 'Cancelada',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default function ClientDetailClient({ client: initialClient, quotes: initialQuotes }: { client: Client, quotes: Quote[] }) {
    const [client, setClient] = useState(initialClient);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        first_name: initialClient.first_name,
        last_name: initialClient.last_name || '',
        email: initialClient.email,
        phone: normalizePhoneE164(initialClient.phone || '') || '',
    });
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const router = useRouter();

    const totalSpent = initialQuotes
        .filter((q: Quote) => ['confirmed', 'completed'].includes(q.status))
        .reduce((s: number, q: Quote) => s + Number(q.total_price), 0);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSyncGoogle = async () => {
        if (!confirm('¿Deseas sincronizar manualmente este cliente con Google Contacts?')) return;
        startTransition(async () => {
            const res = await syncClientWithGoogle(client.id);
            if (res.success) {
                showToast('Sincronizado con éxito ✅');
                router.refresh();
            } else {
                showToast('Error al sincronizar: ' + res.error, false);
            }
        });
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateClientAdmin(client.id, editForm);
            if (res.success) {
                setClient(prev => ({ ...prev, ...editForm }));
                setIsEditing(false);
                showToast('Perfil de cliente actualizado');
                router.refresh();
            } else {
                showToast(res.error || 'Error al actualizar cliente', false);
            }
        });
    };

    return (
        <div>
            <style>{`
                .cd-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
                @media (min-width: 768px) { .cd-grid { grid-template-columns: 280px 1fr; gap: 24px; } }
                .cd-profile { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; position: relative; }
                .cd-profile-top { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
                @media (min-width: 768px) { .cd-profile-top { flex-direction: column; align-items: flex-start; gap: 0; } .cd-profile-top .cd-avatar { margin-bottom: 14px; } }
                .cd-avatar { width: 52px; height: 52px; flex-shrink: 0; border-radius: 50%; background: linear-gradient(135deg, #E2A049, #c8872e); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #1a1a2e; }
                .cd-name-block h2 { color: #f1f5f9; font-size: 17px; font-weight: 800; margin: 0 0 2px; }
                .cd-name-block p { color: #475569; font-size: 12px; margin: 0; word-break: break-all; }
                .cd-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.05); }
                .cd-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
                .cd-quotes { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; }
                .cd-quote-table { display: none; }
                .cd-quote-cards { display: flex; flex-direction: column; }
                .cd-quote-card { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); text-decoration: none; }
                .cd-quote-card:last-child { border-bottom: none; }
                .cd-quote-card:hover { background: rgba(255,255,255,0.02); }
                @media (min-width: 600px) { 
                    .cd-quote-cards { display: none; }
                    .cd-quote-table { display: block; overflow-x: auto; } 
                    .cd-quote-table table { border-collapse: collapse; width: 100%; } 
                }
                .q-input { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 13px; width: 100%; outline: none; transition: border 0.2s; }
                .q-input:focus { border-color: #E2A049; }
                .q-label { color: #64748b; font-size: 11px; margin-bottom: 4px; display: block; }
                .save-btn { background: #E2A049; color: #1a1a2e; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; transition: transform 0.2s; }
                .save-btn:hover { transform: scale(1.02); }
                .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>

            {/* Back */}
            <div className="flex justify-between items-center mb-6">
                <Link href="/admin/clients" className="flex items-center gap-2 text-[#E2A049] text-sm font-bold hover:text-white transition-colors no-underline">
                    <ArrowLeft size={16} /> Volver a Clientes
                </Link>
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${isEditing ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : 'bg-[#E2A049]/10 text-[#E2A049] border-[#E2A049]/20 hover:bg-[#E2A049]/20'}`}
                >
                    {isEditing ? <><X size={14}/> Cancelar Edición</> : <><Edit2 size={14}/> Editar Perfil</>}
                </button>
            </div>

            <div className="cd-grid">
                {/* ── Client Profile Card ── */}
                <div className="cd-profile">
                    {!isEditing ? (
                        <>
                            <div className="cd-profile-top">
                                <div className="cd-avatar">{client.first_name?.[0]?.toUpperCase()}</div>
                                <div className="cd-name-block">
                                    <h2>{client.first_name} {client.last_name || ''}</h2>
                                    <p>{client.email}</p>
                                </div>
                            </div>
                            <div className="cd-meta">
                                {client.phone && <div className="flex items-center gap-2 text-slate-400 text-sm"><Phone size={14}/> {formatPhoneDisplay(client.phone)}</div>}
                                <div style={{ color: '#475569', fontSize: '12px' }}>
                                    Google: {client.google_contact_id ? '✅ Sincronizado' : '⚠️ Sin sync'}
                                </div>
                                <div style={{ color: '#334155', fontSize: '11px' }}>
                                    Registro: {new Date(client.created_at).toLocaleDateString('es-CL')}
                                </div>
                                <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                                    <div style={{ color: '#34d399', fontSize: '18px', fontWeight: 900 }}>{formatCLP(totalSpent)}</div>
                                    <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>Total gastado (confirmadas)</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label className="q-label">Nombre</label>
                                <input className="q-input" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Apellido</label>
                                <input className="q-input" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Email</label>
                                <input className="q-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Celular (ej: +56 9 1234 5678)</label>
                                <PhoneInput
                                    className="q-input"
                                    value={editForm.phone}
                                    onChange={(e164) => setEditForm(f => ({ ...f, phone: e164 }))}
                                />
                            </div>
                            <button className="flex justify-center items-center gap-2 bg-[#E2A049] text-black font-bold text-sm py-3 rounded-xl hover:bg-[#f0ad5c] transition-colors" onClick={handleSave} disabled={isPending}>
                                <Save size={16}/> {isPending ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    )}
                    
                    {!isEditing && (
                        <div className="cd-actions flex flex-col gap-3 mt-5">
                            <button 
                                onClick={handleSyncGoogle}
                                disabled={isPending}
                                className="flex justify-center items-center gap-2 w-full py-3 bg-[#E2A049]/10 border border-[#E2A049]/30 rounded-xl text-[#E2A049] text-sm font-bold hover:bg-[#E2A049]/20 transition-all disabled:opacity-50 cursor-pointer"
                            >
                                <RefreshCcw size={16} className={isPending ? "animate-spin" : ""} /> {isPending ? 'Sincronizando...' : 'Sincronizar a Google'}
                            </button>
                            {client.phone && (
                                <a href={`https://wa.me/${toWhatsAppDigits(client.phone)}`} target="_blank" rel="noopener"
                                    className="flex justify-center items-center gap-2 w-full py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-all no-underline">
                                    <MessageCircle size={16}/> Escribir al WhatsApp
                                </a>
                            )}
                            <a href={`mailto:${client.email}`}
                                className="flex justify-center items-center gap-2 w-full py-3 bg-[#E2A049]/10 border border-[#E2A049]/30 rounded-xl text-[#E2A049] text-sm font-bold hover:bg-[#E2A049]/20 transition-all no-underline">
                                <Mail size={16}/> Enviar un Email
                            </a>
                        </div>
                    )}
                </div>

                {/* ── Quote history ── */}
                <div className="cd-quotes">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                            Historial de Cotizaciones ({initialQuotes.length})
                        </h3>
                    </div>

                    {initialQuotes.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>Sin cotizaciones registradas.</div>
                    ) : (
                        <>
                            <div className="cd-quote-cards">
                                {initialQuotes.map((q: any) => {
                                    const badge = statusBadge[q.status] || statusBadge.draft;
                                    return (
                                        <Link key={q.id} href={`/admin/quotes/${q.id}`} className="cd-quote-card">
                                            <div>
                                                <div style={{ color: '#E2A049', fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{formatCLP(Number(q.total_price))}</div>
                                                <div style={{ color: '#94a3b8', fontSize: '12px' }}>{q.event_date ? new Date(q.event_date).toLocaleDateString('es-CL') : '—'}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, marginBottom: '4px' }}>
                                                    {badge.label}
                                                </span>
                                                <div style={{ color: '#64748b', fontSize: '11px' }}>Creada: {new Date(q.created_at).toLocaleDateString('es-CL')}</div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="cd-quote-table">
                                <table>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            {['Fecha Evento', 'Creación', 'Total', 'Estado', ''].map(h => (
                                                <th key={h} align="left" style={{ padding: '12px 20px', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {initialQuotes.map((q: any) => {
                                            const badge = statusBadge[q.status] || statusBadge.draft;
                                            return (
                                                <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                        {q.event_date ? new Date(q.event_date).toLocaleDateString('es-CL') : '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                        {new Date(q.created_at).toLocaleDateString('es-CL')}
                                                    </td>
                                                    <td style={{ padding: '14px 20px', color: '#E2A049', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                        {formatCLP(Number(q.total_price))}
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: badge.color, background: badge.bg, whiteSpace: 'nowrap' }}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <Link href={`/admin/quotes/${q.id}`} style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver →</Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    padding: '12px 24px', borderRadius: '12px',
                    background: toast.ok ? '#34d399' : '#f87171', color: '#111827',
                    fontWeight: 800, fontSize: '14px', zIndex: 100,
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4)',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {toast.msg}
                </div>
            )}

            <style>{`
                @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
}
