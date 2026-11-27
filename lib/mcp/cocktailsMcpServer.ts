import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SITE_URL, MURO_INSTALLATION_COST, MURO_MIN_LITERS, PORTATIL_MIN_LITERS, COCKTAILS_PER_LITER } from '@/lib/config';
import { fetchAllProductData } from '@/lib/serverData';
import {
    IntegrationContactSchema,
    IntegrationDirectSaleSchema,
    IntegrationEventQuoteSchema,
} from '@/lib/integrationSchemas';
import {
    applyConfirmNowPickupDefault,
    applyContactRegionFromCatalog,
    mapDirectSaleToWizardState,
    mapEventQuoteToWizardState,
    validateItemsAgainstCatalog,
} from '@/lib/integrationMapper';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { normalizeQuoteSource } from '@/lib/quoteSource';
import { createQuoteCore } from '@/lib/services/createQuoteCore';
import { updateDraftQuoteCore } from '@/lib/services/updateDraftQuoteCore';
import { buildEmptyDaySummary, evaluateCapacityForRequest } from '@/lib/eventCapacity';
import { getEventOccupancyByDateRange } from '@/lib/services/eventCapacityService';
import {
    formatOffsetShortLabel,
    getFirstAvailableDate,
    getMinSelectableDate,
    isDateBlocked,
    isWeekdayAllowed,
    resolveOffsetMode,
    type ShippingMethodConfig,
} from '@/lib/shippingMethods';
import { formatDateYMD, getChileNoonDate } from '@/lib/businessDays';
import { createServerClient } from '@/lib/supabaseServer';
import { advanceClientStage } from '@/lib/services/clientLifecycleService';
import {
    appendClientCrmNote,
    recordTouchpoint,
    resolveOrCreateClient,
} from '@/lib/services/clientService';
import {
    calculateEstimatedProposal,
    calculateSmartConfig,
    calculateSummaryData,
    getSizeLiters,
    isEventBarrelSizeLabelCompatible,
    resolveShipping,
} from '@/lib/wizardLogic';
import type { CocktailForWizard, Comuna, WizardState } from '@/lib/types';

export interface CocktailsMcpContext {
    contactPhone?: string;
    contactId?: string;
    channel?: string;
}

const SERVER_NAME = 'cocktails-on-tap';
const SERVER_VERSION = '1.0.0';

function buildEventSchedulePolicy(eventConfig?: ShippingMethodConfig | null) {
    const todayChile = formatDateYMD(getChileNoonDate());
    const offsetMode = resolveOffsetMode(eventConfig, 'calendar');
    const minOffsetDays = typeof eventConfig?.minOffsetDays === 'number' ? eventConfig.minOffsetDays : 2;
    const minSelectableDate = getMinSelectableDate(eventConfig, 2);
    const firstAvailableDate = getFirstAvailableDate(eventConfig, 2);
    const upcomingBlockedDates = (eventConfig?.blockedDates ?? []).filter((d) => d >= todayChile).slice(0, 12);

    return {
        advanceLabel: formatOffsetShortLabel(eventConfig, 2, 'calendar'),
        offsetMode,
        minOffsetDays,
        ...(eventConfig?.cutoffEnabled ? { cutoffTime: eventConfig.cutoffTime || '18:00' } : {}),
        minSelectableDate,
        firstAvailableDate,
        upcomingBlockedDates,
    };
}

function okResult<T extends Record<string, unknown>>(data: T) {
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(data) }],
        structuredContent: data,
    };
}

function errorResult(message: string) {
    return {
        isError: true as const,
        content: [{ type: 'text' as const, text: message }],
    };
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function findComuna(comunas: Comuna[], query?: string): Comuna | undefined {
    if (!query?.trim()) return undefined;
    const rawFirst = query.includes(',') ? query.split(',')[0] : query;
    const needles = Array.from(new Set([normalizeText(query), normalizeText(rawFirst)].filter(Boolean)));
    for (const needle of needles) {
        const match =
            comunas.find((c) => normalizeText(c.name) === needle) ??
            comunas.find((c) => normalizeText(c.name).includes(needle));
        if (match) return match;
    }
    return undefined;
}

function normalizeContactPhone(phone?: string | null): string | undefined {
    const raw = (phone ?? '').trim();
    if (!raw) return undefined;
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    return `+${digits}`;
}

function buildItemSignature(items: { product_id?: string | null; productId?: string | null; size: string; quantity: number }[]): string[] {
    return items
        .map((item) => `${item.product_id ?? item.productId ?? ''}::${normalizeText(item.size)}::${item.quantity}`)
        .sort();
}

async function findRecentDuplicateEventDraft(params: {
    source: string;
    email?: string | null;
    phone?: string | null;
    eventDate?: string | null;
    comunaName?: string | null;
    dispenser: 'portatil' | 'muro';
    items: { productId?: string | null; size: string; quantity: number }[];
}): Promise<{ quoteId: string; token: string; status: string; totalPriceClp: number } | null> {
    const normalizedEmail = (params.email ?? '').trim().toLowerCase() || null;
    const normalizedPhone = normalizeContactPhone(params.phone) ?? null;
    if (!normalizedEmail && !normalizedPhone) return null;

    try {
        const supabase = createServerClient();
        const cutoffIso = new Date(Date.now() - 120_000).toISOString();
        let query = supabase
            .from('quotes')
            .select('id, token, status, total_price, client_email, client_phone, comuna_name, quote_items(product_id, size, quantity)')
            .eq('status', 'draft')
            .eq('service_type', 'event')
            .eq('source', params.source)
            .eq('dispenser', params.dispenser)
            .gte('created_at', cutoffIso)
            .order('created_at', { ascending: false })
            .limit(10);

        query = params.eventDate ? query.eq('event_date', params.eventDate) : query.is('event_date', null);

        const { data, error } = await query;
        if (error || !data?.length) return null;

        const targetComuna = normalizeText(params.comunaName ?? '');
        const expectedSignature = buildItemSignature(params.items);

        for (const row of data) {
            if (!row.token) continue;
            const rowEmail = (row.client_email ?? '').trim().toLowerCase() || null;
            const rowPhone = normalizeContactPhone(row.client_phone) ?? null;

            if (normalizedEmail && rowEmail !== normalizedEmail) continue;
            if (normalizedPhone && rowPhone !== normalizedPhone) continue;
            if (targetComuna && normalizeText(row.comuna_name ?? '') !== targetComuna) continue;

            const rowItems = Array.isArray(row.quote_items) ? row.quote_items : [];
            const rowSignature = buildItemSignature(rowItems);
            if (rowSignature.length !== expectedSignature.length) continue;
            if (rowSignature.every((sig, idx) => sig === expectedSignature[idx])) {
                return {
                    quoteId: row.id,
                    token: row.token,
                    status: row.status ?? 'draft',
                    totalPriceClp: Number(row.total_price ?? 0),
                };
            }
        }
    } catch (dedupErr) {
        console.warn('[cocktailsMcpServer] Duplicate event quote lookup failed:', dedupErr);
    }

    return null;
}

function validateEventDispenserAndItems(
    dispenser: 'portatil' | 'muro',
    items: { productId?: string | null; size: string; quantity: number }[],
    cocktails: CocktailForWizard[]
): string | null {
    const byId = new Map(cocktails.map((c) => [c.id, c]));
    let totalLiquidLiters = 0;

    for (const item of items) {
        const cocktail = item.productId ? byId.get(item.productId) : undefined;
        if (cocktail && cocktail.category === 'Otros') continue;
        const priceData = cocktail?.prices[item.size];
        const liters = priceData ? (priceData.unit === 'L' ? priceData.sizeValue : 0) : getSizeLiters(item.size);
        if (liters <= 0) continue;

        totalLiquidLiters += liters * item.quantity;

        if (!isEventBarrelSizeLabelCompatible(item.size, dispenser)) {
            if (dispenser === 'muro') {
                return `El Muro de Coctelería solo admite barriles de 20L y 30L ("${cocktail?.name ?? item.productId}" está en ${item.size}). Usa dispenser="portatil" para 5L/10L o elige formatos de 20L/30L.`;
            }
            return `El Dispensador Portátil solo admite barriles de 5L y 10L ("${cocktail?.name ?? item.productId}" está en ${item.size}). Usa dispenser="muro" (mín. ${MURO_MIN_LITERS}L) o divide en barriles de 10L y 5L.`;
        }
    }

    if (dispenser === 'muro' && totalLiquidLiters < MURO_MIN_LITERS) {
        return `El Muro de Coctelería requiere un pedido mínimo de ${MURO_MIN_LITERS}L (actual: ${totalLiquidLiters}L). Agrega más litros en 20L/30L o usa dispenser="portatil".`;
    }
    if (dispenser === 'portatil' && totalLiquidLiters < PORTATIL_MIN_LITERS) {
        return `El Dispensador Portátil requiere un pedido mínimo de ${PORTATIL_MIN_LITERS}L (actual: ${totalLiquidLiters}L).`;
    }
    return null;
}

export function createCocktailsMcpServer(ctx: CocktailsMcpContext = {}): McpServer {
    const server = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    });

    server.registerTool(
        'get_catalog_and_delivery',
        {
            description:
                'Consulta el catálogo vivo de cócteles, precios normales y oferta en CLP por formato (5L, 10L, 20L, 30L y barriles desechables 5L), tipos de evento y costos/cobertura de despacho por comuna o región.',
            inputSchema: {
                category: z.string().optional().describe('Filtrar por categoría (ej: Cocktails, Otros)'),
                serviceType: z
                    .enum(['event', 'direct', 'all'])
                    .optional()
                    .describe('event = arriendo con dispensador (5L-30L), direct = barriles desechables 5L, all = todos'),
                search: z.string().optional().describe('Buscar cóctel o producto por nombre'),
                comuna: z.string().optional().describe('Comuna para consultar cobertura y tarifa de despacho exacta'),
            },
            annotations: { readOnlyHint: true },
        },
        async (args) => {
            try {
                const catalog = await fetchAllProductData();
                const serviceType = args.serviceType ?? 'all';
                const catFilter = args.category ? normalizeText(args.category) : null;
                const searchFilter = args.search ? normalizeText(args.search) : null;

                const matchedProducts = catalog.products
                    .filter((p) => (!catFilter || normalizeText(p.category) === catFilter))
                    .filter(
                        (p) =>
                            !searchFilter ||
                            normalizeText(p.name).includes(searchFilter) ||
                            normalizeText(p.description).includes(searchFilter)
                    )
                    .map((p) => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        description: p.description,
                        variant_config: p.variant_config,
                        sizes: p.sizes.filter((s) => {
                            if (serviceType === 'direct') return s.isDisposable;
                            if (serviceType === 'event') return !s.isDisposable;
                            return true;
                        }),
                    }))
                    .filter((p) => p.sizes.length > 0);

                const isBroadList = matchedProducts.length > 10 && !searchFilter;
                const includeDesc = Boolean(searchFilter) && matchedProducts.length <= 5;
                const products = isBroadList
                    ? undefined
                    : matchedProducts.map((p) => ({
                          id: p.id,
                          name: p.name,
                          category: p.category,
                          ...(includeDesc ? { desc: p.description.slice(0, 80) } : {}),
                          ...(p.variant_config ? { variants: p.variant_config } : {}),
                          sizes: p.sizes.map((s) => ({
                              size: s.size,
                              liters: s.sizeValue,
                              disp: s.isDisposable,
                              clp: s.price,
                              ...(s.offerPrice != null ? { offerClp: s.offerPrice } : {}),
                          })),
                      }));

                const catalogSummary = isBroadList
                    ? matchedProducts.reduce<Record<string, string[]>>((acc, p) => {
                          const cat = p.category || 'Otros';
                          if (!acc[cat]) acc[cat] = [];
                          const prices = p.sizes
                              .map((s) => `${s.sizeValue}${s.unit}:$${s.offerPrice ?? s.price}`)
                              .join(',');
                          const variantNote = p.variant_config ? ` (${p.variant_config.options.join('/')})` : '';
                          acc[cat].push(`${p.name}${variantNote} (id:${p.id}) [${prices}]`);
                          return acc;
                      }, {})
                    : undefined;

                const activeComunas = catalog.comunas.filter((c) => c.isActive);
                const matchedComuna = findComuna(activeComunas, args.comuna);

                let deliveryLookup: Record<string, unknown> | null = null;
                if (args.comuna) {
                    if (matchedComuna) {
                        const eventShipping =
                            serviceType === 'direct'
                                ? null
                                : resolveShipping({
                                      serviceType: 'event',
                                      regionCode: matchedComuna.regionCode,
                                      comunaName: matchedComuna.name,
                                      totalLiters: 10,
                                      comunas: activeComunas,
                                      shippingMethodsConfig: catalog.shippingMethodsConfig,
                                  });
                        const directShipping =
                            serviceType === 'event'
                                ? null
                                : resolveShipping({
                                      serviceType: 'direct',
                                      regionCode: matchedComuna.regionCode,
                                      comunaName: matchedComuna.name,
                                      totalLiters: 5,
                                      comunas: activeComunas,
                                      shippingMethodsConfig: catalog.shippingMethodsConfig,
                                  });
                        const usesBlueExpress =
                            eventShipping?.shippingCarrier === 'blue_express' ||
                            directShipping?.shippingCarrier === 'blue_express';
                        deliveryLookup = {
                            found: true,
                            comuna: matchedComuna.name,
                            region: matchedComuna.regionShortName,
                            ...(eventShipping
                                ? {
                                      eventShipping,
                                      freeEventFromLiters:
                                          matchedComuna.freeFrom ?? matchedComuna.regionFreeFrom,
                                  }
                                : {}),
                            ...(directShipping ? { directShipping } : {}),
                            ...(usesBlueExpress
                                ? {
                                      blueExpressZone:
                                          matchedComuna.blueExpressZone ??
                                          matchedComuna.regionBlueExpressZone,
                                      blueExpressRates: catalog.blueExpressRates,
                                      blueExpressTransitDays: catalog.blueExpressTransitDays,
                                  }
                                : {}),
                        };
                    } else {
                        deliveryLookup = {
                            found: false,
                            requestedComuna: args.comuna,
                            note: 'Comuna no encontrada en el listado exacto; verifica la ortografía o confirma si pertenece a la Región Metropolitana.',
                        };
                    }
                }

                const eventSchedulePolicy =
                    serviceType !== 'direct'
                        ? buildEventSchedulePolicy(catalog.shippingMethodsConfig.own_events)
                        : undefined;

                const payload: Record<string, unknown> = {
                    ...(!searchFilter
                        ? {
                              rules: {
                                  cocktailsPerLiter: COCKTAILS_PER_LITER,
                                  portatilMinLiters: PORTATIL_MIN_LITERS,
                                  portatilSizes: [5, 10],
                                  muroMinLiters: MURO_MIN_LITERS,
                                  muroSizes: [20, 30],
                                  muroInstallationCostClp: MURO_INSTALLATION_COST,
                                  ...(eventSchedulePolicy ? { eventSchedulePolicy } : {}),
                              },
                          }
                        : {}),
                    ...(products ? { products } : {}),
                    ...(catalogSummary
                        ? {
                              catalogSummary,
                              note: 'Usa search o category en get_catalog_and_delivery para obtener productId y detalles exactos.',
                          }
                        : {}),
                    ...(deliveryLookup ? { deliveryLookup } : {}),
                    ...(!isBroadList && serviceType !== 'direct' && !searchFilter
                        ? {
                              eventTypes: catalog.eventTypes.map((e) => ({
                                  id: e.id,
                                  name: e.name,
                              })),
                          }
                        : {}),
                    ...(!isBroadList && !args.comuna && !searchFilter
                        ? {
                              regions: catalog.regions
                                  .filter((r) => r.isActive)
                                  .map((r) => ({
                                      code: r.code,
                                      name: r.shortName,
                                      events: r.availableForEvents,
                                      direct: r.availableForDirect,
                                      carrier: r.shippingCarrier,
                                      eventClp: r.cost,
                                      freeFromL: r.freeFrom,
                                      directClp: r.directSaleDeliveryCost,
                                  })),
                          }
                        : {}),
                };

                return okResult(payload);
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error consultando catálogo');
            }
        }
    );

    server.registerTool(
        'calculate_event_proposal',
        {
            description:
                'Calcula litros recomendados, combinación óptima de barriles, costo estimado o exacto (productos + despacho + instalación de Muro si aplica) para un evento o compra de barriles desechables.',
            inputSchema: {
                guests: z.number().int().min(1).max(5000).describe('Cantidad de invitados'),
                drinksPerPerson: z.number().min(1).max(15).default(3).describe('Tragos estimados por persona (recomendado: 3)'),
                serviceType: z.enum(['event', 'direct']).default('event'),
                comuna: z.string().optional().describe('Comuna de destino para calcular despacho exacto'),
                dispenser: z.enum(['portatil', 'muro']).optional().describe('Tipo de dispensador para evento'),
                items: z
                    .array(
                        z.object({
                            productId: z.string().min(1),
                            size: z.string().min(1),
                            quantity: z.number().int().min(1).max(50),
                            variant: z.string().max(120).optional().describe('Variante/mezclador opcional (ej. Coca Zero, Sprite). Si se omite usa la opción por defecto.'),
                        })
                    )
                    .optional()
                    .describe('Ítems específicos elegidos por el cliente para cálculo exacto'),
            },
            annotations: { readOnlyHint: true },
        },
        async (args) => {
            try {
                const catalog = await fetchAllProductData();
                const smart = calculateSmartConfig(args.guests, args.drinksPerPerson, args.serviceType === 'direct');
                const estimate =
                    args.serviceType === 'event'
                        ? calculateEstimatedProposal(args.guests, args.drinksPerPerson, catalog.cocktails)
                        : null;

                const matchedComuna = findComuna(catalog.comunas.filter((c) => c.isActive), args.comuna);
                let exactSummary: Record<string, unknown> | null = null;

                if (args.items && args.items.length > 0) {
                    const validationErr = validateItemsAgainstCatalog(args.items, catalog.cocktails);
                    if (validationErr) {
                        return errorResult(validationErr);
                    }
                    const inferredDispenser =
                        args.dispenser ??
                        (args.serviceType === 'event' && args.items.every((i) => isEventBarrelSizeLabelCompatible(i.size, 'muro'))
                            ? 'muro'
                            : 'portatil');
                    if (args.serviceType === 'event' && args.dispenser) {
                        const dispenserErr = validateEventDispenserAndItems(args.dispenser, args.items, catalog.cocktails);
                        if (dispenserErr) {
                            return errorResult(dispenserErr);
                        }
                    }

                    const dummyState: WizardState = {
                        step: 4,
                        serviceType: args.serviceType,
                        eventData: {
                            type: 'Evento',
                            otherType: '',
                            date: '',
                            startTime: '20:00',
                            pickupDate: '',
                            pickupTime: '',
                        },
                        consumption: {
                            guests: args.guests,
                            drinksPerPerson: args.drinksPerPerson,
                        },
                        selections: args.items.map((i) => ({ id: i.productId, size: i.size, quantity: i.quantity })),
                        dispenser: args.serviceType === 'event' ? inferredDispenser : '',
                        expandedCocktailId: null,
                        expandedCategoryId: '',
                        contact: {
                            firstName: '',
                            lastName: '',
                            email: '',
                            phone: '',
                            address: '',
                            region: matchedComuna?.regionCode ?? 'RM',
                            comuna: matchedComuna?.name ?? (args.comuna || ''),
                            otherComuna: '',
                            comments: '',
                        },
                    };

                    const summary = calculateSummaryData(dummyState, catalog.cocktails, catalog.comunas);
                    exactSummary = {
                        totalLiters: summary.totalLiters,
                        totalCocktails: summary.totalCocktails,
                        avgCocktailsPerGuest:
                            args.guests > 0 ? Number((summary.totalCocktails / args.guests).toFixed(1)) : 0,
                        productsNormalSubtotalClp: summary.totalNormalPrice,
                        productsSubtotalClp: summary.totalOfferPrice,
                        discountClp: summary.totalDiscount,
                        shippingCostClp: summary.shippingCost,
                        shippingLabel: summary.shippingLabel,
                        shippingCarrier: summary.shippingCarrier,
                        installationCostClp: summary.installationCost,
                        totalPriceClp: summary.totalPrice,
                        canHaveMuro: summary.canHaveMuro,
                        canHavePortatil: summary.canHavePortatil,
                        pricePerCocktailClp:
                            summary.totalCocktails > 0 ? Math.round(summary.totalPrice / summary.totalCocktails) : 0,
                        items: summary.items.map((item) => ({
                            id: item.id,
                            name: item.name,
                            size: item.selectedSize,
                            quantity: item.quantity,
                            totalNormalPrice: item.totalNormalPrice,
                            totalOfferPrice: item.totalOfferPrice,
                        })),
                    };
                }

                return okResult({
                    recommendation: smart,
                    estimate,
                    exactSummary,
                    resolvedComuna: matchedComuna
                        ? { name: matchedComuna.name, regionCode: matchedComuna.regionCode, regionName: matchedComuna.regionName }
                        : null,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error calculando propuesta');
            }
        }
    );

    server.registerTool(
        'create_event_quote_or_reservation',
        {
            description:
                'Crea una cotización formal de evento (draft) o reserva confirmada (confirmNow: true) en Cocktails on Tap y retorna el enlace web /cotizar/<token> y total en CLP. Para confirmar reserva inmediata se requieren apellido, correo, teléfono, dirección, horario de inicio y comuna válida.',
            inputSchema: {
                confirmNow: z.boolean().optional().default(false),
                client: z.object({
                    firstName: z.string().min(2),
                    lastName: z.string().optional().default(''),
                    email: z.string().email('Correo electrónico válido requerido'),
                    phone: z.string().optional(),
                    address: z.string().optional().default(''),
                    region: z.string().optional(),
                    comuna: z.string().min(1),
                    otherComuna: z.string().optional(),
                    comments: z.string().optional(),
                }),
                event: z.object({
                    type: z.string().optional(),
                    otherType: z.string().optional(),
                    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                    startTime: z.string().optional(),
                    pickupDate: z.string().optional(),
                    pickupTime: z.string().optional(),
                }),
                consumption: z
                    .object({
                        guests: z.number().int().min(1).max(5000).optional(),
                        drinksPerPerson: z.number().min(0).max(15).optional(),
                    })
                    .optional(),
                dispenser: z.enum(['portatil', 'muro']).default('portatil'),
                items: z
                    .array(
                        z.object({
                            productId: z.string().min(1),
                            size: z.string().min(1),
                            quantity: z.number().int().min(1).max(50),
                            variant: z.string().max(120).optional().describe('Variante/mezclador opcional (ej. Coca Zero, Sprite). Si se omite usa la opción por defecto.'),
                        })
                    )
                    .min(1),
                ctwaClid: z.string().optional(),
                fbc: z.string().optional(),
                fbp: z.string().optional(),
            },
            annotations: { readOnlyHint: false },
        },
        async (args) => {
            try {
                const phoneFallback = normalizeContactPhone(args.client.phone) ?? normalizeContactPhone(ctx.contactPhone);
                const parsed = IntegrationEventQuoteSchema.safeParse({
                    source: 'whatsapp',
                    confirmNow: args.confirmNow,
                    client: {
                        ...args.client,
                        ...(phoneFallback ? { phone: phoneFallback } : {}),
                    },
                    event: args.event,
                    consumption: args.consumption,
                    dispenser: args.dispenser,
                    items: args.items,
                    ctwaClid: args.ctwaClid,
                    fbc: args.fbc,
                    fbp: args.fbp,
                });

                if (!parsed.success) {
                    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
                    return errorResult(`Datos inválidos para cotización de evento: ${msg}`);
                }

                const catalog = await fetchAllProductData();
                const itemErr = validateItemsAgainstCatalog(parsed.data.items, catalog.cocktails);
                if (itemErr) {
                    return errorResult(itemErr);
                }
                const dispenserErr = validateEventDispenserAndItems(
                    parsed.data.dispenser,
                    parsed.data.items,
                    catalog.cocktails
                );
                if (dispenserErr) {
                    return errorResult(dispenserErr);
                }

                const matchedComuna = findComuna(
                    catalog.comunas.filter((c) => c.isActive),
                    parsed.data.client.comuna
                );
                if (matchedComuna) {
                    parsed.data.client.comuna = matchedComuna.name;
                    parsed.data.client.region = matchedComuna.regionCode;
                }

                const state = mapEventQuoteToWizardState(parsed.data);
                applyContactRegionFromCatalog(state, catalog.comunas);

                if (parsed.data.confirmNow) {
                    applyConfirmNowPickupDefault(state);
                    const confirmErr = validateConfirmNowState(state);
                    if (confirmErr) {
                        return errorResult(confirmErr);
                    }
                }

                const quoteSource = normalizeQuoteSource(parsed.data.source);

                if (!parsed.data.confirmNow) {
                    const existingDraft = await findRecentDuplicateEventDraft({
                        source: quoteSource,
                        email: state.contact.email,
                        phone: state.contact.phone,
                        eventDate: state.eventData.date,
                        comunaName: state.contact.comuna && state.contact.comuna !== 'Otra' ? state.contact.comuna : state.contact.otherComuna,
                        dispenser: parsed.data.dispenser,
                        items: parsed.data.items,
                    });
                    if (existingDraft) {
                        return okResult({
                            success: true,
                            quoteId: existingDraft.quoteId,
                            token: existingDraft.token,
                            status: existingDraft.status,
                            totalPriceClp: existingDraft.totalPriceClp,
                            url: `${SITE_URL}/cotizar/${existingDraft.token}`,
                            deduplicated: true,
                        });
                    }
                }

                const result = await createQuoteCore({
                    state,
                    cocktails: catalog.cocktails,
                    comunas: catalog.comunas,
                    confirmNow: Boolean(parsed.data.confirmNow),
                    source: quoteSource,
                    skipEmail: !state.contact.email,
                    ctwaClid: parsed.data.ctwaClid ?? null,
                    fbc: parsed.data.fbc ?? null,
                    fbp: parsed.data.fbp ?? null,
                });

                if (!result.success || !result.token) {
                    return errorResult(result.error ?? 'No se pudo crear la cotización de evento.');
                }

                return okResult({
                    success: true,
                    quoteId: result.quoteId,
                    token: result.token,
                    status: result.status,
                    totalPriceClp: result.totalPrice,
                    url: `${SITE_URL}/cotizar/${result.token}`,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error creando cotización de evento');
            }
        }
    );

    server.registerTool(
        'update_event_quote',
        {
            description:
                'Actualiza una cotización de evento existente en estado borrador (draft) usando su token, recalculando totales en servidor y conservando el mismo enlace /cotizar/<token> sin crear duplicados ni reenviar correos. Úsala siempre que el cliente ya tenga una cotización emitida y pida cambiar cócteles, litros, fecha, invitados o comuna.',
            inputSchema: {
                token: z.string().min(1).describe('Token de la cotización existente (la parte final de /cotizar/<token>)'),
                comuna: z.string().optional().describe('Nueva comuna RM si el cliente la cambió'),
                eventDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional()
                    .describe('Nueva fecha del evento YYYY-MM-DD si cambió'),
                eventType: z.string().optional().describe('Nuevo tipo de evento si cambió'),
                guests: z.number().int().min(1).max(5000).optional().describe('Nueva cantidad de invitados si cambió'),
                dispenser: z.enum(['portatil', 'muro']).optional().describe('Nuevo dispensador si cambió'),
                email: z.string().optional().describe('Nuevo correo del cliente si lo corrigió'),
                items: z
                    .array(
                        z.object({
                            productId: z.string().min(1),
                            size: z.string().min(1),
                            quantity: z.number().int().min(1).max(50),
                            variant: z
                                .string()
                                .max(120)
                                .optional()
                                .describe('Variante/mezclador opcional (ej. Coca Zero, Sprite). Si se omite usa la opción por defecto.'),
                        })
                    )
                    .min(1)
                    .optional()
                    .describe('Lista completa y actualizada de productos si cambiaron los cócteles o cantidades'),
            },
            annotations: { readOnlyHint: false },
        },
        async (args) => {
            try {
                const token = args.token.trim();
                const db = createServerClient();
                const { data: existingQuote, error: fetchErr } = await db
                    .from('quotes')
                    .select('id, status, service_type, dispenser, quote_items(id, product_id, size, quantity, variant)')
                    .eq('token', token)
                    .single();

                if (fetchErr || !existingQuote) {
                    return errorResult('No se encontró una cotización con ese token.');
                }
                if (existingQuote.status !== 'draft') {
                    return errorResult(
                        `La cotización ya está en estado "${existingQuote.status}" y no se puede editar automáticamente.`
                    );
                }
                if (existingQuote.service_type === 'direct' || existingQuote.dispenser === 'desechable') {
                    return errorResult('Esta herramienta solo actualiza cotizaciones de eventos en borrador.');
                }

                const catalog = await fetchAllProductData();

                let nextItems: {
                    id?: string;
                    product_id?: string | null;
                    size: string;
                    quantity: number;
                    variant?: string | null;
                }[];

                if (args.items && args.items.length > 0) {
                    const itemErr = validateItemsAgainstCatalog(args.items, catalog.cocktails);
                    if (itemErr) {
                        return errorResult(itemErr);
                    }
                    nextItems = args.items.map((i) => ({
                        product_id: i.productId,
                        size: i.size,
                        quantity: i.quantity,
                        variant: i.variant ?? null,
                    }));
                } else {
                    const existingItems = (existingQuote.quote_items ?? []) as {
                        id: string;
                        product_id: string | null;
                        size: string;
                        quantity: number;
                        variant?: string | null;
                    }[];
                    if (existingItems.length === 0) {
                        return errorResult('La cotización no tiene productos para conservar; indica los items.');
                    }
                    nextItems = existingItems.map((i) => ({
                        id: i.id,
                        product_id: i.product_id,
                        size: i.size,
                        quantity: i.quantity,
                        variant: i.variant ?? null,
                    }));
                }

                let nextComuna: { comuna_name: string; region_name: string } | undefined;
                if (args.comuna?.trim()) {
                    const activeComunas = catalog.comunas.filter((c) => c.isActive);
                    const matchedComuna = findComuna(activeComunas, args.comuna);
                    if (!matchedComuna) {
                        return errorResult(
                            `Comuna no encontrada: "${args.comuna}". Verifica la ortografía o confirma si pertenece a la Región Metropolitana.`
                        );
                    }
                    const region = catalog.regions.find((r) => r.code === matchedComuna.regionCode);
                    if (region && !region.availableForEvents) {
                        return errorResult(
                            `La comuna "${matchedComuna.name}" (${matchedComuna.regionShortName}) está fuera de la cobertura de eventos (solo RM).`
                        );
                    }
                    nextComuna = {
                        comuna_name: matchedComuna.name,
                        region_name: matchedComuna.regionShortName,
                    };
                }

                const inferredDispenser: 'portatil' | 'muro' =
                    args.dispenser ??
                    (args.items && args.items.length > 0
                        ? args.items.every((i) => isEventBarrelSizeLabelCompatible(i.size, 'muro'))
                            ? 'muro'
                            : 'portatil'
                        : existingQuote.dispenser === 'muro'
                          ? 'muro'
                          : 'portatil');

                const dispenserErr = validateEventDispenserAndItems(
                    inferredDispenser,
                    nextItems.map((i) => ({ productId: i.product_id, size: i.size, quantity: i.quantity })),
                    catalog.cocktails
                );
                if (dispenserErr) {
                    return errorResult(dispenserErr);
                }

                const updateResult = await updateDraftQuoteCore({
                    token,
                    dispenser: inferredDispenser,
                    items: nextItems,
                    ...(nextComuna ?? {}),
                    ...(args.eventDate ? { event_date: args.eventDate } : {}),
                    ...(args.guests !== undefined ? { guests: args.guests } : {}),
                    ...(args.eventType ? { event_type_id: args.eventType } : {}),
                    ...(args.email?.trim() ? { client_email: args.email.trim() } : {}),
                });

                if (!updateResult.success || !updateResult.quote) {
                    return errorResult(updateResult.error ?? 'No se pudo actualizar la cotización de evento.');
                }

                const totalNormal = updateResult.quote.total_normal_price;
                const totalOffer = updateResult.quote.total_offer_price;
                return okResult({
                    success: true,
                    updated: true,
                    quoteId: existingQuote.id,
                    token,
                    status: 'draft',
                    dispenser: updateResult.quote.dispenser,
                    comuna: updateResult.quote.comuna_name,
                    totalLiters: updateResult.quote.total_liters,
                    totalCocktails: updateResult.quote.total_liters * COCKTAILS_PER_LITER,
                    productsNormalSubtotalClp: totalNormal,
                    productsSubtotalClp: totalOffer,
                    discountClp: Math.max(0, totalNormal - totalOffer),
                    shippingCostClp: updateResult.quote.shipping_cost,
                    installationCostClp: updateResult.quote.installation_cost,
                    totalPriceClp: updateResult.quote.total_price,
                    items: (updateResult.items ?? []).map((item) => ({
                        id: item.product_id ?? item.id,
                        name: item.product_name,
                        size: item.size,
                        quantity: item.quantity,
                        ...(item.variant ? { variant: item.variant } : {}),
                        totalNormalPrice: Number(item.price_at_time) * item.quantity,
                        totalOfferPrice: Number(item.offer_price_at_time) * item.quantity,
                    })),
                    url: `${SITE_URL}/cotizar/${token}`,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error actualizando cotización de evento');
            }
        }
    );

    server.registerTool(
        'create_keg_direct_sale',
        {
            description:
                'Registra un pedido/venta directa de barriles desechables de 5L (despacho a domicilio o regiones vía Blue Express) y retorna el enlace web /cotizar/<token> con el resumen y transferencia.',
            inputSchema: {
                client: z.object({
                    firstName: z.string().min(1),
                    lastName: z.string().optional().default(''),
                    email: z.string().optional(),
                    phone: z.string().optional(),
                    address: z.string().min(3),
                    region: z.string().optional(),
                    comuna: z.string().min(1),
                    otherComuna: z.string().optional(),
                    comments: z.string().optional(),
                }),
                event: z.object({
                    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Fecha solicitada de entrega (YYYY-MM-DD)'),
                    startTime: z.string().optional(),
                }),
                items: z
                    .array(
                        z.object({
                            productId: z.string().min(1),
                            size: z.string().min(1),
                            quantity: z.number().int().min(1).max(50),
                            variant: z.string().max(120).optional().describe('Variante/mezclador opcional (ej. Coca Zero, Sprite). Si se omite usa la opción por defecto.'),
                        })
                    )
                    .min(1),
                comments: z.string().optional(),
                ctwaClid: z.string().optional(),
                fbc: z.string().optional(),
                fbp: z.string().optional(),
            },
            annotations: { readOnlyHint: false },
        },
        async (args) => {
            try {
                const phoneFallback = normalizeContactPhone(args.client.phone) ?? normalizeContactPhone(ctx.contactPhone);
                const parsed = IntegrationDirectSaleSchema.safeParse({
                    source: 'whatsapp',
                    client: {
                        ...args.client,
                        ...(phoneFallback ? { phone: phoneFallback } : {}),
                    },
                    event: args.event,
                    items: args.items,
                    comments: args.comments,
                    ctwaClid: args.ctwaClid,
                    fbc: args.fbc,
                    fbp: args.fbp,
                });

                if (!parsed.success) {
                    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
                    return errorResult(`Datos inválidos para venta de barriles: ${msg}`);
                }

                const catalog = await fetchAllProductData();
                const itemErr = validateItemsAgainstCatalog(parsed.data.items, catalog.cocktails);
                if (itemErr) {
                    return errorResult(itemErr);
                }

                const state = mapDirectSaleToWizardState(parsed.data);
                applyContactRegionFromCatalog(state, catalog.comunas);

                const result = await createQuoteCore({
                    state,
                    cocktails: catalog.cocktails,
                    comunas: catalog.comunas,
                    confirmNow: false,
                    source: normalizeQuoteSource(parsed.data.source),
                    skipEmail: !state.contact.email,
                    ctwaClid: parsed.data.ctwaClid ?? null,
                    fbc: parsed.data.fbc ?? null,
                    fbp: parsed.data.fbp ?? null,
                });

                if (!result.success || !result.token) {
                    return errorResult(result.error ?? 'No se pudo crear el pedido de barriles.');
                }

                return okResult({
                    success: true,
                    quoteId: result.quoteId,
                    token: result.token,
                    status: result.status,
                    totalPriceClp: result.totalPrice,
                    url: `${SITE_URL}/cotizar/${result.token}`,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error creando pedido de barriles');
            }
        }
    );

    server.registerTool(
        'sync_cot_contact_stage',
        {
            description:
                'Sincroniza el contacto y su avance de etapa (curious o engaged) en el CRM interno de Cocktails on Tap y guarda notas comerciales relevantes del evento o compra.',
            inputSchema: {
                phone: z.string().optional().describe('Teléfono E.164 del cliente (usa el del chat actual si se omite)'),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                email: z.string().optional(),
                touchpointType: z
                    .enum(['bot_started', 'human_reply', 'intent_selected', 'menu_choice', 'engaged', 'admin_note', 'profile_name'])
                    .default('engaged'),
                intent: z.enum(['event', 'direct', 'unknown']).optional(),
                crmNote: z.string().optional(),
                engagedGuests: z.number().int().min(1).max(5000).optional(),
                engagedComuna: z.string().optional(),
                sendCapiLead: z.boolean().optional().default(true),
                ctwaClid: z.string().optional(),
                fbc: z.string().optional(),
                fbp: z.string().optional(),
            },
            annotations: { readOnlyHint: false },
        },
        async (args) => {
            try {
                const phone = normalizeContactPhone(args.phone) ?? normalizeContactPhone(ctx.contactPhone);
                const parsed = IntegrationContactSchema.safeParse({
                    phone,
                    firstName: args.firstName,
                    lastName: args.lastName,
                    email: args.email,
                    source: 'whatsapp',
                    touchpointType: args.touchpointType,
                    intent: args.intent,
                    crmNote: args.crmNote,
                    engagedGuests: args.engagedGuests,
                    engagedComuna: args.engagedComuna,
                    sendCapiLead: args.sendCapiLead,
                    ctwaClid: args.ctwaClid,
                    fbc: args.fbc,
                    fbp: args.fbp,
                });

                if (!parsed.success) {
                    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
                    return errorResult(`Datos inválidos para sincronizar contacto: ${msg}`);
                }

                const resolved = await resolveOrCreateClient({
                    firstName: parsed.data.firstName ?? null,
                    lastName: parsed.data.lastName || null,
                    email: parsed.data.email ?? null,
                    phone: parsed.data.phone,
                    source: parsed.data.source === 'meta' ? 'meta' : 'whatsapp',
                    channel: 'whatsapp',
                });

                const touchpointId = await recordTouchpoint({
                    clientId: resolved.clientId,
                    channel: parsed.data.source,
                    type: parsed.data.touchpointType,
                    meta_ctwa_clid: parsed.data.ctwaClid ?? null,
                    meta_fbc: parsed.data.fbc ?? null,
                    meta_fbp: parsed.data.fbp ?? null,
                    payload: {
                        via: 'deskcomm_mcp',
                        ...(ctx.contactId ? { deskcomm_contact_id: ctx.contactId } : {}),
                        ...(parsed.data.intent ? { intent: parsed.data.intent } : {}),
                    },
                });

                if (parsed.data.crmNote) {
                    await appendClientCrmNote(resolved.clientId, parsed.data.crmNote);
                }

                const stageToSet =
                    parsed.data.touchpointType === 'bot_started'
                        ? 'curious'
                        : ['human_reply', 'intent_selected', 'menu_choice', 'engaged'].includes(parsed.data.touchpointType)
                          ? 'engaged'
                          : null;

                let stageResult = null;
                if (stageToSet) {
                    stageResult = await advanceClientStage(resolved.clientId, stageToSet, {
                        reason: `mcp:${parsed.data.touchpointType}`,
                        source: parsed.data.source,
                        touchpointId,
                        intent: parsed.data.intent ?? null,
                        fireCapi: stageToSet === 'engaged' ? parsed.data.sendCapiLead : false,
                        ctwaClid: parsed.data.ctwaClid ?? null,
                        fbc: parsed.data.fbc ?? null,
                        fbp: parsed.data.fbp ?? null,
                        engagedGuests: parsed.data.engagedGuests ?? null,
                        engagedComuna: parsed.data.engagedComuna ?? null,
                    });
                }

                return okResult({
                    success: true,
                    clientId: resolved.clientId,
                    created: resolved.created,
                    touchpointId,
                    stage: stageResult?.toStage ?? null,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error sincronizando contacto');
            }
        }
    );

    server.registerTool(
        'check_event_availability',
        {
            description:
                'Consulta disponibilidad real de fechas para eventos: fechas bloqueadas manualmente, días operativos, anticipación mínima/hora de corte configurada y cupo diario de Dispensadores Portátiles (máx. 2 barriles 5L/10L por dispensador) y Muros de Coctelería. Úsala siempre que el cliente indique una fecha concreta o antes de emitir la cotización.',
            inputSchema: {
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa formato YYYY-MM-DD').describe('Fecha del evento (YYYY-MM-DD)'),
                endDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa formato YYYY-MM-DD')
                    .optional()
                    .describe('Fecha fin opcional (máx. 14 días desde date) para revisar un fin de semana o varios días'),
                dispenser: z.enum(['portatil', 'muro']).optional().default('portatil').describe('Tipo de dispensador a evaluar'),
                kegCount: z.number().int().min(1).max(50).optional().describe('Cantidad total de barriles 5L/10L que necesita el cliente (solo para portatil)'),
            },
            annotations: { readOnlyHint: true },
        },
        async (args) => {
            try {
                const startDate = args.date;
                const endDate = args.endDate || startDate;
                const startMs = Date.parse(`${startDate}T00:00:00Z`);
                const endMs = Date.parse(`${endDate}T00:00:00Z`);
                if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
                    return errorResult('Rango de fechas inválido. endDate debe ser igual o posterior a date.');
                }
                const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
                if (diffDays > 14) {
                    return errorResult('El rango máximo de consulta es de 14 días.');
                }

                const [{ config, days }, catalog] = await Promise.all([
                    getEventOccupancyByDateRange(startDate, endDate),
                    fetchAllProductData(),
                ]);
                const eventConfig = catalog.shippingMethodsConfig.own_events;
                const schedulePolicy = buildEventSchedulePolicy(eventConfig);
                const kegsToEvaluate = args.kegCount ?? 1;
                const results = [];

                for (let i = 0; i <= diffDays; i++) {
                    const d = new Date(startMs + i * 86400000);
                    const dateKey = d.toISOString().slice(0, 10);
                    const summary = days[dateKey] || buildEmptyDaySummary(dateKey, config);
                    const evaluation = evaluateCapacityForRequest(summary, args.dispenser, kegsToEvaluate);
                    const blocked = isDateBlocked(dateKey, eventConfig);
                    const weekdayAllowed = isWeekdayAllowed(dateKey, eventConfig);
                    const shortNotice = dateKey < schedulePolicy.minSelectableDate;

                    let status: string;
                    let available: boolean;
                    let note: string | undefined;
                    let requiresHumanApproval = false;

                    if (blocked) {
                        available = false;
                        status = 'Fecha bloqueada';
                        note = 'Fecha bloqueada manualmente en agenda (sin disponibilidad para eventos).';
                    } else if (!weekdayAllowed) {
                        available = false;
                        status = 'Día no operativo';
                        note = 'No operamos eventos ese día de la semana.';
                    } else if (!evaluation.available) {
                        available = false;
                        status =
                            args.dispenser === 'muro'
                                ? 'Todo reservado'
                                : summary.portableAvailable === 0
                                  ? 'Todo reservado'
                                  : 'Cupo insuficiente';
                        note = evaluation.reason;
                    } else if (shortNotice) {
                        available = false;
                        requiresHumanApproval = true;
                        status = 'Fuera de plazo mínimo (requiere revisión humana)';
                        note =
                            schedulePolicy.minOffsetDays > 0
                                ? `Requiere al menos ${schedulePolicy.advanceLabel} de anticipación (primera fecha normal: ${schedulePolicy.firstAvailableDate}). Se puede emitir cotización sujeta a disponibilidad y derivar a humano.`
                                : `Fecha fuera de ventana disponible (primera fecha normal: ${schedulePolicy.firstAvailableDate}). Requiere revisión humana.`;
                    } else {
                        available = true;
                        status = 'Disponible';
                    }

                    results.push({
                        date: dateKey,
                        available,
                        status,
                        ...(blocked ? { isBlockedDate: true } : {}),
                        ...(shortNotice ? { isShortNotice: true } : {}),
                        ...(requiresHumanApproval ? { requiresHumanApproval: true } : {}),
                        portableUsed: summary.portableUsed,
                        portableTotal: summary.portableTotal,
                        portableAvailable: summary.portableAvailable,
                        maxPortableKegsAvailable: summary.maxPortableKegsAvailable,
                        muroUsed: summary.muroUsed,
                        muroTotal: summary.muroTotal,
                        muroAvailable: summary.muroAvailable,
                        ...(note ? { note } : {}),
                    });
                }

                return okResult({
                    dispenser: args.dispenser,
                    ...(args.kegCount ? { requestedKegs: args.kegCount } : {}),
                    schedulePolicy,
                    capacityConfig: config,
                    days: results,
                });
            } catch (err) {
                return errorResult(err instanceof Error ? err.message : 'Error consultando disponibilidad');
            }
        }
    );

    return server;
}
