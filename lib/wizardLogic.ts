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
    return getMinDateString(0);
}

/**
 * Retorna una fecha en formato 'YYYY-MM-DD' con un offset de días, ajustada a la zona horaria chilena.
 */
export function getMinDateString(offsetDays: number = 0): string {
    const now = new Date();
    const chileTime = new Date(now.toLocaleString('en-US', { timeZone: PROJECT_TIMEZONE }));
    chileTime.setDate(chileTime.getDate() + offsetDays);
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
export function formatEventDate(dateStr: string | null | undefined): string {
    if (!dateStr || dateStr === 'null') return 'No especificada';
    try {
        const d = new Date(dateStr + 'T12:00:00');
        if (isNaN(d.getTime())) return 'Fecha inválida';
        const formatted = d.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        return 'Fecha inválida';
    }
}

/**
 * LÓGICA DE BARRILES (SMART CONFIG)
 * ─────────────────────────────────────────────────────────────────────────────
 * Determina automáticamente el tamaño de barril más eficiente basado en:
 * - Cantidad de invitados.
 * - Promedio de tragos por persona (determina la variedad necesaria).
 */
export function calculateSmartConfig(guests: number, avgDrinks: number, isDirect: boolean = false) {
    const totalRequired = Math.ceil(guests * avgDrinks);
    
    /**
     * REGLA DE NEGOCIO - RENDIMIENTOS
     * Para planificación (interno): 1L = 6 cócteles (30, 60, 120, 180)
     * Para visualización (cliente): 1L = 5 cócteles (25, 50, 100, 150)
     */
    
    // Si es Directo, mantenemos la lógica de barriles desechables de 5L mas simple
    if (isDirect) {
        const numBarrels = Math.ceil(totalRequired / 30); // Usamos 30 para planificación
        const totalLiters = numBarrels * 5;
        const totalDrinks = totalLiters * 5; // Mostramos 5 para el cliente
        const labelText = numBarrels === 1 ? '1 Barril Desechable' : `${numBarrels} Barriles Desechables`;
        
        return {
            config: `${labelText} de 5L`,
            liters: totalLiters,
            totalDrinks: totalDrinks
        };
    }

    // Target Variedad: Intentar ofrecer 1 variedad por cada trago por persona
    let targetVariedad = Math.max(1, Math.round(avgDrinks));
    
    // Regla especial: Para 10 personas o menos, máximo 1 variedad
    if (guests <= 10) targetVariedad = 1;

    interface Combination {
        counts: { [key: number]: number };
        totalYield: number; // Basado en 1L = 6
        variedad: number;
        exceso: number;
    }

    const combinations: Combination[] = [];

    // Generamos combinaciones usando rendimiento de planificación 1L = 6
    for (let c30 = 0; c30 <= 3; c30++) {
        for (let c20 = 0; c20 <= 4; c20++) {
            for (let c10 = 0; c10 <= 6; c10++) {
                for (let c5 = 0; c5 <= 10; c5++) {
                    const yieldTotal = (c30 * 180) + (c20 * 120) + (c10 * 60) + (c5 * 30);
                    const totalBarrels = c30 + c20 + c10 + c5;
                    
                    if (totalBarrels > 0 && totalBarrels <= 12 && yieldTotal >= totalRequired) {
                        combinations.push({
                            counts: { 5: c5, 10: c10, 20: c20, 30: c30 },
                            totalYield: yieldTotal,
                            variedad: totalBarrels,
                            exceso: yieldTotal - totalRequired
                        });
                    }
                }
            }
        }
    }

    // SISTEMA DE SCORING (Basado en variedad ideal y eficiencia)
    combinations.sort((a, b) => {
        // 1. Cercanía a la variedad ideal (sabores = tragos por persona)
        const aDiff = Math.abs(a.variedad - targetVariedad);
        const bDiff = Math.abs(b.variedad - targetVariedad);
        if (aDiff !== bDiff) return aDiff - bDiff;

        // 2. Si empatan en variedad, preferir el que tenga MENOR exceso de litros (eficiencia)
        if (a.exceso !== b.exceso) return a.exceso - b.exceso;

        // 3. Si empatan en exceso, preferir menos barriles físicos
        return a.variedad - b.variedad;
    });

    const best = combinations[0] || { 
        counts: { 30: Math.ceil(totalRequired / 180) }, 
        totalYield: Math.ceil(totalRequired / 180) * 180, 
        variedad: Math.ceil(totalRequired / 180), 
        exceso: (Math.ceil(totalRequired / 180) * 180) - totalRequired 
    };

    // Formatear el label llamativo (ej: "2 Barriles de 5L + 1 Barril de 20L")
    const parts: string[] = [];
    [30, 20, 10, 5].forEach(size => {
        const count = best.counts[size];
        if (count > 0) {
            const unitLabel = count === 1 ? 'Barril' : 'Barriles';
            parts.push(`${count} ${unitLabel} de ${size}L`);
        }
    });

    const finalLiters = (best.counts[5] * 5) + (best.counts[10] * 10) + (best.counts[20] * 20) + (best.counts[30] * 30);

    return {
        config: parts.length > 1 ? parts.join(' + ') : parts[0] || '1 Barril de 10L',
        liters: finalLiters,
        totalDrinks: finalLiters * 5 // Regla de negocio conservadora para visualización: 1L = 5 cócteles
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
    totalCocktails: number; 
    serviceType?: 'event' | 'direct' | '';
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
        
        // Blindaje contra IDs no encontrados o nulos
        if (!cocktail) {
            const unitPrice = s.customPrice || 0;
            const itemTotal = unitPrice * s.quantity;
            totalNormalPrice += itemTotal;
            totalOfferPrice += itemTotal;
            
            return {
                id: s.id || 'manual',
                name: 'Producto Personalizado',
                category_id: 'manual',
                category: 'Manual',
                desc: 'Producto añadido manualmente',
                image: '',
                selectedSize: s.size,
                quantity: s.quantity,
                totalNormalPrice: itemTotal,
                totalOfferPrice: itemTotal,
                priceData: { price: unitPrice, offerPrice: unitPrice, sizeValue: getSizeLiters(s.size), unit: 'L', isDisposable: false }
            };
        }

        const priceData = cocktail.prices[s.size] ?? { price: 0, offerPrice: 0, sizeValue: 0, unit: '', isDisposable: false };
        
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
        
        return { ...cocktail, selectedSize: s.size, quantity: s.quantity, totalNormalPrice: itemNormal, totalOfferPrice: itemOffer, priceData };
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
    if (state.dispenser === 'muro') dispenserLabel = 'Muro de Coctelería';
    if (state.serviceType === 'direct') dispenserLabel = 'Barril Desechable';

    const installationCost = (state.dispenser === 'muro') ? MURO_INSTALLATION_COST : 0;

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
        totalCocktails: totalLiters * 5,
        serviceType: state.serviceType
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
    let msg = isDirect ? `*NUEVO PEDIDO*\n\n` : `*SOLICITUD DE COTIZACIÓN*\n\n`;

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

/**
 * LÓGICA DE SUGERENCIA PARA COTIZADOR EN VIVO
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function calculateLiveQuoterSuggestion(guests: number, drinks: number) {
    if (guests === 0 || drinks === 0) return { recommendedLiters: 0, barrelSuggestionText: '' };

    const totalDrinks = guests * drinks;
    const exactLiters = totalDrinks / 5;

    let recommendedLiters = 0;
    if (exactLiters <= 5) {
        recommendedLiters = 5;
    } else if (exactLiters < 60) {
        recommendedLiters = Math.ceil(exactLiters / 5) * 5;
    } else {
        recommendedLiters = Math.round(exactLiters / 5) * 5;
    }

    const sizes = [30, 20, 10, 5];
    const combos: number[][] = [];
    let iterations = 0;
    
    function findCombos(remaining: number, currentCombo: number[], startIndex: number) {
        if (iterations > 15000) return;
        iterations++;
        
        if (remaining === 0) {
            combos.push([...currentCombo]);
            return;
        }
        if (remaining < 0) return;

        for (let i = startIndex; i < sizes.length; i++) {
            currentCombo.push(sizes[i]);
            findCombos(remaining - sizes[i], currentCombo, i);
            currentCombo.pop();
        }
    }

    findCombos(recommendedLiters, [], 0);

    let bestCombo: number[] = [];
    let bestScore = -1;

    if (combos.length > 0) {
        for (const combo of combos) {
            const numBarrels = combo.length;
            const uniqueSizes = new Set(combo).size;
            
            const countDiff = Math.abs(numBarrels - drinks);
            const diffScore = countDiff * 100;
            
            let sizePenalty = 0;
            const count5 = combo.filter(s => s === 5).length;
            const count10 = combo.filter(s => s === 10).length;
            if (count5 > 2) sizePenalty += 20;
            if (count10 > 3) sizePenalty += 10;

            const maxSz = Math.max(...combo);
            const minSz = Math.min(...combo);
            const rangePenalty = maxSz - minSz;

            const score = diffScore + sizePenalty + (uniqueSizes * 5) + rangePenalty;

            if (bestScore === -1 || score < bestScore) {
                bestScore = score;
                bestCombo = combo;
            }
        }
    } else {
        let rem = recommendedLiters;
        for (const sz of sizes) {
            while (rem >= sz) {
                bestCombo.push(sz);
                rem -= sz;
            }
        }
    }

    let barrelSuggestionText = '';
    let compactSuggestionText = '';
    if (bestCombo.length > 0) {
        const totalCounts = { 30: 0, 20: 0, 10: 0, 5: 0 };
        for (const sz of bestCombo) {
            totalCounts[sz as keyof typeof totalCounts]++;
        }

        const parts = [];
        if (totalCounts[30] > 0) parts.push({ qty: totalCounts[30], size: '30L' });
        if (totalCounts[20] > 0) parts.push({ qty: totalCounts[20], size: '20L' });
        if (totalCounts[10] > 0) parts.push({ qty: totalCounts[10], size: '10L' });
        if (totalCounts[5] > 0) parts.push({ qty: totalCounts[5], size: '5L' });

        if (parts.length > 0) {
            compactSuggestionText = parts.map(p => `${p.qty}x ${p.size}`).join(' + ');
        }

        if (parts.length === 1) {
            const p = parts[0];
            barrelSuggestionText = `${p.qty} ${p.qty === 1 ? 'barril' : 'barriles'} de ${p.size}`;
        } else if (parts.length > 1) {
            const strParts = parts.map((p, index) => {
                if (index === 0) {
                    return `${p.qty} ${p.qty === 1 ? 'barril' : 'barriles'} de ${p.size}`;
                } else {
                    return `${p.qty} de ${p.size}`;
                }
            });
            const last = strParts.pop();
            barrelSuggestionText = strParts.join(', ') + ' y ' + last;
        }
    }

    return {
        recommendedLiters,
        barrelSuggestionText,
        compactSuggestionText
    };
}
