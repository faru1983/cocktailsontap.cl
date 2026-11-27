// ==============================================================================
// OBJETIVO: Utilidades puras para cálculo de fechas en hora Chile:
// - Días hábiles (Lunes a Viernes) y días corridos (Lunes a Domingo).
// - Hora de corte opcional por método.
// - Días de reparto courier (Lunes a Viernes o Lunes a Sábado) para Blue Express.
// ==============================================================================

import { PROJECT_TIMEZONE } from './config';

export type OffsetDaysMode = 'business' | 'calendar';
export type CourierDeliveryDaysMode = 'mon_fri' | 'mon_sat';

const MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAY_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export interface ChileDateTimeParts {
    year: number;
    month: number; // 1..12
    day: number; // 1..31
    hour: number; // 0..23
    minute: number; // 0..59
}

/**
 * Obtiene fecha y hora exactas actuales (o de un Date dado) en zona horaria de Chile.
 */
export function getChileDateTimeParts(dateInput?: Date | null): ChileDateTimeParts {
    const target = dateInput instanceof Date && !Number.isNaN(dateInput.getTime()) ? dateInput : new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: PROJECT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(target);
    const getNum = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
        year: getNum('year'),
        month: getNum('month'),
        day: getNum('day'),
        hour: getNum('hour') % 24,
        minute: getNum('minute'),
    };
}

/**
 * Convierte cualquier fecha o string ISO a un objeto Date centrado a mediodía en Chile
 * para evitar saltos o desfases de día por zona horaria.
 */
export function getChileNoonDate(dateInput?: Date | string | null): Date {
    if (!dateInput) {
        const { year, month, day } = getChileDateTimeParts();
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, y, m, d] = match.map(Number);
            return new Date(y, m - 1, d, 12, 0, 0, 0);
        }
    }
    if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
        const { year, month, day } = getChileDateTimeParts(dateInput);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0);
    return d;
}

/**
 * Formatea un objeto Date a string 'YYYY-MM-DD'.
 */
export function formatDateYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Formatea una fecha a formato corto legible en español de Chile (ej: "mié 02 dic").
 */
export function formatShortDateCL(dateInput: Date | string): string {
    const d = getChileNoonDate(dateInput);
    const weekday = WEEKDAY_SHORT_ES[d.getDay()] ?? '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = (MONTH_NAMES_ES[d.getMonth()] ?? '').slice(0, 3).toLowerCase();
    return `${weekday} ${day} ${month}`;
}

/**
 * Parsea hora en formato 'HH:MM' a minutos desde medianoche. Retorna null si es inválida.
 */
export function parseCutoffMinutes(cutoffTime?: string | null): number | null {
    if (!cutoffTime || typeof cutoffTime !== 'string') return null;
    const match = cutoffTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Suma N días corridos (Lunes a Domingo) a partir de una fecha base.
 */
export function addCalendarDays(startDateInput: Date | string, calendarDays: number): Date {
    const current = getChileNoonDate(startDateInput);
    const days = Math.max(0, Math.round(calendarDays || 0));
    if (days === 0) return current;
    current.setDate(current.getDate() + days);
    return current;
}

/**
 * Suma N días hábiles (Lunes a Viernes) a partir de una fecha base.
 * Sábado (6) y Domingo (0) no se cuentan.
 */
export function addBusinessDays(startDateInput: Date | string, businessDays: number): Date {
    const current = getChileNoonDate(startDateInput);
    const days = Math.max(0, Math.round(businessDays || 0));
    if (days === 0) return current;

    let added = 0;
    while (added < days) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            added++;
        }
    }
    return current;
}

/**
 * Suma N días de tránsito courier según modalidad de reparto:
 * - 'mon_fri': Lunes a Viernes (omite sábado y domingo)
 * - 'mon_sat': Lunes a Sábado (omite solo domingo)
 */
export function addCourierDeliveryDays(
    startDateInput: Date | string,
    daysCount: number,
    deliveryDaysMode: CourierDeliveryDaysMode = 'mon_fri'
): Date {
    if (deliveryDaysMode === 'mon_fri') {
        return addBusinessDays(startDateInput, daysCount);
    }
    const current = getChileNoonDate(startDateInput);
    const days = Math.max(0, Math.round(daysCount || 0));
    if (days === 0) return current;

    let added = 0;
    while (added < days) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();
        if (day !== 0) {
            added++;
        }
    }
    return current;
}

/**
 * Avanza una fecha hasta el próximo día hábil (Lun–Vie) si cae en sábado o domingo.
 */
export function rollToNextBusinessDay(dateInput: Date | string): Date {
    const current = getChileNoonDate(dateInput);
    while (current.getDay() === 0 || current.getDay() === 6) {
        current.setDate(current.getDate() + 1);
    }
    return current;
}

/**
 * Calcula la fecha mínima según modalidad (días hábiles o corridos), cantidad de días
 * y hora de corte opcional (en hora de Chile).
 *
 * Reglas exactas:
 * - Días corridos ('calendar'):
 *   - Si la hora actual >= hora de corte (si está activa), el conteo parte desde mañana.
 *   - Luego suma exactamente N días corridos (ej: Lunes + 2 = Miércoles; 0 = hoy).
 * - Días hábiles ('business'):
 *   - Si hoy es Lun–Vie y la hora actual >= hora de corte (si está activa), avanza a mañana.
 *   - Si la fecha base resultante cae en sábado o domingo, el pedido entra el lunes.
 *   - Desde ese primer día hábil suma exactamente N días hábiles (ej: Lunes + 2 = Miércoles;
 *     Domingo -> entra Lunes + 2 = Miércoles; 0 = mismo día hábil o lunes si es fin de semana).
 */
export function calculateOffsetReadyDate(opts: {
    baseDate?: Date | string | null;
    offsetDays: number;
    offsetMode: OffsetDaysMode;
    cutoffEnabled?: boolean;
    cutoffTime?: string | null;
}): Date {
    const days = Math.max(0, Math.round(Number.isFinite(opts.offsetDays) ? opts.offsetDays : 0));
    const cutoffMinutes = opts.cutoffEnabled ? parseCutoffMinutes(opts.cutoffTime) : null;

    let startDate: Date;
    let isAfterCutoff = false;

    if (typeof opts.baseDate === 'string') {
        startDate = getChileNoonDate(opts.baseDate);
    } else {
        const nowParts = getChileDateTimeParts(opts.baseDate ?? undefined);
        startDate = new Date(nowParts.year, nowParts.month - 1, nowParts.day, 12, 0, 0, 0);
        if (cutoffMinutes !== null) {
            const currentMinutes = nowParts.hour * 60 + nowParts.minute;
            isAfterCutoff = currentMinutes >= cutoffMinutes;
        }
    }

    if (opts.offsetMode === 'calendar') {
        if (isAfterCutoff) {
            startDate.setDate(startDate.getDate() + 1);
        }
        return addCalendarDays(startDate, days);
    }

    // Modo días hábiles (Lun–Vie)
    const startWeekday = startDate.getDay();
    const isWeekday = startWeekday !== 0 && startWeekday !== 6;
    if (isWeekday && isAfterCutoff) {
        startDate.setDate(startDate.getDate() + 1);
    }

    const effectiveBusinessStart = rollToNextBusinessDay(startDate);
    return addBusinessDays(effectiveBusinessStart, days);
}

/**
 * Avanza desde startDate hasta encontrar el primer día que cumpla con:
 * - Estar dentro de availableWeekdays (si se informa y no está vacío)
 * - No estar en blockedDates
 */
export function findNextAllowedDate(
    startDateInput: Date | string,
    availableWeekdays?: number[] | null,
    blockedDates?: string[] | null
): Date {
    const current = getChileNoonDate(startDateInput);
    const allowedSet = Array.isArray(availableWeekdays) && availableWeekdays.length > 0
        ? new Set(availableWeekdays)
        : null;
    const blockedSet = Array.isArray(blockedDates) && blockedDates.length > 0
        ? new Set(blockedDates)
        : null;

    for (let guard = 0; guard < 120; guard++) {
        const ymd = formatDateYMD(current);
        const weekdayOk = !allowedSet || allowedSet.has(current.getDay());
        const notBlocked = !blockedSet || !blockedSet.has(ymd);
        if (weekdayOk && notBlocked) {
            return current;
        }
        current.setDate(current.getDate() + 1);
    }

    return current;
}

/**
 * Compatibilidad: retorna la fecha en que el pedido está listo en días hábiles
 * (Domingo -> entra Lunes + N hábiles; Lunes -> +N hábiles).
 */
export function getProductionReadyDate(startDateInput: Date | string, productionBusinessDays: number): Date {
    return calculateOffsetReadyDate({
        baseDate: startDateInput,
        offsetDays: productionBusinessDays,
        offsetMode: 'business',
    });
}

/**
 * Formatea un rango de fechas en lenguaje natural amigable en español de Chile.
 * Ejemplos:
 *  - Mismo mes: "01 al 05 de Noviembre"
 *  - Meses distintos: "28 de Octubre al 03 de Noviembre"
 */
export function formatDateRangeCL(minDate: Date, maxDate: Date): string {
    const minDay = String(minDate.getDate()).padStart(2, '0');
    const maxDay = String(maxDate.getDate()).padStart(2, '0');
    const minMonth = MONTH_NAMES_ES[minDate.getMonth()];
    const maxMonth = MONTH_NAMES_ES[maxDate.getMonth()];

    if (minDay === maxDay && minMonth === maxMonth) {
        return `${minDay} de ${minMonth}`;
    }
    if (minMonth === maxMonth) {
        return `${minDay} al ${maxDay} de ${maxMonth}`;
    }
    return `${minDay} de ${minMonth} al ${maxDay} de ${maxMonth}`;
}

export interface DirectSaleSchedule {
    dispatchDate: string; // YYYY-MM-DD
    deliveryMinDate: string; // YYYY-MM-DD
    deliveryMaxDate: string; // YYYY-MM-DD
    estimatedDaysLabel: string; // ej: "3–4 días hábiles" o "3–4 días"
    dateRangeLabel: string; // ej: "01 al 05 de Noviembre"
}

/**
 * Calcula el itinerario completo de venta directa para Blue Express:
 * 1. Fecha de entrega en sucursal Blue Express según días hábiles/corridos, hora de corte,
 *    días habilitados de entrega al courier y fechas bloqueadas.
 * 2. Rango de llegada: fecha en sucursal + días de tránsito courier (Lun–Vie o Lun–Sáb).
 */
export function calculateDirectSaleSchedule(opts: {
    baseDate?: Date | string;
    productionBusinessDays: number;
    productionOffsetMode?: OffsetDaysMode;
    cutoffEnabled?: boolean;
    cutoffTime?: string | null;
    availableWeekdays?: number[];
    blockedDates?: string[];
    transitMinDays: number;
    transitMaxDays: number;
    deliveryDaysMode?: CourierDeliveryDaysMode;
}): DirectSaleSchedule {
    const productionDays = Math.max(0, Math.round(Number.isFinite(opts.productionBusinessDays) ? opts.productionBusinessDays : 2));
    const offsetMode: OffsetDaysMode = opts.productionOffsetMode === 'calendar' ? 'calendar' : 'business';
    const deliveryDaysMode: CourierDeliveryDaysMode = opts.deliveryDaysMode === 'mon_sat' ? 'mon_sat' : 'mon_fri';
    const transitMin = Math.max(1, Math.round(opts.transitMinDays || 1));
    const transitMax = Math.max(transitMin, Math.round(opts.transitMaxDays || transitMin));

    // 1. Fecha de entrega en sucursal Blue Express
    const rawDispatchDateObj = calculateOffsetReadyDate({
        baseDate: opts.baseDate ?? null,
        offsetDays: productionDays,
        offsetMode,
        cutoffEnabled: opts.cutoffEnabled,
        cutoffTime: opts.cutoffTime,
    });
    const dispatchDateObj = findNextAllowedDate(
        rawDispatchDateObj,
        opts.availableWeekdays,
        opts.blockedDates
    );

    // 2. Llegada (tránsito courier a partir de la entrega en sucursal)
    const deliveryMinObj = addCourierDeliveryDays(dispatchDateObj, transitMin, deliveryDaysMode);
    const deliveryMaxObj = addCourierDeliveryDays(dispatchDateObj, transitMax, deliveryDaysMode);

    const totalMinDays = productionDays + transitMin;
    const totalMaxDays = productionDays + transitMax;
    const isStrictlyBusiness = offsetMode === 'business' && deliveryDaysMode === 'mon_fri';
    const unitLabel = isStrictlyBusiness
        ? totalMaxDays === 1
            ? 'día hábil'
            : 'días hábiles'
        : totalMaxDays === 1
          ? 'día'
          : 'días';
    const daysRange = totalMinDays === totalMaxDays ? `${totalMinDays}` : `${totalMinDays}–${totalMaxDays}`;

    return {
        dispatchDate: formatDateYMD(dispatchDateObj),
        deliveryMinDate: formatDateYMD(deliveryMinObj),
        deliveryMaxDate: formatDateYMD(deliveryMaxObj),
        estimatedDaysLabel: `${daysRange} ${unitLabel}`,
        dateRangeLabel: formatDateRangeCL(deliveryMinObj, deliveryMaxObj),
    };
}
