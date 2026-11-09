// ==============================================================================
// OBJETIVO: Utilidades puras para cálculo de días hábiles (Lunes a Viernes).
// Excluye fines de semana. Utilizado para tiempos de producción y tránsito courier.
// ==============================================================================

import { PROJECT_TIMEZONE } from './config';

const MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Convierte cualquier fecha o string ISO a un objeto Date centrado a mediodía en Chile
 * para evitar saltos o desfases de día por zona horaria.
 */
export function getChileNoonDate(dateInput?: Date | string | null): Date {
    if (!dateInput) {
        const now = new Date();
        const str = now.toLocaleString('en-US', { timeZone: PROJECT_TIMEZONE });
        const local = new Date(str);
        local.setHours(12, 0, 0, 0);
        return local;
    }
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, y, m, d] = match.map(Number);
            return new Date(y, m - 1, d, 12, 0, 0, 0);
        }
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
 * Suma N días hábiles (Lunes a Viernes) a partir de una fecha base.
 * Sábado (6) y Domingo (0) no se cuentan.
 */
export function addBusinessDays(startDateInput: Date | string, businessDays: number): Date {
    const current = getChileNoonDate(startDateInput);
    if (businessDays <= 0) return current;

    let added = 0;
    while (added < businessDays) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            added++;
        }
    }
    return current;
}

/**
 * Retorna la fecha en que el pedido está listo para despachar o repartir
 * (es decir, el día hábil siguiente tras completar los N días hábiles de producción).
 *
 * Ejemplo con 2 días hábiles de producción:
 *  - Compra Domingo: Lun (1), Mar (2) -> Listo Miércoles.
 *  - Compra Lunes:   Mar (1), Mié (2) -> Listo Jueves.
 *  - Compra Jueves:  Vie (1), Lun (2) -> Listo Martes.
 *  - Compra Viernes: Lun (1), Mar (2) -> Listo Miércoles.
 */
export function getProductionReadyDate(startDateInput: Date | string, productionBusinessDays: number): Date {
    const days = Math.max(1, productionBusinessDays || 2);
    // El día de despacho es el día hábil siguiente a cumplir los días de producción (+1)
    return addBusinessDays(startDateInput, days + 1);
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

    if (minMonth === maxMonth) {
        return `${minDay} al ${maxDay} de ${maxMonth}`;
    }
    return `${minDay} de ${minMonth} al ${maxDay} de ${maxMonth}`;
}

export interface DirectSaleSchedule {
    dispatchDate: string; // YYYY-MM-DD
    deliveryMinDate: string; // YYYY-MM-DD
    deliveryMaxDate: string; // YYYY-MM-DD
    estimatedDaysLabel: string; // ej: "4–5 días hábiles"
    dateRangeLabel: string; // ej: "01 al 05 de Noviembre"
}

/**
 * Calcula el itinerario completo de venta directa para Blue Express:
 * 1. Fecha de despacho: día hábil después de producción.
 * 2. Rango de llegada: fecha de despacho + días de transporte courier (min y max).
 */
export function calculateDirectSaleSchedule(opts: {
    baseDate?: Date | string;
    productionBusinessDays: number;
    transitMinDays: number;
    transitMaxDays: number;
}): DirectSaleSchedule {
    const productionDays = Math.max(1, opts.productionBusinessDays || 2);
    const transitMin = Math.max(1, opts.transitMinDays || 1);
    const transitMax = Math.max(transitMin, opts.transitMaxDays || 2);

    // 1. Despacho (día hábil después de producción)
    const dispatchDateObj = getProductionReadyDate(opts.baseDate || new Date(), productionDays);

    // 2. Llegada (tránsito courier a partir del despacho)
    const deliveryMinObj = addBusinessDays(dispatchDateObj, transitMin);
    const deliveryMaxObj = addBusinessDays(dispatchDateObj, transitMax);

    const totalMinDays = productionDays + transitMin;
    const totalMaxDays = productionDays + transitMax;

    return {
        dispatchDate: formatDateYMD(dispatchDateObj),
        deliveryMinDate: formatDateYMD(deliveryMinObj),
        deliveryMaxDate: formatDateYMD(deliveryMaxObj),
        estimatedDaysLabel: `${totalMinDays}–${totalMaxDays} días hábiles`,
        dateRangeLabel: formatDateRangeCL(deliveryMinObj, deliveryMaxObj),
    };
}
