'use client';

import { useState, useTransition } from 'react';
import { 
    saveAdminSettings, 
    sendTestReviewEmail, 
    saveEventType, 
    deleteEventType, 
    saveComuna, 
    deleteComuna,
    updateSiteSetting 
} from '@/app/actions/admin/adminActions';
import Modal from '@/components/admin/Modal';
import { Plus, Trash2, Edit2, MapPin, Calendar, Layout, Cpu } from 'lucide-react';

export default function SettingsClient({ 
    reviewMode, 
    reviewTemplate, 
    reviewLink, 
    eventTypes: initialEventTypes, 
    comunas: initialComunas,
    siteSettings
}: { 
    reviewMode: string; 
    reviewTemplate: string; 
    reviewLink: string; 
    eventTypes: any[]; 
    comunas: any[]; 
    siteSettings: any[];
}) {
    const [tab, setTab] = useState<'review' | 'events' | 'comunas' | 'system'>('review');
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    // ─── Post-Venta State ───────────────────────────────────────────────────
    const [mode, setMode] = useState(reviewMode);
    const [template, setTemplate] = useState(reviewTemplate);
    const [link, setLink] = useState(reviewLink);
    const [testEmail, setTestEmail] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ s: boolean; m: string } | null>(null);

    const handleSaveGeneral = (formData: FormData) => {
        startTransition(async () => {
            const res = await saveAdminSettings(formData);
            if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        });
    };

    const handleTest = async () => {
        if (!testEmail) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await sendTestReviewEmail(testEmail, template, link);
            if (res.success) {
                setTestResult({ s: true, m: 'Email de prueba enviado.' });
                setTimeout(() => setTestResult(null), 4000);
            } else {
                setTestResult({ s: false, m: res.error || 'Error al enviar.' });
            }
        } catch (e) {
            setTestResult({ s: false, m: 'Error de conexión.' });
        } finally {
            setIsTesting(false);
        }
    };

    // ─── Event Types / Comunas / Site Settings Logic ──────────────────────────
    const [modalData, setModalData] = useState<{ isOpen: boolean; type: 'event' | 'comuna' | 'system' | null; data: any }>({ isOpen: false, type: null, data: null });

    const openModal = (type: 'event' | 'comuna' | 'system', item: any = null) => {
        setModalData({
            isOpen: true,
            type,
            data: item || (
                type === 'event' ? { name: '', icon: '🥂', display_order: 0 } : 
                type === 'comuna' ? { name: '', cost: 0, free_from: null, display_order: 0 } :
                { key: '', value: '', category: 'global', is_active: true, description: '' }
            )
        });
    };

    const closeModal = () => setModalData({ isOpen: false, type: null, data: null });

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const { type, data } = modalData;
        startTransition(async () => {
            try {
                if (type === 'event') await saveEventType(data);
                else if (type === 'comuna') await saveComuna(data);
                else if (type === 'system') await updateSiteSetting(data.id, { value: data.value, is_active: data.is_active });
                closeModal();
            } catch (err: any) {
                alert('Error al guardar: ' + err.message);
            }
        });
    };

    const handleDelete = async (id: string, name: string, type: 'event' | 'comuna') => {
        if (!confirm(`¿Estás seguro de que quieres eliminar "${name}"?`)) return;
        startTransition(async () => {
            try {
                if (type === 'event') await deleteEventType(id);
                else await deleteComuna(id);
            } catch (err: any) {
                alert('Error al eliminar: ' + err.message);
            }
        });
    };

    const formatCLP = (n: number | null) => {
        if (n === null) return '—';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
    };

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Configuración</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Gestión avanzada del sistema</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: '#1e2433', padding: '6px', borderRadius: '14px', marginBottom: '28px', maxWidth: 'max-content', overflowX: 'auto' }}>
                {[
                    { id: 'review', label: 'Post-Venta', icon: <Layout size={16} /> },
                    { id: 'events', label: 'Tipos de Evento', icon: <Calendar size={16} /> },
                    { id: 'comunas', label: 'Comunas', icon: <MapPin size={16} /> },
                    { id: 'system', label: 'Cerebro Central', icon: <Cpu size={16} /> }
                ].map((t: any) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px', fontWeight: 700,
                            background: tab === t.id ? 'rgba(226,160,73,0.12)' : 'transparent',
                            color: tab === t.id ? '#E2A049' : '#64748b'
                        }}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB: REVIEW ───────────────────────────────────────────────────── */}
            {tab === 'review' && (
                <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '28px', maxWidth: '640px' }}>
                    <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>⭐ Email de Review</h2>
                    <form action={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Modo de envío</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {[{ v: 'manual', l: 'Manual' }, { v: 'auto', l: 'Automático' }].map(opt => (
                                    <label key={opt.v} style={{
                                        flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
                                        border: `2px solid ${mode === opt.v ? '#E2A049' : 'rgba(255,255,255,0.08)'}`,
                                        background: mode === opt.v ? 'rgba(226,160,73,0.08)' : 'rgba(255,255,255,0.03)',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                    }}>
                                        <input type="radio" name="review_mode" value={opt.v} checked={mode === opt.v} onChange={() => setMode(opt.v)} style={{ accentColor: '#E2A049' }} />
                                        <span style={{ color: mode === opt.v ? '#E2A049' : '#94a3b8', fontSize: '13px', fontWeight: 600 }}>{opt.l}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Link de Reseña</label>
                            <input type="url" name="review_link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Mensaje <span style={{ color: '#475569' }}>· {'{nombre}'}</span></label>
                            <textarea name="review_template" value={template} onChange={e => setTemplate(e.target.value)} rows={6} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                            <button type="submit" disabled={isPending} style={{ padding: '11px 22px', background: saved ? 'rgba(52,211,153,0.8)' : 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                                {isPending ? '⏳' : saved ? '✅' : 'Guardar'}
                            </button>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="email" placeholder="Test email…" value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px', outline: 'none' }} />
                                <button type="button" onClick={handleTest} disabled={isTesting || !testEmail} style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{isTesting ? '...' : 'Probar'}</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── TAB: EVENTS ───────────────────────────────────────────────────── */}
            {tab === 'events' && (
                <div style={{ maxWidth: '800px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 }}>Tipos de Evento</h2>
                        <button onClick={() => openModal('event')} style={{ padding: '8px 16px', background: 'rgba(226,160,73,0.1)', border: '1px solid rgba(226,160,73,0.3)', borderRadius: '10px', color: '#E2A049', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <Plus size={16} /> Agregar
                        </button>
                    </div>
                    <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <th align="left" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Icono</th>
                                    <th align="left" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Nombre</th>
                                    <th align="center" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Orden</th>
                                    <th align="right" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initialEventTypes.map(item => (
                                    <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '14px 20px', fontSize: '20px' }}>{item.icon}</td>
                                        <td style={{ padding: '14px 20px', color: '#f1f5f9', fontWeight: 600 }}>{item.name}</td>
                                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }} align="center">{item.display_order}</td>
                                        <td style={{ padding: '14px 20px' }} align="right">
                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => openModal('event', item)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(item.id, item.name, 'event')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── TAB: COMUNAS ──────────────────────────────────────────────────── */}
            {tab === 'comunas' && (
                <div style={{ maxWidth: '800px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 }}>Gestión de Comunas</h2>
                        <button onClick={() => openModal('comuna')} style={{ padding: '8px 16px', background: 'rgba(226,160,73,0.1)', border: '1px solid rgba(226,160,73,0.3)', borderRadius: '10px', color: '#E2A049', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <Plus size={16} /> Agregar
                        </button>
                    </div>
                    <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <th align="left" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Comuna</th>
                                    <th align="left" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Costo</th>
                                    <th align="left" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Gratis desde</th>
                                    <th align="right" style={{ padding: '14px 20px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initialComunas.map(item => (
                                    <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '14px 20px', color: '#f1f5f9', fontWeight: 600 }}>{item.name}</td>
                                        <td style={{ padding: '14px 20px', color: '#4d7c0f', fontWeight: 600, fontSize: '13px' }}>{formatCLP(item.cost)}</td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>{item.free_from ? `${item.free_from}L` : 'Nunca'}</td>
                                        <td style={{ padding: '14px 20px' }} align="right">
                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => openModal('comuna', item)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(item.id, item.name, 'comuna')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── TAB: SYSTEM (Cerebro Central) ────────────────────────────────── */}
            {tab === 'system' && (
                <div style={{ maxWidth: '900px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>Cerebro Central (Comunicaciones & Sincronización)</h2>
                        <p style={{ color: '#64748b', fontSize: '13px' }}>Gestiona las plantillas de correo, calendario y sincronización con Google.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {['emails', 'calendar', 'contacts'].map(cat => (
                            <div key={cat} style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px' }}>
                                <h3 style={{ color: '#E2A049', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {cat === 'emails' ? '📧 Correos' : cat === 'calendar' ? '📅 Calendario' : '👤 Contactos'}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {siteSettings.filter((s: any) => s.category === cat).map((setting: any) => (
                                        <div key={setting.id} onClick={() => openModal('system', setting)} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{setting.description || setting.key}</span>
                                                {!setting.is_active && <span style={{ fontSize: '10px', background: '#f87171', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>OFF</span>}
                                            </div>
                                            <p style={{ color: '#64748b', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                {setting.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── MODAL: EVENT / COMUNA / SYSTEM ─────────────────────────────────── */}
            {modalData.isOpen && modalData.data && (
                <Modal
                    isOpen={modalData.isOpen}
                    onClose={closeModal}
                    title={
                        modalData.type === 'event' ? (modalData.data?.id ? 'Editar Evento' : 'Nuevo Evento') : 
                        modalData.type === 'comuna' ? (modalData.data?.id ? 'Editar Comuna' : 'Nueva Comuna') :
                        'Ajuste de Sistema'
                    }
                >
                    <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {modalData.type === 'event' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Nombre</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Icono (Emoji)</label>
                                    <input type="text" required value={modalData.data.icon} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, icon: e.target.value } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                </div>
                            </>
                        ) : modalData.type === 'comuna' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Nombre Comuna</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '14px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Costo Despacho</label>
                                        <input type="number" required value={modalData.data.cost} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, cost: Number(e.target.value) } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Gratis desde (Litros)</label>
                                        <input type="number" value={modalData.data.free_from || ''} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, free_from: e.target.value ? Number(e.target.value) : null } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Orden de Aparición</label>
                                    <input type="number" required value={modalData.data.display_order} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, display_order: Number(e.target.value) } })} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{modalData.data.description || modalData.data.key}</label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={modalData.data.is_active} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, is_active: e.target.checked } })} style={{ accentColor: '#E2A049' }} />
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Activo</span>
                                        </label>
                                    </div>
                                    <textarea 
                                        rows={8} 
                                        value={modalData.data.value} 
                                        onChange={e => setModalData({ ...modalData, data: { ...modalData.data, value: e.target.value } })} 
                                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} 
                                    />
                                    <div style={{ marginTop: '12px', background: 'rgba(226,160,73,0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed rgba(226,160,73,0.2)' }}>
                                        <p style={{ margin: 0, fontSize: '10px', color: '#c8872e', fontWeight: 700 }}>Variables disponibles:</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                                            {modalData.data.category === 'calendar' ? '{{full_name}}, {{guests}}, {{phone}}, {{link}}, {{comments}}, {{items_list}}, {{shipping_cost}}, {{total_price}}, {{payments_summary}}' : '{{full_name}}, {{event_date}}, {{first_name}}, {{quote_url}}'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                        <button type="submit" disabled={isPending} style={{ marginTop: '10px', padding: '14px', background: 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 800, fontSize: '15px', cursor: 'pointer' }}>
                            {isPending ? '⏳ Guardando...' : 'Guardar Cambios'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
