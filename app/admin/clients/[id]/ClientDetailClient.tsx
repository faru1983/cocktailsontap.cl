'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatPhoneDisplay, normalizePhoneE164, toWhatsAppDigits } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import Modal from '@/components/admin/Modal';
import {
    deleteClientPermanent,
    updateClientAdmin,
    syncClientWithGoogle,
    setClientPrimaryIdentifierAdmin,
    updateClientCrmAdmin,
} from '@/app/actions/admin/adminActions';
import { useRouter } from 'next/navigation';
import { formatDateCL, formatDateTimeCL, getAvatarInitial } from '@/lib/utils';
import {
    Edit2,
    Save,
    X,
    Phone,
    Mail,
    MessageCircle,
    RefreshCcw,
    ArrowLeft,
    AlertTriangle,
    GitMerge,
    Star,
    Activity,
    Trash2,
} from 'lucide-react';

interface Client {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    google_contact_id: string | null;
    created_at: string;
    possible_duplicate?: boolean | null;
    merged_into_id?: string | null;
    first_touch_source?: string | null;
    lifecycle_stage?: string | null;
    intent?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    stage_changed_at?: string | null;
    last_activity_at?: string | null;
}

interface Quote {
    id: string;
    token: string;
    status: string;
    event_date: string | null;
    total_price: number;
    created_at: string;
}

interface Identifier {
    id: string;
    type: 'email' | 'phone';
    value: string;
    is_primary: boolean;
    source: string | null;
}

interface MergeLog {
    id: string;
    from_client_id: string | null;
    reason: string;
    source: string | null;
    created_at: string;
}

interface StageEvent {
    id: string;
    from_stage: string | null;
    to_stage: string;
    reason: string;
    source: string | null;
    meta_event_sent: string | null;
    created_at: string;
}

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    confirmed: { label: 'Confirmada', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    completed: { label: 'Completada', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    cancelled: { label: 'Cancelada', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const stageMeta: Record<string, { label: string; color: string; bg: string }> = {
    curious: { label: 'Curioso', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    engaged: { label: 'Interesado', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    quoted: { label: 'Cotizó', color: '#E2A049', bg: 'rgba(226,160,73,0.15)' },
    customer: { label: 'Cliente', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    lost: { label: 'Perdido', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default function ClientDetailClient({
    client: initialClient,
    quotes: initialQuotes,
    identifiers: initialIdentifiers = [],
    merges = [],
    stageEvents = [],
}: {
    client: Client;
    quotes: Quote[];
    identifiers?: Identifier[];
    merges?: MergeLog[];
    stageEvents?: StageEvent[];
}) {
    const [client, setClient] = useState(initialClient);
    const [identifiers, setIdentifiers] = useState(initialIdentifiers);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        first_name: initialClient.first_name,
        last_name: initialClient.last_name || '',
        email: initialClient.email || '',
        phone: normalizePhoneE164(initialClient.phone || '') || '',
    });
    const [crmForm, setCrmForm] = useState({
        lifecycle_stage: initialClient.lifecycle_stage || 'curious',
        intent: initialClient.intent || '',
        notes: initialClient.notes || '',
        tags: (initialClient.tags || []).join(', '),
    });
    const [isPending, startTransition] = useTransition();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const router = useRouter();

    const totalSpent = initialQuotes
        .filter((q: Quote) => ['confirmed', 'completed'].includes(q.status))
        .reduce((s: number, q: Quote) => s + Number(q.total_price), 0);

    const stage = stageMeta[client.lifecycle_stage || 'curious'] || stageMeta.curious;

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSyncGoogle = async () => {
        if (!confirm('¿Deseas sincronizar manualmente este cliente con Google Contacts?')) return;
        startTransition(async () => {
            const res = await syncClientWithGoogle(client.id);
            if (res.success) {
                showToast('Sincronizado con éxito');
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
                setClient((prev) => ({ ...prev, ...editForm }));
                setIsEditing(false);
                showToast('Perfil de cliente actualizado');
                router.refresh();
            } else {
                showToast(res.error || 'Error al actualizar cliente', false);
            }
        });
    };

    const handleDeleteClient = () => {
        setIsDeleting(true);
        startTransition(async () => {
            const res = await deleteClientPermanent(client.id);
            if (res.success) {
                router.push('/admin/clients');
                router.refresh();
                return;
            }

            setIsDeleting(false);
            setShowDeleteModal(false);
            showToast(res.error || 'No se pudo eliminar el cliente', false);
        });
    };

    const handleSaveCrm = () => {
        startTransition(async () => {
            const tags = crmForm.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
            const res = await updateClientCrmAdmin(client.id, {
                lifecycle_stage: crmForm.lifecycle_stage,
                intent: crmForm.intent || null,
                notes: crmForm.notes || null,
                tags,
            });
            if (res.success) {
                setClient((prev) => ({
                    ...prev,
                    lifecycle_stage: crmForm.lifecycle_stage,
                    intent: crmForm.intent || null,
                    notes: crmForm.notes || null,
                    tags,
                }));
                showToast('CRM actualizado');
                router.refresh();
            } else {
                showToast(res.error || 'Error al actualizar CRM', false);
            }
        });
    };

    const handleSetPrimary = (identifierId: string) => {
        startTransition(async () => {
            const res = await setClientPrimaryIdentifierAdmin(client.id, identifierId);
            if (res.success) {
                setIdentifiers((prev) =>
                    prev.map((i) => {
                        const target = prev.find((x) => x.id === identifierId);
                        if (!target) return i;
                        if (i.type !== target.type) return i;
                        return { ...i, is_primary: i.id === identifierId };
                    })
                );
                showToast('Identificador primario actualizado');
                router.refresh();
            } else {
                showToast(res.error || 'No se pudo actualizar', false);
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
                .q-input { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 13px; width: 100%; outline: none; }
                .q-input:focus { border-color: #E2A049; }
                .q-label { color: #64748b; font-size: 11px; margin-bottom: 4px; display: block; }
                .id-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .id-row:last-child { border-bottom: none; }
            `}</style>

            <div className="flex justify-between items-center mb-6">
                <Link href="/admin/clients" className="flex items-center gap-2 text-[#E2A049] text-sm font-bold hover:text-white transition-colors no-underline">
                    <ArrowLeft size={16} /> Volver a Clientes
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        disabled={isPending || isDeleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                    >
                        <Trash2 size={14} /> {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsEditing(!isEditing)}
                        disabled={isPending || isDeleting}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 cursor-pointer ${isEditing ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-[#E2A049]/10 text-[#E2A049] border-[#E2A049]/20'}`}
                    >
                        {isEditing ? (
                            <>
                                <X size={14} /> Cancelar Edición
                            </>
                        ) : (
                            <>
                                <Edit2 size={14} /> Editar Perfil
                            </>
                        )}
                    </button>
                </div>
            </div>

            {(client.possible_duplicate || merges.length > 0) && (
                <div className="mb-4 flex flex-col gap-2">
                    {client.possible_duplicate && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold">
                            <AlertTriangle size={16} /> Posible duplicado: revisar identifiers / merges
                        </div>
                    )}
                    {merges.length > 0 && (
                        <div className="px-4 py-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200 text-sm">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <GitMerge size={16} /> Merges recibidos ({merges.length})
                            </div>
                            {merges.slice(0, 3).map((m) => (
                                <div key={m.id} className="text-xs opacity-80">
                                    {formatDateTimeCL(m.created_at)} — {m.reason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="cd-grid">
                <div className="cd-profile">
                    {!isEditing ? (
                        <>
                            <div className="cd-profile-top">
                                <div className="cd-avatar">{getAvatarInitial(client.first_name)}</div>
                                <div className="cd-name-block">
                                    <h2>
                                        {client.first_name} {client.last_name || ''}
                                    </h2>
                                    <p>{client.email || 'Sin email primario'}</p>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            marginTop: 8,
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: stage.color,
                                            background: stage.bg,
                                        }}
                                    >
                                        {stage.label}
                                        {client.intent ? ` · ${client.intent}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="cd-meta">
                                {client.phone && (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                        <Phone size={14} /> {formatPhoneDisplay(client.phone)}
                                    </div>
                                )}
                                {client.first_touch_source && (
                                    <div style={{ color: '#64748b', fontSize: '12px' }}>Primer contacto: {client.first_touch_source}</div>
                                )}
                                {client.last_activity_at && (
                                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                                        Última actividad:{' '}
                                        {formatDateTimeCL(client.last_activity_at)}
                                    </div>
                                )}
                                <div style={{ color: '#475569', fontSize: '12px' }}>
                                    Google: {client.google_contact_id ? 'Sincronizado' : 'Sin sync'}
                                </div>
                                <div style={{ color: '#334155', fontSize: '11px' }}>
                                    Registro: {formatDateCL(client.created_at)}
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
                                <input className="q-input" value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Apellido</label>
                                <input className="q-input" value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Email primario</label>
                                <input className="q-input" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className="q-label">Celular primario</label>
                                <PhoneInput className="q-input" value={editForm.phone} onChange={(e164) => setEditForm((f) => ({ ...f, phone: e164 }))} />
                            </div>
                            <button
                                className="flex justify-center items-center gap-2 bg-[#E2A049] text-black font-bold text-sm py-3 rounded-xl hover:bg-[#f0ad5c] transition-colors"
                                onClick={handleSave}
                                disabled={isPending}
                            >
                                <Save size={16} /> {isPending ? 'Guardando...' : 'Guardar Cambios'}
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
                                <RefreshCcw size={16} className={isPending ? 'animate-spin' : ''} /> {isPending ? 'Sincronizando...' : 'Sincronizar a Google'}
                            </button>
                            {client.phone && (
                                <a
                                    href={`https://wa.me/${toWhatsAppDigits(client.phone)}`}
                                    target="_blank"
                                    rel="noopener"
                                    className="flex justify-center items-center gap-2 w-full py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-all no-underline"
                                >
                                    <MessageCircle size={16} /> Escribir al WhatsApp
                                </a>
                            )}
                            {client.email && (
                                <a
                                    href={`mailto:${client.email}`}
                                    className="flex justify-center items-center gap-2 w-full py-3 bg-[#E2A049]/10 border border-[#E2A049]/30 rounded-xl text-[#E2A049] text-sm font-bold hover:bg-[#E2A049]/20 transition-all no-underline"
                                >
                                    <Mail size={16} /> Enviar un Email
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <div className="cd-quotes">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                                Ciclo de vida CRM
                            </h3>
                        </div>
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="q-label">Etapa</label>
                                <select
                                    className="q-input"
                                    value={crmForm.lifecycle_stage}
                                    onChange={(e) =>
                                        setCrmForm((f) => ({ ...f, lifecycle_stage: e.target.value }))
                                    }
                                >
                                    <option value="curious">Curioso</option>
                                    <option value="engaged">Interesado</option>
                                    <option value="quoted">Cotizó</option>
                                    <option value="customer">Cliente</option>
                                    <option value="lost">Perdido</option>
                                </select>
                            </div>
                            <div>
                                <label className="q-label">Intención</label>
                                <select
                                    className="q-input"
                                    value={crmForm.intent}
                                    onChange={(e) => setCrmForm((f) => ({ ...f, intent: e.target.value }))}
                                >
                                    <option value="">Sin definir</option>
                                    <option value="event">Evento</option>
                                    <option value="direct">Barril desechable</option>
                                    <option value="unknown">Desconocida</option>
                                </select>
                            </div>
                            <div>
                                <label className="q-label">Tags (separados por coma)</label>
                                <input
                                    className="q-input"
                                    value={crmForm.tags}
                                    onChange={(e) => setCrmForm((f) => ({ ...f, tags: e.target.value }))}
                                    placeholder="vip, corporate…"
                                />
                            </div>
                            <div>
                                <label className="q-label">Notas</label>
                                <textarea
                                    className="q-input"
                                    rows={3}
                                    value={crmForm.notes}
                                    onChange={(e) => setCrmForm((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="Bitácora corta del cliente…"
                                    style={{ resize: 'vertical', minHeight: 72 }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveCrm}
                                disabled={isPending}
                                className="flex justify-center items-center gap-2 bg-[#E2A049] text-black font-bold text-sm py-3 rounded-xl hover:bg-[#f0ad5c] transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                <Save size={16} /> {isPending ? 'Guardando…' : 'Guardar CRM'}
                            </button>
                        </div>
                    </div>

                    <div className="cd-quotes">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3
                                style={{
                                    color: '#f1f5f9',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <Activity size={16} /> Historial de etapas ({stageEvents.length})
                            </h3>
                        </div>
                        <div style={{ padding: '12px 20px' }}>
                            {stageEvents.length === 0 ? (
                                <div style={{ color: '#475569', fontSize: '13px', padding: '12px 0' }}>
                                    Sin cambios de etapa registrados.
                                </div>
                            ) : (
                                stageEvents.map((ev) => {
                                    const to = stageMeta[ev.to_stage] || stageMeta.curious;
                                    return (
                                        <div key={ev.id} className="id-row" style={{ alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
                                                    {ev.from_stage || '—'} → {to.label}
                                                </div>
                                                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                                                    {ev.reason}
                                                </div>
                                                <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                                                    {formatDateTimeCL(ev.created_at)}
                                                    {ev.source ? ` · ${ev.source}` : ''}
                                                    {ev.meta_event_sent ? ` · CAPI ${ev.meta_event_sent}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="cd-quotes">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>Identificadores ({identifiers.length})</h3>
                        </div>
                        <div style={{ padding: '12px 20px' }}>
                            {identifiers.length === 0 ? (
                                <div style={{ color: '#475569', fontSize: '13px', padding: '12px 0' }}>Sin identificadores.</div>
                            ) : (
                                identifiers.map((ident) => (
                                    <div key={ident.id} className="id-row">
                                        <div>
                                            <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                                                {ident.type}
                                                {ident.is_primary ? ' · primario' : ''}
                                            </div>
                                            <div style={{ color: '#f1f5f9', fontSize: '13px' }}>
                                                {ident.type === 'phone' ? formatPhoneDisplay(ident.value) : ident.value}
                                            </div>
                                            {ident.source && <div style={{ color: '#475569', fontSize: '11px' }}>origen: {ident.source}</div>}
                                        </div>
                                        {!ident.is_primary && (
                                            <button
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => handleSetPrimary(ident.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-[#E2A049]/30 text-[#E2A049] bg-[#E2A049]/10 hover:bg-[#E2A049]/20 cursor-pointer"
                                            >
                                                <Star size={12} /> Primario
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

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
                                    {initialQuotes.map((q: Quote) => {
                                        const badge = statusBadge[q.status] || statusBadge.draft;
                                        return (
                                            <Link key={q.id} href={`/admin/quotes/${q.id}`} className="cd-quote-card">
                                                <div>
                                                    <div style={{ color: '#E2A049', fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>
                                                        {formatCLP(Number(q.total_price))}
                                                    </div>
                                                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                                        {q.event_date ? formatDateCL(q.event_date + 'T12:00:00') : '—'}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            color: badge.color,
                                                            background: badge.bg,
                                                            marginBottom: '4px',
                                                        }}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                                                        Creada: {formatDateCL(q.created_at)}
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>

                                <div className="cd-quote-table">
                                    <table>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                {['Fecha Evento', 'Creación', 'Total', 'Estado', ''].map((h) => (
                                                    <th
                                                        key={h}
                                                        align="left"
                                                        style={{
                                                            padding: '12px 20px',
                                                            color: '#475569',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.8px',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {initialQuotes.map((q: Quote) => {
                                                const badge = statusBadge[q.status] || statusBadge.draft;
                                                return (
                                                    <tr key={q.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                            {q.event_date ? formatDateCL(q.event_date + 'T12:00:00') : '—'}
                                                        </td>
                                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                            {formatDateCL(q.created_at)}
                                                        </td>
                                                        <td style={{ padding: '14px 20px', color: '#E2A049', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                            {formatCLP(Number(q.total_price))}
                                                        </td>
                                                        <td style={{ padding: '14px 20px' }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '20px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: badge.color,
                                                                    background: badge.bg,
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '14px 20px' }}>
                                                            <Link
                                                                href={`/admin/quotes/${q.id}`}
                                                                style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                                                            >
                                                                Ver →
                                                            </Link>
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
            </div>

            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    if (!isDeleting) setShowDeleteModal(false);
                }}
                title="Eliminar cliente"
            >
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10">
                        <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-rose-200">
                            Esta acción es permanente y no se puede deshacer.
                        </div>
                    </div>

                    <div className="text-sm text-slate-300">
                        Se eliminará a{' '}
                        <span className="font-bold text-slate-100">
                            {client.first_name} {client.last_name || ''}
                        </span>{' '}
                        junto con sus identificadores, touchpoints e historial de etapas.
                    </div>

                    <div className="text-sm text-slate-300">
                        {initialQuotes.length === 0
                            ? 'Este cliente no tiene cotizaciones asociadas.'
                            : initialQuotes.length === 1
                                ? 'También se eliminará su cotización y todos sus registros asociados.'
                                : `También se eliminarán sus ${initialQuotes.length} cotizaciones y todos sus registros asociados.`}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <X size={16} /> Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteClient}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <Trash2 size={16} /> {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        background: toast.ok ? '#34d399' : '#f87171',
                        color: '#111827',
                        fontWeight: 800,
                        fontSize: '14px',
                        zIndex: 100,
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4)',
                    }}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
