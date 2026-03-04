import type { CocktailForWizard, Comuna, WizardState, WizardSelection } from './types';
import { formatCurrency } from './utils';

// ─── Utilidades puras ────────────────────────────────────────────────────────

export function getSizeLiters(size: string): number {
    if (size.includes('30L')) return 30;
    if (size.includes('20L')) return 20;
    if (size.includes('10L')) return 10;
    if (size.includes('5L')) return 5;
    return 10; // Default
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

export function calculateSmartConfig(totalDrinks: number) {
    const liters = totalDrinks / 5;
    if (liters <= 10) return { config: '1 Barril de 10L', liters: 10, totalDrinks: 50 };
    if (liters <= 15) return { config: '3 Barriles de 5L', liters: 15, totalDrinks: 75 };
    if (liters <= 20) return { config: '2 Barriles de 10L', liters: 20, totalDrinks: 100 };
    if (liters <= 25) return { config: '2 Barriles de 10L + 1 Barril de 5L', liters: 25, totalDrinks: 125 };
    if (liters <= 30) return { config: '3 Barriles de 10L', liters: 30, totalDrinks: 150 };

    const count10L = Math.floor(liters / 10);
    const remainder = liters % 10;
    const label10L = count10L === 1 ? '1 Barril' : `${count10L} Barriles`;

    if (remainder === 0) return { config: `${label10L} de 10L`, liters: count10L * 10, totalDrinks: count10L * 50 };
    if (remainder <= 5) return { config: `${label10L} de 10L + 1 Barril de 5L`, liters: count10L * 10 + 5, totalDrinks: (count10L * 10 + 5) * 5 };
    return { config: `${count10L + 1} Barriles de 10L`, liters: (count10L + 1) * 10, totalDrinks: (count10L + 1) * 50 };
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

export function buildWhatsAppMessage(state: WizardState, data: SummaryData): string {
    const guests = Math.max(state.consumption.guests, 1);
    const totalDrinks = data.totalLiters * 5;
    const avgDrinks = (totalDrinks / guests).toFixed(1);
    const N = new Intl.NumberFormat('es-CL');

    const itemsText = data.items.map((s) => {
        const hasOffer = s.totalNormalPrice > s.totalOfferPrice;
        return `- x${s.quantity} ${s.name} (${s.selectedSize}): ${hasOffer ? `~$${N.format(s.totalNormalPrice)}~ ` : ''}*$${N.format(s.totalOfferPrice)}*`;
    }).join('\n');

    let msg = `*SOLICITUD DE COTIZACIÓN*\n\n`;
    msg += `*INFORMACIÓN*\n`;
    msg += `Cliente: ${state.contact.firstName} ${state.contact.lastName}\n`;
    if (state.contact.email) msg += `Email: ${state.contact.email}\n`;
    if (state.contact.phone) msg += `Celular: ${state.contact.phone}\n`;
    if (state.contact.address || data.comunaDisplay !== 'No especificada') {
        msg += `Dirección: ${[state.contact.address, data.comunaDisplay].filter(Boolean).join(', ')}\n`;
    }
    msg += `Fecha: ${data.formattedDate}\n`;
    if (state.eventData.startTime) msg += `Hora Inicio: ${state.eventData.startTime}\n`;
    if (state.eventData.pickupDate) {
        msg += `Fecha Retiro: ${data.formattedPickupDate}\n`;
        if (state.eventData.pickupTime) msg += `Horario Retiro: ${state.eventData.pickupTime}\n`;
    }
    msg += `Temática: ${data.eventTypeDisplay}\n`;
    msg += `Invitados: ${guests} pers.\n`;
    if (state.contact.comments) msg += `Comentarios: ${state.contact.comments}\n`;
    msg += `\n*PRODUCTOS*:\n${itemsText}\n\n`;
    msg += `Subtotal: ${formatCurrency(data.totalNormalPrice)}\n`;
    if (data.totalDiscount > 0) msg += `Descuento: -${formatCurrency(data.totalDiscount)}\n`;
    msg += `Traslados: ${data.shippingLabel}\n`;
    msg += `${data.dispenserLabel}: ${data.installationCost === 0 ? '¡Gratis!' : formatCurrency(data.installationCost)}\n`;
    msg += `*TOTAL: ${formatCurrency(data.totalPrice)}*\n\n`;
    msg += `*Notas:*\n`;
    msg += `Estas cotizando ${data.totalLiters}L con rendimiento total aprox. de ${totalDrinks} cócteles.\n`;
    msg += `Para ${guests} invitados tienes en promedio de ${avgDrinks} cócteles x pers.`;

    return msg;
}
