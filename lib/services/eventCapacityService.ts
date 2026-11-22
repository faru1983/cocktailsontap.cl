import { createServerClient } from '@/lib/supabaseServer';
import { SettingsService } from '@/lib/services/settingsService';
import {
    ACTIVE_CAPACITY_STATUSES,
    buildEmptyDaySummary,
    calculateRequiredDispensers,
    countPortableKegs,
    DEFAULT_EVENT_CAPACITY,
    evaluateCapacityForRequest,
    EVENT_CAPACITY_SETTING_KEY,
    parseEventCapacityConfig,
    type CapacityEvaluation,
    type DayCapacitySummary,
    type EventCapacityConfig,
} from '@/lib/eventCapacity';

export interface EventDateAvailabilityResult extends CapacityEvaluation {
    config: EventCapacityConfig;
    daySummary: DayCapacitySummary;
}

export async function getEventCapacityConfig(): Promise<EventCapacityConfig> {
    const setting = await SettingsService.getSetting(EVENT_CAPACITY_SETTING_KEY);
    if (!setting || !setting.is_active) {
        return { ...DEFAULT_EVENT_CAPACITY };
    }
    return parseEventCapacityConfig(setting.value);
}

/**
 * Calcula la ocupación diaria de Dispensadores Portátiles y Muros en un rango de fechas.
 * Solo considera eventos confirmados/activos (`confirmed`, `in_delivery`, `completed`)
 * en su `event_date` (al día siguiente los equipos quedan disponibles nuevamente).
 */
export async function getEventOccupancyByDateRange(
    startDate: string,
    endDate: string,
    excludeQuoteId?: string,
): Promise<{ config: EventCapacityConfig; days: Record<string, DayCapacitySummary> }> {
    const db = createServerClient();
    const [config, quotesRes] = await Promise.all([
        getEventCapacityConfig(),
        db
            .from('quotes')
            .select('id, event_date, dispenser, quote_items(size, quantity)')
            .eq('service_type', 'event')
            .in('status', [...ACTIVE_CAPACITY_STATUSES])
            .gte('event_date', startDate)
            .lte('event_date', endDate),
    ]);

    if (quotesRes.error) {
        console.error('[eventCapacityService] Error querying quotes occupancy:', quotesRes.error);
        return { config, days: {} };
    }

    const days: Record<string, DayCapacitySummary> = {};

    for (const q of quotesRes.data || []) {
        if (!q.event_date) continue;
        if (excludeQuoteId && q.id === excludeQuoteId) continue;

        const dateKey = String(q.event_date).slice(0, 10);
        if (!days[dateKey]) {
            days[dateKey] = buildEmptyDaySummary(dateKey, config);
        }

        const kegs = countPortableKegs((q as any).quote_items);
        const req = calculateRequiredDispensers(q.dispenser, kegs);

        days[dateKey].portableUsed += req.portable;
        days[dateKey].muroUsed += req.muro;
        days[dateKey].eventsCount += 1;
    }

    for (const dateKey of Object.keys(days)) {
        const d = days[dateKey];
        d.portableAvailable = Math.max(0, d.portableTotal - d.portableUsed);
        d.maxPortableKegsAvailable = d.portableAvailable * 2;
        d.muroAvailable = Math.max(0, d.muroTotal - d.muroUsed);
    }

    return { config, days };
}

/**
 * Valida la disponibilidad de una fecha puntual para un tipo de dispensador y cantidad de barriles 5L/10L.
 */
export async function checkEventDateAvailability(params: {
    date: string;
    dispenser: 'portatil' | 'muro' | string | null | undefined;
    portableKegCount: number;
    excludeQuoteId?: string;
}): Promise<EventDateAvailabilityResult> {
    const dateKey = String(params.date || '').slice(0, 10);
    const { config, days } = await getEventOccupancyByDateRange(dateKey, dateKey, params.excludeQuoteId);
    const daySummary = days[dateKey] || buildEmptyDaySummary(dateKey, config);
    const evaluation = evaluateCapacityForRequest(daySummary, params.dispenser, params.portableKegCount);

    return {
        ...evaluation,
        config,
        daySummary,
    };
}
