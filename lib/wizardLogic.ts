import type { CocktailForWizard, Comuna, WizardState, WizardSelection } from './types';
import { formatCurrency } from './utils';

// ─── Utilidades puras ────────────────────────────────────────────────────────

export function getTodayString(): string {
    const now = new Date();
    // Ajustar a la zona horaria de Chile (UTC-3/UTC-4)
    const chileTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
    return chileTime.toISOString().split('T')[0];
}

export function getSizeLiters(size: string): number {
    if (size.includes('30L')) return 30;
    if (size.includes('20L')) return 20;
    if (size.includes('10L')) return 10;
    if (size.includes('5L')) return 5;
    return 10; // Default
}

export function calculateMaxPickupDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

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

// ─── Lógica de configuración de barriles ─────────────────────────────────────

export function calculateSmartConfig(guests: number, avgDrinks: number) {
    const totalLitersRequired = (guests * avgDrinks) / 5;
    const numVarieties = Math.max(1, avgDrinks); // Variedad = Promedio de tragos

    // Tamaño ideal por barril
    const idealLitersPerBarrel = totalLitersRequired / numVarieties;

    // Buscamos el barril comercial más cercano (5, 10, 20, 30)
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

// ─── Cálculo del resumen de cotización ───────────────────────────────────────

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

    const items = state.selections.map((s: WizardSelection) => {
        const cocktail = cocktailsById.get(s.id);
        const priceData = cocktail?.prices[s.size] ?? { price: 0, offerPrice: 0 };
        const itemNormal = priceData.price * s.quantity;
        const itemOffer = priceData.offerPrice * s.quantity;
        totalNormalPrice += itemNormal;
        totalOfferPrice += itemOffer;
        totalLiters += getSizeLiters(s.size) * s.quantity;
        return { ...cocktail!, selectedSize: s.size, quantity: s.quantity, totalNormalPrice: itemNormal, totalOfferPrice: itemOffer };
    });

    const selectedComuna = comunasByName.get(state.contact.comuna);
    let shippingCost = 0;
    let shippingLabel = 'Por calcular';
    if (selectedComuna && state.contact.comuna !== 'Otra') {
        const isFree = selectedComuna.freeFrom !== null && totalLiters >= selectedComuna.freeFrom;
        shippingCost = isFree ? 0 : (selectedComuna.cost ?? 0);
        shippingLabel = shippingCost === 0 ? '¡Gratis!' : formatCurrency(shippingCost);
    } else if (state.contact.comuna === 'Otra') {
        shippingLabel = 'Pendiente de factibilidad';
    }

    const eventTypeDisplay = state.eventData.type === 'Otro' ? state.eventData.otherType : state.eventData.type;
    const comunaDisplay = state.contact.comuna === 'Otra' ? state.contact.otherComuna : (state.contact.comuna || 'No especificada');

    const hasIncompatibleSize = state.selections.some((s: WizardSelection) => {
        const liters = getSizeLiters(s.size);
        return liters !== 10 && liters !== 20 && liters !== 30;
    });
    const canHaveMuro = !hasIncompatibleSize && totalLiters >= 30;
    const dispenserLabel = (state.dispenser === 'muro' && canHaveMuro) ? 'Muro de Coctelería' : 'Dispensador Portátil';
    const installationCost = (state.dispenser === 'muro' && canHaveMuro) ? 50000 : 0;

    return {
        items, totalNormalPrice, totalOfferPrice,
        totalDiscount: totalNormalPrice - totalOfferPrice,
        totalLiters, shippingCost, shippingLabel,
        installationCost,
        totalPrice: totalOfferPrice + (shippingCost || 0) + installationCost,
        eventTypeDisplay, comunaDisplay,
        dispenserLabel,
        formattedDate: formatEventDate(state.eventData.date),
        formattedPickupDate: formatEventDate(state.eventData.pickupDate),
    };
}

// ─── Construcción del mensaje de WhatsApp ────────────────────────────────────

export function buildWhatsAppMessage(state: WizardState, data: SummaryData, token?: string): string {
    const guests = Math.max(state.consumption.guests, 1);
    const totalDrinks = data.totalLiters * 5;
    const avgDrinks = (totalDrinks / guests).toFixed(1);
    const N = new Intl.NumberFormat('es-CL');

    const itemsText = data.items.map((s) => {
        const hasOffer = s.totalNormalPrice > s.totalOfferPrice;
        return `- x${s.quantity} ${s.name} (${s.selectedSize}): ${hasOffer ? `~$${N.format(s.totalNormalPrice)}~ ` : ''}*$${N.format(s.totalOfferPrice)}*`;
    }).join('\n');

    let msg = `*SOLICITUD DE COTIZACIÓN*\n\n`;

    msg += `*PRODUCTOS:*\n${itemsText}\n`;

    msg += `*Subtotal:* ${formatCurrency(data.totalNormalPrice)}\n`;
    if (data.totalDiscount > 0) msg += `*Descuento:* -${formatCurrency(data.totalDiscount)}\n`;
    msg += `*Traslados:* ${data.shippingLabel}\n`;
    msg += `*${data.dispenserLabel}:* ${data.installationCost === 0 ? '¡Gratis!' : formatCurrency(data.installationCost)}\n`;
    msg += `*TOTAL: ${formatCurrency(data.totalPrice)}*\n\n`;

    msg += `*Notas:* \n`;
    msg += `_Estas cotizando ${data.totalLiters}L con rendimiento total aprox. de ${totalDrinks} cócteles._\n_Para ${guests} invitados tienes en promedio de ${avgDrinks} cócteles x pers._\n\n`;

    if (token) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cocktailsontap.cl';
        msg += `*Confirma tu cotización aquí:* ${baseUrl}/cotizar/${token}\n`;
    }

    return msg;
}
