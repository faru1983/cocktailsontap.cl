'use client';

import { useMemo, useState, Fragment } from 'react';
import {
    updateQuickComunaField,
    updateQuickRegionField,
    saveBlueExpressRates,
    updateComunasCarrier,
} from '@/app/actions/admin/adminActions';
import {
    Beer,
    CalendarDays,
    MapPin,
    RefreshCw,
    Search,
    ToggleLeft,
    ToggleRight,
    Truck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
    BLUE_EXPRESS_ZONE_OPTIONS,
    formatBlueExpressPacks,
    isBlueExpressZone,
    parseBlueExpressRates,
    quoteBlueExpressHome,
    type BlueExpressHomeRates,
    type BlueExpressZone,
    type ShippingCarrier,
} from '@/lib/blueExpress';

export interface AdminRegionRow {
    id: string;
    name: string;
    short_name: string;
    code: string;
    display_order: number;
    is_active: boolean;
    available_for_events: boolean;
    available_for_direct: boolean;
    cost: number | null;
    direct_sale_delivery_cost: number | null;
    free_from: number | null;
    shipping_carrier?: ShippingCarrier | null;
    blue_express_zone?: BlueExpressZone | null;
}

export interface AdminComunaRow {
    id: string;
    name: string;
    region_id: string;
    display_order?: number;
    is_active: boolean;
    cost: number | null;
    direct_sale_delivery_cost: number | null;
    free_from: number | null;
    province_name?: string | null;
    shipping_carrier?: ShippingCarrier | null;
    blue_express_zone?: BlueExpressZone | null;
}

type RateField = 'cost' | 'direct_sale_delivery_cost' | 'free_from';

const PROVINCE_ORDER: Record<string, string[]> = {
    XV: ['Arica', 'Parinacota'],
    I: ['Iquique', 'Tamarugal'],
    II: ['Antofagasta', 'El Loa', 'Tocopilla'],
    III: ['Copiapó', 'Chañaral', 'Huasco'],
    IV: ['Elqui', 'Limarí', 'Choapa'],
    V: ['Valparaíso', 'Marga Marga', 'Quillota', 'San Antonio', 'Petorca', 'Los Andes', 'San Felipe', 'Isla de Pascua'],
    RM: ['Santiago', 'Cordillera', 'Chacabuco', 'Maipo', 'Melipilla', 'Talagante'],
    VI: ['Cachapoal', 'Colchagua', 'Cardenal Caro'],
    VII: ['Talca', 'Curicó', 'Linares', 'Cauquenes'],
    XVI: ['Diguillín', 'Punilla', 'Itata'],
    VIII: ['Concepción', 'Biobío', 'Arauco'],
    IX: ['Cautín', 'Malleco'],
    XIV: ['Valdivia', 'Ranco'],
    X: ['Llanquihue', 'Osorno', 'Chiloé', 'Palena'],
    XI: ['Coyhaique', 'Aysén', 'General Carrera', 'Capitán Prat'],
    XII: ['Magallanes', 'Última Esperanza', 'Tierra del Fuego', 'Antártica Chilena'],
};

function provinceKey(comuna: AdminComunaRow): string {
    if (comuna.province_name) return comuna.province_name;
    if (comuna.name === 'Otra') return 'Otra';
    return 'Sin provincia';
}

function effectiveCarrier(region: AdminRegionRow, comuna: AdminComunaRow): ShippingCarrier {
    return comuna.shipping_carrier || region.shipping_carrier || 'own';
}

function comunaTransportValue(comuna: AdminComunaRow): string {
    if (!comuna.shipping_carrier) return 'inherit';
    if (comuna.shipping_carrier === 'own') return 'own';
    return `be:${comuna.blue_express_zone || 'misma_zona'}`;
}

function parseTransportValue(raw: string): {
    shipping_carrier: ShippingCarrier | null;
    blue_express_zone: BlueExpressZone | null;
} {
    if (raw === 'inherit') return { shipping_carrier: null, blue_express_zone: null };
    if (raw === 'own') return { shipping_carrier: 'own', blue_express_zone: null };
    if (raw.startsWith('be:')) {
        const zone = raw.slice(3);
        return {
            shipping_carrier: 'blue_express',
            blue_express_zone: isBlueExpressZone(zone) ? zone : 'misma_zona',
        };
    }
    return { shipping_carrier: null, blue_express_zone: null };
}

interface Props {
    regions: AdminRegionRow[];
    comunas: AdminComunaRow[];
    blueExpressRates?: BlueExpressHomeRates | string | null;
}

function parseNullableInt(value: string): number | null {
    if (value.trim() === '') return null;
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

function displayRate(value: number | null): string {
    return value === null || value === undefined ? '' : String(value);
}

/**
 * Celda de tarifa por comuna: si no hay override, el input vacío muestra
 * el valor de la región (o "—") con placeholder legible. Así no hace falta
 * el texto "Usa región", que se cortaba y no contrastaba en el fondo oscuro.
 */
function ComunaRateCell({
    comunaId,
    field,
    value,
    inherited,
    prefix,
    suffix,
    colorClass,
    saving,
    onBlur,
}: {
    comunaId: string;
    field: RateField;
    value: number | null;
    inherited: number | null;
    prefix?: string;
    suffix?: string;
    colorClass: string;
    saving: boolean;
    onBlur: (raw: string) => void;
}) {
    const inherits = value === null || value === undefined;
    const placeholder = inherited == null ? '—' : String(inherited);
    const hint = inherits
        ? inherited == null
            ? 'Sin tarifa de región'
            : `Usa región: ${inherited}${suffix ? ` ${suffix}` : ''}`
        : undefined;

    return (
        <div className="flex items-center gap-1 min-w-0" title={hint}>
            {prefix && <span className="text-slate-500 text-xs font-bold shrink-0">{prefix}</span>}
            <input
                type="number"
                key={`c-${field}-${comunaId}-${value}`}
                defaultValue={displayRate(value)}
                placeholder={placeholder}
                aria-label={hint ?? field}
                className={`bg-transparent border-none p-0 min-w-[3.25rem] w-full max-w-[5.5rem] ${colorClass} text-sm font-black focus:ring-0 outline-none hover:bg-white/5 rounded px-1 placeholder:text-slate-400 placeholder:font-bold placeholder:opacity-100 ${
                    saving ? 'opacity-40' : ''
                }`}
                onBlur={(e) => onBlur(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {suffix && <span className="text-slate-400 text-[10px] font-bold shrink-0">{suffix}</span>}
            {saving && <RefreshCw size={12} className="text-[#E2A049] animate-spin shrink-0" />}
        </div>
    );
}

export default function CoverageSettings({
    regions: initialRegions,
    comunas: initialComunas,
    blueExpressRates: initialBlueExpressRates,
}: Props) {
    const [regions, setRegions] = useState(initialRegions);
    const [comunas, setComunas] = useState(initialComunas);
    const [beRates, setBeRates] = useState<BlueExpressHomeRates>(() =>
        parseBlueExpressRates(initialBlueExpressRates)
    );
    const [savingRates, setSavingRates] = useState(false);
    const [selectedRegionId, setSelectedRegionId] = useState(
        () => initialRegions.find((r) => r.code === 'RM')?.id ?? initialRegions[0]?.id ?? ''
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightComunaId, setHighlightComunaId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const sortedRegions = useMemo(
        () => [...regions].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        [regions]
    );

    const selectedRegion = regions.find((r) => r.id === selectedRegionId);

    const regionComunas = useMemo(() => {
        if (!selectedRegionId) return [];
        return comunas
            .filter((c) => c.region_id === selectedRegionId)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name, 'es'));
    }, [comunas, selectedRegionId]);

    const groupedComunas = useMemo(() => {
        const map = new Map<string, AdminComunaRow[]>();
        for (const comuna of regionComunas) {
            const key = provinceKey(comuna);
            const list = map.get(key) || [];
            list.push(comuna);
            map.set(key, list);
        }
        const order = selectedRegion ? PROVINCE_ORDER[selectedRegion.code] || [] : [];
        const keys = [...map.keys()].sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            if (a === 'Otra') return 1;
            if (b === 'Otra') return -1;
            return a.localeCompare(b, 'es');
        });
        return keys.map((province) => ({ province, comunas: map.get(province) || [] }));
    }, [regionComunas, selectedRegion]);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        const q = query.trim().toLowerCase();
        if (!q) {
            setHighlightComunaId(null);
            return;
        }
        const match = comunas.find((c) => c.name.toLowerCase().includes(q));
        if (match) {
            setSelectedRegionId(match.region_id);
            setHighlightComunaId(match.id);
        }
    };

    const handleRegionToggle = async (
        field: 'is_active' | 'available_for_events' | 'available_for_direct',
        value: boolean
    ) => {
        if (!selectedRegion) return;
        setSavingId(`${selectedRegion.id}-${field}`);
        try {
            await updateQuickRegionField(selectedRegion.id, { [field]: value });
            setRegions((prev) =>
                prev.map((r) => (r.id === selectedRegion.id ? { ...r, [field]: value } : r))
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const handleRegionRateBlur = async (field: RateField, raw: string) => {
        if (!selectedRegion) return;
        const numValue = parseNullableInt(raw);
        if (selectedRegion[field] === numValue) return;

        setSavingId(`${selectedRegion.id}-${field}`);
        try {
            await updateQuickRegionField(selectedRegion.id, { [field]: numValue });
            setRegions((prev) =>
                prev.map((r) => (r.id === selectedRegion.id ? { ...r, [field]: numValue } : r))
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const handleRegionCarrier = async (
        carrier: ShippingCarrier,
        zone: BlueExpressZone | null
    ) => {
        if (!selectedRegion) return;
        setSavingId(`${selectedRegion.id}-carrier`);
        try {
            const nextZone = carrier === 'own' ? null : zone || 'centro';
            await updateQuickRegionField(selectedRegion.id, {
                shipping_carrier: carrier,
                blue_express_zone: nextZone,
            });
            setRegions((prev) =>
                prev.map((r) =>
                    r.id === selectedRegion.id
                        ? { ...r, shipping_carrier: carrier, blue_express_zone: nextZone }
                        : r
                )
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const handleSaveBlueExpressRates = async () => {
        setSavingRates(true);
        try {
            await saveBlueExpressRates(parseBlueExpressRates(beRates));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar tarifas Blue Express: ' + message);
        } finally {
            setSavingRates(false);
        }
    };

    const applyComunaCarrier = async (
        ids: string[],
        shipping_carrier: ShippingCarrier | null,
        blue_express_zone: BlueExpressZone | null
    ) => {
        if (!ids.length) return;
        setSavingId(`carrier-${ids[0]}`);
        try {
            await updateComunasCarrier(ids, shipping_carrier, blue_express_zone);
            const idSet = new Set(ids);
            setComunas((prev) =>
                prev.map((c) =>
                    idSet.has(c.id) ? { ...c, shipping_carrier, blue_express_zone } : c
                )
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar transporte: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const handleComunaToggle = async (comuna: AdminComunaRow) => {
        const next = !comuna.is_active;
        setSavingId(`${comuna.id}-is_active`);
        try {
            await updateQuickComunaField(comuna.id, { is_active: next });
            setComunas((prev) =>
                prev.map((c) => (c.id === comuna.id ? { ...c, is_active: next } : c))
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const handleComunaRateBlur = async (comuna: AdminComunaRow, field: RateField, raw: string) => {
        const numValue = parseNullableInt(raw);
        if (comuna[field] === numValue) return;

        setSavingId(`${comuna.id}-${field}`);
        try {
            await updateQuickComunaField(comuna.id, { [field]: numValue });
            setComunas((prev) =>
                prev.map((c) => (c.id === comuna.id ? { ...c, [field]: numValue } : c))
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            alert('Error al guardar: ' + message);
        } finally {
            setSavingId(null);
        }
    };

    const ToggleButton = ({
        label,
        icon: Icon,
        checked,
        onChange,
        saving,
        accent = 'text-[#E2A049]',
    }: {
        label: string;
        icon: typeof CalendarDays;
        checked: boolean;
        onChange: (v: boolean) => void;
        saving: boolean;
        accent?: string;
    }) => (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            disabled={saving}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                checked
                    ? 'bg-[#E2A049]/10 border-[#E2A049]/30 text-white'
                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
            } disabled:opacity-50`}
        >
            <Icon size={14} className={checked ? accent : 'text-slate-600'} />
            <span className="text-xs font-bold flex-1">{label}</span>
            {saving ? (
                <RefreshCw size={14} className="animate-spin text-[#E2A049]" />
            ) : checked ? (
                <ToggleRight size={18} className={accent} />
            ) : (
                <ToggleLeft size={18} className="text-slate-600" />
            )}
        </button>
    );

    const RateInput = ({
        label,
        value,
        placeholder,
        colorClass,
        saving,
        onBlur,
        unit = 'clp',
    }: {
        label: string;
        value: number | null;
        placeholder?: string;
        colorClass: string;
        saving: boolean;
        onBlur: (raw: string) => void;
        unit?: 'clp' | 'liters';
    }) => (
        <div>
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                {label}
            </label>
            <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
                {unit === 'clp' && (
                    <span className="text-slate-500 text-xs font-bold">$</span>
                )}
                <input
                    type="number"
                    key={`${label}-${value}`}
                    defaultValue={displayRate(value)}
                    placeholder={placeholder}
                    className={`bg-transparent border-none p-0 w-full ${colorClass} text-sm font-black focus:ring-0 outline-none ${saving ? 'opacity-40' : ''}`}
                    onBlur={(e) => onBlur(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                {unit === 'liters' && (
                    <span className="text-slate-400 text-[10px] font-bold shrink-0">L</span>
                )}
                {saving && <RefreshCw size={12} className="text-[#E2A049] animate-spin shrink-0" />}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-white text-lg font-black flex items-center gap-2">
                        <MapPin size={20} className="text-[#E2A049]" />
                        Cobertura y Despacho
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Tarifas por región y overrides por comuna. Vacío = sin configurar (hereda región).
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Buscar comuna..."
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm outline-none focus:border-[#E2A049] transition-colors"
                    />
                </div>
            </div>

            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-white text-sm font-black flex items-center gap-2">
                            <Truck size={16} className="text-violet-300" />
                            Tarifas Blue Express
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                            Domicilio. M = 1 barril (hasta 6 kg), L = 2 a 4 barriles (hasta 20 kg).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleSaveBlueExpressRates()}
                        disabled={savingRates}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#E2A049]/15 border border-[#E2A049]/30 text-[#E2A049] text-xs font-black uppercase tracking-wider hover:bg-[#E2A049]/25 disabled:opacity-50"
                    >
                        {savingRates ? <RefreshCw size={14} className="animate-spin" /> : null}
                        Guardar tarifas
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                {label}
                            </label>
                            <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
                                <span className="text-slate-500 text-xs font-bold">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={beRates[zone][size]}
                                    onChange={(e) => {
                                        const n = parseNullableInt(e.target.value);
                                        if (n === null) return;
                                        setBeRates((prev) => ({
                                            ...prev,
                                            [zone]: { ...prev[zone], [size]: n },
                                        }));
                                    }}
                                    className="bg-transparent border-none p-0 w-full text-sky-400 text-sm font-black focus:ring-0 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-start gap-5 min-h-[520px]">
                {/* Region list */}
                <div className="lg:w-56 w-full shrink-0 bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    <div className="px-4 py-3 border-b border-white/5">
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            Regiones
                        </span>
                    </div>
                    <div>
                        {sortedRegions.map((region) => {
                            const isSelected = region.id === selectedRegionId;
                            return (
                                <button
                                    key={region.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedRegionId(region.id);
                                        setHighlightComunaId(null);
                                    }}
                                    className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors ${
                                        isSelected
                                            ? 'bg-[#E2A049]/10 border-l-2 border-l-[#E2A049]'
                                            : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span
                                            className={`text-sm font-black ${
                                                isSelected ? 'text-[#E2A049]' : 'text-white'
                                            }`}
                                        >
                                            {region.short_name}
                                        </span>
                                        {!region.is_active && (
                                            <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-black uppercase">
                                                Off
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {region.available_for_events && (
                                            <span className="text-[8px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                <CalendarDays size={8} />
                                                Eventos
                                            </span>
                                        )}
                                        {region.available_for_direct && (
                                            <span className="text-[8px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                <Beer size={8} />
                                                Barriles
                                            </span>
                                        )}
                                        {region.shipping_carrier === 'blue_express' && (
                                            <span className="text-[8px] bg-violet-500/15 text-violet-300 px-1.5 py-0.5 rounded font-black uppercase">
                                                BE{' '}
                                                {region.blue_express_zone === 'extremo'
                                                    ? 'Extremo'
                                                    : region.blue_express_zone === 'misma_zona'
                                                      ? 'Misma zona'
                                                      : 'Centro'}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Region detail */}
                <div className="flex-1 min-w-0 bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    {!selectedRegion ? (
                        <div className="flex items-center justify-center h-full text-slate-500 text-sm p-8">
                            Selecciona una región
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="px-6 py-4 border-b border-white/5">
                                <h3 className="text-white font-black text-base">{selectedRegion.name}</h3>
                                <p className="text-slate-500 text-xs mt-0.5">
                                    Código {selectedRegion.code} · {regionComunas.length} comunas
                                </p>
                            </div>

                            <div className="px-6 py-5 border-b border-white/5 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <ToggleButton
                                        label="Región activa"
                                        icon={MapPin}
                                        checked={selectedRegion.is_active}
                                        saving={savingId === `${selectedRegion.id}-is_active`}
                                        onChange={(v) => handleRegionToggle('is_active', v)}
                                    />
                                    <ToggleButton
                                        label="Disponible eventos"
                                        icon={CalendarDays}
                                        checked={selectedRegion.available_for_events}
                                        saving={savingId === `${selectedRegion.id}-available_for_events`}
                                        onChange={(v) => handleRegionToggle('available_for_events', v)}
                                        accent="text-emerald-400"
                                    />
                                    <ToggleButton
                                        label="Disponible barriles"
                                        icon={Beer}
                                        checked={selectedRegion.available_for_direct}
                                        saving={savingId === `${selectedRegion.id}-available_for_direct`}
                                        onChange={(v) => handleRegionToggle('available_for_direct', v)}
                                        accent="text-sky-400"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                            Transporte desechable
                                        </label>
                                        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
                                            <Truck size={14} className="text-slate-500 shrink-0" />
                                            <select
                                                value={selectedRegion.shipping_carrier === 'blue_express' ? 'blue_express' : 'own'}
                                                disabled={savingId === `${selectedRegion.id}-carrier`}
                                                onChange={(e) => {
                                                    const carrier = e.target.value as ShippingCarrier;
                                                    const zone =
                                                        carrier === 'blue_express'
                                                            ? selectedRegion.blue_express_zone || 'centro'
                                                            : null;
                                                    void handleRegionCarrier(carrier, zone);
                                                }}
                                                className="bg-transparent border-none p-0 w-full text-white text-sm font-bold focus:ring-0 outline-none"
                                            >
                                                <option value="own" className="bg-[#1e2433] text-white">
                                                    Traslado propio
                                                </option>
                                                <option value="blue_express" className="bg-[#1e2433] text-white">
                                                    Blue Express
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    {selectedRegion.shipping_carrier === 'blue_express' && (
                                        <div>
                                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                                                Zona Blue Express
                                            </label>
                                            <select
                                                value={selectedRegion.blue_express_zone || 'centro'}
                                                disabled={savingId === `${selectedRegion.id}-carrier`}
                                                onChange={(e) =>
                                                    void handleRegionCarrier(
                                                        'blue_express',
                                                        e.target.value as BlueExpressZone
                                                    )
                                                }
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-bold focus:ring-0 outline-none"
                                            >
                                                {BLUE_EXPRESS_ZONE_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value} className="bg-[#1e2433]">
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {selectedRegion.shipping_carrier === 'blue_express' &&
                                    isBlueExpressZone(selectedRegion.blue_express_zone) ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {([1, 4, 5] as const).map((n) => {
                                                const quoted = quoteBlueExpressHome(
                                                    n,
                                                    selectedRegion.blue_express_zone as BlueExpressZone,
                                                    beRates
                                                );
                                                return (
                                                    <div
                                                        key={n}
                                                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-2.5"
                                                    >
                                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">
                                                            {n} barril{n > 1 ? 'es' : ''}
                                                        </p>
                                                        <p className="text-sky-400 text-sm font-black">
                                                            {formatCurrency(quoted.cost)}
                                                        </p>
                                                        <p className="text-slate-500 text-[10px] font-bold mt-0.5">
                                                            {formatBlueExpressPacks(quoted)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <RateInput
                                            label="Desechable"
                                            value={selectedRegion.direct_sale_delivery_cost}
                                            colorClass="text-sky-400"
                                            saving={savingId === `${selectedRegion.id}-direct_sale_delivery_cost`}
                                            onBlur={(raw) =>
                                                handleRegionRateBlur('direct_sale_delivery_cost', raw)
                                            }
                                        />
                                    )}
                                    <RateInput
                                        label="Evento"
                                        value={selectedRegion.cost}
                                        colorClass="text-[#E2A049]"
                                        saving={savingId === `${selectedRegion.id}-cost`}
                                        onBlur={(raw) => handleRegionRateBlur('cost', raw)}
                                    />
                                    <RateInput
                                        label="Evento Gratis (L)"
                                        value={selectedRegion.free_from}
                                        colorClass="text-emerald-400"
                                        saving={savingId === `${selectedRegion.id}-free_from`}
                                        onBlur={(raw) => handleRegionRateBlur('free_from', raw)}
                                        unit="liters"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto">
                                <table className="w-full border-collapse text-left min-w-[640px]">
                                    <thead className="sticky top-0 bg-[#1e2433] z-10">
                                        <tr className="bg-white/[0.02]">
                                            <th className="px-6 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                                Comuna
                                            </th>
                                            <th className="px-4 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                                Transporte
                                            </th>
                                            <th className="px-4 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                                Desechable
                                            </th>
                                            <th className="px-4 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                                Evento
                                            </th>
                                            <th className="px-4 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                                Evento Gratis
                                            </th>
                                            <th className="px-4 py-3 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 text-center">
                                                Activa
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedComunas.map((group) => (
                                            <Fragment key={group.province}>
                                                {groupedComunas.length > 1 && (
                                                    <tr className="bg-white/[0.04]">
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span>Provincia {group.province}</span>
                                                                {group.province !== 'Otra' &&
                                                                    group.province !== 'Sin provincia' && (
                                                                        <span className="flex gap-2 normal-case tracking-normal">
                                                                            <button
                                                                                type="button"
                                                                                className="text-[10px] font-black uppercase text-violet-300 hover:text-violet-200"
                                                                                onClick={() =>
                                                                                    void applyComunaCarrier(
                                                                                        group.comunas.map((c) => c.id),
                                                                                        'blue_express',
                                                                                        'misma_zona'
                                                                                    )
                                                                                }
                                                                            >
                                                                                BE misma zona
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-300"
                                                                                onClick={() =>
                                                                                    void applyComunaCarrier(
                                                                                        group.comunas.map((c) => c.id),
                                                                                        null,
                                                                                        null
                                                                                    )
                                                                                }
                                                                            >
                                                                                Igual que la región
                                                                            </button>
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {group.comunas.map((comuna) => {
                                            const highlighted = comuna.id === highlightComunaId;
                                            const usesBlueExpress =
                                                effectiveCarrier(selectedRegion, comuna) === 'blue_express';
                                            return (
                                                <tr
                                                    key={comuna.id}
                                                    className={`border-t border-white/[0.03] transition-colors ${
                                                        highlighted
                                                            ? 'bg-[#E2A049]/10'
                                                            : 'hover:bg-white/[0.01]'
                                                    } ${!comuna.is_active ? 'opacity-50' : ''}`}
                                                >
                                                    <td className="px-6 py-3 text-white font-bold text-sm">
                                                        {comuna.name}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={comunaTransportValue(comuna)}
                                                            disabled={savingId?.startsWith('carrier-')}
                                                            onChange={(e) => {
                                                                const next = parseTransportValue(e.target.value);
                                                                void applyComunaCarrier(
                                                                    [comuna.id],
                                                                    next.shipping_carrier,
                                                                    next.blue_express_zone
                                                                );
                                                            }}
                                                            className="w-full max-w-[11rem] bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white outline-none"
                                                        >
                                                            <option value="inherit" className="bg-[#1e2433]">
                                                                Como la región
                                                            </option>
                                                            <option value="own" className="bg-[#1e2433]">
                                                                Traslado propio
                                                            </option>
                                                            {BLUE_EXPRESS_ZONE_OPTIONS.map((opt) => (
                                                                <option
                                                                    key={opt.value}
                                                                    value={`be:${opt.value}`}
                                                                    className="bg-[#1e2433]"
                                                                >
                                                                    BE {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {usesBlueExpress &&
                                                        comuna.direct_sale_delivery_cost == null ? (
                                                            <span
                                                                className="text-slate-400 text-xs font-bold"
                                                                title="Tarifa Blue Express según cantidad de barriles"
                                                            >
                                                                Según barriles
                                                            </span>
                                                        ) : (
                                                            <ComunaRateCell
                                                                comunaId={comuna.id}
                                                                field="direct_sale_delivery_cost"
                                                                value={comuna.direct_sale_delivery_cost}
                                                                inherited={
                                                                    usesBlueExpress
                                                                        ? null
                                                                        : selectedRegion.direct_sale_delivery_cost
                                                                }
                                                                prefix="$"
                                                                colorClass="text-sky-400"
                                                                saving={
                                                                    savingId ===
                                                                    `${comuna.id}-direct_sale_delivery_cost`
                                                                }
                                                                onBlur={(raw) =>
                                                                    handleComunaRateBlur(
                                                                        comuna,
                                                                        'direct_sale_delivery_cost',
                                                                        raw
                                                                    )
                                                                }
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <ComunaRateCell
                                                            comunaId={comuna.id}
                                                            field="cost"
                                                            value={comuna.cost}
                                                            inherited={selectedRegion.cost}
                                                            prefix="$"
                                                            colorClass="text-[#E2A049]"
                                                            saving={savingId === `${comuna.id}-cost`}
                                                            onBlur={(raw) =>
                                                                handleComunaRateBlur(comuna, 'cost', raw)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <ComunaRateCell
                                                            comunaId={comuna.id}
                                                            field="free_from"
                                                            value={comuna.free_from}
                                                            inherited={selectedRegion.free_from}
                                                            suffix="L"
                                                            colorClass="text-emerald-400"
                                                            saving={savingId === `${comuna.id}-free_from`}
                                                            onBlur={(raw) =>
                                                                handleComunaRateBlur(comuna, 'free_from', raw)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleComunaToggle(comuna)}
                                                            disabled={savingId === `${comuna.id}-is_active`}
                                                            className="inline-flex items-center justify-center p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                                                            title={comuna.is_active ? 'Desactivar comuna' : 'Activar comuna'}
                                                        >
                                                            {savingId === `${comuna.id}-is_active` ? (
                                                                <RefreshCw size={18} className="animate-spin text-[#E2A049]" />
                                                            ) : comuna.is_active ? (
                                                                <ToggleRight size={20} className="text-emerald-400" />
                                                            ) : (
                                                                <ToggleLeft size={20} className="text-slate-600" />
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                                })}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                                {regionComunas.length === 0 && (
                                    <p className="text-slate-500 text-sm text-center py-12">
                                        No hay comunas en esta región
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
