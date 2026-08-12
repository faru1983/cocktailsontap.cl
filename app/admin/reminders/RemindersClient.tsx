'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
    saveReminderTemplate,
    deleteReminderTemplate,
    sendBatchReminders,
    sendTestReminderEmail,
    logReminderSend,
    addReminderSuppression,
    deleteReminderSuppression,
    updateReminderCronSettings,
    runRemindersNow,
    clearReminderLogsAction,
} from '@/app/actions/admin/adminActions';
import { SITE_URL, WHATSAPP_LABEL, WHATSAPP_URL } from '@/lib/config';
import { toWhatsAppDigits } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import { formatDateCL, formatDateTimeCL, formatCurrency } from '@/lib/utils';
import { applyReminderBoldMarkup } from '@/lib/reminderMarkup';
import {
    Mail,
    MessageSquare,
    Trash2,
    Edit2,
    Plus,
    X,
    Check,
    Send,
    Smartphone,
    Calendar,
    ExternalLink,
    Filter,
    List,
    LayoutGrid,
    TestTube,
    Info,
    Activity,
    Ban,
    Settings2,
    Play,
    Zap,
    Clock,
} from 'lucide-react';

type ReminderTrigger = 'draft_event' | 'anniversary_event' | 'anniversary_direct';

interface Template {
    id: string;
    name: string;
    subject?: string | null;
    content: string;
    type: string;
    trigger?: ReminderTrigger;
    auto_enabled?: boolean;
    days_before?: number;
}

interface Suppression {
    id: string;
    email: string;
    note: string | null;
    created_at: string;
}

interface ReminderLog {
    id: string;
    quote_id: string | null;
    template_id: string | null;
    template_name?: string | null;
    channel: string;
    sent_at: string;
    client_id: string | null;
    recipient_email: string | null;
    status: string;
    error: string | null;
    trigger: string | null;
    target_date: string | null;
    source: string;
    reminder_templates?: { name: string } | null;
    quotes?: { client_name: string | null; client_email: string | null } | null;
}

interface CronSettings {
    enabled: boolean;
    hour: number;
    lastRunAt: string;
    lastRunSummary: string;
}

type Tab = 'list' | 'templates' | 'monitor' | 'suppress' | 'automation';

const TRIGGER_LABELS: Record<ReminderTrigger, string> = {
    draft_event: 'Draft (evento próximo)',
    anniversary_event: 'Aniversario eventos',
    anniversary_direct: 'Aniversario barriles',
};

const emptyTemplate = (): Partial<Template> => ({
    name: '',
    subject: '',
    content: '',
    type: 'both',
    trigger: 'draft_event',
    auto_enabled: false,
    days_before: 7,
});

const TAB_IDS: Tab[] = ['list', 'templates', 'monitor', 'suppress', 'automation'];

function parseTab(value: string | null | undefined): Tab {
    return TAB_IDS.includes(value as Tab) ? (value as Tab) : 'list';
}

export default function RemindersClient({
    initialQuotes,
    initialAnniversaryQuotes = [],
    initialTemplates,
    initialSuppressions,
    initialLogs,
    initialCron,
    initialTab = 'list',
    cronChileTime,
}: {
    initialQuotes: any[];
    initialAnniversaryQuotes?: any[];
    initialTemplates: Template[];
    initialSuppressions: Suppression[];
    initialLogs: ReminderLog[];
    initialCron: CronSettings;
    initialTab?: string;
    cronChileTime: string;
}) {
    const [quotes] = useState(initialQuotes);
    const [anniversaryQuotes] = useState(initialAnniversaryQuotes);
    const [templates, setTemplates] = useState(initialTemplates);
    const [suppressions, setSuppressions] = useState(initialSuppressions);
    const [logs, setLogs] = useState(initialLogs);
    const [cron, setCron] = useState(initialCron);
    const [tab, setTabState] = useState<Tab>(() => parseTab(initialTab));
    const [isPending, startTransition] = useTransition();
    const [isTesting, setIsTesting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const setTab = (next: Tab) => {
        setTabState(next);
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (next === 'list') url.searchParams.delete('tab');
        else url.searchParams.set('tab', next);
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    };

    const [filterType, setFilterType] = useState('this_month');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
    const [autoEnabledForm, setAutoEnabledForm] = useState(false);
    const [triggerForm, setTriggerForm] = useState<ReminderTrigger>('draft_event');

    const [batchModal, setBatchModal] = useState<{ show: boolean; templateId: string }>({
        show: false,
        templateId: '',
    });
    const [waModal, setWaModal] = useState<{ show: boolean; quote: any; templateId: string }>({
        show: false,
        quote: null,
        templateId: '',
    });
    const [testModal, setTestModal] = useState<{ show: boolean; template: Template | null }>({
        show: false,
        template: null,
    });
    const [testInp, setTestInp] = useState({ email: '', phone: '' });
    const [suppressEmail, setSuppressEmail] = useState('');
    const [suppressNote, setSuppressNote] = useState('');
    const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'failed' | 'skipped'>('all');
    const [cronEnabled, setCronEnabled] = useState(initialCron.enabled);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const isAnniversaryFilter =
        filterType === 'anniv_this_month' || filterType === 'anniv_next_month';

    const filteredQuotes = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (isAnniversaryFilter) {
            const nextMonth = (currentMonth + 1) % 12;
            const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            return anniversaryQuotes.filter((q) => {
                const ann = new Date((q.anniversary_date || q.event_date) + 'T12:00:00');
                if (filterType === 'anniv_this_month') {
                    return ann.getMonth() === currentMonth && ann.getFullYear() === currentYear;
                }
                return ann.getMonth() === nextMonth && ann.getFullYear() === nextYear;
            });
        }

        return quotes.filter((q) => {
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
    }, [quotes, anniversaryQuotes, filterType, isAnniversaryFilter]);

    const emailTemplates = useMemo(
        () => templates.filter((t) => t.type === 'both' || t.type === 'email'),
        [templates]
    );
    const waTemplates = useMemo(
        () => templates.filter((t) => t.type === 'both' || t.type === 'whatsapp'),
        [templates]
    );

    const filteredLogs = useMemo(() => {
        if (logFilter === 'all') return logs;
        return logs.filter((l) => l.status === logFilter);
    }, [logs, logFilter]);

    const lastRunSummary = useMemo(() => {
        if (!cron.lastRunSummary) return null;
        try {
            return JSON.parse(cron.lastRunSummary) as {
                sent?: number;
                failed?: number;
                skipped?: number;
                processed?: number;
                reason?: string;
                ran?: boolean;
            };
        } catch {
            return null;
        }
    }, [cron.lastRunSummary]);

    const autoTemplates = useMemo(
        () => templates.filter((t) => t.auto_enabled),
        [templates]
    );

    const cronLogs = useMemo(
        () => logs.filter((l) => l.source === 'cron').slice(0, 8),
        [logs]
    );

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredQuotes.length) setSelectedIds([]);
        else setSelectedIds(filteredQuotes.map((q) => q.id));
    };

    const openEditTemplate = (t?: Partial<Template>) => {
        const next = t ? { ...t } : emptyTemplate();
        setEditingTemplate(next);
        setAutoEnabledForm(Boolean(next.auto_enabled));
        setTriggerForm((next.trigger as ReminderTrigger) || 'draft_event');
    };

    const handleSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            id: editingTemplate?.id,
            name: formData.get('name') as string,
            subject: formData.get('subject') as string,
            content: formData.get('content') as string,
            type: formData.get('type') as string,
            trigger: triggerForm,
            auto_enabled: autoEnabledForm,
            days_before: Number(formData.get('days_before') || 7),
        };

        startTransition(async () => {
            const res = await saveReminderTemplate(data);
            if (res.success && res.template) {
                showToast('Plantilla guardada');
                setEditingTemplate(null);
                setTemplates((prev) => {
                    const idx = prev.findIndex((t) => t.id === res.template.id);
                    if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = res.template;
                        return next;
                    }
                    return [res.template, ...prev];
                });
                setTab('templates');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleDeleteTemplate = (id: string) => {
        if (!confirm('¿Borrar esta plantilla? Los envíos en Monitoreo se conservan con el nombre guardado.'))
            return;
        const tplName = templates.find((t) => t.id === id)?.name;
        startTransition(async () => {
            const res = await deleteReminderTemplate(id);
            if (res.success) {
                showToast('Plantilla eliminada');
                setTemplates((prev) => prev.filter((t) => t.id !== id));
                // UI: mantener etiqueta aunque la FK quede en null
                setLogs((prev) =>
                    prev.map((l) =>
                        l.template_id === id
                            ? {
                                  ...l,
                                  template_id: null,
                                  template_name: l.template_name || tplName || l.reminder_templates?.name || null,
                                  reminder_templates: null,
                              }
                            : l
                    )
                );
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleClearLogs = () => {
        if (!confirm('¿Limpiar todo el registro de monitoreo? Esta acción no se puede deshacer.')) return;
        startTransition(async () => {
            const res = await clearReminderLogsAction();
            if (res.success) {
                showToast(`Registro limpiado (${res.deleted ?? 0})`);
                setLogs([]);
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
                    subject: testModal.template.subject || 'Recordatorio de tu evento',
                    content: testModal.template.content,
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
                    token: 'test-token',
                };
                const url = getWhatsAppUrl(testQuote, testModal.template);
                if (url) window.open(url, '_blank');
            }
        } catch {
            showToast('Error al procesar prueba', false);
        } finally {
            setIsTesting(false);
        }
    };

    const handleBatchSend = () => {
        if (selectedIds.length === 0) return showToast('Selecciona al menos una cotización', false);
        setBatchModal({ show: true, templateId: emailTemplates[0]?.id || '' });
    };

    const executeBatchSend = () => {
        startTransition(async () => {
            const res = await sendBatchReminders(selectedIds, batchModal.templateId);
            if (res.success) {
                showToast('Proceso completado. Revisa Monitoreo.');
                setBatchModal({ show: false, templateId: '' });
                setSelectedIds([]);
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleWaClick = (quote: any) => {
        setWaModal({ show: true, quote, templateId: waTemplates[0]?.id || '' });
    };

    const executeWaSend = () => {
        const template = templates.find((t) => t.id === waModal.templateId);
        if (!template || !waModal.quote) return;
        const url = getWhatsAppUrl(waModal.quote, template);
        if (url) {
            window.open(url, '_blank');
            startTransition(async () => {
                await logReminderSend(waModal.quote.id, template.id, 'whatsapp');
            });
            setWaModal({ show: false, quote: null, templateId: '' });
        }
    };

    const getWhatsAppUrl = (quote: any, template: Template) => {
        const phone = quote.client_phone ? toWhatsAppDigits(quote.client_phone) : '';
        if (!phone) return null;
        const eventDateStr = quote.event_date
            ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
              })
            : 'por confirmar';
        const totalStr = formatCurrency(quote.total_price);
        const msg = applyReminderBoldMarkup(template.content, 'whatsapp')
            .replace(/\\n/g, '\n')
            .replace(/{nombre}/g, `*${quote.client_name}*`)
            .replace(/{fecha}/g, `*${eventDateStr}*`)
            .replace(/{total}/g, `*${totalStr}*`)
            .replace(/{link}/g, quote.token ? `${SITE_URL}/cotizar/${quote.token}` : '')
            .replace(/{whatsapp}/g, `${WHATSAPP_LABEL} (${WHATSAPP_URL})`);
        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    };

    const handleAddSuppression = () => {
        startTransition(async () => {
            const res = await addReminderSuppression(suppressEmail, suppressNote);
            if (res.success && res.suppression) {
                showToast('Email agregado a omitidos');
                setSuppressEmail('');
                setSuppressNote('');
                setSuppressions((prev) => [res.suppression, ...prev]);
                setTab('suppress');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleDeleteSuppression = (id: string) => {
        startTransition(async () => {
            const res = await deleteReminderSuppression(id);
            if (res.success) {
                setSuppressions((prev) => prev.filter((s) => s.id !== id));
                showToast('Omitido eliminado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleToggleCron = (enabled: boolean) => {
        startTransition(async () => {
            const res = await updateReminderCronSettings({ enabled });
            if (res.success) {
                setCronEnabled(enabled);
                setCron((c) => ({ ...c, enabled }));
                showToast(enabled ? 'Envío automático activado' : 'Envío automático pausado');
            } else showToast(res.error || 'Error', false);
        });
    };

    const handleRunNow = () => {
        if (!confirm('¿Enviar ahora los correos automáticos que correspondan a hoy?')) return;
        startTransition(async () => {
            const res = await runRemindersNow();
            if (res.success) {
                showToast(
                    `Job: ${res.summary?.sent ?? 0} enviados, ${res.summary?.failed ?? 0} fallidos, ${res.summary?.skipped ?? 0} omitidos`
                );
                window.location.href = '/admin/reminders?tab=automation';
            } else showToast(res.error || 'Error', false);
        });
    };

    const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
        { id: 'list', label: 'Pendientes', icon: <List size={16} /> },
        { id: 'templates', label: 'Plantillas', icon: <LayoutGrid size={16} /> },
        { id: 'monitor', label: 'Monitoreo', icon: <Activity size={16} /> },
        { id: 'suppress', label: 'Omitidos', icon: <Ban size={16} /> },
        { id: 'automation', label: 'Automatización', icon: <Settings2 size={16} /> },
    ];

    const daysBeforeHint =
        triggerForm === 'draft_event'
            ? 'Días antes de la fecha del evento (draft)'
            : 'Días antes del aniversario de su última reserva';

    return (
        <div className="pb-16 w-full">
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[9999] px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-3 ${
                        toast.ok
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                >
                    {toast.ok ? <Check size={18} /> : <Info size={18} />}
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1">Recordatorios</h1>
                    <p className="text-slate-500 text-sm">
                        Seguimiento manual de drafts + envíos automáticos por correo
                    </p>
                </div>
                {tab === 'templates' && (
                    <button
                        className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
                        onClick={() => openEditTemplate()}
                    >
                        <Plus size={18} /> Nueva Plantilla
                    </button>
                )}
            </div>

            <div className="flex gap-1.5 border-b border-white/5 mb-8 pb-3 overflow-x-auto">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                            tab === t.id
                                ? 'bg-[#E2A049]/10 text-[#E2A049]'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Pendientes ── */}
            {tab === 'list' && (
                <div>
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <div className="flex-1 min-w-[200px] relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-[#E2A049] text-sm appearance-none"
                                value={filterType}
                                onChange={(e) => {
                                    setFilterType(e.target.value);
                                    setSelectedIds([]);
                                }}
                            >
                                <option value="this_month">Drafts de este mes</option>
                                <option value="7">Drafts próximos 7 días</option>
                                <option value="next_month">Drafts del próximo mes</option>
                                <option value="all">Todos los drafts</option>
                                <option value="anniv_this_month">Aniversarios este mes</option>
                                <option value="anniv_next_month">Aniversarios próximo mes</option>
                            </select>
                        </div>
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-tight">
                            {filteredQuotes.length}{' '}
                            {isAnniversaryFilter ? 'aniversarios' : 'borradores'}
                        </span>
                        {selectedIds.length > 0 && (
                            <button
                                className="bg-[#E2A049] text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 active:scale-95"
                                onClick={handleBatchSend}
                            >
                                <Mail size={14} /> Email Masivo ({selectedIds.length})
                            </button>
                        )}
                        <label className="flex items-center gap-2 text-slate-500 text-xs font-bold cursor-pointer hover:text-slate-300 ml-auto md:ml-0">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-white/10 bg-black/20 accent-[#E2A049]"
                                checked={
                                    selectedIds.length === filteredQuotes.length &&
                                    filteredQuotes.length > 0
                                }
                                onChange={toggleSelectAll}
                            />
                            Todos
                        </label>
                    </div>

                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    <th className="py-4 px-6 text-left border-b border-white/5">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded accent-[#E2A049]"
                                            checked={
                                                selectedIds.length === filteredQuotes.length &&
                                                filteredQuotes.length > 0
                                            }
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
                                        Cliente
                                    </th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
                                        {isAnniversaryFilter ? 'Aniversario' : 'Fecha Evento'}
                                    </th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
                                        Comuna
                                    </th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
                                        Total
                                    </th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
                                        Último Envío
                                    </th>
                                    <th className="text-right py-4 px-6 border-b border-white/5" />
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuotes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center text-slate-500 text-sm italic">
                                            {isAnniversaryFilter
                                                ? 'No hay aniversarios para este rango.'
                                                : 'No hay borradores para este rango.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredQuotes.map((q: any) => (
                                        <tr
                                            key={q.id}
                                            className="border-t border-white/[0.03] hover:bg-white/[0.01]"
                                        >
                                            <td className="py-4 px-6">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded accent-[#E2A049]"
                                                    checked={selectedIds.includes(q.id)}
                                                    onChange={() => toggleSelect(q.id)}
                                                />
                                            </td>
                                            <td className="py-4 px-6">
                                                <Link
                                                    href={`/admin/quotes/${q.id}`}
                                                    className="text-white font-bold text-sm hover:text-[#E2A049] no-underline"
                                                >
                                                    {q.client_name} {q.client_lastname}
                                                </Link>
                                            </td>
                                            <td className="py-4 px-6 text-slate-400 text-sm">
                                                {isAnniversaryFilter ? (
                                                    <div>
                                                        <div className="text-slate-200 font-bold">
                                                            {formatDateCL(
                                                                (q.anniversary_date || q.event_date) +
                                                                    'T12:00:00'
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                                            Última:{' '}
                                                            {formatDateCL(q.event_date + 'T12:00:00')}
                                                            {q.anniversary_kind === 'direct'
                                                                ? ' · barriles'
                                                                : ' · evento'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    formatDateCL(q.event_date + 'T12:00:00')
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-slate-400 text-sm">
                                                {q.comuna_name === 'Otra' && q.comuna_other
                                                    ? q.comuna_other
                                                    : q.comuna_name || '—'}
                                            </td>
                                            <td className="py-4 px-6 text-[#E2A049] font-black text-sm">
                                                {formatCurrency(q.total_price)}
                                            </td>
                                            <td className="py-4 px-6">
                                                {q.reminder_logs?.[0] ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                                            {formatDateCL(q.reminder_logs[0].sent_at)}
                                                            {q.reminder_logs[0].channel === 'email' ? (
                                                                <Mail size={12} />
                                                            ) : (
                                                                <Smartphone size={12} />
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-slate-600 truncate max-w-[120px]">
                                                            {templates.find(
                                                                (t) =>
                                                                    t.id === q.reminder_logs[0].template_id
                                                            )?.name || 'Plantilla'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 text-xs italic">Nunca</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        disabled={!q.client_phone}
                                                        onClick={() => handleWaClick(q)}
                                                        className="p-2.5 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 rounded-xl disabled:opacity-30"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageSquare size={16} />
                                                    </button>
                                                    {q.token && (
                                                        <a
                                                            href={`${SITE_URL}/cotizar/${q.token}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-xl"
                                                            title="Enlace público"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 mt-4 md:hidden">
                        {filteredQuotes.map((q: any) => (
                            <div
                                key={q.id}
                                className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded accent-[#E2A049] mt-1"
                                            checked={selectedIds.includes(q.id)}
                                            onChange={() => toggleSelect(q.id)}
                                        />
                                        <div>
                                            <Link
                                                href={`/admin/quotes/${q.id}`}
                                                className="text-white font-black text-base hover:text-[#E2A049] no-underline block"
                                            >
                                                {q.client_name} {q.client_lastname}
                                            </Link>
                                            <div className="text-[#E2A049] font-black text-sm mt-1">
                                                {formatCurrency(q.total_price)}
                                            </div>
                                        </div>
                                    </div>
                                    {q.token && (
                                        <a
                                            href={`${SITE_URL}/cotizar/${q.token}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2.5 bg-white/5 text-slate-400 rounded-xl"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                                    <div>
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                                            {isAnniversaryFilter ? 'Aniversario' : 'Evento'}
                                        </span>
                                        <span className="text-slate-300 text-xs font-bold flex items-center gap-1.5">
                                            <Calendar size={12} className="text-emerald-500" />
                                            {formatDateCL(
                                                (isAnniversaryFilter
                                                    ? q.anniversary_date || q.event_date
                                                    : q.event_date) + 'T12:00:00'
                                            )}
                                        </span>
                                        {isAnniversaryFilter && (
                                            <span className="block text-[10px] text-slate-500 mt-1">
                                                Última {formatDateCL(q.event_date + 'T12:00:00')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                                            Comuna
                                        </span>
                                        <span className="text-slate-300 text-xs font-bold truncate block">
                                            {q.comuna_name === 'Otra' && q.comuna_other
                                                ? q.comuna_other
                                                : q.comuna_name || '—'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                                            Envío
                                        </span>
                                        <span className="text-slate-300 text-xs font-bold">
                                            {q.reminder_logs?.[0]
                                                ? formatDateCL(q.reminder_logs[0].sent_at)
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    disabled={!q.client_phone}
                                    onClick={() => handleWaClick(q)}
                                    className="w-full mt-4 py-3 bg-emerald-500 text-emerald-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-30"
                                >
                                    <MessageSquare size={14} /> Contactar por WhatsApp
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Plantillas ── */}
            {tab === 'templates' && (
                <div>
                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 mb-8 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="p-4 bg-[#E2A049]/10 rounded-2xl text-[#E2A049]">
                            <Info size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-black text-lg mb-1">Variables y automatización</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Usa{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'{nombre}'}
                                </code>{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'{fecha}'}
                                </code>{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'{total}'}
                                </code>{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'{link}'}
                                </code>{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'{whatsapp}'}
                                </code>
                                {' '}y negrita con{' '}
                                <code className="px-1.5 py-0.5 bg-black/30 rounded text-[#E2A049] text-xs">
                                    {'**texto**'}
                                </code>
                                {' '}(email y WhatsApp). Toda plantilla sirve para envío manual; el toggle de
                                automático solo añade el cron por correo.
                            </p>
                        </div>
                    </div>

                    {templates.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 text-sm">
                            No hay plantillas. Crea la primera.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {templates.map((t) => (
                                <div
                                    key={t.id}
                                    className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 flex flex-col gap-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span
                                                    className={`w-2 h-2 rounded-full ${
                                                        t.type === 'both'
                                                            ? 'bg-amber-400'
                                                            : t.type === 'email'
                                                              ? 'bg-sky-400'
                                                              : 'bg-emerald-400'
                                                    }`}
                                                />
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                                    {t.type}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-bold">
                                                    {TRIGGER_LABELS[(t.trigger as ReminderTrigger) || 'draft_event']}
                                                </span>
                                                {t.auto_enabled ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold flex items-center gap-1">
                                                        <Zap size={10} /> Auto {t.days_before ?? 0}d
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-500 font-bold">
                                                        Solo manual
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-white font-black text-lg">{t.name}</h3>
                                            <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 truncate">
                                                <Mail size={11} /> {t.subject || 'Sin asunto'}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => setTestModal({ show: true, template: t })}
                                                className="p-2 bg-sky-500/10 text-sky-400 rounded-lg"
                                                title="Probar"
                                            >
                                                <TestTube size={14} />
                                            </button>
                                            <button
                                                onClick={() => openEditTemplate(t)}
                                                className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(t.id)}
                                                className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-slate-400 text-sm leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                                        {t.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Monitoreo ── */}
            {tab === 'monitor' && (
                <div>
                    <div className="flex flex-wrap gap-3 mb-6 items-center">
                        <select
                            className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E2A049]"
                            value={logFilter}
                            onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="sent">Enviados</option>
                            <option value="failed">Fallidos</option>
                            <option value="skipped">Omitidos / skipped</option>
                        </select>
                        <button
                            type="button"
                            disabled={isPending || logs.length === 0}
                            onClick={handleClearLogs}
                            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                        >
                            <Trash2 size={14} /> Limpiar registro
                        </button>
                        {lastRunSummary ? (
                            <span className="text-xs text-slate-500">
                                Último cron: {cron.lastRunAt ? formatDateTimeCL(cron.lastRunAt) : '—'} ·{' '}
                                {lastRunSummary.ran === false
                                    ? lastRunSummary.reason || 'no ejecutó'
                                    : `${lastRunSummary.sent ?? 0} sent / ${lastRunSummary.failed ?? 0} fail / ${lastRunSummary.skipped ?? 0} skip`}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-600">
                                Cron aún sin ejecuciones (activar en Automatización o «Ejecutar ahora»).
                            </span>
                        )}
                    </div>

                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 overflow-x-auto">
                        <table className="w-full border-collapse min-w-[880px]">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    {[
                                        'Fecha',
                                        'Destinatario',
                                        'Plantilla',
                                        'Canal',
                                        'Trigger',
                                        'Origen',
                                        'Estado',
                                        'Error',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="text-left py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-slate-500 text-sm">
                                            Sin registros aún.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((l) => {
                                        const plantilla =
                                            l.template_name ||
                                            l.reminder_templates?.name ||
                                            (l.template_id ? '—' : 'Plantilla eliminada');
                                        const destinatario =
                                            l.recipient_email ||
                                            l.quotes?.client_email ||
                                            l.quotes?.client_name ||
                                            '—';
                                        return (
                                            <tr key={l.id} className="border-t border-white/[0.03]">
                                                <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                                                    {formatDateTimeCL(l.sent_at)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-300 text-xs">{destinatario}</td>
                                                <td className="py-3 px-4 text-white text-xs font-bold">
                                                    {plantilla}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400 text-xs">{l.channel}</td>
                                                <td className="py-3 px-4 text-slate-500 text-xs">
                                                    {l.trigger || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <span
                                                        className={
                                                            l.source === 'cron'
                                                                ? 'text-[#E2A049] font-bold'
                                                                : 'text-slate-500'
                                                        }
                                                    >
                                                        {l.source || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            l.status === 'sent'
                                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                                : l.status === 'failed'
                                                                  ? 'bg-rose-500/15 text-rose-400'
                                                                  : 'bg-slate-500/15 text-slate-400'
                                                        }`}
                                                    >
                                                        {l.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-rose-400/80 text-xs max-w-[180px] truncate">
                                                    {l.error || ''}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Omitidos ── */}
            {tab === 'suppress' && (
                <div className="max-w-3xl">
                    <p className="text-slate-400 text-sm mb-6">
                        Los emails de esta lista no reciben recordatorios automáticos ni envíos masivos por correo.
                    </p>
                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 mb-6 space-y-4">
                        <div>
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                Email a omitir
                            </label>
                            <input
                                type="email"
                                value={suppressEmail}
                                onChange={(e) => setSuppressEmail(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E2A049]"
                                placeholder="cliente@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                Nota (opcional)
                            </label>
                            <input
                                value={suppressNote}
                                onChange={(e) => setSuppressNote(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E2A049]"
                                placeholder="Motivo"
                            />
                        </div>
                        <button
                            type="button"
                            disabled={isPending || !suppressEmail}
                            onClick={handleAddSuppression}
                            className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm disabled:opacity-40"
                        >
                            Agregar
                        </button>
                    </div>

                    <div className="space-y-2">
                        {suppressions.length === 0 ? (
                            <p className="text-slate-600 text-sm italic">Lista vacía.</p>
                        ) : (
                            suppressions.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-3 bg-[#1e2433] border border-white/5 rounded-xl px-4 py-3"
                                >
                                    <div className="min-w-0">
                                        <div className="text-white text-sm font-bold truncate">{s.email}</div>
                                        {s.note && (
                                            <div className="text-slate-500 text-xs truncate">{s.note}</div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteSuppression(s.id)}
                                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ── Automatización ── */}
            {tab === 'automation' && (
                <div className="max-w-3xl space-y-6">
                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-3 rounded-xl bg-[#E2A049]/10 text-[#E2A049]">
                                    <Zap size={22} />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-lg">Correo automático</h3>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Vercel lo dispara una vez al día. WhatsApp no entra: sigue siendo manual.
                                    </p>
                                </div>
                            </div>
                            <span
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                                    cronEnabled
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-slate-500/15 text-slate-400'
                                }`}
                            >
                                {cronEnabled ? 'Activo' : 'Pausado'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-4">
                                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                    <Clock size={12} /> Hora Chile
                                </div>
                                <div className="text-white font-black text-3xl tracking-tight">{cronChileTime}</div>
                                <p className="text-slate-500 text-xs mt-1">Todos los días · no se cambia desde acá</p>
                            </div>
                            <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-4">
                                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                    <Mail size={12} /> Canal
                                </div>
                                <div className="text-white font-black text-lg">Solo correo</div>
                                <p className="text-slate-500 text-xs mt-1">
                                    {autoTemplates.length} plantilla{autoTemplates.length === 1 ? '' : 's'} en el cron
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">
                                Última ejecución
                            </div>
                            <p className="text-white text-sm font-bold mb-3">
                                {cron.lastRunAt ? formatDateTimeCL(cron.lastRunAt) : 'Aún no corre'}
                            </p>
                            {lastRunSummary?.ran === false ? (
                                <p className="text-amber-400/90 text-sm">{lastRunSummary.reason}</p>
                            ) : lastRunSummary ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {(
                                        [
                                            ['Enviados', lastRunSummary.sent ?? 0, 'text-emerald-400'],
                                            ['Fallidos', lastRunSummary.failed ?? 0, 'text-rose-400'],
                                            ['Omitidos', lastRunSummary.skipped ?? 0, 'text-slate-400'],
                                            ['Revisados', lastRunSummary.processed ?? 0, 'text-[#E2A049]'],
                                        ] as const
                                    ).map(([label, value, color]) => (
                                        <div
                                            key={label}
                                            className="bg-black/30 border border-white/5 rounded-xl px-3 py-3"
                                        >
                                            <div className="text-slate-500 text-[10px] font-bold uppercase">
                                                {label}
                                            </div>
                                            <div className={`text-xl font-black ${color}`}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">Sin resumen todavía.</p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleCron(!cronEnabled)}
                                className={`px-5 py-2.5 rounded-xl font-black text-sm disabled:opacity-40 ${
                                    cronEnabled
                                        ? 'bg-white/5 text-slate-200'
                                        : 'bg-[#E2A049] text-black'
                                }`}
                            >
                                {cronEnabled ? 'Pausar' : 'Activar'}
                            </button>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={handleRunNow}
                                className="bg-white/5 text-slate-200 px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 disabled:opacity-40"
                            >
                                <Play size={16} /> Enviar ahora
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6">
                        <h4 className="text-white font-black text-sm mb-4">Qué manda el cron</h4>
                        {autoTemplates.length === 0 ? (
                            <p className="text-slate-500 text-sm">
                                Ninguna plantilla tiene envío automático. Actívalo en Plantillas.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {autoTemplates.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center justify-between gap-3 bg-black/20 border border-white/5 rounded-xl px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-white text-sm font-bold truncate">{t.name}</div>
                                            <div className="text-slate-500 text-xs">
                                                {TRIGGER_LABELS[t.trigger || 'draft_event']} · {t.days_before ?? 0}{' '}
                                                días antes
                                            </div>
                                        </div>
                                        <Mail size={14} className="text-[#E2A049] shrink-0" />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6">
                        <h4 className="text-white font-black text-sm mb-4">Últimos envíos del cron</h4>
                        {cronLogs.length === 0 ? (
                            <p className="text-slate-500 text-sm">Todavía no hay correos enviados por el cron.</p>
                        ) : (
                            <ul className="space-y-2">
                                {cronLogs.map((l) => (
                                    <li
                                        key={l.id}
                                        className="flex items-center justify-between gap-3 text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-slate-200 truncate">
                                                {l.recipient_email ||
                                                    l.quotes?.client_email ||
                                                    l.quotes?.client_name ||
                                                    '—'}
                                            </div>
                                            <div className="text-slate-500 text-xs">
                                                {formatDateTimeCL(l.sent_at)} ·{' '}
                                                {l.template_name || l.reminder_templates?.name || '—'}
                                            </div>
                                        </div>
                                        <span
                                            className={`text-[10px] font-black uppercase shrink-0 ${
                                                l.status === 'sent'
                                                    ? 'text-emerald-400'
                                                    : l.status === 'failed'
                                                      ? 'text-rose-400'
                                                      : 'text-slate-400'
                                            }`}
                                        >
                                            {l.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Edit template modal */}
            {editingTemplate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setEditingTemplate(null)}
                    />
                    <form
                        className="relative w-full max-w-2xl bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
                        onSubmit={handleSaveTemplate}
                    >
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-xl font-black">
                                {editingTemplate.id ? 'Editar Plantilla' : 'Nueva Plantilla'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setEditingTemplate(null)}
                                className="text-slate-500 hover:text-white p-2 rounded-full hover:bg-white/5"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                    Nombre
                                </label>
                                <input
                                    name="name"
                                    defaultValue={editingTemplate.name}
                                    required
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                        Canal
                                    </label>
                                    <select
                                        name="type"
                                        defaultValue={editingTemplate.type || 'both'}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] text-sm"
                                        required
                                    >
                                        <option value="both">Ambos</option>
                                        <option value="email">Sólo Email</option>
                                        <option value="whatsapp">Sólo WhatsApp</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                        Audiencia / trigger
                                    </label>
                                    <select
                                        value={triggerForm}
                                        onChange={(e) => setTriggerForm(e.target.value as ReminderTrigger)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] text-sm"
                                    >
                                        <option value="draft_event">Draft (evento próximo)</option>
                                        <option value="anniversary_event">Aniversario eventos</option>
                                        <option value="anniversary_direct">Aniversario barriles</option>
                                    </select>
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer bg-black/20 border border-white/5 rounded-xl px-4 py-3">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-[#E2A049]"
                                    checked={autoEnabledForm}
                                    onChange={(e) => setAutoEnabledForm(e.target.checked)}
                                />
                                <span className="text-sm text-white font-bold">
                                    Envío automático por correo
                                </span>
                            </label>

                            {autoEnabledForm && (
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                        {daysBeforeHint}
                                    </label>
                                    <input
                                        name="days_before"
                                        type="number"
                                        min={0}
                                        max={365}
                                        defaultValue={editingTemplate.days_before ?? 7}
                                        className="w-40 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] text-sm"
                                    />
                                </div>
                            )}
                            {!autoEnabledForm && (
                                <input type="hidden" name="days_before" value={editingTemplate.days_before ?? 7} />
                            )}

                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                    Asunto (email)
                                </label>
                                <input
                                    name="subject"
                                    defaultValue={editingTemplate.subject || ''}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                                    Contenido
                                </label>
                                <textarea
                                    name="content"
                                    defaultValue={editingTemplate.content}
                                    required
                                    rows={10}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-white outline-none focus:border-[#E2A049] text-sm resize-y leading-relaxed"
                                />
                                <p className="text-[11px] text-slate-500 mt-2 ml-1">
                                    Negrita para email y WhatsApp:{' '}
                                    <code className="text-[#E2A049]">{'**texto**'}</code>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8">
                            <button
                                type="button"
                                className="flex-1 bg-white/5 text-slate-400 py-3.5 rounded-2xl font-black text-xs"
                                onClick={() => setEditingTemplate(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 bg-[#E2A049] text-black py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2"
                                disabled={isPending}
                            >
                                <Check size={16} /> Guardar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Test modal */}
            {testModal.show && testModal.template && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setTestModal({ show: false, template: null })}
                    />
                    <div className="relative w-full max-w-lg bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-white text-xl font-black flex items-center gap-3 mb-6">
                            <TestTube className="text-sky-400" size={24} /> Laboratorio
                        </h2>
                        <p className="text-slate-400 text-sm mb-8">
                            Prueba la plantilla{' '}
                            <span className="text-[#E2A049] font-bold">&quot;{testModal.template.name}&quot;</span>.
                        </p>
                        <div className="space-y-6">
                            {(testModal.template.type === 'both' || testModal.template.type === 'email') && (
                                <div className="bg-black/20 border border-white/5 p-6 rounded-2xl">
                                    <label className="block text-sky-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                        Email
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            type="email"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
                                            placeholder="tu@email.com"
                                            value={testInp.email}
                                            onChange={(e) =>
                                                setTestInp((prev) => ({ ...prev, email: e.target.value }))
                                            }
                                        />
                                        <button
                                            className="bg-sky-500 text-sky-950 px-5 rounded-xl font-black text-xs disabled:opacity-30 flex items-center gap-2"
                                            onClick={() => handleTestReminder('email')}
                                            disabled={isTesting || !testInp.email}
                                        >
                                            <Send size={14} /> Enviar
                                        </button>
                                    </div>
                                </div>
                            )}
                            {(testModal.template.type === 'both' ||
                                testModal.template.type === 'whatsapp') && (
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl">
                                    <label className="block text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                        WhatsApp
                                    </label>
                                    <div className="flex gap-3">
                                        <PhoneInput
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
                                            value={testInp.phone}
                                            onChange={(e164) =>
                                                setTestInp((prev) => ({ ...prev, phone: e164 }))
                                            }
                                        />
                                        <button
                                            className="bg-emerald-500 text-emerald-950 px-5 rounded-xl font-black text-xs disabled:opacity-30 flex items-center gap-2"
                                            onClick={() => handleTestReminder('wa')}
                                            disabled={!testInp.phone}
                                        >
                                            <MessageSquare size={14} /> Abrir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            className="w-full mt-8 py-3.5 bg-white/5 text-slate-500 text-xs font-black rounded-2xl"
                            onClick={() => setTestModal({ show: false, template: null })}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Batch modal */}
            {batchModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setBatchModal({ show: false, templateId: '' })}
                    />
                    <div className="relative w-full max-w-md bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-white text-xl font-black mb-1">Envío Masivo</h2>
                        <p className="text-slate-400 text-sm mb-8">
                            Email a <span className="text-white font-black">{selectedIds.length}</span> contactos
                            (omitidos se saltan).
                        </p>
                        <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm mb-6"
                            value={batchModal.templateId}
                            onChange={(e) => setBatchModal((m) => ({ ...m, templateId: e.target.value }))}
                        >
                            {emailTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                        <button
                            className="w-full bg-[#E2A049] text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 disabled:opacity-50"
                            onClick={executeBatchSend}
                            disabled={isPending || !batchModal.templateId}
                        >
                            <Send size={18} />
                            {isPending ? 'Procesando…' : 'Confirmar y Enviar'}
                        </button>
                        <button
                            className="w-full py-3 text-slate-600 text-xs font-bold mt-2"
                            onClick={() => setBatchModal({ show: false, templateId: '' })}
                        >
                            Abortar
                        </button>
                    </div>
                </div>
            )}

            {/* WA modal */}
            {waModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setWaModal({ show: false, quote: null, templateId: '' })}
                    />
                    <div className="relative w-full max-w-md bg-[#1e2433] border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-white text-xl font-black mb-1 flex items-center gap-3">
                            <MessageSquare className="text-emerald-400" size={24} /> WhatsApp
                        </h2>
                        <p className="text-slate-400 text-sm mb-8">
                            Mensaje para{' '}
                            <span className="text-white font-black">{waModal.quote?.client_name}</span>
                        </p>
                        <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm font-bold mb-6"
                            value={waModal.templateId}
                            onChange={(e) => setWaModal((m) => ({ ...m, templateId: e.target.value }))}
                        >
                            {waTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                        <button
                            className="w-full bg-emerald-500 text-emerald-950 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3"
                            onClick={executeWaSend}
                            disabled={!waModal.templateId}
                        >
                            <ExternalLink size={18} /> Abrir Aplicación
                        </button>
                        <button
                            className="w-full py-3 text-slate-600 text-xs font-bold mt-2"
                            onClick={() => setWaModal({ show: false, quote: null, templateId: '' })}
                        >
                            Regresar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
