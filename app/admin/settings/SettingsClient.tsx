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
        <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl text-slate-100 font-black mb-1">Configuración</h1>
                <p className="text-slate-500 text-sm">Gestión avanzada del sistema</p>
            </div>

            {/* Tabs - Scrollable on mobile */}
            <div className="flex gap-2 bg-[#1e2433] p-1.5 rounded-2xl mb-8 overflow-x-auto hide-scrollbar sticky top-0 z-10 md:relative md:max-w-max">
                {[
                    { id: 'review', label: 'Post-Venta', icon: <Layout size={16} /> },
                    { id: 'events', label: 'Eventos', icon: <Calendar size={16} /> },
                    { id: 'comunas', label: 'Comunas', icon: <MapPin size={16} /> },
                    { id: 'system', label: 'Cerebro Central', icon: <Cpu size={16} /> }
                ].map((t: any) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs md:text-sm font-bold whitespace-nowrap border-none cursor-pointer ${
                            tab === t.id 
                            ? 'bg-[rgba(226,160,73,0.12)] text-[#E2A049]' 
                            : 'bg-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB: REVIEW ───────────────────────────────────────────────────── */}
            {tab === 'review' && (
                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 max-w-2xl shadow-xl">
                    <h2 className="text-slate-100 text-lg font-bold mb-6 flex items-center gap-2">⭐ Email de Review</h2>
                    <form action={handleSaveGeneral} className="flex flex-col gap-6">
                        <div>
                            <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-3">Modo de envío</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[{ v: 'manual', l: 'Manual' }, { v: 'auto', l: 'Automático' }].map(opt => (
                                    <label key={opt.v} className={`flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
                                        mode === opt.v 
                                        ? 'border-[#E2A049] bg-[rgba(226,160,73,0.08)]' 
                                        : 'border-white/5 bg-white/3'
                                    }`}>
                                        <input type="radio" name="review_mode" value={opt.v} checked={mode === opt.v} onChange={() => setMode(opt.v)} className="accent-[#E2A049]" />
                                        <span className={`text-sm font-bold ${mode === opt.v ? 'text-[#E2A049]' : 'text-slate-400'}`}>{opt.l}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Link de Reseña</label>
                            <input type="url" name="review_link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." 
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                            />
                        </div>
                        <div>
                            <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Mensaje <span className="text-slate-600 font-medium whitespace-nowrap">· {'{nombre}'} para nombre cliente</span></label>
                            <textarea name="review_template" value={template} onChange={e => setTemplate(e.target.value)} rows={6} 
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all resize-y leading-relaxed font-sans" 
                            />
                        </div>
                        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button type="submit" disabled={isPending} 
                                className={`w-full sm:w-auto px-10 py-3 rounded-xl text-white font-extrabold text-sm transition-all border-none cursor-pointer ${
                                    saved ? 'bg-emerald-500/80' : 'bg-gradient-to-br from-[#E2A049] to-[#c8872e] shadow-lg shadow-orange-900/10'
                                } hover:scale-105 active:scale-95 disabled:opacity-50`}
                            >
                                {isPending ? '⏳' : saved ? '✅ Guardado' : 'Guardar Cambios'}
                            </button>
                            
                            <div className="flex w-full sm:w-auto gap-2 items-center">
                                <input type="email" placeholder="Email de prueba…" value={testEmail} onChange={e => setTestEmail(e.target.value)} 
                                    className="flex-1 sm:w-48 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs outline-none" 
                                />
                                <button type="button" onClick={handleTest} disabled={isTesting || !testEmail} 
                                    className="whitespace-nowrap px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-slate-400 text-xs font-bold cursor-pointer transition-colors"
                                >
                                    {isTesting ? '...' : 'Probar'}
                                </button>
                            </div>
                        </div>
                        {testResult && (
                            <div className={`text-xs font-bold p-3 rounded-lg animate-fade-in ${testResult.s ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {testResult.m}
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* ─── TAB: EVENTS ───────────────────────────────────────────────────── */}
            {tab === 'events' && (
                <div className="max-w-4xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-slate-100 text-lg font-bold">Tipos de Evento</h2>
                        <button onClick={() => openModal('event')} 
                            className="flex items-center gap-2 px-4 py-2 bg-[#E2A049]/10 border border-[#E2A049]/30 rounded-xl text-[#E2A049] font-bold text-sm hover:bg-[#E2A049]/20 transition-all cursor-pointer"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Agregar</span>
                        </button>
                    </div>

                    {/* Table View (Desktop) */}
                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Icono</th>
                                    <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Nombre</th>
                                    <th className="text-center px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Orden</th>
                                    <th className="text-right px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initialEventTypes.map(item => (
                                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.01] transition-colors">
                                        <td className="px-6 py-4 text-2xl">{item.icon}</td>
                                        <td className="px-6 py-4 text-slate-100 font-semibold">{item.name}</td>
                                        <td className="px-6 py-4 text-slate-400 text-sm text-center">{item.display_order}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => openModal('event', item)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors bg-transparent border-none cursor-pointer"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(item.id, item.name, 'event')} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Card View (Mobile) */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {initialEventTypes.map(item => (
                            <div key={item.id} className="bg-[#1e2433] p-5 rounded-2xl border border-white/5 shadow-md flex justify-between items-center transition-transform active:scale-95">
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl bg-white/5 w-14 h-14 rounded-xl flex items-center justify-center border border-white/5">{item.icon}</span>
                                    <div>
                                        <div className="text-slate-100 font-bold text-base">{item.name}</div>
                                        <div className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">Orden: {item.display_order}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => openModal('event', item)} className="p-2.5 bg-white/5 rounded-lg text-slate-400 border border-white/5"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(item.id, item.name, 'event')} className="p-2.5 bg-red-500/5 rounded-lg text-red-400/70 border border-red-500/10"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── TAB: COMUNAS ──────────────────────────────────────────────────── */}
            {tab === 'comunas' && (
                <div className="max-w-4xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-slate-100 text-lg font-bold">Gestión de Comunas</h2>
                        <button onClick={() => openModal('comuna')} 
                            className="flex items-center gap-2 px-4 py-2 bg-[#E2A049]/10 border border-[#E2A049]/30 rounded-xl text-[#E2A049] font-bold text-sm hover:bg-[#E2A049]/20 transition-all cursor-pointer"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Agregar</span>
                        </button>
                    </div>

                    {/* Table View (Desktop) */}
                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Comuna</th>
                                    <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Costo</th>
                                    <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Gratis desde</th>
                                    <th className="text-right px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initialComunas.map(item => (
                                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.01] transition-colors">
                                        <td className="px-6 py-4 text-slate-100 font-semibold">{item.name}</td>
                                        <td className="px-6 py-4 text-emerald-400 font-bold text-sm">{formatCLP(item.cost)}</td>
                                        <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{item.free_from ? `${item.free_from}L` : '—'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => openModal('comuna', item)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors bg-transparent border-none cursor-pointer"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(item.id, item.name, 'comuna')} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Card View (Mobile) */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {initialComunas.map(item => (
                            <div key={item.id} className="bg-[#1e2433] p-5 rounded-2xl border border-white/5 shadow-md transition-all active:scale-[0.98]">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-slate-100 font-bold text-lg mb-0.5">{item.name}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-bold text-base">{formatCLP(item.cost)}</span>
                                            {item.free_from && (
                                                <>
                                                    <span className="text-slate-600 text-xs">•</span>
                                                    <span className="text-slate-500 text-xs">Gratis desde {item.free_from}L</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal('comuna', item)} className="p-3 bg-white/5 rounded-xl text-slate-400 border border-white/5"><Edit2 size={18} /></button>
                                        <button onClick={() => handleDelete(item.id, item.name, 'comuna')} className="p-3 bg-red-500/5 rounded-xl text-red-400/70 border border-red-500/10"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── TAB: SYSTEM (Cerebro Central) ────────────────────────────────── */}
            {tab === 'system' && (
                <div className="max-w-6xl">
                    <div className="mb-8">
                        <h2 className="text-slate-100 text-xl font-bold mb-2">Cerebro Central</h2>
                        <p className="text-slate-500 text-sm">Comunicaciones y automatización avanzada con Google Services.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {['emails', 'calendar', 'contacts'].map(cat => (
                            <div key={cat} className="flex flex-col h-full bg-[#1e2433] rounded-3xl border border-white/5 p-6 shadow-2xl">
                                <h3 className="text-[#E2A049] text-[10px] font-black uppercase tracking-[2px] mb-6 flex items-center gap-3">
                                    <span className="p-2 bg-[#E2A049]/10 rounded-lg">
                                        {cat === 'emails' ? <Layout size={14} /> : cat === 'calendar' ? <Calendar size={14} /> : <Cpu size={14} />}
                                    </span>
                                    {cat === 'emails' ? '📧 Correos' : cat === 'calendar' ? '📅 Calendario' : '👤 Contactos'}
                                </h3>
                                <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
                                    {siteSettings.filter((s: any) => s.category === cat).map((setting: any) => (
                                        <div key={setting.id} onClick={() => openModal('system', setting)} 
                                            className="group bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-white/10 cursor-pointer transition-all active:scale-[0.97]"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-slate-100 text-sm font-bold group-hover:text-[#E2A049] transition-colors">{setting.description || setting.key}</span>
                                                {!setting.is_active && (
                                                    <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black tracking-tighter uppercase border border-red-500/20">Inactive</span>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 italic">
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
                        modalData.type === 'event' ? (modalData.data?.id ? '✏️ Editar Evento' : '✨ Nuevo Evento') : 
                        modalData.type === 'comuna' ? (modalData.data?.id ? '📍 Editar Comuna' : '🏙️ Nueva Comuna') :
                        '⚙️ Ajuste de Sistema'
                    }
                >
                    <form onSubmit={handleSaveItem} className="flex flex-col gap-6">
                        {modalData.type === 'event' ? (
                            <>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Nombre</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} 
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Icono (Emoji)</label>
                                    <input type="text" required value={modalData.data.icon} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, icon: e.target.value } })} 
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-2xl text-center focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                                    />
                                </div>
                            </>
                        ) : modalData.type === 'comuna' ? (
                            <>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Nombre Comuna</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} 
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm font-bold focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Costo Despacho</label>
                                        <input type="number" required value={modalData.data.cost} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, cost: Number(e.target.value) } })} 
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Gratis desde (Litros)</label>
                                        <input type="number" value={modalData.data.free_from || ''} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, free_from: e.target.value ? Number(e.target.value) : null } })} 
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2 text-left">Orden de Aparición</label>
                                    <input type="number" required value={modalData.data.display_order} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, display_order: Number(e.target.value) } })} 
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#E2A049]/50 transition-all" 
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                        <label className="block text-slate-100 text-sm font-black uppercase tracking-wider text-left">{modalData.data.description || modalData.data.key}</label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" checked={modalData.data.is_active} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, is_active: e.target.checked } })} 
                                                className="w-5 h-5 accent-[#E2A049] cursor-pointer" 
                                            />
                                            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest leading-none">Activo</span>
                                        </label>
                                    </div>
                                    <textarea 
                                        rows={8} 
                                        value={modalData.data.value} 
                                        onChange={e => setModalData({ ...modalData, data: { ...modalData.data, value: e.target.value } })} 
                                        className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-100 text-xs md:text-sm font-mono focus:outline-none focus:border-[#E2A049]/50 transition-all resize-y leading-relaxed" 
                                    />
                                    <div className="bg-[#E2A049]/5 p-4 rounded-2xl border border-[#E2A049]/10">
                                        <p className="m-0 text-[10px] text-[#E2A049] font-black uppercase tracking-widest mb-1.5">Variables dinámicas:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(modalData.data.category === 'calendar' 
                                                ? ['full_name', 'guests', 'phone', 'link', 'comments', 'items_list', 'shipping_cost', 'total_price', 'payments_summary'] 
                                                : ['full_name', 'event_date', 'first_name', 'quote_url']
                                            ).map(variable => (
                                                <code key={variable} className="bg-black/20 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-white/5">{`{{${variable}}}`}</code>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <button type="submit" disabled={isPending} 
                            className="mt-2 w-full py-4 bg-gradient-to-br from-[#E2A049] to-[#c8872e] rounded-2xl text-white font-black text-base shadow-xl shadow-orange-950/20 active:scale-95 transition-all border-none cursor-pointer disabled:opacity-50"
                        >
                            {isPending ? '⏳ Guardando...' : 'Guardar Cambios'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
