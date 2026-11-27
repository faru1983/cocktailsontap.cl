'use client';

import React, { useMemo, useState } from 'react';
import {
    Calendar,
    CalendarCheck,
    Check,
    Clock,
    Copy,
    DollarSign,
    Info,
    Lock,
    Package,
    RefreshCw,
    Sparkles,
    Truck,
    X,
} from 'lucide-react';
import {
    WEEKDAY_LABELS,
    formatOffsetUnit,
    getFirstAvailableDate,
    getMinSelectableDate,
    resolveOffsetMode,
    type OffsetDaysMode,
    type ShippingMethodConfig,
    type ShippingMethodsSettings,
} from '@/lib/shippingMethods';
import {
    calculateDirectSaleSchedule,
    formatShortDateCL,
    getChileDateTimeParts,
    parseCutoffMinutes,
} from '@/lib/businessDays';
import {
    type BlueExpressDeliveryDaysMode,
    type BlueExpressHomeRates,
    type BlueExpressTransitTimes,
    getBlueExpressDeliveryDaysMode,
} from '@/lib/blueExpress';
import type { AdminRegionRow, AdminComunaRow } from './CoverageSettings';

interface Props {
    config: ShippingMethodsSettings;
    onChangeConfig: (next: ShippingMethodsSettings) => void;
    onSaveConfig: () => Promise<void>;
    isSavingConfig: boolean;
    hasSavedConfig: boolean;
    regions: AdminRegionRow[];
    comunas: AdminComunaRow[];
    onBulkApplyRate: (regionId: string, target: 'direct' | 'event', rate: number) => Promise<void>;
    beRates: BlueExpressHomeRates;
    onChangeBeRates: (next: BlueExpressHomeRates) => void;
    onSaveBeRates: () => Promise<void>;
    isSavingBeRates: boolean;
    beTransitDays: BlueExpressTransitTimes;
    onChangeBeTransitDays: (next: BlueExpressTransitTimes) => void;
    onSaveBeTransitDays: () => Promise<void>;
    isSavingBeTransitDays: boolean;
    hasSavedBeTransitDays?: boolean;
}

function formatBlockedDateReadable(dateStr: string): string {
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day, 12, 0, 0);
        const raw = d.toLocaleDateString('es-CL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
        return dateStr;
    }
}

function formatChileClockLabel(): { todayShort: string; timeLabel: string; currentMinutes: number } {
    const parts = getChileDateTimeParts();
    const todayDate = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
    const hh = String(parts.hour).padStart(2, '0');
    const mm = String(parts.minute).padStart(2, '0');
    return {
        todayShort: formatShortDateCL(todayDate),
        timeLabel: `${hh}:${mm}`,
        currentMinutes: parts.hour * 60 + parts.minute,
    };
}

interface AnticipationEditorProps {
    methodKey: 'own_direct' | 'own_events' | 'blue_express';
    title: string;
    method: ShippingMethodConfig;
    maxDays: number;
    accent: 'sky' | 'amber' | 'violet';
    previewPrefix: string;
    helperNote?: string;
    onUpdate: (updates: Partial<ShippingMethodConfig>) => void;
}

function AnticipationRuleEditor({
    methodKey,
    title,
    method,
    maxDays,
    accent,
    previewPrefix,
    helperNote,
    onUpdate,
}: AnticipationEditorProps) {
    const offsetMode = resolveOffsetMode(method);
    const cutoffEnabled = Boolean(method.cutoffEnabled);
    const cutoffTime = method.cutoffTime || '18:00';
    const minOffsetDays = typeof method.minOffsetDays === 'number' ? method.minOffsetDays : 0;

    const preview = useMemo(() => {
        const clock = formatChileClockLabel();
        const minDate = getMinSelectableDate(method, minOffsetDays);
        const firstAvailable = getFirstAvailableDate(method, minOffsetDays);
        const cutoffMins = cutoffEnabled ? parseCutoffMinutes(cutoffTime) : null;
        const pastCutoff = cutoffMins !== null && clock.currentMinutes >= cutoffMins;
        return {
            todayShort: clock.todayShort,
            timeLabel: clock.timeLabel,
            minDate,
            firstAvailable,
            minDateShort: formatShortDateCL(minDate),
            firstAvailableShort: formatShortDateCL(firstAvailable),
            skippedUnavailable: firstAvailable !== minDate,
            pastCutoff,
        };
    }, [method, minOffsetDays, cutoffEnabled, cutoffTime]);

    const accentStyles = {
        sky: {
            radioActive: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
            previewBox: 'bg-sky-500/10 border-sky-500/20 text-sky-200',
            previewIcon: 'text-sky-400',
            badge: 'text-sky-300',
        },
        amber: {
            radioActive: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
            previewBox: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
            previewIcon: 'text-amber-400',
            badge: 'text-amber-300',
        },
        violet: {
            radioActive: 'bg-violet-500/15 border-violet-500/40 text-violet-200',
            previewBox: 'bg-violet-500/10 border-violet-500/20 text-violet-200',
            previewIcon: 'text-violet-300',
            badge: 'text-violet-300',
        },
    }[accent];

    const radioGroupName = `offset-mode-${methodKey}`;

    return (
        <div className="space-y-3">
            <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest">
                {title}
            </label>

            {/* Radio: Días hábiles vs Días corridos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={`Tipo de días para ${method.name}`}>
                {(
                    [
                        {
                            value: 'business' as OffsetDaysMode,
                            label: 'Días hábiles',
                            sub: 'Lunes a Viernes',
                        },
                        {
                            value: 'calendar' as OffsetDaysMode,
                            label: 'Días corridos',
                            sub: 'Lunes a Domingo',
                        },
                    ] as const
                ).map((option) => {
                    const selected = offsetMode === option.value;
                    return (
                        <label
                            key={option.value}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none ${
                                selected
                                    ? accentStyles.radioActive
                                    : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/15 hover:text-slate-200'
                            }`}
                        >
                            <input
                                type="radio"
                                name={radioGroupName}
                                value={option.value}
                                checked={selected}
                                onChange={() => onUpdate({ offsetMode: option.value })}
                                className="w-3.5 h-3.5 accent-[#E2A049] cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                                <span className="block text-xs font-black leading-tight">{option.label}</span>
                                <span className="block text-[10px] opacity-75">{option.sub}</span>
                            </div>
                        </label>
                    );
                })}
            </div>

            {/* Cantidad de días + Hora de corte opcional */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={0}
                        max={maxDays}
                        value={minOffsetDays}
                        onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            const nextVal = Number.isNaN(parsed) ? 0 : Math.min(maxDays, Math.max(0, parsed));
                            onUpdate({ minOffsetDays: nextVal });
                        }}
                        className="w-20 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-black text-center focus:border-[#E2A049] outline-none"
                    />
                    <span className="text-slate-300 text-xs font-bold">
                        {formatOffsetUnit(minOffsetDays, offsetMode)}
                    </span>
                </div>

                <div className="flex items-center gap-2 bg-black/25 border border-white/5 rounded-xl px-3 py-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={cutoffEnabled}
                            onChange={(e) =>
                                onUpdate({
                                    cutoffEnabled: e.target.checked,
                                    cutoffTime: cutoffTime || '18:00',
                                })
                            }
                            className="w-3.5 h-3.5 accent-[#E2A049] cursor-pointer"
                        />
                        <Clock size={13} className={cutoffEnabled ? accentStyles.previewIcon : 'text-slate-500'} />
                        <span className="text-[11px] font-bold text-slate-300">Hora de corte</span>
                    </label>
                    {cutoffEnabled && (
                        <input
                            type="time"
                            value={cutoffTime}
                            onChange={(e) => onUpdate({ cutoffTime: e.target.value || '18:00' })}
                            aria-label={`Hora de corte para ${method.name}`}
                            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-black outline-none focus:border-[#E2A049]"
                        />
                    )}
                </div>
            </div>

            {cutoffEnabled && (
                <p className="text-slate-400 text-[11px] leading-snug">
                    Compras desde las <strong className="text-white">{cutoffTime} hrs</strong> (hora Chile) pasan a contar desde el día siguiente.
                </p>
            )}

            {/* Vista previa en vivo */}
            <div className={`rounded-xl px-3 py-2 border text-[11px] flex items-start gap-2 ${accentStyles.previewBox}`}>
                <CalendarCheck size={14} className={`${accentStyles.previewIcon} shrink-0 mt-0.5`} />
                <div className="leading-snug">
                    <span className="opacity-85">
                        Hoy <strong>{preview.todayShort}</strong> ({preview.timeLabel} hrs)
                        {preview.pastCutoff ? ' · pasó hora de corte' : ''}:
                    </span>{' '}
                    <span>{previewPrefix} </span>
                    <strong className="text-white">{preview.firstAvailableShort}</strong>
                    {preview.skippedUnavailable && (
                        <span className="block text-[10px] opacity-80 mt-0.5">
                            El mínimo por anticipación era {preview.minDateShort}, pero se ajustó por día no habilitado o fecha bloqueada.
                        </span>
                    )}
                </div>
            </div>

            {helperNote && (
                <p className="text-slate-400 text-[11px] leading-snug flex items-start gap-1.5">
                    <Info size={13} className={`${accentStyles.badge} shrink-0 mt-0.5`} />
                    <span>{helperNote}</span>
                </p>
            )}
        </div>
    );
}

export default function ShippingMethodsCards({
    config,
    onChangeConfig,
    onSaveConfig,
    isSavingConfig,
    hasSavedConfig,
    regions,
    onBulkApplyRate,
    beRates,
    onChangeBeRates,
    onSaveBeRates,
    isSavingBeRates,
    beTransitDays,
    onChangeBeTransitDays,
    onSaveBeTransitDays,
    isSavingBeTransitDays,
    hasSavedBeTransitDays,
}: Props) {
    // ── Bulk Pricing State ───────────────────────────────────────────────────
    const [selectedBulkRegionId, setSelectedBulkRegionId] = useState<string>(() => {
        return regions.find((r) => r.code === 'RM')?.id || regions[0]?.id || '';
    });
    const [bulkDirectRate, setBulkDirectRate] = useState<number>(4990);
    const [bulkEventRate, setBulkEventRate] = useState<number>(15000);
    const [isApplyingBulk, setIsApplyingBulk] = useState(false);
    const [bulkNotice, setBulkNotice] = useState<string | null>(null);

    // ── Date inputs for blackout dates ───────────────────────────────────────
    const [directNewBlockedDate, setDirectNewBlockedDate] = useState('');
    const [eventsNewBlockedDate, setEventsNewBlockedDate] = useState('');
    const [beNewBlockedDate, setBeNewBlockedDate] = useState('');

    const updateMethod = (key: 'own_direct' | 'own_events' | 'blue_express', updates: Partial<ShippingMethodConfig>) => {
        onChangeConfig({
            ...config,
            [key]: {
                ...config[key],
                ...updates,
            },
        });
    };

    const toggleWeekday = (key: 'own_direct' | 'own_events' | 'blue_express', day: number) => {
        const current = config[key].availableWeekdays;
        const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
        updateMethod(key, { availableWeekdays: next });
    };

    const addBlockedDate = (key: 'own_direct' | 'own_events' | 'blue_express', dateStr: string) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
        const current = config[key].blockedDates || [];
        if (current.includes(dateStr)) return;
        const next = [...current, dateStr].sort();
        updateMethod(key, { blockedDates: next });
    };

    const removeBlockedDate = (key: 'own_direct' | 'own_events' | 'blue_express', dateStr: string) => {
        const current = config[key].blockedDates || [];
        const next = current.filter((d) => d !== dateStr);
        updateMethod(key, { blockedDates: next });
    };

    const handleApplyBulkDirect = async () => {
        if (!selectedBulkRegionId) return;
        const region = regions.find((r) => r.id === selectedBulkRegionId);
        const name = region?.short_name || 'la región';
        if (!confirm(`¿Estás seguro de fijar $${bulkDirectRate.toLocaleString('es-CL')} a todas las comunas de ${name}?`)) {
            return;
        }

        setIsApplyingBulk(true);
        try {
            await onBulkApplyRate(selectedBulkRegionId, 'direct', bulkDirectRate);
            setBulkNotice(`Tarifa de $${bulkDirectRate.toLocaleString('es-CL')} aplicada a todas las comunas de ${name}.`);
            setTimeout(() => setBulkNotice(null), 4000);
        } catch (err: any) {
            alert('Error al aplicar tarifa: ' + err.message);
        } finally {
            setIsApplyingBulk(false);
        }
    };

    const handleApplyBulkEvent = async () => {
        const rmRegion = regions.find((r) => r.code === 'RM') || regions[0];
        if (!rmRegion) return;
        if (!confirm(`¿Estás seguro de fijar $${bulkEventRate.toLocaleString('es-CL')} a todas las comunas de Eventos de ${rmRegion.short_name}?`)) {
            return;
        }

        setIsApplyingBulk(true);
        try {
            await onBulkApplyRate(rmRegion.id, 'event', bulkEventRate);
            setBulkNotice(`Tarifa de eventos de $${bulkEventRate.toLocaleString('es-CL')} aplicada exitosamente.`);
            setTimeout(() => setBulkNotice(null), 4000);
        } catch (err: any) {
            alert('Error al aplicar tarifa de eventos: ' + err.message);
        } finally {
            setIsApplyingBulk(false);
        }
    };

    const bulkRegion = regions.find((r) => r.id === selectedBulkRegionId);
    const beDeliveryDaysMode = getBlueExpressDeliveryDaysMode(beTransitDays);

    const beZonesPreview = useMemo(() => {
        const beMethod = config.blue_express;
        const buildForZone = (zone: 'misma_zona' | 'centro' | 'extremo') => {
            const z = beTransitDays[zone];
            return calculateDirectSaleSchedule({
                productionBusinessDays: beMethod.minOffsetDays,
                productionOffsetMode: resolveOffsetMode(beMethod, 'business'),
                cutoffEnabled: Boolean(beMethod.cutoffEnabled),
                cutoffTime: beMethod.cutoffTime,
                availableWeekdays: beMethod.availableWeekdays,
                blockedDates: beMethod.blockedDates,
                transitMinDays: z?.minDays ?? 1,
                transitMaxDays: z?.maxDays ?? 2,
                deliveryDaysMode: beDeliveryDaysMode,
            });
        };
        return {
            misma_zona: buildForZone('misma_zona'),
            centro: buildForZone('centro'),
            extremo: buildForZone('extremo'),
        };
    }, [config.blue_express, beTransitDays, beDeliveryDaysMode]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* ── Sticky/Top Bar: Guardar Cambios ──────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#1e2433] border border-white/5 shadow-xl">
                <div>
                    <h3 className="text-white text-base font-black flex items-center gap-2">
                        <Truck size={20} className="text-[#E2A049]" />
                        Centro de Métodos de Envío
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Define días operativos, anticipación en días hábiles o corridos, hora de corte, bloqueos y reglas de envío gratis.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {hasSavedConfig && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 animate-fade-in">
                            <Check size={14} /> Guardado exitoso
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => void onSaveConfig()}
                        disabled={isSavingConfig}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E2A049] text-black text-xs font-black uppercase tracking-wider hover:bg-[#d4933d] active:scale-95 transition-all shadow-lg shadow-[#E2A049]/15 disabled:opacity-50 cursor-pointer"
                    >
                        {isSavingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                        {isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>

            {bulkNotice && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
                    <Check size={16} /> {bulkNotice}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TARJETA 1: TRANSPORTE PROPIO (BARRILES DESECHABLES)               */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-black">
                            <Truck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-white font-black text-base">
                                    {config.own_direct.name}
                                </h4>
                                <span className="text-[9px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">
                                    Venta Directa
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">
                                {config.own_direct.description}
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer self-start sm:self-auto">
                        <input
                            type="checkbox"
                            checked={config.own_direct.isActive}
                            onChange={(e) => updateMethod('own_direct', { isActive: e.target.checked })}
                            className="w-5 h-5 accent-[#E2A049] cursor-pointer rounded-md bg-black/40"
                        />
                        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                            {config.own_direct.isActive ? 'Habilitado' : 'Inactivo'}
                        </span>
                    </label>
                </div>

                {/* Reglas de Entrega */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Días habituales */}
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Días de entrega habilitados
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                const active = config.own_direct.availableWeekdays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleWeekday('own_direct', day)}
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            active
                                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                                                : 'bg-black/30 text-slate-500 border border-white/5 hover:text-slate-400'
                                        }`}
                                    >
                                        {WEEKDAY_LABELS[day]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-2">
                            Los días desmarcados se bloquearán automáticamente en el calendario del cliente.
                        </p>
                    </div>

                    {/* Anticipación mínima */}
                    <AnticipationRuleEditor
                        methodKey="own_direct"
                        title="Anticipación mínima de compra"
                        method={config.own_direct}
                        maxDays={30}
                        accent="sky"
                        previewPrefix="primera entrega disponible"
                        onUpdate={(updates) => updateMethod('own_direct', updates)}
                    />
                </div>

                {/* Franja de entrega */}
                <div>
                    <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                        Indicación de horario para el cliente
                    </label>
                    <input
                        type="text"
                        value={config.own_direct.deliveryWindow || ''}
                        onChange={(e) => updateMethod('own_direct', { deliveryWindow: e.target.value })}
                        placeholder="Durante todo el día (09:00 a 20:00 hrs)"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-bold focus:border-[#E2A049] outline-none"
                    />
                </div>

                {/* Fechas Bloqueadas (Blackout Dates) */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span className="text-white text-xs font-black flex items-center gap-1.5">
                                <Lock size={14} className="text-rose-400" />
                                Fechas Bloqueadas / Sin Reparto
                            </span>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                                Días puntuales (feriados, mantenciones o cupos llenos) donde no se podrán agendar entregas.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={directNewBlockedDate}
                                onChange={(e) => setDirectNewBlockedDate(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-rose-400"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    addBlockedDate('own_direct', directNewBlockedDate);
                                    setDirectNewBlockedDate('');
                                }}
                                disabled={!directNewBlockedDate}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase hover:bg-rose-500/30 disabled:opacity-30 cursor-pointer"
                            >
                                + Bloquear
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {(!config.own_direct.blockedDates || config.own_direct.blockedDates.length === 0) ? (
                            <span className="text-slate-500 text-xs italic">
                                No hay fechas bloqueadas actualmente. Todas las fechas según los días operativos están disponibles.
                            </span>
                        ) : (
                            config.own_direct.blockedDates.map((dateStr) => (
                                <span
                                    key={dateStr}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold"
                                >
                                    <Lock size={12} />
                                    {formatBlockedDateReadable(dateStr)}
                                    <button
                                        type="button"
                                        onClick={() => removeBlockedDate('own_direct', dateStr)}
                                        className="text-rose-400 hover:text-rose-200 ml-1 p-0.5 rounded cursor-pointer"
                                        title="Desbloquear fecha"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))
                        )}
                    </div>
                </div>

                {/* Envío Gratis */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-400" />
                            <span className="text-white text-xs font-black">
                                Envío Gratis en Venta Directa (Opcional)
                            </span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.own_direct.freeShippingEnabled}
                                onChange={(e) =>
                                    updateMethod('own_direct', { freeShippingEnabled: e.target.checked })
                                }
                                className="w-4 h-4 accent-[#E2A049] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-400">Activar regla</span>
                        </label>
                    </div>

                    {config.own_direct.freeShippingEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    Tipo de umbral
                                </label>
                                <select
                                    value={config.own_direct.freeShippingThresholdType || 'amount'}
                                    onChange={(e) =>
                                        updateMethod('own_direct', {
                                            freeShippingThresholdType: e.target.value as 'amount' | 'liters',
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                                >
                                    <option value="amount">Por monto total del pedido ($ CLP)</option>
                                    <option value="liters">Por cantidad de litros (ej: ≥ 15L)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    {config.own_direct.freeShippingThresholdType === 'liters'
                                        ? 'Litros mínimos para envío gratis'
                                        : 'Monto mínimo para envío gratis ($)'}
                                </label>
                                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    {config.own_direct.freeShippingThresholdType !== 'liters' && (
                                        <span className="text-slate-500 text-xs font-bold">$</span>
                                    )}
                                    <input
                                        type="number"
                                        min={0}
                                        value={config.own_direct.freeShippingThreshold || 0}
                                        onChange={(e) =>
                                            updateMethod('own_direct', {
                                                freeShippingThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                                            })
                                        }
                                        className="w-full bg-transparent border-none text-emerald-400 text-xs font-black outline-none"
                                    />
                                    {config.own_direct.freeShippingThresholdType === 'liters' && (
                                        <span className="text-slate-400 text-xs font-bold">L</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Herramienta Masiva: Copiar tarifa a todas las comunas ── */}
                <div className="bg-sky-500/5 rounded-xl p-4 border border-sky-500/15 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-sky-400 text-xs font-black flex items-center gap-1.5">
                                <Copy size={14} />
                                Asignación Rápida de Tarifa por Región
                            </span>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                                Escribe un valor base y aplícalo de golpe a todas las comunas de una región. Luego podrás modificar comunas puntuales en la matriz.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                            <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                Región destino
                            </label>
                            <select
                                value={selectedBulkRegionId}
                                onChange={(e) => setSelectedBulkRegionId(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none"
                            >
                                {regions.map((r) => (
                                    <option key={r.id} value={r.id} className="bg-[#1e2433]">
                                        {r.name} ({r.short_name})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                Tarifa de despacho a aplicar
                            </label>
                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                <span className="text-slate-500 text-xs font-bold">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={bulkDirectRate}
                                    onChange={(e) => setBulkDirectRate(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-full bg-transparent border-none text-sky-400 text-sm font-black outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => void handleApplyBulkDirect()}
                                disabled={isApplyingBulk}
                                className="w-full px-4 py-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black uppercase tracking-wider hover:bg-sky-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isApplyingBulk ? <RefreshCw size={14} className="animate-spin" /> : <Copy size={14} />}
                                Copiar a {bulkRegion?.short_name || 'Región'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TARJETA 2: TRANSPORTE Y MONTAJE (EVENTOS)                         */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-white font-black text-base">
                                    {config.own_events.name}
                                </h4>
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">
                                    Eventos y Barras
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">
                                {config.own_events.description}
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer self-start sm:self-auto">
                        <input
                            type="checkbox"
                            checked={config.own_events.isActive}
                            onChange={(e) => updateMethod('own_events', { isActive: e.target.checked })}
                            className="w-5 h-5 accent-[#E2A049] cursor-pointer rounded-md bg-black/40"
                        />
                        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                            {config.own_events.isActive ? 'Habilitado' : 'Inactivo'}
                        </span>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Días habituales */}
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Días de servicio de eventos
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                const active = config.own_events.availableWeekdays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleWeekday('own_events', day)}
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            active
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                                                : 'bg-black/30 text-slate-500 border border-white/5 hover:text-slate-400'
                                        }`}
                                    >
                                        {WEEKDAY_LABELS[day]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-2">
                            Permite asegurar personal y coordinación de barriles y dispensadores para cada fecha.
                        </p>
                    </div>

                    {/* Anticipación eventos */}
                    <AnticipationRuleEditor
                        methodKey="own_events"
                        title="Anticipación mínima para eventos"
                        method={config.own_events}
                        maxDays={60}
                        accent="amber"
                        previewPrefix="primera fecha agendable"
                        onUpdate={(updates) => updateMethod('own_events', updates)}
                    />
                </div>

                <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-slate-400 text-xs flex items-start gap-2">
                    <Info size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                        <strong className="text-white">Horarios de Reserva y Retiro:</strong> El cliente selecciona el horario de inicio y elige retiro el mismo día o día siguiente (12:00 a 14:00 hrs) en su reserva.
                    </span>
                </div>

                {/* Fechas Bloqueadas Eventos */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span className="text-white text-xs font-black flex items-center gap-1.5">
                                <Lock size={14} className="text-rose-400" />
                                Fechas Bloqueadas para Eventos (Sobredemanda)
                            </span>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                                Si un fin de semana tienes la capacidad completa de dispensadores, bloquea la fecha aquí para que nadie más agende.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={eventsNewBlockedDate}
                                onChange={(e) => setEventsNewBlockedDate(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-rose-400"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    addBlockedDate('own_events', eventsNewBlockedDate);
                                    setEventsNewBlockedDate('');
                                }}
                                disabled={!eventsNewBlockedDate}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase hover:bg-rose-500/30 disabled:opacity-30 cursor-pointer"
                            >
                                + Bloquear
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {(!config.own_events.blockedDates || config.own_events.blockedDates.length === 0) ? (
                            <span className="text-slate-500 text-xs italic">
                                No hay fechas bloqueadas para eventos. Todos los días están disponibles.
                            </span>
                        ) : (
                            config.own_events.blockedDates.map((dateStr) => (
                                <span
                                    key={dateStr}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold"
                                >
                                    <Lock size={12} />
                                    {formatBlockedDateReadable(dateStr)}
                                    <button
                                        type="button"
                                        onClick={() => removeBlockedDate('own_events', dateStr)}
                                        className="text-rose-400 hover:text-rose-200 ml-1 p-0.5 rounded cursor-pointer"
                                        title="Desbloquear fecha"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))
                        )}
                    </div>
                </div>

                {/* Envío Gratis Eventos */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-400" />
                            <span className="text-white text-xs font-black">
                                Regla de Traslado Gratis en Eventos
                            </span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.own_events.freeShippingEnabled}
                                onChange={(e) =>
                                    updateMethod('own_events', { freeShippingEnabled: e.target.checked })
                                }
                                className="w-4 h-4 accent-[#E2A049] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-400">Activar regla</span>
                        </label>
                    </div>

                    {config.own_events.freeShippingEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    Tipo de umbral
                                </label>
                                <select
                                    value={config.own_events.freeShippingThresholdType || 'liters'}
                                    onChange={(e) =>
                                        updateMethod('own_events', {
                                            freeShippingThresholdType: e.target.value as 'amount' | 'liters',
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                                >
                                    <option value="liters">Por cantidad de Litros (ej: ≥ 50L gratis)</option>
                                    <option value="amount">Por monto total del evento ($ CLP)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    {config.own_events.freeShippingThresholdType === 'amount'
                                        ? 'Monto mínimo para traslado gratis ($)'
                                        : 'Litros mínimos para traslado gratis (L)'}
                                </label>
                                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    {config.own_events.freeShippingThresholdType === 'amount' && (
                                        <span className="text-slate-500 text-xs font-bold">$</span>
                                    )}
                                    <input
                                        type="number"
                                        min={0}
                                        value={config.own_events.freeShippingThreshold || 0}
                                        onChange={(e) =>
                                            updateMethod('own_events', {
                                                freeShippingThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                                            })
                                        }
                                        className="w-full bg-transparent border-none text-emerald-400 text-xs font-black outline-none"
                                    />
                                    {config.own_events.freeShippingThresholdType === 'liters' && (
                                        <span className="text-slate-400 text-xs font-bold">L</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Copia Masiva Eventos */}
                <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/15 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-amber-400 text-xs font-black flex items-center gap-1.5">
                                <Copy size={14} />
                                Tarifa Base de Traslado para RM
                            </span>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                                Fija la misma tarifa de traslado para todas las comunas de eventos en la Región Metropolitana.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                <span className="text-slate-500 text-xs font-bold">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={bulkEventRate}
                                    onChange={(e) => setBulkEventRate(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-28 bg-transparent border-none text-amber-400 text-sm font-black outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleApplyBulkEvent()}
                                disabled={isApplyingBulk}
                                className="px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase hover:bg-amber-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                                {isApplyingBulk ? <RefreshCw size={14} className="animate-spin" /> : <Copy size={14} />}
                                Aplicar a Eventos RM
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TARJETA 3: BLUE EXPRESS (COURIER NACIONAL)                        */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-300 flex items-center justify-center font-black">
                            <Package size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-white font-black text-base">
                                    {config.blue_express.name}
                                </h4>
                                <span className="text-[9px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">
                                    Courier Encomiendas
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">
                                {config.blue_express.description}
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer self-start sm:self-auto">
                        <input
                            type="checkbox"
                            checked={config.blue_express.isActive}
                            onChange={(e) => updateMethod('blue_express', { isActive: e.target.checked })}
                            className="w-5 h-5 accent-[#E2A049] cursor-pointer rounded-md bg-black/40"
                        />
                        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                            {config.blue_express.isActive ? 'Habilitado' : 'Inactivo'}
                        </span>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Días entrega a BE */}
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Días de entrega en oficina Blue Express
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                const active = config.blue_express.availableWeekdays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleWeekday('blue_express', day)}
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            active
                                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                                                : 'bg-black/30 text-slate-500 border border-white/5 hover:text-slate-400'
                                        }`}
                                    >
                                        {WEEKDAY_LABELS[day]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-2">
                            Días en que llevas los paquetes a la sucursal de Blue Express (también agenda ese día en Google Calendar).
                        </p>
                    </div>

                    {/* Anticipación preparación */}
                    <AnticipationRuleEditor
                        methodKey="blue_express"
                        title="Preparación hasta entregar en sucursal Blue Express"
                        method={config.blue_express}
                        maxDays={15}
                        accent="violet"
                        previewPrefix="entrega en sucursal Blue Express"
                        helperNote="A esta fecha se le suman automáticamente los días de tránsito configurados abajo para mostrar el rango estimado al comprador."
                        onUpdate={(updates) => updateMethod('blue_express', updates)}
                    />
                </div>

                {/* Fechas bloqueadas Blue Express */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span className="text-white text-xs font-black flex items-center gap-1.5">
                                <Lock size={14} className="text-rose-400" />
                                Fechas Bloqueadas para Blue Express
                            </span>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                                Días en que la sucursal de Blue Express esté cerrada o no puedas despachar bultos.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={beNewBlockedDate}
                                onChange={(e) => setBeNewBlockedDate(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-rose-400"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    addBlockedDate('blue_express', beNewBlockedDate);
                                    setBeNewBlockedDate('');
                                }}
                                disabled={!beNewBlockedDate}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase hover:bg-rose-500/30 disabled:opacity-30 cursor-pointer"
                            >
                                + Bloquear
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {(!config.blue_express.blockedDates || config.blue_express.blockedDates.length === 0) ? (
                            <span className="text-slate-500 text-xs italic">
                                No hay fechas bloqueadas para Blue Express.
                            </span>
                        ) : (
                            config.blue_express.blockedDates.map((dateStr) => (
                                <span
                                    key={dateStr}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold"
                                >
                                    <Lock size={12} />
                                    {formatBlockedDateReadable(dateStr)}
                                    <button
                                        type="button"
                                        onClick={() => removeBlockedDate('blue_express', dateStr)}
                                        className="text-rose-400 hover:text-rose-200 ml-1 p-0.5 rounded cursor-pointer"
                                        title="Desbloquear fecha"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))
                        )}
                    </div>
                </div>

                {/* Tarifas Oficiales Blue Express (Domicilio) */}
                <div className="bg-black/20 rounded-xl p-5 border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-white text-xs font-black flex items-center gap-1.5">
                                <DollarSign size={14} className="text-violet-300" />
                                Tarifario de Encomiendas Blue Express (A Domicilio)
                            </span>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                                Paquete M (1 barril, hasta 6 kg) · Paquete L (2 a 4 barriles, hasta 20 kg).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void onSaveBeRates()}
                            disabled={isSavingBeRates}
                            className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-black uppercase hover:bg-violet-500/30 disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                            {isSavingBeRates ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                            Guardar Tarifas BE
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
                        {(
                            [
                                ['misma_zona', 'M', 'Misma zona · M'],
                                ['misma_zona', 'L', 'Misma zona · L'],
                                ['centro', 'M', 'Centro · M'],
                                ['centro', 'L', 'Centro · L'],
                                ['extremo', 'M', 'Extremo · M'],
                                ['extremo', 'L', 'Extremo · L'],
                            ] as const
                        ).map(([zone, size, label]) => (
                            <div key={`${zone}-${size}`}>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    {label}
                                </label>
                                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    <span className="text-slate-500 text-xs font-bold">$</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={beRates[zone][size]}
                                        onChange={(e) => {
                                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                            onChangeBeRates({
                                                ...beRates,
                                                [zone]: { ...beRates[zone], [size]: val },
                                            });
                                        }}
                                        className="w-full bg-transparent border-none text-violet-300 text-sm font-black outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Plazos de Tránsito Blue Express por Zona + Días de reparto del courier */}
                <div className="bg-black/20 rounded-xl p-5 border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-white text-xs font-black flex items-center gap-1.5">
                                <Truck size={14} className="text-violet-300" />
                                Tiempos de Tránsito Courier Blue Express
                            </span>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                                Tiempo estimado que demora el courier desde que dejas el paquete en sucursal hasta el domicilio del cliente.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void onSaveBeTransitDays()}
                            disabled={isSavingBeTransitDays}
                            className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-black uppercase hover:bg-violet-500/30 disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                            {isSavingBeTransitDays ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : hasSavedBeTransitDays ? (
                                <Check size={12} className="text-emerald-400" />
                            ) : (
                                <Check size={12} />
                            )}
                            {hasSavedBeTransitDays ? 'Guardado' : 'Guardar Plazos BE'}
                        </button>
                    </div>

                    {/* Radio: días en que Blue Express reparte */}
                    <div className="space-y-2 pt-1">
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            Días de reparto considerados para el tránsito Blue Express
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Días de reparto de Blue Express">
                            {(
                                [
                                    {
                                        value: 'mon_fri' as BlueExpressDeliveryDaysMode,
                                        label: 'Lunes a Viernes (días hábiles)',
                                        sub: 'Estándar oficial de Blue Express · promesa más segura',
                                    },
                                    {
                                        value: 'mon_sat' as BlueExpressDeliveryDaysMode,
                                        label: 'Lunes a Sábado (incluye sábados)',
                                        sub: 'Refleja entregas de sábado donde opera reparto',
                                    },
                                ] as const
                            ).map((option) => {
                                const selected = beDeliveryDaysMode === option.value;
                                return (
                                    <label
                                        key={option.value}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                            selected
                                                ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                                                : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/15 hover:text-slate-200'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="be-delivery-days-mode"
                                            value={option.value}
                                            checked={selected}
                                            onChange={() =>
                                                onChangeBeTransitDays({
                                                    ...beTransitDays,
                                                    deliveryDaysMode: option.value,
                                                })
                                            }
                                            className="w-3.5 h-3.5 accent-[#E2A049] cursor-pointer shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <span className="block text-xs font-black leading-tight">{option.label}</span>
                                            <span className="block text-[10px] opacity-75">{option.sub}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {(
                            [
                                ['misma_zona', 'Misma Zona', 'RM periférica'],
                                ['centro', 'Zona Centro', "Valparaíso, O'Higgins, etc."],
                                ['extremo', 'Zona Extrema', 'Norte grande y Sur austral'],
                            ] as const
                        ).map(([zone, label, hint]) => {
                            const zonePreview = beZonesPreview[zone];
                            return (
                                <div key={zone} className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white text-xs font-black">{label}</span>
                                        <span className="text-slate-400 text-[10px]">{hint}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">
                                                Mínimo
                                            </label>
                                            <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={30}
                                                    value={beTransitDays[zone]?.minDays ?? 1}
                                                    onChange={(e) => {
                                                        const minVal = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                        const currentMax = beTransitDays[zone]?.maxDays ?? minVal;
                                                        onChangeBeTransitDays({
                                                            ...beTransitDays,
                                                            [zone]: { minDays: minVal, maxDays: Math.max(minVal, currentMax) },
                                                        });
                                                    }}
                                                    className="w-full bg-transparent border-none text-violet-300 text-sm font-black outline-none"
                                                />
                                                <span className="text-slate-500 text-[10px] font-bold">días</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">
                                                Máximo
                                            </label>
                                            <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5">
                                                <input
                                                    type="number"
                                                    min={beTransitDays[zone]?.minDays ?? 1}
                                                    max={30}
                                                    value={beTransitDays[zone]?.maxDays ?? 2}
                                                    onChange={(e) => {
                                                        const maxVal = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                        const currentMin = beTransitDays[zone]?.minDays ?? 1;
                                                        onChangeBeTransitDays({
                                                            ...beTransitDays,
                                                            [zone]: { minDays: Math.min(currentMin, maxVal), maxDays: maxVal },
                                                        });
                                                    }}
                                                    className="w-full bg-transparent border-none text-violet-300 text-sm font-black outline-none"
                                                />
                                                <span className="text-slate-500 text-[10px] font-bold">días</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-1.5 border-t border-white/5 text-[10px] text-slate-300 leading-snug">
                                        <span className="text-slate-400">Comprando hoy: </span>
                                        <strong className="text-violet-200">{zonePreview.dateRangeLabel}</strong>
                                        <span className="block text-slate-500">
                                            Sucursal {formatShortDateCL(zonePreview.dispatchDate)} · {zonePreview.estimatedDaysLabel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
