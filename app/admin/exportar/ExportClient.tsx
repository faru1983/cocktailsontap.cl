'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Panel } from '@/components/admin/ui/Panel';
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import {
    deleteExportPreset,
    previewExport,
    saveExportPreset,
} from '@/app/actions/admin/exportActions';
import {
    encodeExportConfig,
    type ExportClientFilters,
    type ExportConfig,
    type ExportDataset,
    type ExportPreset,
    type ExportQuoteFilters,
} from '@/lib/exportSchemas';
import {
    defaultExportConfig,
    getFieldGroups,
} from '@/lib/services/exportService';
import { Download, Eye, Save, Trash2, FileSpreadsheet } from 'lucide-react';

const fieldClass =
    'bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-primary/50 w-full';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';

const STAGE_OPTIONS = [
    { value: 'curious', label: 'Curioso' },
    { value: 'engaged', label: 'Interesado' },
    { value: 'quoted', label: 'Cotizado' },
    { value: 'customer', label: 'Cliente' },
    { value: 'lost', label: 'Perdido' },
];

const QUOTE_STATUS_OPTIONS = [
    { value: 'draft', label: 'Borrador' },
    { value: 'confirmed', label: 'Confirmado' },
    { value: 'in_delivery', label: 'En reparto' },
    { value: 'completed', label: 'Completado' },
    { value: 'cancelled', label: 'Cancelado' },
];

function clientFilters(config: ExportConfig): ExportClientFilters {
    return (config.filters || {}) as ExportClientFilters;
}

function quoteFilters(config: ExportConfig): ExportQuoteFilters {
    return (config.filters || {}) as ExportQuoteFilters;
}

export default function ExportClient({
    builtinPresets,
    savedPresets: initialSaved,
    comunas,
}: {
    builtinPresets: ExportPreset[];
    savedPresets: ExportPreset[];
    comunas: string[];
}) {
    const [isPending, startTransition] = useTransition();
    const [config, setConfig] = useState<ExportConfig>(() => defaultExportConfig('clients'));
    const [savedPresets, setSavedPresets] = useState(initialSaved);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
    const [presetName, setPresetName] = useState('');
    const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
    const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
    const [previewKeys, setPreviewKeys] = useState<string[]>([]);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const allPresets = useMemo(
        () => [...builtinPresets, ...savedPresets],
        [builtinPresets, savedPresets]
    );

    const fieldGroups = useMemo(() => getFieldGroups(config.dataset), [config.dataset]);

    const updateConfig = useCallback((patch: Partial<ExportConfig>) => {
        setConfig((prev) => ({ ...prev, ...patch }));
        setSelectedPresetId('custom');
    }, []);

    const updateFormat = useCallback((patch: Partial<ExportConfig['format']>) => {
        setConfig((prev) => ({ ...prev, format: { ...prev.format, ...patch } }));
        setSelectedPresetId('custom');
    }, []);

    const updateClientFilter = useCallback((patch: Partial<ExportClientFilters>) => {
        setConfig((prev) => ({
            ...prev,
            filters: { ...clientFilters(prev), ...patch },
        }));
        setSelectedPresetId('custom');
    }, []);

    const updateQuoteFilter = useCallback((patch: Partial<ExportQuoteFilters>) => {
        setConfig((prev) => ({
            ...prev,
            filters: { ...quoteFilters(prev), ...patch },
        }));
        setSelectedPresetId('custom');
    }, []);

    const setDataset = useCallback((dataset: ExportDataset) => {
        setConfig(defaultExportConfig(dataset));
        setSelectedPresetId('custom');
        setPreviewRows([]);
        setPreviewHeaders([]);
        setPreviewKeys([]);
    }, []);

    const toggleField = useCallback((key: string) => {
        setConfig((prev) => {
            const fields = prev.fields.includes(key)
                ? prev.fields.filter((f) => f !== key)
                : [...prev.fields, key];
            return { ...prev, fields };
        });
        setSelectedPresetId('custom');
    }, []);

    const selectAllInGroup = useCallback((groupId: string, select: boolean) => {
        const group = fieldGroups.find((g) => g.id === groupId);
        if (!group) return;
        const keys = group.fields.map((f) => f.key);
        setConfig((prev) => {
            let fields = [...prev.fields];
            if (select) {
                for (const k of keys) {
                    if (!fields.includes(k)) fields.push(k);
                }
            } else {
                fields = fields.filter((f) => !keys.includes(f));
            }
            return { ...prev, fields };
        });
        setSelectedPresetId('custom');
    }, [fieldGroups]);

    const applyPreset = useCallback(
        (presetId: string) => {
            if (presetId === 'custom') {
                setSelectedPresetId('custom');
                return;
            }
            const preset = allPresets.find((p) => p.id === presetId);
            if (!preset) return;
            setConfig(JSON.parse(JSON.stringify(preset.config)) as ExportConfig);
            setSelectedPresetId(presetId);
            setPreviewRows([]);
        },
        [allPresets]
    );

    useEffect(() => {
        setTotalCount(null);
    }, [config]);

    const runPreview = () => {
        setError(null);
        if (config.fields.length === 0) {
            setError('Selecciona al menos un campo');
            return;
        }
        startTransition(async () => {
            const res = await previewExport(config);
            if (!res.success) {
                setError(res.error || 'Error en vista previa');
                return;
            }
            setPreviewRows(res.rows || []);
            setPreviewHeaders(res.headers || []);
            setPreviewKeys(res.columnKeys || []);
            setTotalCount(res.total ?? 0);
        });
    };

    const handleDownload = () => {
        if (config.fields.length === 0) {
            setError('Selecciona al menos un campo');
            return;
        }
        const encoded = encodeExportConfig(config);
        window.location.href = `/admin/exportar/download?c=${encodeURIComponent(encoded)}`;
    };

    const handleSavePreset = () => {
        if (!presetName.trim()) {
            setError('Escribe un nombre para el preset');
            return;
        }
        startTransition(async () => {
            const res = await saveExportPreset(presetName, config);
            if (!res.success) {
                setError(res.error || 'No se pudo guardar');
                return;
            }
            setSavedPresets((prev) => {
                const filtered = prev.filter((p) => p.id !== res.id);
                return [...filtered, { id: res.id!, name: presetName.trim(), config }];
            });
            setSelectedPresetId(res.id!);
            setPresetName('');
            setError(null);
        });
    };

    const handleDeletePreset = () => {
        const preset = savedPresets.find((p) => p.id === selectedPresetId);
        if (!preset) return;
        if (!confirm(`¿Eliminar preset "${preset.name}"?`)) return;
        startTransition(async () => {
            const res = await deleteExportPreset(preset.id);
            if (!res.success) {
                setError(res.error || 'No se pudo eliminar');
                return;
            }
            setSavedPresets((prev) => prev.filter((p) => p.id !== preset.id));
            setSelectedPresetId('custom');
        });
    };

    const cf = clientFilters(config);
    const qf = quoteFilters(config);
    const isSavedPreset = savedPresets.some((p) => p.id === selectedPresetId);

    return (
        <div className="space-y-6">
            <Panel title="Dataset y preset" accent="primary">
                <div className="p-4 md:p-6 space-y-4">
                    <div>
                        <label className={labelClass}>Exportar</label>
                        <SegmentedControl
                            value={config.dataset}
                            options={[
                                { value: 'clients', label: 'Clientes' },
                                { value: 'quotes', label: 'Cotizaciones' },
                            ]}
                            onChange={setDataset}
                            ariaLabel="Dataset de exportación"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                        <div>
                            <label className={labelClass}>Preset</label>
                            <select
                                className={fieldClass}
                                value={selectedPresetId}
                                onChange={(e) => applyPreset(e.target.value)}
                            >
                                <option value="custom">Personalizado</option>
                                <optgroup label="Incorporados">
                                    {builtinPresets.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </optgroup>
                                {savedPresets.length > 0 && (
                                    <optgroup label="Guardados">
                                        {savedPresets.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Guardar como</label>
                            <input
                                className={fieldClass}
                                placeholder="Mi preset…"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={isPending || !presetName.trim()}
                                onClick={handleSavePreset}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 text-primary font-bold text-sm border-none cursor-pointer disabled:opacity-40"
                            >
                                <Save size={16} /> Guardar
                            </button>
                            {isSavedPreset && (
                                <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={handleDeletePreset}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 font-bold text-sm border-none cursor-pointer"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {totalCount !== null && (
                        <p className="text-sm text-slate-400">
                            <span className="font-bold text-white">{totalCount.toLocaleString('es-CL')}</span>{' '}
                            registros en la última vista previa / export.
                        </p>
                    )}
                </div>
            </Panel>

            <Panel
                title="Campos"
                subtitle={`${config.fields.length} seleccionados`}
                accent="event"
            >
                <div className="p-4 md:p-6 space-y-4">
                    {fieldGroups.map((group) => {
                        const collapsed = collapsedGroups[group.id];
                        const selectedInGroup = group.fields.filter((f) =>
                            config.fields.includes(f.key)
                        ).length;
                        return (
                            <div key={group.id} className="border border-admin-border rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCollapsedGroups((p) => ({
                                            ...p,
                                            [group.id]: !p[group.id],
                                        }))
                                    }
                                    className="w-full flex items-center justify-between px-4 py-3 bg-black/20 text-left border-none cursor-pointer"
                                >
                                    <span className="text-white font-bold text-sm">
                                        {group.label}{' '}
                                        <span className="text-slate-500 font-normal">
                                            ({selectedInGroup}/{group.fields.length})
                                        </span>
                                    </span>
                                    <span className="text-slate-500 text-xs">{collapsed ? '+' : '−'}</span>
                                </button>
                                {!collapsed && (
                                    <div className="p-4 pt-2 space-y-2">
                                        <div className="flex gap-2 mb-2">
                                            <button
                                                type="button"
                                                onClick={() => selectAllInGroup(group.id, true)}
                                                className="text-[11px] font-bold text-primary bg-transparent border-none cursor-pointer"
                                            >
                                                Todos
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectAllInGroup(group.id, false)}
                                                className="text-[11px] font-bold text-slate-500 bg-transparent border-none cursor-pointer"
                                            >
                                                Ninguno
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {group.fields.map((field) => (
                                                <label
                                                    key={field.key}
                                                    className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={config.fields.includes(field.key)}
                                                        onChange={() => toggleField(field.key)}
                                                        className="accent-primary"
                                                    />
                                                    {field.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Panel>

            <Panel title="Filtros y formato" accent="direct">
                <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-white font-bold text-sm">Filtros</h3>
                        {config.dataset === 'clients' ? (
                            <>
                                <div>
                                    <label className={labelClass}>Etapas CRM</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STAGE_OPTIONS.map((s) => {
                                            const active = cf.stages?.includes(s.value);
                                            return (
                                                <button
                                                    key={s.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const stages = cf.stages || [];
                                                        updateClientFilter({
                                                            stages: active
                                                                ? stages.filter((x) => x !== s.value)
                                                                : [...stages, s.value],
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer ${
                                                        active
                                                            ? 'bg-primary text-black'
                                                            : 'bg-white/5 text-slate-400'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Intent</label>
                                        <select
                                            className={fieldClass}
                                            value={cf.intent || 'all'}
                                            onChange={(e) =>
                                                updateClientFilter({
                                                    intent: e.target.value as ExportClientFilters['intent'],
                                                })
                                            }
                                        >
                                            <option value="all">Todos</option>
                                            <option value="event">Eventos</option>
                                            <option value="direct">Directas</option>
                                            <option value="unknown">Desconocido</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <select
                                            className={fieldClass}
                                            value={
                                                cf.hasEmail === true
                                                    ? 'yes'
                                                    : cf.hasEmail === false
                                                      ? 'no'
                                                      : 'any'
                                            }
                                            onChange={(e) =>
                                                updateClientFilter({
                                                    hasEmail:
                                                        e.target.value === 'yes'
                                                            ? true
                                                            : e.target.value === 'no'
                                                              ? false
                                                              : null,
                                                })
                                            }
                                        >
                                            <option value="any">Cualquiera</option>
                                            <option value="yes">Con email</option>
                                            <option value="no">Sin email</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Desde</label>
                                        <input
                                            type="date"
                                            className={fieldClass}
                                            value={cf.dateFrom || ''}
                                            onChange={(e) =>
                                                updateClientFilter({ dateFrom: e.target.value || null })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Hasta</label>
                                        <input
                                            type="date"
                                            className={fieldClass}
                                            value={cf.dateTo || ''}
                                            onChange={(e) =>
                                                updateClientFilter({ dateTo: e.target.value || null })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Fecha según</label>
                                        <select
                                            className={fieldClass}
                                            value={cf.dateField || 'created_at'}
                                            onChange={(e) =>
                                                updateClientFilter({
                                                    dateField: e.target.value as ExportClientFilters['dateField'],
                                                })
                                            }
                                        >
                                            <option value="created_at">Creación cliente</option>
                                            <option value="last_purchase">Última compra</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Mín. pedidos</label>
                                        <input
                                            type="number"
                                            min={0}
                                            className={fieldClass}
                                            value={cf.minOrders || 0}
                                            onChange={(e) =>
                                                updateClientFilter({
                                                    minOrders: parseInt(e.target.value, 10) || 0,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={cf.excludeDuplicates || false}
                                        onChange={(e) =>
                                            updateClientFilter({ excludeDuplicates: e.target.checked })
                                        }
                                        className="accent-primary"
                                    />
                                    Excluir posibles duplicados
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={cf.onlyEventBuyers || false}
                                        onChange={(e) =>
                                            updateClientFilter({ onlyEventBuyers: e.target.checked })
                                        }
                                        className="accent-primary"
                                    />
                                    Solo compradores de eventos
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={cf.onlyDirectBuyers || false}
                                        onChange={(e) =>
                                            updateClientFilter({ onlyDirectBuyers: e.target.checked })
                                        }
                                        className="accent-primary"
                                    />
                                    Solo compradores directos
                                </label>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className={labelClass}>Estados</label>
                                    <div className="flex flex-wrap gap-2">
                                        {QUOTE_STATUS_OPTIONS.map((s) => {
                                            const active = qf.statuses?.includes(s.value);
                                            return (
                                                <button
                                                    key={s.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const statuses = qf.statuses || [];
                                                        updateQuoteFilter({
                                                            statuses: active
                                                                ? statuses.filter((x) => x !== s.value)
                                                                : [...statuses, s.value],
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer ${
                                                        active
                                                            ? 'bg-chart-direct text-black'
                                                            : 'bg-white/5 text-slate-400'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Tipo venta</label>
                                        <select
                                            className={fieldClass}
                                            value={qf.saleType || 'all'}
                                            onChange={(e) =>
                                                updateQuoteFilter({
                                                    saleType: e.target.value as ExportQuoteFilters['saleType'],
                                                })
                                            }
                                        >
                                            <option value="all">Todos</option>
                                            <option value="event">Eventos</option>
                                            <option value="direct">Directas</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Origen</label>
                                        <select
                                            className={fieldClass}
                                            value={qf.source || 'all'}
                                            onChange={(e) =>
                                                updateQuoteFilter({
                                                    source: e.target.value as ExportQuoteFilters['source'],
                                                })
                                            }
                                        >
                                            <option value="all">Todos</option>
                                            <option value="web">Web</option>
                                            <option value="admin">Admin</option>
                                            <option value="whatsapp">WhatsApp</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Desde</label>
                                        <input
                                            type="date"
                                            className={fieldClass}
                                            value={qf.dateFrom || ''}
                                            onChange={(e) =>
                                                updateQuoteFilter({ dateFrom: e.target.value || null })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Hasta</label>
                                        <input
                                            type="date"
                                            className={fieldClass}
                                            value={qf.dateTo || ''}
                                            onChange={(e) =>
                                                updateQuoteFilter({ dateTo: e.target.value || null })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Fecha según</label>
                                        <select
                                            className={fieldClass}
                                            value={qf.dateField || 'created_at'}
                                            onChange={(e) =>
                                                updateQuoteFilter({
                                                    dateField: e.target.value as ExportQuoteFilters['dateField'],
                                                })
                                            }
                                        >
                                            <option value="created_at">Creación pedido</option>
                                            <option value="event_date">Fecha evento / entrega</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Comuna</label>
                                        <input
                                            list="export-comunas"
                                            className={fieldClass}
                                            placeholder="Filtrar comuna…"
                                            value={qf.comuna || ''}
                                            onChange={(e) =>
                                                updateQuoteFilter({ comuna: e.target.value || null })
                                            }
                                        />
                                        <datalist id="export-comunas">
                                            {comunas.map((c) => (
                                                <option key={c} value={c} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={qf.withBalance || false}
                                        onChange={(e) =>
                                            updateQuoteFilter({ withBalance: e.target.checked })
                                        }
                                        className="accent-primary"
                                    />
                                    Solo con saldo pendiente
                                </label>
                            </>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-white font-bold text-sm">Formato de salida</h3>
                        <div>
                            <label className={labelClass}>Archivo</label>
                            <SegmentedControl
                                value={config.format.type}
                                options={[
                                    { value: 'csv', label: 'CSV' },
                                    { value: 'txt', label: 'TXT' },
                                    { value: 'json', label: 'JSON' },
                                ]}
                                onChange={(v) => updateFormat({ type: v })}
                                ariaLabel="Formato de archivo"
                                size="sm"
                            />
                        </div>
                        {config.format.type === 'csv' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Separador</label>
                                    <select
                                        className={fieldClass}
                                        value={config.format.csvSeparator || ';'}
                                        onChange={(e) =>
                                            updateFormat({
                                                csvSeparator: e.target.value as ';' | ',',
                                            })
                                        }
                                    >
                                        <option value=";">Punto y coma (;)</option>
                                        <option value=",">Coma (,)</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer mt-6">
                                    <input
                                        type="checkbox"
                                        checked={config.format.csvBom !== false}
                                        onChange={(e) => updateFormat({ csvBom: e.target.checked })}
                                        className="accent-primary"
                                    />
                                    BOM UTF-8 (Excel)
                                </label>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Fechas</label>
                                <select
                                    className={fieldClass}
                                    value={config.format.dateFormat || 'iso'}
                                    onChange={(e) =>
                                        updateFormat({
                                            dateFormat: e.target.value as 'iso' | 'es-cl',
                                        })
                                    }
                                >
                                    <option value="iso">ISO (2026-09-07)</option>
                                    <option value="es-cl">es-CL (07-09-2026)</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Montos</label>
                                <select
                                    className={fieldClass}
                                    value={config.format.amountFormat || 'plain'}
                                    onChange={(e) =>
                                        updateFormat({
                                            amountFormat: e.target.value as 'plain' | 'formatted',
                                        })
                                    }
                                >
                                    <option value="plain">Número plano</option>
                                    <option value="formatted">Formato $ CLP</option>
                                </select>
                            </div>
                        </div>
                        {config.dataset === 'clients' && (
                            <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer p-3 rounded-xl bg-primary/5 border border-primary/20">
                                <input
                                    type="checkbox"
                                    checked={config.format.hashPii || false}
                                    onChange={(e) => updateFormat({ hashPii: e.target.checked })}
                                    className="accent-primary mt-0.5"
                                />
                                <span>
                                    <span className="font-bold text-primary block">Hashear PII (Meta Ads)</span>
                                    Normaliza y aplica SHA-256 a email, teléfono, nombre, apellido y comuna.
                                    Columnas con headers Meta (email, phone, fn, ln, ct).
                                </span>
                            </label>
                        )}
                    </div>
                </div>
            </Panel>

            {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-400 text-sm font-medium">
                    {error}
                </div>
            )}

            <Panel
                title="Vista previa y descarga"
                accent="profit"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={runPreview}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-200 font-bold text-sm border-none cursor-pointer disabled:opacity-50"
                        >
                            <Eye size={16} /> Vista previa
                        </button>
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-black text-sm border-none cursor-pointer disabled:opacity-50"
                        >
                            <Download size={16} /> Descargar
                        </button>
                    </div>
                }
            >
                <div className="p-4 md:p-6">
                    {previewRows.length === 0 ? (
                        <EmptyState
                            message="Genera una vista previa para ver las primeras 20 filas."
                            icon={FileSpreadsheet}
                        />
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-admin-border">
                            <table className="w-full border-collapse text-sm min-w-max">
                                <thead>
                                    <tr className="bg-black/30">
                                        {previewHeaders.map((h) => (
                                            <th
                                                key={h}
                                                className="text-left px-3 py-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-admin-border whitespace-nowrap"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-admin-border/50">
                                            {previewKeys.map((key) => (
                                                <td
                                                    key={key}
                                                    className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[240px] truncate"
                                                    title={row[key]}
                                                >
                                                    {row[key]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-xs text-slate-500 p-3 border-t border-admin-border">
                                Mostrando {previewRows.length} de {totalCount ?? '—'} filas.
                            </p>
                        </div>
                    )}
                </div>
            </Panel>
        </div>
    );
}
