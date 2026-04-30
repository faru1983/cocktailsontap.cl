'use client';

import React from 'react';
import { useState, useTransition } from 'react';
import { 
    saveAdminSettings, 
    sendTestReviewEmail, 
    saveEventType, 
    deleteEventType, 
    saveComuna, 
    deleteComuna,
    updateSiteSetting,
    updateQuickComunaField
} from '@/app/actions/admin/adminActions';
import Modal from '@/components/admin/Modal';
import { 
    Plus, Trash2, Edit2, MapPin, Calendar, Layout, Cpu, 
    Mail, Star, Settings, MessageSquare, Check, X, RefreshCw, ArrowUpDown
} from 'lucide-react';
import { ICON_CATALOG, renderIconFromKey } from '@/lib/icons';

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
    const [savingId, setSavingId] = useState<string | null>(null);
    const [sortComunas, setSortComunas] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'display_order', dir: 'asc' });

    const handleQuickSaveComuna = async (id: string, field: 'cost' | 'direct_sale_delivery_cost' | 'free_from', value: string) => {
        const numValue = value === '' ? (field === 'free_from' ? null : 0) : parseInt(value);
        
        // Find current value to avoid redundant saves
        const current = initialComunas.find(c => c.id === id);
        if (current && current[field] === numValue) return;

        setSavingId(`${id}-${field}`);
        try {
            await updateQuickComunaField(id, { [field]: numValue });
        } catch (err: any) {
            console.error(err);
            alert('Error al guardar: ' + err.message);
        } finally {
            setSavingId(null);
        }
    };

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
                type === 'event' ? { name: '', icon: 'GlassWater', display_order: 0 } : 
                type === 'comuna' ? { name: '', cost: 0, free_from: null, display_order: 0, direct_sale_delivery_cost: 0 } :
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

    const toggleSortComuna = (key: string) => {
        setSortComunas(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    };

    const sortedComunas = [...initialComunas].sort((a, b) => {
        let valA = a[sortComunas.key];
        let valB = b[sortComunas.key];
        
        if (valA === null || valA === undefined) valA = 0;
        if (valB === null || valB === undefined) valB = 0;
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortComunas.dir === 'asc' ? -1 : 1;
        if (valA > valB) return sortComunas.dir === 'asc' ? 1 : -1;
        return 0;
    });

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

    const renderIcon = (iconKey: string, size: number = 24, className?: string) => {
        return renderIconFromKey(iconKey, size, className);
    };

    return (
        <div className="pb-16 w-full">
            {/* Header Simplified */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1 capitalize">Configuración</h1>
                    <p className="text-slate-500 text-sm">Gestión avanzada del sistema</p>
                </div>
            </div>

            {/* Tabs matching the new standard */}
            <div className="flex gap-1.5 border-b border-white/5 mb-8 pb-3 overflow-x-auto scrollbar-none">
                {[
                    { id: 'review', label: 'Post-Venta' },
                    { id: 'events', label: 'Eventos' },
                    { id: 'comunas', label: 'Comunas' },
                    { id: 'system', label: 'Cerebro Central' }
                ].map((t: any) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            tab === t.id ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-500">
                {/* ─── TAB: REVIEW ───────────────────────────────────────────────────── */}
                {tab === 'review' && (
                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 md:p-8 max-w-2xl shadow-xl">
                        <h2 className="text-white text-lg font-black mb-6 flex items-center gap-3"><Star className="text-[#E2A049]" size={22} /> Email de Reseñas</h2>
                        <form action={handleSaveGeneral} className="flex flex-col gap-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Modo de envío</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[{ v: 'manual', l: 'Manual' }, { v: 'auto', l: 'Automático' }].map(opt => (
                                        <label key={opt.v} className={`flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
                                            mode === opt.v 
                                            ? 'border-[#E2A049] bg-[rgba(226,160,73,0.08)]' 
                                            : 'border-white/5 bg-white/3'
                                        }`}>
                                            <input type="radio" name="review_mode" value={opt.v} checked={mode === opt.v} onChange={() => setMode(opt.v)} className="accent-[#E2A049]" />
                                            <span className={`text-sm font-black ${mode === opt.v ? 'text-[#E2A049]' : 'text-slate-400'}`}>{opt.l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Enlace de Calificación Google</label>
                                <input type="url" name="review_link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://g.page/..." 
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Plantilla de Correo <span className="text-slate-600 lowercase ml-2 font-bold">(Usa {'{nombre}'} para nombre cliente)</span></label>
                                <textarea name="review_template" value={template} onChange={e => setTemplate(e.target.value)} rows={6} 
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-white outline-none focus:border-[#E2A049] transition-colors text-sm resize-none leading-relaxed" 
                                />
                            </div>
                            <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6">
                                <button type="submit" disabled={isPending} 
                                    className="w-full sm:w-auto bg-[#E2A049] text-black px-8 py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-[#E2A049]/10 disabled:opacity-50"
                                >
                                    {isPending ? <RefreshCw className="animate-spin" size={16}/> : saved ? <Check size={16}/> : <Check size={16}/>}
                                    {isPending ? 'Procesando' : saved ? 'Guardado Exitosamente' : 'Actualizar Plantilla'}
                                </button>
                                
                                <div className="flex w-full sm:w-auto gap-3 items-center">
                                    <input type="email" placeholder="Email de simulación" value={testEmail} onChange={e => setTestEmail(e.target.value)} 
                                        className="flex-1 sm:w-48 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-sky-500 transition-colors" 
                                    />
                                    <button type="button" onClick={handleTest} disabled={isTesting || !testEmail} 
                                        className="bg-sky-500/10 text-sky-400 px-4 py-2 rounded-xl font-bold text-xs hover:bg-sky-500/20 active:scale-95 transition-all disabled:opacity-30"
                                    >
                                        {isTesting ? 'Procesando...' : 'Enviar Prueba'}
                                    </button>
                                </div>
                            </div>
                            {testResult && (
                                <div className={`text-xs font-bold p-3 rounded-lg flex items-center gap-2 ${testResult.s ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                    {testResult.s ? <Check size={14}/> : <X size={14}/>} {testResult.m}
                                </div>
                            )}
                        </form>
                    </div>
                )}

                {/* ─── TAB: EVENTS ───────────────────────────────────────────────────── */}
                {tab === 'events' && (
                    <div className="max-w-4xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-white text-lg font-black">Repertorio de Eventos</h2>
                            <button onClick={() => openModal('event')} 
                                className="bg-[#E2A049] text-black px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-[#E2A049]/10"
                            >
                                <Plus size={16} /> <span className="hidden sm:inline">Nuevo Tipo</span>
                            </button>
                        </div>

                        {/* Table View (Desktop) */}
                        <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02]">
                                        <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Icono</th>
                                        <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Denominación</th>
                                        <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Orden</th>
                                        <th className="text-right px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {initialEventTypes.map(item => (
                                        <tr key={item.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="w-10 h-10 flex items-center justify-center bg-black/30 shadow-inner rounded-xl border border-white/5 text-[#E2A049]">
                                                    {renderIcon(item.icon, 20)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-white font-bold text-sm">{item.name}</td>
                                            <td className="px-6 py-4 text-slate-500 font-bold text-xs">#{item.display_order}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => openModal('event', item)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(item.id, item.name, 'event')} className="p-2 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Card View (Mobile) */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {initialEventTypes.map(item => (
                                <div key={item.id} className="bg-[#1e2433] p-4 rounded-xl border border-white/5 shadow-md flex justify-between items-center transition-transform active:scale-[0.98]">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 flex items-center justify-center bg-black/40 rounded-xl border border-white/5 text-[#E2A049] shrink-0 shadow-inner">
                                            {renderIcon(item.icon, 20)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-white font-bold text-base truncate">{item.name}</div>
                                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Orden: {item.display_order}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => openModal('event', item)} className="p-2.5 bg-white/5 rounded-lg text-slate-400 hover:text-[#E2A049]"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(item.id, item.name, 'event')} className="p-2.5 bg-rose-500/10 rounded-lg text-rose-400"><Trash2 size={16} /></button>
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
                            <h2 className="text-white text-lg font-black">Cobertura y Despacho</h2>
                            <button onClick={() => openModal('comuna')} 
                                className="bg-[#E2A049] text-black px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-[#E2A049]/10"
                            >
                                <Plus size={16} /> <span className="hidden sm:inline">Nueva Comuna</span>
                            </button>
                        </div>

                        {/* Table View (Desktop) */}
                        <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-white/[0.02]">
                                        <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSortComuna('name')}>
                                            <div className="flex items-center gap-1">Ubicación <ArrowUpDown size={10} className="opacity-50" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSortComuna('cost')}>
                                            <div className="flex items-center gap-1">Tarifa Normal <ArrowUpDown size={10} className="opacity-50" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSortComuna('direct_sale_delivery_cost')}>
                                            <div className="flex items-center gap-1">Traslado Directo <ArrowUpDown size={10} className="opacity-50" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSortComuna('free_from')}>
                                            <div className="flex items-center gap-1">Beneficio Mayorista <ArrowUpDown size={10} className="opacity-50" /></div>
                                        </th>
                                        <th className="text-right px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedComunas.map(item => (
                                        <tr key={item.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors group">
                                            <td className="px-6 py-4 text-white font-bold text-sm">{item.name}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 group/input">
                                                    <span className="text-slate-600 text-xs font-bold">$</span>
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.cost || 0}
                                                        className={`bg-transparent border-none p-0 w-20 text-[#E2A049] text-sm font-black focus:ring-0 outline-none hover:bg-white/5 rounded px-1 transition-all ${savingId === `${item.id}-cost` ? 'opacity-30' : ''}`}
                                                        onBlur={(e) => handleQuickSaveComuna(item.id, 'cost', e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                    />
                                                    {savingId === `${item.id}-cost` && <RefreshCw size={10} className="text-[#E2A049] animate-spin" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 group/input">
                                                    <span className="text-slate-600 text-xs font-bold">$</span>
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.direct_sale_delivery_cost || 0}
                                                        className={`bg-transparent border-none p-0 w-20 text-sky-400 text-sm font-black focus:ring-0 outline-none hover:bg-white/5 rounded px-1 transition-all ${savingId === `${item.id}-direct_sale_delivery_cost` ? 'opacity-30' : ''}`}
                                                        onBlur={(e) => handleQuickSaveComuna(item.id, 'direct_sale_delivery_cost', e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                    />
                                                    {savingId === `${item.id}-direct_sale_delivery_cost` && <RefreshCw size={10} className="text-[#E2A049] animate-spin" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 group/input">
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.free_from || ''}
                                                        placeholder="N/A"
                                                        className={`bg-transparent border-none p-0 w-12 text-emerald-400 text-xs font-bold focus:ring-0 outline-none hover:bg-white/5 rounded px-1 transition-all ${savingId === `${item.id}-free_from` ? 'opacity-30' : ''}`}
                                                        onBlur={(e) => handleQuickSaveComuna(item.id, 'free_from', e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                    />
                                                    <span className="text-slate-600 text-[10px] font-bold">L</span>
                                                    {savingId === `${item.id}-free_from` && <RefreshCw size={10} className="text-[#E2A049] animate-spin" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => openModal('comuna', item)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(item.id, item.name, 'comuna')} className="p-2 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Card View (Mobile) */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {sortedComunas.map(item => (
                                <div key={item.id} className="bg-[#1e2433] p-4 rounded-xl border border-white/5 shadow-md flex justify-between items-center transition-all active:scale-[0.98]">
                                    <div>
                                        <div className="text-white font-black text-base mb-1">{item.name}</div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[#E2A049] font-black text-sm">{formatCLP(item.cost)} <span className="text-slate-600 font-bold ml-1">/ Evento</span></span>
                                            <span className="text-sky-400 font-black text-[10px]">{formatCLP(item.direct_sale_delivery_cost)} <span className="text-slate-600 font-bold ml-1">/ Directo</span></span>
                                            {item.free_from && (
                                                <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest drop-shadow-sm">Envio gratis desde {item.free_from}L</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => openModal('comuna', item)} className="p-2.5 bg-white/5 rounded-lg text-slate-400 hover:text-[#E2A049]"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(item.id, item.name, 'comuna')} className="p-2.5 bg-rose-500/10 rounded-lg text-rose-400"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── TAB: SYSTEM (Cerebro Central) ────────────────────────────────── */}
                {tab === 'system' && (
                    <div className="max-w-6xl">
                        <div className="mb-6">
                            <h2 className="text-white text-lg font-black mb-1">Automatizaciones y Configuración</h2>
                            <p className="text-slate-500 text-sm">Gestionar plantillas de comunicación, agenda y reglas globales.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {['emails', 'calendar', 'contacts'].map(cat => (
                                <div key={cat} className="flex flex-col h-full bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-xl">
                                    <h3 className="text-white text-sm font-black mb-5 flex items-center gap-3">
                                        <span className={`p-2 rounded-xl ${cat === 'emails' ? 'bg-sky-500/10 text-sky-400' : cat === 'calendar' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {cat === 'emails' ? <Mail size={16} /> : cat === 'calendar' ? <Calendar size={16} /> : <Cpu size={16} />}
                                        </span>
                                        {cat === 'emails' ? 'Plantillas de Correo' : cat === 'calendar' ? 'Eventos Google Calendar' : 'Integración G-Contacts'}
                                    </h3>
                                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin scrollbar-thumb-white/10">
                                        {siteSettings.filter((s: any) => s.category === cat).map((setting: any) => {
                                            const isDirect = setting.key.includes('direct_sale');
                                            const isDraft = setting.key.includes('draft');
                                            const isConfirmed = setting.key.includes('confirmed') && !isDirect;

                                            return (
                                                <div key={setting.id} onClick={() => openModal('system', setting)} 
                                                    className="group bg-black/20 hover:bg-black/40 p-4 rounded-xl border border-white/5 hover:border-[#E2A049]/30 cursor-pointer transition-all active:scale-[0.98]"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-white text-xs font-black group-hover:text-[#E2A049] transition-colors">{setting.description || setting.key}</span>
                                                            <div className="flex gap-1.5 items-center">
                                                                {isDirect ? (
                                                                    <span className="text-[7px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-sky-500/10">Compra Directa</span>
                                                                ) : (
                                                                    <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-emerald-500/10">Evento</span>
                                                                )}
                                                                {isDraft && <span className="text-[7px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Borrador</span>}
                                                                {isConfirmed && <span className="text-[7px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Confirmación</span>}
                                                            </div>
                                                        </div>
                                                        {!setting.is_active && (
                                                            <span className="text-[8px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">Inactivo</span>
                                                        )}
                                                    </div>
                                                    <p className="text-slate-400 text-[10px] leading-relaxed line-clamp-2 italic font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                                                        {setting.value}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── MODAL: EVENT / COMUNA / SYSTEM ─────────────────────────────────── */}
            {modalData.isOpen && modalData.data && (
                <Modal
                    isOpen={modalData.isOpen}
                    onClose={closeModal}
                    title={
                        modalData.type === 'event' ? (modalData.data?.id ? 'Editar Evento' : 'Nuevo Evento') : 
                        modalData.type === 'comuna' ? (modalData.data?.id ? 'Editar Comuna' : 'Nueva Comuna') :
                        'Ajuste Sensible'
                    }
                >
                    <form onSubmit={handleSaveItem} className="flex flex-col gap-6 px-1">
                        {modalData.type === 'event' ? (
                            <>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Denominación</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} 
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Representación Visual (Icono)</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[220px] overflow-y-auto p-2 bg-black/30 rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/10">
                                        {ICON_CATALOG.map((iconItem) => {
                                            const isSelected = modalData.data.icon?.toLowerCase() === iconItem.id.toLowerCase();
                                            return (
                                                <button 
                                                    key={iconItem.id} 
                                                    type="button"
                                                    onClick={() => setModalData({ ...modalData, data: { ...modalData.data, icon: iconItem.id } })}
                                                    className={`aspect-square flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${isSelected ? 'bg-[#E2A049]/20 border-[#E2A049] text-[#E2A049] shadow-inner' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'}`}
                                                    title={iconItem.name}
                                                >
                                                    {React.createElement(iconItem.component, { size: 24 })}
                                                    <span className="text-[8px] mt-1.5 font-bold truncate w-full text-center tracking-tight">{iconItem.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Ordenanza</label>
                                    <input type="number" required value={modalData.data.display_order} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, display_order: Number(e.target.value) } })} 
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm font-bold" 
                                    />
                                </div>
                            </>
                        ) : modalData.type === 'comuna' ? (
                            <>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Topónimo / Comuna</label>
                                    <input type="text" required value={modalData.data.name} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, name: e.target.value } })} 
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm font-bold" 
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Tarifa Logística ($)</label>
                                        <input type="number" required value={modalData.data.cost} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, cost: Number(e.target.value) } })} 
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[#E2A049] outline-none focus:border-[#E2A049] transition-colors text-sm font-black" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Tarifa Directo ($)</label>
                                        <input type="number" required value={modalData.data.direct_sale_delivery_cost} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, direct_sale_delivery_cost: Number(e.target.value) } })} 
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sky-400 outline-none focus:border-sky-500 transition-colors text-sm font-black" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Exención Comercial (L)</label>
                                    <input type="number" value={modalData.data.free_from || ''} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, free_from: e.target.value ? Number(e.target.value) : null } })} 
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 outline-none focus:border-emerald-500 transition-colors text-sm font-black" 
                                        placeholder="Litros para despacho gratis"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 text-left">Posición en Formulario</label>
                                    <input type="number" required value={modalData.data.display_order} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, display_order: Number(e.target.value) } })} 
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm font-bold" 
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                                        <label className="block text-white text-sm font-black tracking-tight text-left">{modalData.data.description || modalData.data.key}</label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" checked={modalData.data.is_active} onChange={e => setModalData({ ...modalData, data: { ...modalData.data, is_active: e.target.checked } })} 
                                                className="w-5 h-5 accent-[#E2A049] cursor-pointer rounded-md bg-black/40 border-white/10" 
                                            />
                                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">Habilitado</span>
                                        </label>
                                    </div>
                                    <textarea 
                                        rows={8} 
                                        value={modalData.data.value} 
                                        onChange={e => setModalData({ ...modalData, data: { ...modalData.data, value: e.target.value } })} 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-emerald-400 text-xs md:text-sm font-mono focus:outline-none focus:border-[#E2A049] transition-all resize-y leading-relaxed shadow-inner" 
                                    />
                                    <div className="bg-sky-500/5 p-4 rounded-xl border border-sky-500/10">
                                        <p className="m-0 text-[10px] text-sky-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"><Layout size={12}/> Variables Disponibles de Contexto:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(modalData.data.category === 'calendar' 
                                                ? ['full_name', 'email', 'phone', 'event_date', 'pickup_date', 'start_time', 'pickup_time', 'event_type', 'comuna', 'address', 'guests', 'total_liters', 'link', 'items_list', 'total_price', 'payments_summary', 'comments'] 
                                                : ['full_name', 'event_date', 'first_name', 'quote_url']
                                            ).map(variable => (
                                                <code key={variable} className="bg-black/30 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/5">{`{{${variable}}}`}</code>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <button type="submit" disabled={isPending} 
                            className="mt-6 w-full py-4 bg-[#E2A049] text-black rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending ? <RefreshCw className="animate-spin" size={16}/> : <Check size={16}/>}
                            {isPending ? 'Sincronizando Cambios...' : 'Consolidar Cambios al Sistema'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
