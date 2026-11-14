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
    isEventBarrelSizeLabelCompatible,
    resolveShipping,
} from '@/lib/wizardLogic';
import type { Comuna, WizardState } from '@/lib/types';

export interface CocktailsMcpContext {
    contactPhone?: string;
    contactId?: string;
    channel?: string;
}

const SERVER_NAME = 'cocktails-on-tap';
const SERVER_VERSION = '1.0.0';

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
    const needle = normalizeText(query);
    return (
        comunas.find((c) => normalizeText(c.name) === needle) ??
        comunas.find((c) => normalizeText(c.name).includes(needle))
    );
}

function normalizeContactPhone(phone?: string | null): string | undefined {
    const raw = (phone ?? '').trim();
    if (!raw) return undefined;
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    return `+${digits}`;
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

                const products = catalog.products
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
                        sizes: p.sizes.filter((s) => {
                            if (serviceType === 'direct') return s.isDisposable;
                            if (serviceType === 'event') return !s.isDisposable;
                            return true;
                        }),
                    }))
                    .filter((p) => p.sizes.length > 0);

                const activeComunas = catalog.comunas.filter((c) => c.isActive);
                const matchedComuna = findComuna(activeComunas, args.comuna);

                let deliveryLookup: Record<string, unknown> | null = null;
                if (args.comuna) {
                    if (matchedComuna) {
                        const eventShipping = resolveShipping({
                            serviceType: 'event',
                            regionCode: matchedComuna.regionCode,
                            comunaName: matchedComuna.name,
                            totalLiters: 10,
                            comunas: activeComunas,
                            shippingMethodsConfig: catalog.shippingMethodsConfig,
                        });
                        const directShipping = resolveShipping({
                            serviceType: 'direct',
                            regionCode: matchedComuna.regionCode,
                            comunaName: matchedComuna.name,
                            totalLiters: 5,
                            comunas: activeComunas,
                            shippingMethodsConfig: catalog.shippingMethodsConfig,
                        });
                        deliveryLookup = {
                            found: true,
                            comuna: matchedComuna.name,
                            region: matchedComuna.regionName,
                            regionCode: matchedComuna.regionCode,
                            regionShortName: matchedComuna.regionShortName,
                            eventShipping,
                            directShipping,
                            freeEventFromLiters: matchedComuna.freeFrom ?? matchedComuna.regionFreeFrom,
                            blueExpressZone: matchedComuna.blueExpressZone ?? matchedComuna.regionBlueExpressZone,
                            blueExpressRates: catalog.blueExpressRates,
                            blueExpressTransitDays: catalog.blueExpressTransitDays,
                        };
                    } else {
                        deliveryLookup = {
                            found: false,
                            requestedComuna: args.comuna,
                            note: 'Comuna no encontrada en el listado exacto; usa "Otra" si corresponde o verifica ortografía.',
                        };
                    }
                }

                return okResult({
                    rules: {
                        cocktailsPerLiter: COCKTAILS_PER_LITER,
                        portatilMinLiters: PORTATIL_MIN_LITERS,
                        portatilCompatibleSizesLiters: [5, 10],
                        muroMinLiters: MURO_MIN_LITERS,
                        muroCompatibleSizesLiters: [20, 30],
                        muroInstallationCostClp: MURO_INSTALLATION_COST,
                    },
                    products,
                    eventTypes: catalog.eventTypes.map((e) => ({ id: e.id, name: e.name })),
                    deliveryLookup,
                    regions: catalog.regions
                        .filter((r) => r.isActive)
                        .map((r) => ({
                            code: r.code,
                            shortName: r.shortName,
                            availableForEvents: r.availableForEvents,
                            availableForDirect: r.availableForDirect,
                            shippingCarrier: r.shippingCarrier,
                            eventCost: r.cost,
                            freeFromLiters: r.freeFrom,
                            directSaleDeliveryCost: r.directSaleDeliveryCost,
                        })),
                });
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
                    firstName: z.string().min(1),
                    lastName: z.string().optional().default(''),
                    email: z.string().optional(),
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
                        drinksPerPerson: z.number().min(1).max(15).optional(),
                    })
                    .optional(),
                dispenser: z.enum(['portatil', 'muro']).default('portatil'),
                items: z
                    .array(
                        z.object({
                            productId: z.string().min(1),
                            size: z.string().min(1),
                            quantity: z.number().int().min(1).max(50),
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

                const state = mapEventQuoteToWizardState(parsed.data);
                applyContactRegionFromCatalog(state, catalog.comunas);

                if (parsed.data.confirmNow) {
                    applyConfirmNowPickupDefault(state);
                    const confirmErr = validateConfirmNowState(state);
                    if (confirmErr) {
                        return errorResult(confirmErr);
                    }
                }

                const result = await createQuoteCore({
                    state,
                    cocktails: catalog.cocktails,
                    comunas: catalog.comunas,
                    confirmNow: Boolean(parsed.data.confirmNow),
                    source: normalizeQuoteSource(parsed.data.source),
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

    return server;
}
