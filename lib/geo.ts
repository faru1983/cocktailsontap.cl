import type { Comuna, Region } from './types';

/** Regiones activas para un canal (eventos | barriles). */
export function filterRegionsForService(
    regions: Region[],
    serviceType: 'event' | 'direct'
): Region[] {
    return regions.filter((r) => {
        if (!r.isActive) return false;
        return serviceType === 'direct' ? r.availableForDirect : r.availableForEvents;
    });
}

/** Comunas activas de una región (por code), con Otra al final solo en RM. */
export function filterComunasForRegion(comunas: Comuna[], regionCode: string): Comuna[] {
    return comunas
        .filter((c) => c.regionCode === regionCode && c.isActive)
        .sort((a, b) => {
            if (a.name === 'Otra') return 1;
            if (b.name === 'Otra') return -1;
            return a.name.localeCompare(b.name, 'es');
        });
}
