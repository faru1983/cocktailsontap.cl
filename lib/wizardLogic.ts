import type { CocktailForWizard, Comuna, WizardState, WizardSelection } from './types';
import { formatCurrency } from './utils';
import { SITE_URL, MURO_INSTALLATION_COST, MURO_COMPATIBLE_SIZES, MURO_MIN_LITERS, PROJECT_TIMEZONE } from './config';

/**
 * UTILS DE FECHAS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Retorna la fecha de hoy en formato 'YYYY-MM-DD' ajustada a la zona horaria chilena.
 */
export function getTodayString(): string {
    const now = new Date();
    const chileTime = new Date(now.toLocaleString('en-US', { timeZone: PROJECT_TIMEZONE }));
    return chileTime.toISOString().split('T')[0];
}

/**
 * Extrae el número de litros de un string (ej: "10L" -> 10).
 */
export function getSizeLiters(size: string): number {
    const s = size.toUpperCase();
    
    // El label ahora es consistente: "5L", "10L", "5L DESECHABLE"
    // Buscamos un número seguido inmediatamente de una L
    const match = s.match(/^(\d+(?:\.\d+)?)L(?:\s|$)/);
    
    if (match) {
        return parseFloat(match[1]);
    }
    
    return 0; // Si no es litros, no suma volumen líquido
}

/**
 * Calcula la fecha máxima permitida para el retiro (24h después).
 */
export function calculateMaxPickupDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

/**
 * Formatea una fecha ISO a formato humano chileno (ej: "Lunes, 14 de Marzo de 2026").
 */
export function formatEventDate(dateStr: string): string {
    if (!dateStr) return 'No especificada';
    const d = new Date(dateStr + 'T12:00:00');
    const formatted = d.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * LÓGICA DE BARRILES (SMART CONFIG)
 * ─────────────────────────────────────────────────────────────────────────────
 * Determina automáticamente el tamaño de barril más eficiente basado en:
 * - Cantidad de invitados.
 * - Promedio de tragos por persona (determina la variedad necesaria).
 */
export function calculateSmartConfig(guests: number, avgDrinks: number, isDirect: boolean = false) {
    const totalLitersRequired = (guests * avgDrinks) / 5; // Rendimiento: 1L = 5 Tragos

    if (isDirect) {
        const numBarrels = Math.ceil(totalLitersRequired / 5);
        const totalLiters = numBarrels * 5;
        const totalDrinks = totalLiters * 5;
        const label = numBarrels === 1 ? '1 Barril Desechable' : `${numBarrels} Barriles Desechables`;
        
        return {
            config: `${label} de 5L`,
            liters: totalLiters,
            totalDrinks: totalDrinks
        };
    }

    const numVarieties = Math.max(1, avgDrinks); 

    const idealLitersPerBarrel = totalLitersRequired / numVarieties;

    // Clasificación comercial (5, 10, 20 o 30 Litros)
    let selectedBarrelSize = 10;
    if (idealLitersPerBarrel <= 7.5) {
        selectedBarrelSize = 5;
    } else if (idealLitersPerBarrel <= 15) {
        selectedBarrelSize = 10;
    } else if (idealLitersPerBarrel <= 25) {
        selectedBarrelSize = 20;
    } else {
        selectedBarrelSize = 30;
    }

    const totalLiters = selectedBarrelSize * numVarieties;
    const totalDrinks = totalLiters * 5;
    const labelVariety = numVarieties === 1 ? '1 Variedad' : `${numVarieties} Variedades`;

    return {
        config: `${labelVariety} de ${selectedBarrelSize}L`,
        liters: totalLiters,
        totalDrinks: totalDrinks
    };
}

/**
 * CÁLCULO DE RESUMEN DE COTIZACIÓN
 * ─────────────────────────────────────────────────────────────────────────────
 * Función pura que calcula todos los precios, descuentos, envíos e instalaciones.
 * Se utiliza tanto en el Wizard como en la vista de Cotización.
 */
export interface SummaryData {
    items: (Omit<CocktailForWizard, 'prices'> & { selectedSize: string; quantity: number; totalNormalPrice: number; totalOfferPrice: number })[];
    totalNormalPrice: number;
    totalOfferPrice: number;
    totalDiscount: number;
    totalLiters: number;
    shippingCost: number;
    shippingLabel: string;
    installationCost: number;
    totalPrice: number;
    eventTypeDisplay: string;
    comunaDisplay: string;
    dispenserLabel: string;
    formattedDate: string;
    formattedPickupDate: string;
    canHaveMuro: boolean;
    manualDiscount: number;
    totalCocktails: number; // Nuevo: Para centralizar el cálculo de rendimiento
}

export function calculateSummaryData(
    state: WizardState,
    cocktails: CocktailForWizard[],
    comunas: Comuna[]
): SummaryData {
    const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));
    const comunasByName = new Map(comunas.map((c) => [c.name, c]));
    let totalNormalPrice = 0;
    let totalOfferPrice = 0;
    let totalLiters = 0;

    // Mapear selecciones del estado a items con precios calculados
    const items = state.selections.map((s: WizardSelection) => {
        const cocktail = cocktailsById.get(s.id);
        const priceData = cocktail?.prices[s.size] ?? { price: 0, offerPrice: 0, sizeValue: 0, unit: '', isDisposable: false };
        
        // Use custom price if provided (for admin overrides), otherwise use standard offer price
        const unitPrice = s.customPrice !== undefined ? s.customPrice : priceData.offerPrice;
        
        const itemNormal = priceData.price * s.quantity;
        const itemOffer = unitPrice * s.quantity;
        
        totalNormalPrice += itemNormal;
        totalOfferPrice += itemOffer;

        // SOLO sumar litros si la unidad es 'L' (Litros)
        if (priceData.unit === 'L') {
            totalLiters += priceData.sizeValue * s.quantity;
        }
        
        return { ...cocktail!, selectedSize: s.size, quantity: s.quantity, totalNormalPrice: itemNormal, totalOfferPrice: itemOffer, priceData };
    });

    // Lógica dinámica de Envío Gratis o Venta Directa
    const selectedComuna = comunasByName.get(state.contact.comuna);
    let shippingCost = 0;
    let shippingLabel = 'Por calcular';
    if (selectedComuna && state.contact.comuna !== 'Otra') {
        if (state.serviceType === 'direct') {
            shippingCost = selectedComuna.directSaleDeliveryCost ?? 5000;
            shippingLabel = formatCurrency(shippingCost);
        } else {
            // Verifica si alcanza el umbral de envío gratis definido en la DB para esa comuna.
            const isFree = selectedComuna.freeFrom !== null && totalLiters >= selectedComuna.freeFrom;
            shippingCost = isFree ? 0 : (selectedComuna.cost ?? 0);
            shippingLabel = shippingCost === 0 ? '¡Gratis!' : formatCurrency(shippingCost);
        }
    } else if (state.contact.comuna === 'Otra') {
        shippingLabel = 'Pendiente de factibilidad';
    }

    const eventTypeDisplay = state.eventData.type === 'Otro' ? state.eventData.otherType : state.eventData.type;
    const comunaDisplay = state.contact.comuna === 'Otra' ? state.contact.otherComuna : (state.contact.comuna || 'No especificada');

    // Lógica del Muro de Coctelería
    // REGLA: No debe tener barriles de formato incompatible y debe sumar al menos MURO_MIN_LITERS.
    // Solo consideramos items de tipo líquido (L) para esta validación.
    const hasIncompatibleSize = items.some((item) => {
        const pd = (item as any).priceData;
        if (pd.unit !== 'L') return false; // Items no líquidos no bloquean el muro
        return !MURO_COMPATIBLE_SIZES.includes(pd.sizeValue);
    });
    const canHaveMuro = !hasIncompatibleSize && totalLiters >= MURO_MIN_LITERS;
    
    let dispenserLabel = 'Dispensador Portátil';
    if (state.dispenser === 'muro' && canHaveMuro) dispenserLabel = 'Muro de Coctelería';
    if (state.dispenser === 'desechable') dispenserLabel = 'Barril Desechable';

    const installationCost = (state.dispenser === 'muro' && canHaveMuro) ? MURO_INSTALLATION_COST : 0;

    return {
        items, 
        totalNormalPrice, 
        totalOfferPrice,
        totalDiscount: totalNormalPrice - totalOfferPrice,
        totalLiters, 
        shippingCost, 
        shippingLabel,
        installationCost,
        totalPrice: totalOfferPrice + (shippingCost || 0) + installationCost,
        eventTypeDisplay, 
        comunaDisplay,
        dispenserLabel,
        formattedDate: formatEventDate(state.eventData.date),
        formattedPickupDate: formatEventDate(state.eventData.pickupDate),
        canHaveMuro,
        manualDiscount: 0,
        totalCocktails: totalLiters * 5 // 1L = 5 cócteles
    };
}

/**
 * CONSTRUCCIÓN DEL MENSAJE DE WHATSAPP
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera el texto formateado para enviar la cotización por WhatsApp.
 */
export function buildWhatsAppMessage(state: WizardState, data: SummaryData, token?: string): string {
    const guests = state.consumption.guests || 0;
    const totalDrinks = data.totalLiters * 5;
    const avgDrinks = guests > 0 ? (totalDrinks / guests).toFixed(1) : '0';
    const N = new Intl.NumberFormat('es-CL');

    const itemsText = data.items.map((s) => {
        const hasOffer = s.totalNormalPrice > s.totalOfferPrice;
        return `- x${s.quantity} ${s.name} (${s.selectedSize}): ${hasOffer ? `~$${N.format(s.totalNormalPrice)}~ ` : ''}*$${N.format(s.totalOfferPrice)}*`;
    }).join('\n');

    const isDirect = state.serviceType === 'direct';
    let msg = isDirect ? `*NUEVO PEDIDO DIRECTO*\n\n` : `*SOLICITUD DE COTIZACIÓN*\n\n`;

    msg += `*PRODUCTOS:*\n${itemsText}\n`;

    msg += `*Subtotal:* ${formatCurrency(data.totalNormalPrice)}\n`;
    if (data.totalDiscount > 0) msg += `*Descuento:* -${formatCurrency(data.totalDiscount)}\n`;
    msg += `*Traslados:* ${data.shippingLabel}\n`;
    msg += `*${data.dispenserLabel}:* ${data.installationCost === 0 ? '¡Gratis!' : formatCurrency(data.installationCost)}\n`;
    msg += `*TOTAL: ${formatCurrency(data.totalPrice)}*\n\n`;

    // Solo mostrar el rendimiento si realmente hay litros acumulados
    if (data.totalLiters > 0) {
        msg += `*Notas:* \n`;
        msg += `_Estas cotizando ${data.totalLiters}L con rendimiento total aprox. de ${data.totalCocktails} cócteles._\n`;
        
        if (guests > 0) {
            const avgDrinks = (data.totalCocktails / guests).toFixed(1);
            msg += `_Para ${guests} invitados tienes en promedio ${avgDrinks} cócteles x pers._\n\n`;
        }
    }

    if (token) {
        msg += isDirect 
            ? `*Comprobante de tu pedido aquí:* ${SITE_URL}/cotizar/${token}\n`
            : `*Confirma tu cotización aquí:* ${SITE_URL}/cotizar/${token}\n`;
    }

    return msg;
}
