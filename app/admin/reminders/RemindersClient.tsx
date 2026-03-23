'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { 
    saveReminderTemplate, deleteReminderTemplate, sendBatchReminders, sendTestReminderEmail 
} from '@/app/actions/admin/adminActions';
import { SITE_URL } from '@/lib/config';

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
            if (res.success) showToast('Plantilla eliminada');
            else showToast(res.error || 'Error', false);
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
        <div style={{ position: 'relative' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
                    padding: '14px 20px', borderRadius: '12px',
                    background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                    border: `1px solid ${toast.ok ? '#34d399' : '#f87171'}`,
                    color: toast.ok ? '#34d399' : '#f87171',
                    fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                    {toast.ok ? '✅' : '⚠️'} {toast.msg}
                </div>
            )}

            <style>{`
                .rem-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; }
                .rem-tab { 
                    padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #64748b; background: none; border: none; transition: all 0.2s;
                }
                .rem-tab-active { background: rgba(226,160,73,0.12); color: #E2A049; }
                
                /* ── Desktop table ── */
                .rem-table-wrap { display: block; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                .rem-table { width: 100%; border-collapse: collapse; }
                .rem-table th { padding: 14px 20px; text-align: left; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; background: rgba(255,255,255,0.02); }
                .rem-table td { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.04); color: #f1f5f9; font-size: 14px; }
                
                /* ── Mobile cards ── */
                .rem-cards { display: none; flex-direction: column; gap: 12px; }
                .rem-card { 
                    background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 16px; position: relative;
                }
                .rem-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
                .rem-card-name { color: #f1f5f9; font-size: 15px; font-weight: 700; }
                .rem-card-meta { display: flex; gap: 14px; margin-bottom: 14px; }
                .rem-meta-item { display: flex; flex-direction: column; gap: 2px; }
                .rem-meta-label { color: #475569; font-size: 10px; font-weight: 600; text-transform: uppercase; }
                .rem-meta-value { color: #94a3b8; font-size: 13px; }
                .rem-card-price { color: #E2A049; font-weight: 800; font-size: 15px; }
                .rem-card-actions { display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 12px; margin-top: 12px; }

                @media(max-width: 767px) {
                    .rem-table-wrap { display: none; }
                    .rem-cards { display: flex; }
                }
                
                .rem-check { width: 18px; height: 18px; cursor: pointer; accent-color: #E2A049; }
                
                .rem-filter-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
                .rem-select { padding: 8px 12px; background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-size: 13px; cursor: pointer; outline: none; }
                
                .rem-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
                .rem-btn-primary { background: linear-gradient(135deg, #E2A049, #c8872e); color: #fff; }
                .rem-btn-outline { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; }
                .rem-btn-wa { background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.2); color: #25D366; }
                
                .rem-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 20px; }
                .rem-modal { background: #1e2433; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; max-width: 500px; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                
                .rem-temp-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 20px; margin-bottom: 12px; text-align: left; }
                .rem-tag { font-family: monospace; background: rgba(226,160,73,0.1); color: #E2A049; padding: 2px 4px; border-radius: 4px; font-size: 12px; }
            `}</style>

            <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, marginBottom: '20px' }}>🔔 Recordatorios</h1>

            <div className="rem-tabs">
                <button className={`rem-tab ${tab === 'list' ? 'rem-tab-active' : ''}`} onClick={() => setTab('list')}>Listado de Pendientes</button>
                <button className={`rem-tab ${tab === 'templates' ? 'rem-tab-active' : ''}`} onClick={() => setTab('templates')}>Gestionar Plantillas</button>
            </div>

            {tab === 'list' && (
                <div>
                    <div className="rem-filter-bar">
                        <select className="rem-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="7">Próximos 7 días</option>
                            <option value="this_month">De este mes</option>
                            <option value="next_month">Del próximo mes</option>
                            <option value="all">Ver todas</option>
                        </select>
                        <span style={{ color: '#475569', fontSize: '13px' }}>{filteredQuotes.length} borradores encontrados</span>
                        
                        {selectedIds.length > 0 && (
                            <button className="rem-btn rem-btn-primary" style={{ marginLeft: 'auto' }} onClick={handleBatchSend}>
                                📧 Email Masivo ({selectedIds.length})
                            </button>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', cursor: 'pointer', marginLeft: selectedIds.length > 0 ? '0' : 'auto' }}>
                            <input type="checkbox" className="rem-check" checked={selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0} onChange={toggleSelectAll} />
                            Todos
                        </label>
                    </div>

                    {/* ── MOBILE VIEW: Cards ── */}
                    <div className="rem-cards">
                        {filteredQuotes.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No hay borradores para este rango.</div>
                        ) : filteredQuotes.map((q: any) => (
                            <div key={q.id} className="rem-card">
                                <div className="rem-card-header">
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <input type="checkbox" className="rem-check" checked={selectedIds.includes(q.id)} onChange={() => toggleSelect(q.id)} />
                                        <div className="rem-card-name">{q.client_name} {q.client_lastname}</div>
                                    </div>
                                    <Link href={`/admin/quotes/${q.id}`} style={{ color: '#E2A049', fontSize: '12px', textDecoration: 'none', fontWeight: 700 }}>VER FICHA →</Link>
                                </div>
                                <div className="rem-card-meta">
                                    <div className="rem-meta-item">
                                        <span className="rem-meta-label">Fecha Evento</span>
                                        <span className="rem-meta-value">{new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL')}</span>
                                    </div>
                                    <div className="rem-meta-item">
                                        <span className="rem-meta-label">Total</span>
                                        <span className="rem-card-price">{formatCLP(q.total_price)}</span>
                                    </div>
                                </div>
                                <div className="rem-card-actions">
                                    <button disabled={!q.client_phone} onClick={() => handleWaClick(q)} 
                                        className="rem-btn rem-btn-wa" style={{ flex: 1, textAlign: 'center', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: q.client_phone ? 1 : 0.4 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.038 3.284l-.569 2.1c-.123.454.28.855.73.726l2.124-.609c1.048.589 2.123.915 3.313.915 3.14-.04 5.77-2.612 5.77-5.77 0-3.18-2.587-5.761-5.767-5.761zm3.336 8.356c-.113.318-.654.582-.911.62-.257.038-.501.066-1.556-.35a5.53 5.53 0 0 1-2.42-2.128c-.066-.094-.523-.695-.523-1.327 0-.632.33-.941.449-1.065.118-.124.257-.156.344-.156s.174.001.249.005c.08.004.188-.03.294.223.113.272.387.942.422 1.012.035.071.058.151.011.246-.046.094-.07.151-.139.231-.07.081-.144.179-.211.24-.075.071-.154.146-.064.301.091.156.401.66.862 1.07.593.527 1.091.69 1.246.763.156.075.246.061.34-.046.094-.108.401-.468.509-.627.108-.159.217-.133.363-.078.146.056.923.435 1.083.514.16.08.267.118.305.18.038.061.038.353-.075.671z"/></svg>
                                        Contactar por WhatsApp
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── DESKTOP VIEW: Table ── */}
                    <div className="rem-table-wrap">
                        <table className="rem-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}><input type="checkbox" className="rem-check" checked={selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0} onChange={toggleSelectAll} /></th>
                                    <th>Cliente</th>
                                    <th>Fecha Evento</th>
                                    <th>Total</th>
                                    <th>Acción WhatsApp</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuotes.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No hay borradores para este rango.</td></tr>
                                ) : filteredQuotes.map((q: any) => (
                                    <tr key={q.id}>
                                        <td><input type="checkbox" className="rem-check" checked={selectedIds.includes(q.id)} onChange={() => toggleSelect(q.id)} /></td>
                                        <td style={{ fontWeight: 700, color: '#f1f5f9' }}>{q.client_name} {q.client_lastname}</td>
                                        <td>{new Date(q.event_date + 'T12:00:00').toLocaleDateString('es-CL')}</td>
                                        <td style={{ color: '#E2A049', fontWeight: 800 }}>{formatCLP(q.total_price)}</td>
                                        <td>
                                            <button disabled={!q.client_phone} onClick={() => handleWaClick(q)} 
                                                className="rem-btn rem-btn-wa" style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', opacity: q.client_phone ? 1 : 0.4 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.038 3.284l-.569 2.1c-.123.454.28.855.73.726l2.124-.609c1.048.589 2.123.915 3.313.915 3.14-.04 5.77-2.612 5.77-5.77 0-3.18-2.587-5.761-5.767-5.761zm3.336 8.356c-.113.318-.654.582-.911.62-.257.038-.501.066-1.556-.35a5.53 5.53 0 0 1-2.42-2.128c-.066-.094-.523-.695-.523-1.327 0-.632.33-.941.449-1.065.118-.124.257-.156.344-.156s.174.001.249.005c.08.004.188-.03.294.223.113.272.387.942.422 1.012.035.071.058.151.011.246-.046.094-.07.151-.139.231-.07.081-.144.179-.211.24-.075.071-.154.146-.064.301.091.156.401.66.862 1.07.593.527 1.091.69 1.246.763.156.075.246.061.34-.046.094-.108.401-.468.509-.627.108-.159.217-.133.363-.078.146.056.923.435 1.083.514.16.08.267.118.305.18.038.061.038.353-.075.671z"/></svg>
                                                Conversar
                                            </button>
                                        </td>
                                        <td align="right"><Link href={`/admin/quotes/${q.id}`} style={{ color: '#64748b', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>Ficha →</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'templates' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Configura tus mensajes tipo. Usa <span className="rem-tag">{'{nombre}'}</span>, <span className="rem-tag">{'{fecha}'}</span>, <span className="rem-tag">{'{total}'}</span> y <span className="rem-tag">{'{link}'}</span>.</p>
                        <button className="rem-btn rem-btn-primary" onClick={() => setEditingTemplate({ name: '', content: '', type: 'both' })}>+ Nueva Plantilla</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                        {templates.map(t => (
                            <div key={t.id} className="rem-temp-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '15px' }}>{t.name}</h3>
                                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>Canal: {t.type}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="rem-btn rem-btn-outline" style={{ padding: '4px 8px' }} onClick={() => setTestModal({ show: true, template: t })} title="Probar envío">🧪</button>
                                        <button className="rem-btn rem-btn-outline" style={{ padding: '4px 8px' }} onClick={() => setEditingTemplate(t)}>✏️</button>
                                        <button className="rem-btn rem-btn-outline" style={{ padding: '4px 8px', borderColor: 'rgba(248,113,113,0.3)' }} onClick={() => handleDeleteTemplate(t.id)}>🗑️</button>
                                    </div>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Asunto: {t.subject || '—'}</div>
                                <div style={{ color: '#94a3b8', fontSize: '13px', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '8px', lineHeight: 1.5 }}>{t.content}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Test Reminder Modal */}
            {testModal.show && testModal.template && (
                <div className="rem-modal-overlay">
                    <div className="rem-modal">
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 10px', textAlign: 'left' }}>🧪 Probar Plantilla</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px', textAlign: 'left' }}>Prueba cómo se ve tu recordatorio: "{testModal.template.name}"</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Email Test */}
                            {(testModal.template.type === 'both' || testModal.template.type === 'email') && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Probar por EMAIL</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            type="email" 
                                            className="rem-select" 
                                            placeholder="correo@ejemplo.com" 
                                            style={{ flex: 1 }} 
                                            value={testInp.email} 
                                            onChange={e => setTestInp(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                        <button className="rem-btn rem-btn-primary" onClick={() => handleTestReminder('email')} disabled={isTesting || !testInp.email}>
                                            {isTesting ? '…' : 'Enviar'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* WA Test */}
                            {(testModal.template.type === 'both' || testModal.template.type === 'whatsapp') && (
                                <div style={{ background: 'rgba(37,211,102,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(37,211,102,0.1)', textAlign: 'left' }}>
                                    <label style={{ display: 'block', color: '#25D366', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Probar por WHATSAPP</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            type="tel" 
                                            className="rem-select" 
                                            placeholder="56912345678" 
                                            style={{ flex: 1 }} 
                                            value={testInp.phone} 
                                            onChange={e => setTestInp(prev => ({ ...prev, phone: e.target.value }))}
                                        />
                                        <button className="rem-btn" style={{ background: '#25D366', color: '#fff' }} onClick={() => handleTestReminder('wa')} disabled={!testInp.phone}>
                                            WhatsApp
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className="rem-btn rem-btn-outline" style={{ width: '100%', marginTop: '24px' }} onClick={() => setTestModal({ show: false, template: null })}>Cerrar</button>
                    </div>
                </div>
            )}

            {/* Modal Edit Template */}
            {editingTemplate && (
                <div className="rem-modal-overlay">
                    <form className="rem-modal" onSubmit={handleSaveTemplate}>
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 20px', textAlign: 'left' }}>{editingTemplate.id ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Nombre</label>
                                <input name="name" defaultValue={editingTemplate.name} required className="rem-select" style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Asunto (Email)</label>
                                <input name="subject" defaultValue={editingTemplate.subject} className="rem-select" style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Contenido</label>
                                <textarea name="content" defaultValue={editingTemplate.content} required rows={6} className="rem-select" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Canal</label>
                                <select name="type" defaultValue={editingTemplate.type} className="rem-select" style={{ width: '100%' }}>
                                    <option value="both">Ambos (Email & WA)</option>
                                    <option value="email">Sólo Email</option>
                                    <option value="whatsapp">Sólo WhatsApp</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button type="button" className="rem-btn rem-btn-outline" style={{ flex: 1 }} onClick={() => setEditingTemplate(null)}>Cancelar</button>
                            <button type="submit" className="rem-btn rem-btn-primary" style={{ flex: 1 }} disabled={isPending}>Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal Batch Send Email */}
            {batchModal.show && (
                <div className="rem-modal-overlay">
                    <div className="rem-modal">
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 10px', textAlign: 'left' }}>Enviar Recordatorio Masivo</h2>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>Seleccionaste <strong style={{ color: '#f1f5f9' }}>{selectedIds.length}</strong> cotizaciones para enviar por Email.</p>
                        
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Selecciona Plantilla</label>
                            <select className="rem-select" style={{ width: '100%', marginBottom: '24px' }} value={batchModal.templateId} onChange={e => setBatchModal(m => ({ ...m, templateId: e.target.value }))}>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="rem-btn rem-btn-outline" style={{ flex: 1 }} onClick={() => setBatchModal({ show: false, templateId: '' })}>Cancelar</button>
                            <button className="rem-btn rem-btn-primary" style={{ flex: 1 }} onClick={executeBatchSend} disabled={isPending || !batchModal.templateId}>
                                {isPending ? 'Enviando…' : '¡Enviar ahora!'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Select WhatsApp Template */}
            {waModal.show && (
                <div className="rem-modal-overlay">
                    <div className="rem-modal">
                        <h2 style={{ color: '#f1f5f9', fontSize: '18px', margin: '0 0 10px', textAlign: 'left' }}>Contactar por WhatsApp</h2>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>Vas a enviar un recordatorio a <strong style={{ color: '#f1f5f9' }}>{waModal.quote.client_name}</strong>.</p>
                        
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Selecciona Plantilla</label>
                            <select className="rem-select" style={{ width: '100%', marginBottom: '24px' }} value={waModal.templateId} onChange={e => setWaModal(m => ({ ...m, templateId: e.target.value }))}>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="rem-btn rem-btn-outline" style={{ flex: 1 }} onClick={() => setWaModal({ show: false, quote: null, templateId: '' })}>Cancelar</button>
                            <button className="rem-btn" style={{ flex: 1, background: '#25D366', color: '#fff' }} onClick={executeWaSend} disabled={!waModal.templateId}>
                                Abrir WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
