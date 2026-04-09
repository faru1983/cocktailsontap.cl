'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { 
    saveReminderTemplate, deleteReminderTemplate, sendBatchReminders, sendTestReminderEmail, logReminderSend 
} from '@/app/actions/admin/adminActions';
import { SITE_URL } from '@/lib/config';
import { 
    Mail, MessageSquare, Trash2, Edit2, Plus, 
    X, Check, Send, Smartphone, Calendar,
    ExternalLink, Filter, List, LayoutGrid,
    TestTube, Info
} from 'lucide-react';

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

interface Template {
    id: string;
    name: string;
    subject?: string;
    content: string;
    type: string;
}

export default function RemindersClient({ initialQuotes, initialTemplates }: { initialQuotes: any[], initialTemplates: Template[] }) {
    const [quotes, setQuotes] = useState(initialQuotes);
    const [templates, setTemplates] = useState(initialTemplates);
    const [tab, setTab] = useState<'list' | 'templates'>('list');
    const [isPending, startTransition] = useTransition();
    const [isTesting, setIsTesting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    // Filter state
    const [filterType, setFilterType] = useState('this_month'); // '7', 'this_month', 'next_month', 'all'
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Template Form state
    const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);

    // Modals state
    const [batchModal, setBatchModal] = useState<{ show: boolean, templateId: string }>({ show: false, templateId: '' });
    const [waModal, setWaModal] = useState<{ show: boolean, quote: any, templateId: string }>({ show: false, quote: null, templateId: '' });
    const [testModal, setTestModal] = useState<{ show: boolean, template: Template | null }>({ show: false, template: null });
    const [testInp, setTestInp] = useState({ email: '', phone: '' });

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Logic ──

    const filteredQuotes = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return quotes.filter(q => {
            if (filterType === 'all') return true;
            
            const eventDate = new Date(q.event_date + 'T12:00:00');

            if (filterType === '7') {
                const limit = new Date();
                limit.setDate(now.getDate() + 7);
                return eventDate >= now && eventDate <= limit;
            }

            if (filterType === 'this_month') {
                return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
            }

            if (filterType === 'next_month') {
                const nextMonth = (currentMonth + 1) % 12;
                const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
                return eventDate.getMonth() === nextMonth && eventDate.getFullYear() === nextYear;
            }

            return true;
        });
    }, [quotes, filterType]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredQuotes.length) setSelectedIds([]);
        else setSelectedIds(filteredQuotes.map(q => q.id));
    };

    // ── Template Actions ──

    const handleSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            id: editingTemplate?.id,
            name: formData.get('name') as string,
            subject: formData.get('subject') as string,
            content: formData.get('content') as string,
            type: formData.get('type') as string,
        };

        startTransition(async () => {
            const res = await saveReminderTemplate(data);
            if (res.success) {
                showToast('Plantilla guardada');
                setEditingTemplate(null);
                window.location.reload(); 
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleDeleteTemplate = (id: string) => {
        if (!confirm('¿Borrar esta plantilla?')) return;
        startTransition(async () => {
            const res = await deleteReminderTemplate(id);
            if (res.success) {
                showToast('Plantilla eliminada');
                setTemplates(prev => prev.filter(t => t.id !== id));
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleTestReminder = async (type: 'email' | 'wa') => {
        if (!testModal.template) return;
        setIsTesting(true);
        try {
            if (type === 'email') {
                if (!testInp.email) return showToast('Ingresa un email', false);
                const res = await sendTestReminderEmail(testInp.email, { 
                    subject: testModal.template.subject || 'Recordatorio de tu evento 🍸', 
                    content: testModal.template.content 
                });
                if (res.success) showToast('Email de prueba enviado');
                else showToast(res.error || 'Error', false);
            } else {
                if (!testInp.phone) return showToast('Ingresa un teléfono', false);
                const testQuote = {
                    client_name: 'Cliente Prueba',
                    client_phone: testInp.phone,
                    event_date: new Date().toISOString().split('T')[0],
                    total_price: 150000,
                    token: 'test-token'
                };
                const url = getWhatsAppUrl(testQuote, testModal.template);
                if (url) window.open(url, '_blank');
            }
        } catch (e) { showToast('Error al procesar prueba', false); }
        finally { setIsTesting(false); }
    };

    // ── Email Batch Sending ──

    const handleBatchSend = () => {
        if (selectedIds.length === 0) return showToast('Selecciona al menos una cotización', false);
        setBatchModal({ show: true, templateId: templates[0]?.id || '' });
    };

    const executeBatchSend = () => {
        startTransition(async () => {
            const res = await sendBatchReminders(selectedIds, batchModal.templateId);
            if (res.success) {
                showToast(`Proceso completado. Revisa los resultados.`);
                setBatchModal({ show: false, templateId: '' });
                setSelectedIds([]);
            } else showToast(res.error || 'Error', false);
        });
    };

    // ── WhatsApp Sending ──

    const handleWaClick = (quote: any) => {
        setWaModal({ show: true, quote, templateId: templates[0]?.id || '' });
    };

    const executeWaSend = () => {
        const template = templates.find(t => t.id === waModal.templateId);
        if (!template || !waModal.quote) return;
        const url = getWhatsAppUrl(waModal.quote, template);
        if (url) {
            window.open(url, '_blank');
            // Log the send
            startTransition(async () => {
                await logReminderSend(waModal.quote.id, template.id, 'whatsapp');
            });
            setWaModal({ show: false, quote: null, templateId: '' });
        }
    };

    const getWhatsAppUrl = (quote: any, template: Template) => {
        const phone = quote.client_phone?.replace(/\D/g, '');
        if (!phone) return null;

        const eventDateStr = quote.event_date 
            ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) 
            : 'por confirmar';
        const totalStr = formatCLP(quote.total_price);
        
        let msg = template.content
            .replace(/\\n/g, '\n') // Fix literal \n
            .replace(/{nombre}/g, `*${quote.client_name}*`)
            .replace(/{fecha}/g, `*${eventDateStr}*`)
            .replace(/{total}/g, `*${totalStr}*`)
            .replace(/{link}/g, quote.token ? `${SITE_URL}/cotizar/${quote.token}` : '');

        const base = phone.startsWith('56') ? phone : '56' + phone;
        return `https://wa.me/${base}?text=${encodeURIComponent(msg)}`;
    };

    return (
        <div className="pb-16 w-full">
            {/* Toast Container */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[9999] px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-300 flex items-center gap-3 ${
                    toast.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                    {toast.ok ? <Check size={18} /> : <Info size={18} />}
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1">Recordatorios</h1>
                    <p className="text-slate-500 text-sm">Gestiona el seguimiento de cotizaciones pendientes</p>
                </div>
                {tab === 'templates' && (
                    <button 
                        className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-[#E2A049]/10"
                        onClick={() => setEditingTemplate({ name: '', content: '', type: 'both' })}
                    >
                       <Plus size={18} /> Nueva Plantilla
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 border-b border-white/5 mb-8 pb-3 overflow-x-auto scrollbar-none">
                <button 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                        tab === 'list' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                    }`} 
                    onClick={() => setTab('list')}
                >
                    <List size={16} /> Listado de Pendientes
                </button>
                <button 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                        tab === 'templates' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                    }`} 
                    onClick={() => setTab('templates')}
                >
                    <LayoutGrid size={16} /> Gestionar Plantillas
                </button>
            </div>

            {tab === 'list' && (
                <div className="animate-in fade-in duration-500">
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <div className="flex-1 min-w-[200px] relative">
                             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                             <select className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-[#E2A049] transition-colors text-sm appearance-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="7">Próximos 7 días</option>
                                <option value="this_month">De este mes</option>
                                <option value="next_month">Del próximo mes</option>
                                <option value="all">Ver todas</option>
                            </select>
                        </div>
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-tight">{filteredQuotes.length} borradores encontrados</span>
                        
                        {selectedIds.length > 0 && (
                            <button className="bg-[#E2A049] text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#E2A049]/10 active:scale-95 transition-transform" onClick={handleBatchSend}>
                                <Mail size={14} /> Email Masivo ({selectedIds.length})
                            </button>
                        )}
                        <label className="flex items-center gap-2 text-slate-500 text-xs font-bold cursor-pointer hover:text-slate-300 transition-colors ml-auto md:ml-0">
                            <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-black/20 accent-[#E2A049]" checked={selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0} onChange={toggleSelectAll} />
                            Todos
                        </label>
                    </div>

                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    <th className="py-4 px-6 text-left border-b border-white/5"><input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-black/20 accent-[#E2A049]" checked={selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0} onChange={toggleSelectAll} /></th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Cliente</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Fecha Evento</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Total</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Último Envío</th>
                                    <th className="text-right py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuotes.length === 0 ? (
                                    <tr><td colSpan={6} className="py-20 text-center text-slate-500 text-sm italic">No hay borradores para este rango.</td></tr>
                                ) : filteredQuotes.map((q: any) => (
                                    <tr key={q.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors group">
                                        <td className="py-4 px-6"><input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-black/20 accent-[#E2A049]" checked={selectedIds.includes(q.id)} onChange={() => toggleSelect(q.id)} /></td>
                                        <td className="py-4 px-6">
                                            <div className="text-white font-bold text-sm tracking-tight">{q.client_name} {q.client_lastname}</div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-400 text-sm">{new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL')}</td>
                                        <td className="py-4 px-6 text-[#E2A049] font-black text-sm">{formatCLP(q.total_price)}</td>
                                        <td className="py-4 px-6">
                                            {q.reminder_logs?.[0] ? (
                                                <div className="flex flex-col">
                                                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                                        {new Date(q.reminder_logs[0].sent_at).toLocaleDateString('es-CL')}
                                                        {q.reminder_logs[0].channel === 'email' ? <Mail size={12} /> : <Smartphone size={12} />}
                                                    </span>
                                                    <span className="text-[10px] text-slate-600 truncate max-w-[120px]">
                                                        {templates.find(t => t.id === q.reminder_logs[0].template_id)?.name || 'Plantilla borrada'}
                                                    </span>
                                                </div>
                                            ) : <span className="text-slate-600 text-xs italic">Nunca</span>}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button disabled={!q.client_phone} onClick={() => handleWaClick(q)} className="p-2.5 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-30" title="WhatsApp"><MessageSquare size={16} /></button>
                                                <Link href={`/admin/quotes/${q.id}`} className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all" title="Ver Ficha"><ExternalLink size={16} /></Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 mt-4 md:hidden">
                        {filteredQuotes.map((q: any) => (
                            <div key={q.id} className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-lg relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <input type="checkbox" className="w-5 h-5 rounded border-white/10 bg-black/20 accent-[#E2A049] mt-1" checked={selectedIds.includes(q.id)} onChange={() => toggleSelect(q.id)} />
                                        <div>
                                            <div className="text-white font-black text-base leading-tight">{q.client_name} {q.client_lastname}</div>
                                            <div className="text-[#E2A049] font-black text-sm mt-1">{formatCLP(q.total_price)}</div>
                                        </div>
                                    </div>
                                    <Link href={`/admin/quotes/${q.id}`} className="p-2.5 bg-white/5 text-slate-400 rounded-xl"><ExternalLink size={16}/></Link>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                    <div>
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Evento</span>
                                        <span className="text-slate-300 text-xs font-bold flex items-center gap-1.5"><Calendar size={12} className="text-emerald-500"/> {new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL')}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Último Envío</span>
                                        <span className="text-slate-300 text-xs font-bold">
                                            {q.reminder_logs?.[0] ? new Date(q.reminder_logs[0].sent_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                                        </span>
                                    </div>
                                </div>
                                <button disabled={!q.client_phone} onClick={() => handleWaClick(q)} className="w-full mt-4 py-3 bg-emerald-500 text-emerald-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-30">
                                    <MessageSquare size={14} /> Contactar por WhatsApp
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'templates' && (
                <div className="animate-in fade-in duration-500">
                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 mb-8 flex flex-col md:flex-row items-center gap-6 shadow-xl">
                        <div className="p-4 bg-[#E2A049]/10 rounded-2xl text-[#E2A049]">
                            <Info size={32} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-black text-lg mb-1 tracking-tight">Variables de Personalización</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Mejora la respuesta usando etiquetas dinámicas en el contenido: 
                                <span className="inline-block mx-1 px-2 py-0.5 bg-black/30 rounded border border-white/10 font-mono text-[#E2A049] text-xs">{"{nombre}"}</span>, 
                                <span className="inline-block mx-1 px-2 py-0.5 bg-black/30 rounded border border-white/10 font-mono text-[#E2A049] text-xs">{"{fecha}"}</span>, 
                                <span className="inline-block mx-1 px-2 py-0.5 bg-black/30 rounded border border-white/10 font-mono text-[#E2A049] text-xs">{"{total}"}</span> y 
                                <span className="inline-block mx-1 px-2 py-0.5 bg-black/30 rounded border border-white/10 font-mono text-[#E2A049] text-xs">{"{link}"}</span>.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {templates.map(t => (
                            <div key={t.id} className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-2xl hover:border-white/10 transition-all group relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 p-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setTestModal({ show: true, template: t })} className="p-2 bg-sky-500/10 text-sky-400 rounded-lg group-hover:scale-100 scale-90 transition-transform" title="Probar"><TestTube size={14}/></button>
                                    <button onClick={() => setEditingTemplate(t)} className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-100 scale-90 transition-transform" title="Editar"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDeleteTemplate(t.id)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg group-hover:scale-100 scale-90 transition-transform" title="Eliminar"><Trash2 size={14}/></button>
                                </div>
                                
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${t.type === 'both' ? 'bg-amber-400' : t.type === 'email' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Canal: {t.type}</span>
                                    </div>
                                    <h3 className="text-white font-black text-lg line-clamp-1">{t.name}</h3>
                                </div>

                                <div className="space-y-4 flex-1">
                                    <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-slate-400 text-xs italic line-clamp-4 leading-relaxed h-[100px] overflow-hidden relative">
                                        {t.content}
                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1b1f2b] to-transparent" />
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-tight flex items-center gap-2 truncate">
                                        <Mail size={10}/> {t.subject || 'Sin asunto (Email)'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals Implementation (Minimalist Layer) */}
            {editingTemplate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setEditingTemplate(null)}></div>
                    <form className="relative w-full max-w-xl bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200" onSubmit={handleSaveTemplate}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-xl font-black">{editingTemplate.id ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
                            <button type="button" onClick={() => setEditingTemplate(null)} className="text-slate-500 hover:text-white p-2 rounded-full hover:bg-white/5"><X size={20}/></button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Nombre Identificador</label>
                                <input name="name" defaultValue={editingTemplate.name} required className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" placeholder="Ej: Primer Seguimiento" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Canal de Envío</label>
                                    <select name="type" defaultValue={editingTemplate.type} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" required>
                                        <option value="both">Ambos Canales</option>
                                        <option value="email">Sólo Email</option>
                                        <option value="whatsapp">Sólo WhatsApp</option>
                                    </select>
                                </div>
                                <div className="opacity-60 pointer-events-none">
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Prioridad (WIP)</label>
                                    <div className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-slate-600 text-sm">Media</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Asunto (Solo para Email)</label>
                                <input name="subject" defaultValue={editingTemplate.subject} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" placeholder="Te recordamos tu cotización en Cocktails on Tap" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Contenido del Mensaje</label>
                                <textarea name="content" defaultValue={editingTemplate.content} required rows={8} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-white outline-none focus:border-[#E2A049] transition-colors text-sm resize-none leading-relaxed" placeholder="Hola {nombre}, te escribimos para..." />
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8">
                            <button type="button" className="flex-1 bg-white/5 text-slate-400 py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-transform" onClick={() => setEditingTemplate(null)}>Cancelar</button>
                            <button type="submit" className="flex-1 bg-[#E2A049] text-black py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-transform flex items-center justify-center gap-2" disabled={isPending}>
                                <Check size={16}/> Guardar Plantilla
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Test Modal Implementation */}
            {testModal.show && testModal.template && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setTestModal({ show: false, template: null })}></div>
                    <div className="relative w-full max-w-lg bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-xl font-black flex items-center gap-3"><TestTube className="text-sky-400" size={24}/> Laboratorio de Pruebas</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            Simula un envío para la plantilla <span className="text-[#E2A049] font-bold">"{testModal.template.name}"</span>.
                        </p>

                        <div className="space-y-6">
                            {(testModal.template.type === 'both' || testModal.template.type === 'email') && (
                                <div className="bg-black/20 border border-white/5 p-6 rounded-2xl">
                                    <label className="block text-sky-400 text-[10px] font-black uppercase tracking-widest mb-4">Simulador de Email</label>
                                    <div className="flex gap-3">
                                        <input type="email" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-sky-400 transition-colors" placeholder="tu@email.com" value={testInp.email} onChange={e => setTestInp(prev => ({ ...prev, email: e.target.value }))} />
                                        <button className="bg-sky-500 text-sky-950 px-5 rounded-xl font-black text-xs active:scale-95 transition-transform disabled:opacity-30 flex items-center gap-2" onClick={() => handleTestReminder('email')} disabled={isTesting || !testInp.email}>
                                            <Send size={14}/> {isTesting ? '...' : 'Enviar'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(testModal.template.type === 'both' || testModal.template.type === 'whatsapp') && (
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl">
                                    <label className="block text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">Simulador de WhatsApp</label>
                                    <div className="flex gap-3">
                                        <input type="tel" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-400 transition-colors" placeholder="56912345678" value={testInp.phone} onChange={e => setTestInp(prev => ({ ...prev, phone: e.target.value }))} />
                                        <button className="bg-emerald-500 text-emerald-950 px-5 rounded-xl font-black text-xs active:scale-95 transition-transform disabled:opacity-30 flex items-center gap-2" onClick={() => handleTestReminder('wa')} disabled={!testInp.phone}>
                                            <MessageSquare size={14}/> Abrir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className="w-full mt-8 py-3.5 bg-white/5 text-slate-500 text-xs font-black rounded-2xl hover:text-white transition-colors" onClick={() => setTestModal({ show: false, template: null })}>Cerrar Laboratorio</button>
                    </div>
                </div>
            )}

            {/* Batch Send Modal */}
            {batchModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setBatchModal({ show: false, templateId: '' })}></div>
                    <div className="relative w-full max-w-md bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-white text-xl font-black mb-1">Envío Masivo</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            Se enviará un recordatorio por email a <span className="text-white font-black">{selectedIds.length}</span> contactos.
                        </p>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Selecciona Plantilla a utilizar</label>
                                <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" value={batchModal.templateId} onChange={e => setBatchModal(m => ({ ...m, templateId: e.target.value }))}>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            <button className="w-full bg-[#E2A049] text-black py-4 rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50" onClick={executeBatchSend} disabled={isPending || !batchModal.templateId}>
                                <Send size={18}/>
                                {isPending ? 'Procesando Envío...' : 'Confirmar y Enviar'}
                            </button>
                            <button className="w-full py-3 text-slate-600 text-xs font-bold hover:text-slate-400 transition-colors" onClick={() => setBatchModal({ show: false, templateId: '' })}>Abortar Proceso</button>
                        </div>
                    </div>
                </div>
            )}

            {/* WA Selection Modal */}
            {waModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setWaModal({ show: false, quote: null, templateId: '' })}></div>
                    <div className="relative w-full max-w-md bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-white text-xl font-black mb-1 flex items-center gap-3"><MessageSquare className="text-emerald-400" size={24}/> Canal WhatsApp</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            Personaliza el mensaje para <span className="text-white font-black">{waModal.quote.client_name}</span>.
                        </p>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Plantilla de Conversación</label>
                                <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors text-sm font-bold" value={waModal.templateId} onChange={e => setWaModal(m => ({ ...m, templateId: e.target.value }))}>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            <button className="w-full bg-emerald-500 text-emerald-950 py-4 rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-3" onClick={executeWaSend} disabled={!waModal.templateId}>
                                <ExternalLink size={18}/> Abrir Aplicación
                            </button>
                            <button className="w-full py-3 text-slate-600 text-xs font-bold hover:text-slate-400 transition-colors" onClick={() => setWaModal({ show: false, quote: null, templateId: '' })}>Regresar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
