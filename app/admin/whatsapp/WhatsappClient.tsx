'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    saveWhatsappNotificationSettingsAction,
    sendTestWhatsappAction,
    resendQuoteWhatsappAction,
    clearWhatsappLogsAction,
} from '@/app/actions/admin/adminActions';
import type {
    WhatsappNotificationLogRow,
    WhatsappNotificationSettings,
} from '@/lib/services/deskcommService';
import PhoneInput from '@/components/ui/PhoneInput';
import { formatDateTimeCL } from '@/lib/utils';
import {
    MessageSquare,
    CheckCircle2,
    XCircle,
    PauseCircle,
    Send,
    RefreshCw,
    Trash2,
    Bell,
    ExternalLink,
    ShieldCheck,
    AlertTriangle,
    ArrowRight,
} from 'lucide-react';

interface Props {
    initialSettings: WhatsappNotificationSettings;
    initialLogs: WhatsappNotificationLogRow[];
    connection: { configured: boolean; hasWebhook: boolean; crmUrl: string | null };
    whatsappLabel: string;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    web_event_quote: { label: 'Cotización Evento (Web)', color: 'bg-amber-500/15 text-amber-300' },
    web_direct_order: { label: 'Pedido Barriles 5L (Web)', color: 'bg-sky-500/15 text-sky-300' },
    event_confirmed: { label: 'Reserva Confirmada', color: 'bg-emerald-500/15 text-emerald-300' },
    payment_registered: { label: 'Pago Registrado', color: 'bg-green-500/15 text-green-300' },
    direct_dispatched: { label: 'Despacho / Tracking', color: 'bg-indigo-500/15 text-indigo-300' },
    reminder_auto: { label: 'Recordatorio Automático', color: 'bg-purple-500/15 text-purple-300' },
    reminder_manual: { label: 'Recordatorio Manual', color: 'bg-fuchsia-500/15 text-fuchsia-300' },
    manual_resend: { label: 'Reenvío Manual', color: 'bg-cyan-500/15 text-cyan-300' },
    test: { label: 'Mensaje de Prueba', color: 'bg-slate-500/20 text-slate-300' },
};

const NOTIFICATION_TOGGLES: Array<{
    key: keyof WhatsappNotificationSettings;
    title: string;
    description: string;
    group: 'notify' | 'crm';
}> = [
    {
        key: 'webEventQuote',
        title: 'Cotización nueva de Evento en la web',
        description:
            'Envía al cliente una copia con los cócteles, valores y su link único apenas cotiza en la página.',
        group: 'notify',
    },
    {
        key: 'webDirectOrder',
        title: 'Pedido nuevo de Barriles 5L en la web',
        description:
            'Envía el resumen del pedido de barriles desechables junto al total a transferir (100%) y los datos bancarios.',
        group: 'notify',
    },
    {
        key: 'eventConfirmed',
        title: 'Reserva de Evento confirmada',
        description:
            'Avisa que la reserva quedó confirmada y envía fecha, dirección y los datos bancarios para transferir el total (100%).',
        group: 'notify',
    },
    {
        key: 'paymentRegistered',
        title: 'Pago o abono registrado en /admin',
        description:
            'Confirma automáticamente el monto exacto del pago o abono que registraste y muestra el saldo pendiente si existe.',
        group: 'notify',
    },
    {
        key: 'directDispatched',
        title: 'Pedido en reparto / Blue Express',
        description:
            'Avisa al cliente cuando marcas su pedido de barriles como despachado, incluyendo el código y link de seguimiento.',
        group: 'notify',
    },
    {
        key: 'syncDeskcommLeads',
        title: 'Registrar oportunidades en DeskcommCRM',
        description:
            'Crea o actualiza la tarjeta del cliente en tu embudo "Pedidos" (Cotización enviada → Confirmado) sin activar respuestas del bot.',
        group: 'crm',
    },
];

export default function WhatsappClient({
    initialSettings,
    initialLogs,
    connection,
    whatsappLabel,
}: Props) {
    const router = useRouter();
    const [settings, setSettings] = useState<WhatsappNotificationSettings>(initialSettings);
    const [logs, setLogs] = useState<WhatsappNotificationLogRow[]>(initialLogs);
    const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'skipped'>('all');
    const [testPhone, setTestPhone] = useState('');
    const [isPending, startTransition] = useTransition();
    const [sendingTest, setSendingTest] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

    const showToast = (text: string, ok = true) => {
        setToast({ text, ok });
        setTimeout(() => setToast(null), 4500);
    };

    const stats = useMemo(() => {
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        for (const l of logs) {
            if (l.status === 'sent') sent += 1;
            else if (l.status === 'failed') failed += 1;
            else skipped += 1;
        }
        return { sent, failed, skipped };
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (filter === 'all') return logs;
        return logs.filter((l) => l.status === filter);
    }, [logs, filter]);

    const handleToggle = (key: keyof WhatsappNotificationSettings) => {
        const nextVal = !settings[key];
        const optimistic = { ...settings, [key]: nextVal };
        setSettings(optimistic);

        startTransition(async () => {
            const res = await saveWhatsappNotificationSettingsAction({ [key]: nextVal });
            if (res.success && res.settings) {
                setSettings(res.settings);
                showToast('Configuración guardada');
            } else {
                setSettings(settings);
                showToast(res.error || 'No se pudo guardar la configuración', false);
            }
        });
    };

    const handleSendTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testPhone.trim()) {
            showToast('Ingresa un número de WhatsApp para la prueba', false);
            return;
        }
        setSendingTest(true);
        try {
            const res = await sendTestWhatsappAction(testPhone);
            if (res.success) {
                showToast('WhatsApp de prueba enviado correctamente');
                router.refresh();
            } else {
                showToast(res.error || 'Error enviando WhatsApp de prueba', false);
                router.refresh();
            }
        } finally {
            setSendingTest(false);
        }
    };

    const handleResendRow = async (log: WhatsappNotificationLogRow) => {
        if (!log.quote_id) return;
        setResendingId(log.id);
        try {
            const mode =
                log.event_type === 'payment_registered'
                    ? 'payment'
                    : log.event_type === 'direct_dispatched'
                      ? 'dispatch'
                      : log.event_type === 'event_confirmed'
                        ? 'confirmed'
                        : log.event_type === 'web_event_quote' || log.event_type === 'web_direct_order'
                          ? 'quote'
                          : 'auto';

            const res = await resendQuoteWhatsappAction(log.quote_id, mode);
            if (res.success) {
                showToast(`Reenviado (${res.sentKind || 'WhatsApp'}) correctamente`);
                router.refresh();
            } else {
                showToast(res.error || 'No se pudo reenviar', false);
                router.refresh();
            }
        } finally {
            setResendingId(null);
        }
    };

    const handleClearLogs = () => {
        if (!confirm('¿Limpiar todo el historial de envíos de WhatsApp?')) return;
        startTransition(async () => {
            const res = await clearWhatsappLogsAction();
            if (res.success) {
                setLogs([]);
                showToast(`Historial limpiado (${res.deleted ?? 0} registros)`);
            } else {
                showToast(res.error || 'No se pudo limpiar el historial', false);
            }
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {toast && (
                <div
                    className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm font-bold shadow-2xl flex items-center gap-2 ${
                        toast.ok
                            ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                            : 'bg-red-950/95 border-red-500/40 text-red-200'
                    }`}
                >
                    {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                            <MessageSquare size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                Notificaciones WhatsApp
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400">
                                Controla qué avisos envía automáticamente tu agente ({whatsappLabel}) a los clientes.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {connection.configured ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                            <ShieldCheck size={14} /> Conectado a DeskcommCRM
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold">
                            <AlertTriangle size={14} /> Sin configurar en Vercel
                        </span>
                    )}
                </div>
            </div>

            {/* Interruptor Maestro + Prueba */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-admin-surface border border-admin-border rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                                Interruptor principal
                            </div>
                            <h2 className="text-base sm:text-lg font-extrabold text-white">
                                {settings.enabled
                                    ? 'Envíos automáticos activos'
                                    : 'Todos los envíos automáticos están pausados'}
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                Si lo apagas, el sistema dejará de enviar WhatsApps automáticos (incluidos los recordatorios programados), pero podrás seguir reenviando manualmente cuando quieras.
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggle('enabled')}
                            aria-pressed={settings.enabled}
                            className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition-colors cursor-pointer border-none ${
                                settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                    settings.enabled ? 'translate-x-7' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                        <div className="bg-black/20 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">Enviados</div>
                            <div className="text-xl font-black text-emerald-400">{stats.sent}</div>
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">Fallidos</div>
                            <div className="text-xl font-black text-red-400">{stats.failed}</div>
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">Omitidos</div>
                            <div className="text-xl font-black text-slate-400">{stats.skipped}</div>
                        </div>
                    </div>
                </div>

                {/* Enviar prueba */}
                <form
                    onSubmit={handleSendTest}
                    className="bg-admin-surface border border-admin-border rounded-2xl p-5 flex flex-col justify-between gap-3"
                >
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                            Verificación rápida
                        </div>
                        <h2 className="text-base font-extrabold text-white">Enviar WhatsApp de prueba</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Envía un mensaje de prueba a tu número para comprobar que el agente responde al instante.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <PhoneInput
                            value={testPhone}
                            onChange={setTestPhone}
                            placeholder="+56 9 1234 5678"
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500 text-sm"
                        />
                        <button
                            type="submit"
                            disabled={sendingTest || !connection.configured}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors cursor-pointer border-none"
                        >
                            <Send size={14} />
                            {sendingTest ? 'Enviando prueba...' : 'Enviar prueba ahora'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Interruptores por evento */}
            <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-white">
                        Avisos automáticos del sistema
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                        Activa o desactiva cada aviso según lo que necesites que el agente notifique a tus clientes.
                    </p>
                </div>

                <div className="divide-y divide-white/5">
                    {NOTIFICATION_TOGGLES.map((item) => {
                        const checked = settings[item.key];
                        const dimmed = item.group === 'notify' && !settings.enabled;
                        return (
                            <div
                                key={item.key}
                                className={`py-4 flex items-center justify-between gap-4 ${
                                    dimmed ? 'opacity-50' : ''
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>{item.title}</span>
                                        {item.group === 'crm' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                                                CRM
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleToggle(item.key)}
                                    aria-pressed={checked}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer border-none ${
                                        checked ? 'bg-emerald-500' : 'bg-slate-700'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                            checked ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Banner hacia Recordatorios */}
            <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0">
                        <Bell size={18} />
                    </div>
                    <div>
                        <div className="text-sm font-extrabold text-white">
                            Recordatorios de cotizaciones y aniversarios por WhatsApp
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            En la sección Recordatorios ahora puedes elegir si cada plantilla o envío masivo sale por Solo Email, Solo WhatsApp o Ambos.
                        </p>
                    </div>
                </div>
                <Link
                    href="/admin/reminders?tab=templates"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-slate-950 font-black text-xs no-underline shrink-0"
                >
                    Ir a Recordatorios <ArrowRight size={14} />
                </Link>
            </div>

            {/* Historial */}
            <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base sm:text-lg font-extrabold text-white">
                            Historial de envíos recientes
                        </h2>
                        <p className="text-xs text-slate-400">
                            Últimos 100 avisos registrados. Si alguno falló o quieres reenviarlo, usa el botón Reenviar.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['all', 'sent', 'failed', 'skipped'] as const).map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                                    filter === f
                                        ? 'bg-primary text-slate-950 border-primary'
                                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {f === 'all'
                                    ? `Todos (${logs.length})`
                                    : f === 'sent'
                                      ? `Enviados (${stats.sent})`
                                      : f === 'failed'
                                        ? `Fallidos (${stats.failed})`
                                        : `Omitidos (${stats.skipped})`}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => router.refresh()}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                            title="Actualizar historial"
                        >
                            <RefreshCw size={14} />
                        </button>

                        {logs.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearLogs}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-bold cursor-pointer"
                            >
                                <Trash2 size={13} /> Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {filteredLogs.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                        Aún no hay envíos registrados en esta vista.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                                    <th className="py-2.5 pr-3">Fecha</th>
                                    <th className="py-2.5 pr-3">Cliente</th>
                                    <th className="py-2.5 pr-3">Aviso</th>
                                    <th className="py-2.5 pr-3">Estado</th>
                                    <th className="py-2.5 pr-3">Detalle</th>
                                    <th className="py-2.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                                {filteredLogs.map((log) => {
                                    const badge = EVENT_TYPE_LABELS[log.event_type] || {
                                        label: log.event_type,
                                        color: 'bg-white/10 text-slate-300',
                                    };
                                    const clientLabel =
                                        log.recipient_name ||
                                        [log.quotes?.client_name, log.quotes?.client_lastname]
                                            .filter(Boolean)
                                            .join(' ') ||
                                        'Cliente';

                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02]">
                                            <td className="py-3 pr-3 whitespace-nowrap text-slate-400">
                                                {formatDateTimeCL(log.created_at)}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <div className="font-bold text-white">{clientLabel}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    {log.recipient_phone || 'Sin teléfono'}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 whitespace-nowrap">
                                                <span
                                                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.color}`}
                                                >
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 whitespace-nowrap">
                                                {log.status === 'sent' ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                                        <CheckCircle2 size={14} /> Enviado
                                                    </span>
                                                ) : log.status === 'failed' ? (
                                                    <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                                                        <XCircle size={14} /> Falló
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 font-bold">
                                                        <PauseCircle size={14} /> Omitido
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 max-w-xs">
                                                {log.error ? (
                                                    <div className="text-red-300/90 line-clamp-2">{log.error}</div>
                                                ) : (
                                                    <div className="text-slate-400 line-clamp-2">
                                                        {log.message_preview || '—'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2">
                                                    {log.quote_id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={resendingId === log.id}
                                                                onClick={() => handleResendRow(log)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                                            >
                                                                <Send size={11} />
                                                                {resendingId === log.id
                                                                    ? 'Enviando...'
                                                                    : 'Reenviar'}
                                                            </button>
                                                            <Link
                                                                href={`/admin/quotes/${log.quote_id}`}
                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                                                                title="Ver cotización"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </Link>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
