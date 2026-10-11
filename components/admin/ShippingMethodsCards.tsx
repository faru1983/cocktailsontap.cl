'use client';

import React, { useState } from 'react';
import {
    Calendar,
    Check,
    Clock,
    Copy,
    DollarSign,
    Lock,
    Package,
    Plus,
    RefreshCw,
    Sparkles,
    Trash2,
    Truck,
    X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
    WEEKDAY_LABELS,
    type ShippingMethodConfig,
    type ShippingMethodsSettings,
} from '@/lib/shippingMethods';
import {
    type BlueExpressHomeRates,
    type BlueExpressZone,
    isBlueExpressZone,
    parseBlueExpressRates,
    quoteBlueExpressHome,
    formatBlueExpressPacks,
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

function getAnticipationHint(offsetDays: number): string {
    if (offsetDays === 0) return 'El cliente puede solicitar despacho para el mismo día.';
    if (offsetDays === 1) return 'Si el cliente compra el lunes, la primera fecha disponible será el martes.';
    if (offsetDays === 2) return 'Si el cliente compra el lunes, la primera fecha disponible será el miércoles.';
    return `Se requieren al menos ${offsetDays} días de preparación antes de la fecha de entrega.`;
}

export default function ShippingMethodsCards({
    config,
    onChangeConfig,
    onSaveConfig,
    isSavingConfig,
    hasSavedConfig,
    regions,
    comunas,
    onBulkApplyRate,
    beRates,
    onChangeBeRates,
    onSaveBeRates,
    isSavingBeRates,
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

    // ── Custom Method Modal / Creator ────────────────────────────────────────
    const [showNewCustomForm, setShowNewCustomForm] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customDesc, setCustomDesc] = useState('');
    const [customOffset, setCustomOffset] = useState(1);
    const [customWindow, setCustomWindow] = useState('Aviso el día anterior. Retiro AM / Entrega PM');

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

    const handleCreateCustomMethod = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customName.trim()) return;
        const newMethod: ShippingMethodConfig = {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            description: customDesc.trim() || 'Courier personalizado para despachos locales.',
            serviceType: 'direct',
            isActive: true,
            availableWeekdays: [1, 2, 3, 4, 5],
            minOffsetDays: customOffset,
            blockedDates: [],
            deliveryWindow: customWindow.trim(),
            freeShippingEnabled: false,
            freeShippingThresholdType: 'amount',
            freeShippingThreshold: 0,
        };
        onChangeConfig({
            ...config,
            custom_methods: [...(config.custom_methods || []), newMethod],
        });
        setCustomName('');
        setCustomDesc('');
        setShowNewCustomForm(false);
    };

    const removeCustomMethod = (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este método de envío personalizado?')) return;
        onChangeConfig({
            ...config,
            custom_methods: (config.custom_methods || []).filter((m) => m.id !== id),
        });
    };

    const bulkRegion = regions.find((r) => r.id === selectedBulkRegionId);
    const bulkRegionComunas = comunas.filter((c) => c.region_id === selectedBulkRegionId);

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
                        Define días operativos, anticipación, bloqueos de fechas y reglas de envío gratis para cada transporte.
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
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
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
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Anticipación mínima de compra (días)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={30}
                                value={config.own_direct.minOffsetDays}
                                onChange={(e) =>
                                    updateMethod('own_direct', {
                                        minOffsetDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                }
                                className="w-24 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-black text-center focus:border-[#E2A049] outline-none"
                            />
                            <span className="text-slate-400 text-xs font-bold">días corridos</span>
                        </div>
                        <p className="text-sky-400/80 text-[11px] mt-2 font-medium">
                            💡 {getAnticipationHint(config.own_direct.minOffsetDays)}
                        </p>
                    </div>
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
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
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
                    </div>

                    {/* Anticipación eventos */}
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Anticipación mínima para eventos (días)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={60}
                                value={config.own_events.minOffsetDays}
                                onChange={(e) =>
                                    updateMethod('own_events', {
                                        minOffsetDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                                    })
                                }
                                className="w-24 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-black text-center focus:border-[#E2A049] outline-none"
                            />
                            <span className="text-slate-400 text-xs font-bold">días corridos</span>
                        </div>
                        <p className="text-amber-400/80 text-[11px] mt-2 font-medium">
                            💡 Permite asegurar personal y coordinación de barriles y dispensadores.
                        </p>
                    </div>
                </div>

                <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-slate-400 text-xs">
                    ℹ️ <strong className="text-white">Horarios de Reserva y Retiro:</strong> El cliente selecciona libremente el horario estimado en el formulario final de su cotización de evento para la coordinación operativa de tu equipo.
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
                            Días de entrega al courier (cuando llevas los paquetes)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                const active = config.blue_express.availableWeekdays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleWeekday('blue_express', day)}
                                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
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
                    </div>

                    {/* Anticipación preparación */}
                    <div>
                        <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2.5">
                            Anticipación para empaque y entrega a Blue Express
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={15}
                                value={config.blue_express.minOffsetDays}
                                onChange={(e) =>
                                    updateMethod('blue_express', {
                                        minOffsetDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                }
                                className="w-24 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-black text-center focus:border-[#E2A049] outline-none"
                            />
                            <span className="text-slate-400 text-xs font-bold">días</span>
                        </div>
                        <p className="text-violet-300/80 text-[11px] mt-2 font-medium">
                            💡 La fecha elegida por el cliente será el día en que entregas el paquete a la sucursal de Blue Express.
                        </p>
                    </div>
                </div>

                {/* Mensaje al cliente */}
                <div>
                    <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                        Explicación que verá el cliente en el checkout
                    </label>
                    <input
                        type="text"
                        value={config.blue_express.deliveryWindow || ''}
                        onChange={(e) => updateMethod('blue_express', { deliveryWindow: e.target.value })}
                        placeholder="Fecha en que entregamos tu pedido al courier Blue Express para su despacho"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-bold focus:border-[#E2A049] outline-none"
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
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MÉTODOS PERSONALIZADOS / COURIER NUEVO                            */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {config.custom_methods && config.custom_methods.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-white font-black text-sm uppercase tracking-wider">
                        Couriers Personalizados Adicionales
                    </h4>
                    {config.custom_methods.map((custom) => (
                        <div
                            key={custom.id}
                            className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-xl space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                                        <Truck size={16} />
                                    </div>
                                    <div>
                                        <h5 className="text-white text-sm font-black">{custom.name}</h5>
                                        <p className="text-slate-400 text-xs">{custom.description}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeCustomMethod(custom.id)}
                                    className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Eliminar método personalizado"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="text-slate-400 text-xs">
                                <strong>Ventana / Horario:</strong> {custom.deliveryWindow || 'Durante el día'} ·{' '}
                                <strong>Anticipación:</strong> {custom.minOffsetDays} día(s).
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Botón "+ Agregar Nuevo Método" */}
            <div className="p-6 rounded-2xl border border-dashed border-white/10 bg-black/20 text-center">
                {!showNewCustomForm ? (
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowNewCustomForm(true)}
                            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all cursor-pointer border border-white/10"
                        >
                            <Plus size={16} className="text-[#E2A049]" />
                            Agregar Nuevo Método de Envío (ej: Courier Express Santiago)
                        </button>
                        <p className="text-slate-500 text-xs mt-2">
                            Ideal para sumar empresas externas de despacho (ej: servicio que retira en la mañana y entrega en la tarde con aviso previo).
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleCreateCustomMethod} className="max-w-xl mx-auto text-left space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <h5 className="text-white font-black text-sm">Nuevo Método de Envío</h5>
                            <button
                                type="button"
                                onClick={() => setShowNewCustomForm(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                Nombre del servicio
                            </label>
                            <input
                                type="text"
                                required
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="ej: Courier Express Santiago - Entrega Mismo Día"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-[#E2A049]"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                Descripción operativa
                            </label>
                            <input
                                type="text"
                                value={customDesc}
                                onChange={(e) => setCustomDesc(e.target.value)}
                                placeholder="ej: Requiere aviso previo el día anterior hasta las 18:00 hrs."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-[#E2A049]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    Anticipación (días)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={customOffset}
                                    onChange={(e) => setCustomOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                    Horario de entrega / Nota
                                </label>
                                <input
                                    type="text"
                                    value={customWindow}
                                    onChange={(e) => setCustomWindow(e.target.value)}
                                    placeholder="Retiro AM, Entrega PM"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowNewCustomForm(false)}
                                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-xl bg-[#E2A049] text-black text-xs font-black uppercase hover:bg-[#d4933d] cursor-pointer"
                            >
                                Crear Método
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
