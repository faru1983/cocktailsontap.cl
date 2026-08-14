'use client';

import { useMemo } from 'react';
import type { Comuna, Region } from '@/lib/types';
import { filterComunasForRegion, filterRegionsForService } from '@/lib/geo';

const PUBLIC_SELECT =
    "w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]";

const PUBLIC_LABEL = 'block font-bold mb-1 text-brand-text text-[0.8rem]';
const ADMIN_SELECT = 'admin-input appearance-none';
const ADMIN_LABEL = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2';

interface Props {
    regions: Region[];
    comunas: Comuna[];
    serviceType: 'event' | 'direct';
    regionCode: string;
    /** Nombre de comuna seleccionada (alias: comunaName). */
    comuna?: string;
    comunaName?: string;
    otherComuna: string;
    onRegionChange: (regionCode: string) => void;
    onComunaChange: (comuna: string) => void;
    onOtherComunaChange: (other: string) => void;
    stacked?: boolean;
    required?: boolean;
    variant?: 'public' | 'admin';
    labelClassName?: string;
    selectClassName?: string;
}

/**
 * Cascada Región → Comuna.
 * Default: región preseleccionada (RM), comuna en "Selecciona...".
 * "Otra" solo aparece dentro de RM.
 */
export default function RegionComunaFields({
    regions,
    comunas,
    serviceType,
    regionCode,
    comuna,
    comunaName,
    otherComuna,
    onRegionChange,
    onComunaChange,
    onOtherComunaChange,
    stacked = false,
    required = true,
    variant = 'public',
    labelClassName,
    selectClassName,
}: Props) {
    const selectedComuna = comuna ?? comunaName ?? '';
    const isAdmin = variant === 'admin';
    const labelCls = labelClassName ?? (isAdmin ? ADMIN_LABEL : PUBLIC_LABEL);
    const selectCls = selectClassName ?? (isAdmin ? ADMIN_SELECT : PUBLIC_SELECT);
    const inputCls = isAdmin
        ? ADMIN_SELECT
        : 'w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm';

    const availableRegions = useMemo(
        () => filterRegionsForService(regions, serviceType),
        [regions, serviceType]
    );

    const comunasInRegion = useMemo(
        () => filterComunasForRegion(comunas, regionCode),
        [comunas, regionCode]
    );

    const gridClass = stacked
        ? 'flex flex-col gap-3'
        : isAdmin
          ? 'contents'
          : 'grid grid-cols-1 sm:grid-cols-2 gap-3';

    const fields = (
        <>
            <div className={isAdmin ? undefined : undefined}>
                <label className={labelCls}>
                    Región {required && <span className={isAdmin ? 'text-[#E2A049]' : 'text-primary'}>*</span>}
                </label>
                <select
                    required={required}
                    className={selectCls}
                    value={regionCode}
                    onChange={(e) => {
                        onRegionChange(e.target.value);
                        onComunaChange('');
                        onOtherComunaChange('');
                    }}
                >
                    {availableRegions.map((r) => (
                        <option key={r.code} value={r.code}>
                            {r.shortName}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label className={labelCls}>
                    Comuna {required && <span className={isAdmin ? 'text-[#E2A049]' : 'text-primary'}>*</span>}
                </label>
                <select
                    required={required}
                    className={selectCls}
                    value={selectedComuna}
                    onChange={(e) => {
                        onComunaChange(e.target.value);
                        if (e.target.value !== 'Otra') onOtherComunaChange('');
                    }}
                >
                    <option value="">Selecciona...</option>
                    {comunasInRegion.map((c) => (
                        <option key={`${c.regionCode}-${c.name}`} value={c.name}>
                            {c.name === 'Otra' ? 'Otra / No está en la lista' : c.name}
                        </option>
                    ))}
                </select>
            </div>
        </>
    );

    return (
        <div className={isAdmin ? 'md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6' : 'flex flex-col gap-3'}>
            {isAdmin ? fields : <div className={gridClass}>{fields}</div>}

            {selectedComuna === 'Otra' && regionCode === 'RM' && (
                <div className={`animate-fade-in ${isAdmin ? 'md:col-span-2' : ''}`}>
                    <label className={labelCls}>
                        Especificar Comuna{' '}
                        {required && <span className={isAdmin ? 'text-[#E2A049]' : 'text-primary'}>*</span>}
                    </label>
                    <input
                        type="text"
                        required={required}
                        placeholder="Ej: Curacaví"
                        className={inputCls}
                        value={otherComuna}
                        onChange={(e) => onOtherComunaChange(e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}
