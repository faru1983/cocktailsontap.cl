/**
 * Dominio: actualización automática de cotización en borrador (`draft`) desde `/cotizar/[token]`.
 * Zero Trust Financials: todos los precios y totales se recalculan en servidor contra el catálogo.
 * Sin efectos secundarios intrusivos (no envía emails, WhatsApp, Calendar ni CAPI).
 */
import { revalidatePath } from 'next/cache';
import { UpdateDraftQuoteSchema, type EventType, type QuoteItem } from '@/lib/types';
import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData } from '@/lib/serverData';
import { resolveQuoteItemsFromCatalog } from '@/lib/catalogPricing';
import {
    calculateSummaryData,
    EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME,
    resolveRegionCode,
    resolveRegionShortName,
} from '@/lib/wizardLogic';
import { isValidPhoneE164, normalizePhoneE164 } from '@/lib/phone';
import { normalizeEmail, normalizePersonName } from '@/lib/utils';

export interface UpdateDraftQuoteResult {
    success: boolean;
    error?: string;
    code?: 'NOT_DRAFT' | 'NOT_FOUND' | 'EMPTY_ITEMS' | 'VALIDATION' | 'SERVER_ERROR';
    quote?: {
        total_normal_price: number;
        total_offer_price: number;
        shipping_cost: number;
        installation_cost: number;
        total_price: number;
        total_liters: number;
        shipping_label: string | null;
        dispenser: 'portatil' | 'muro' | 'desechable';
        region_name: string | null;
        comuna_name: string | null;
        updated_at: string;
    };
    items?: QuoteItem[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeText = (v: string) =>
    v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function resolveEventTypeForDraft(
    rawEventTypeId: string | null | undefined,
    rawEventTypeOther: string | null | undefined,
    eventTypes: EventType[]
): { event_type_id: string | null; event_type_other: string | null } {
    const rawId = (rawEventTypeId || '').trim();
    const rawOther = (rawEventTypeOther || '').trim();

    if (!rawId) {
        return { event_type_id: null, event_type_other: rawOther || null };
    }

    const needle = normalizeText(rawId);
    const matched = eventTypes.find(
        (et) => normalizeText(et.id) === needle || normalizeText(et.name) === needle
    );

    if (matched && normalizeText(matched.id) !== 'otro' && normalizeText(matched.name) !== 'otro') {
        return { event_type_id: matched.id, event_type_other: null };
    }

    // Selección "Otro"
    if (matched) {
        return { event_type_id: matched.id, event_type_other: rawOther || null };
    }
    return { event_type_id: null, event_type_other: rawOther || null };
}

export async function updateDraftQuoteCore(formData: unknown): Promise<UpdateDraftQuoteResult> {
    const validation = UpdateDraftQuoteSchema.safeParse(formData);
    if (!validation.success) {
        const emptyItemsIssue = validation.error.issues.find((i) => i.path[0] === 'items');
        if (emptyItemsIssue) {
            return {
                success: false,
                code: 'EMPTY_ITEMS',
                error: 'Agrega al menos un producto para guardar los cambios.',
            };
        }
        return {
            success: false,
            code: 'VALIDATION',
            error: validation.error.issues[0]?.message || 'Datos inválidos.',
        };
    }

    const data = validation.data;
    const db = createServerClient();

    try {
        const [quoteRes, catalogRes] = await Promise.all([
            db.from('quotes').select('*, quote_items(*)').eq('token', data.token).single(),
            fetchAllProductData(),
        ]);

        if (quoteRes.error || !quoteRes.data) {
            return { success: false, code: 'NOT_FOUND', error: 'Cotización no encontrada.' };
        }

        const quote = quoteRes.data;
        if (quote.status !== 'draft') {
            return {
                success: false,
                code: 'NOT_DRAFT',
                error: 'Esta cotización ya no está en borrador y no puede modificarse.',
            };
        }

        const isDirectSale = quote.service_type === 'direct' || quote.dispenser === 'desechable';
        const effectiveDispenser: 'portatil' | 'muro' | 'desechable' = isDirectSale
            ? 'desechable'
            : data.dispenser === 'muro'
              ? 'muro'
              : 'portatil';

        // 1. Resolver ítems contra catálogo del servidor (Zero Trust) + preservar custom items de admin
        const existingItems = ((quote as { quote_items?: QuoteItem[] }).quote_items || []) as QuoteItem[];
        const existingCustomItems = existingItems.filter((i) => !i.product_id);

        // Consolidar líneas de catálogo duplicadas (mismo product_id + size)
        const catalogMap = new Map<string, { product_id: string; size: string; quantity: number; variant?: string | null }>();
        const customLines: { id?: string; size: string; quantity: number }[] = [];

        for (const line of data.items) {
            if (line.product_id) {
                const variantKey = (line.variant || '').trim();
                const key = `${line.product_id}::${line.size}::${variantKey}`;
                const prev = catalogMap.get(key);
                if (prev) {
                    prev.quantity += line.quantity;
                } else {
                    catalogMap.set(key, {
                        product_id: line.product_id,
                        size: line.size,
                        quantity: line.quantity,
                        variant: line.variant ?? null,
                    });
                }
            } else {
                customLines.push({ id: line.id, size: line.size, quantity: line.quantity });
            }
        }

        const resolvedCatalog = resolveQuoteItemsFromCatalog(
            Array.from(catalogMap.values()),
            catalogRes.cocktails
        );
        if (resolvedCatalog.error) {
            return { success: false, code: 'VALIDATION', error: resolvedCatalog.error };
        }

        const matchedCustomIds = new Set<string>();
        const resolvedCustomItems: (Omit<QuoteItem, 'id'> & { _matchedExistingId: string })[] = [];

        for (const customLine of customLines) {
            const matched =
                (customLine.id
                    ? existingCustomItems.find((ex) => ex.id === customLine.id && !matchedCustomIds.has(ex.id))
                    : undefined) ||
                existingCustomItems.find(
                    (ex) =>
                        !matchedCustomIds.has(ex.id) &&
                        (ex.size === customLine.size || ex.product_name === customLine.size)
                ) ||
                existingCustomItems.find((ex) => !matchedCustomIds.has(ex.id));

            if (!matched) {
                return {
                    success: false,
                    code: 'VALIDATION',
                    error: 'Producto no válido en la cotización.',
                };
            }

            matchedCustomIds.add(matched.id);
            resolvedCustomItems.push({
                _matchedExistingId: matched.id,
                quote_id: quote.id,
                product_id: null,
                product_name: matched.product_name,
                size: matched.size,
                size_value: matched.size_value,
                unit_id: matched.unit_id,
                is_disposable: matched.is_disposable,
                quantity: customLine.quantity,
                price_at_time: matched.price_at_time,
                offer_price_at_time: matched.offer_price_at_time,
            });
        }

        const resolvedAllForSummary = [
            ...resolvedCatalog.items.map((item) => ({
                ...item,
                quote_id: quote.id,
            })),
            ...resolvedCustomItems.map(({ _matchedExistingId: _ignored, ...rest }) => rest),
        ];

        // 2. Normalizar datos de contacto, ubicación y evento (sin romper si un campo de texto está a medio escribir)
        const nextClientName =
            data.client_name !== undefined && data.client_name.trim().length > 0
                ? normalizePersonName(data.client_name)
                : quote.client_name;

        const nextClientLastname =
            data.client_lastname !== undefined
                ? normalizePersonName(data.client_lastname) || null
                : quote.client_lastname;

        let nextClientEmail: string | null = quote.client_email;
        if (data.client_email !== undefined) {
            const trimmedEmail = normalizeEmail(data.client_email);
            if (trimmedEmail === '') {
                nextClientEmail = null;
            } else if (EMAIL_RE.test(trimmedEmail)) {
                nextClientEmail = trimmedEmail;
            }
            // Si el email está parcialmente escrito e inválido, preservamos el valor anterior en BD
        }

        let nextClientPhone: string | null = quote.client_phone;
        if (data.client_phone !== undefined) {
            const trimmedPhone = (data.client_phone || '').trim();
            if (trimmedPhone === '') {
                nextClientPhone = null;
            } else {
                const normalized = normalizePhoneE164(trimmedPhone);
                if (normalized && isValidPhoneE164(normalized)) {
                    nextClientPhone = normalized;
                }
                // Si el celular está incompleto mientras escribe, preservamos el valor anterior en BD
            }
        }

        const nextAddress =
            data.client_address !== undefined
                ? data.client_address?.trim() || null
                : quote.client_address;

        const nextComuna =
            data.comuna_name !== undefined
                ? data.comuna_name?.trim() || null
                : quote.comuna_name;

        if (!isDirectSale && data.comuna_name !== undefined && nextComuna) {
            const allowAllRegions = quote.source === 'admin';
            const eventRegionCodes = new Set(
                catalogRes.regions
                    .filter((r) => r.isActive && (allowAllRegions || r.availableForEvents))
                    .map((r) => r.code)
            );
            const matchedEventComuna = catalogRes.comunas.find(
                (c) =>
                    c.isActive &&
                    (eventRegionCodes.size === 0 || eventRegionCodes.has(c.regionCode)) &&
                    c.name.toLowerCase() === nextComuna.toLowerCase()
            );
            if (!matchedEventComuna) {
                return {
                    success: false,
                    code: 'VALIDATION',
                    error: allowAllRegions
                        ? 'La comuna seleccionada no es válida o está inactiva.'
                        : 'Los eventos con dispensador operan exclusivamente en la Región Metropolitana (52 comunas).',
                };
            }
        }

        const nextComunaOther =
            nextComuna === 'Otra'
                ? data.comuna_other !== undefined
                    ? data.comuna_other?.trim() || null
                    : quote.comuna_other
                : null;

        const nextRegionName =
            data.region_name !== undefined
                ? resolveRegionShortName(data.region_name, catalogRes.comunas) ??
                  (data.region_name?.trim() || null)
                : quote.region_name ?? null;

        const resolvedRegionCode = resolveRegionCode(
            nextRegionName || quote.region_name || '',
            catalogRes.comunas
        );

        const nextEventDate =
            data.event_date && /^\d{4}-\d{2}-\d{2}$/.test(data.event_date)
                ? data.event_date
                : quote.event_date;

        const nextStartTime = isDirectSale
            ? null
            : data.start_time !== undefined
              ? data.start_time?.trim() || null
              : quote.start_time;

        let nextPickupDate: string | null = quote.pickup_date;
        let nextPickupTime: string | null = quote.pickup_time;
        if (isDirectSale) {
            nextPickupDate = null;
            nextPickupTime = null;
        } else if (data.pickup_date !== undefined) {
            const trimmedPickup = (data.pickup_date || '').trim();
            if (!trimmedPickup) {
                nextPickupDate = null;
                nextPickupTime = null;
            } else {
                nextPickupDate = trimmedPickup;
                nextPickupTime =
                    trimmedPickup === nextEventDate
                        ? null
                        : data.pickup_time?.trim() || EVENT_DEFAULT_NEXT_DAY_PICKUP_TIME;
            }
        }

        const nextGuests = isDirectSale ? 0 : (data.guests ?? quote.guests ?? 0);

        const { event_type_id: nextEventTypeId, event_type_other: nextEventTypeOther } = isDirectSale
            ? { event_type_id: null, event_type_other: null }
            : data.event_type_id !== undefined || data.event_type_other !== undefined
              ? resolveEventTypeForDraft(
                    data.event_type_id,
                    data.event_type_other,
                    catalogRes.eventTypes
                )
              : {
                    event_type_id: quote.event_type_id,
                    event_type_other: quote.event_type_other,
                };

        const nextComments =
            data.comments !== undefined ? data.comments?.trim() || null : quote.comments;

        // 3. Recalcular totales en servidor (Zero Trust)
        const summary = calculateSummaryData(
            {
                ...quote,
                selections: resolvedAllForSummary.map((i) => ({
                    id: i.product_id || 'manual',
                    size: i.size,
                    quantity: i.quantity,
                    variant: i.variant ?? null,
                    customPrice: i.offer_price_at_time,
                    customName: i.product_name,
                })),
                serviceType: isDirectSale ? 'direct' : 'event',
                contact: {
                    ...quote,
                    firstName: nextClientName,
                    lastName: nextClientLastname || '',
                    email: nextClientEmail || '',
                    phone: nextClientPhone || '',
                    address: nextAddress || '',
                    region: resolvedRegionCode,
                    comuna: nextComuna || '',
                    otherComuna: nextComunaOther || '',
                    comments: nextComments || '',
                },
                dispenser: effectiveDispenser,
                eventData: {
                    type: nextEventTypeId || '',
                    otherType: nextEventTypeOther || '',
                    date: nextEventDate || '',
                    startTime: nextStartTime || '',
                    pickupDate: nextPickupDate || '',
                    pickupTime: nextPickupTime || '',
                },
            } as unknown as Parameters<typeof calculateSummaryData>[0],
            catalogRes.cocktails,
            catalogRes.comunas
        );

        const locationChanged =
            (nextComuna || '') !== (quote.comuna_name || '') ||
            (nextRegionName || '') !== (quote.region_name || '');
        const itemsMetricsChanged =
            summary.totalLiters !== (quote.total_liters || 0) ||
            summary.totalOfferPrice !== (quote.total_offer_price || 0);

        let effectiveShippingCost: number;
        let effectiveShippingLabel: string | null;

        if (quote.shipping_label === 'Por Pagar' && !locationChanged) {
            effectiveShippingCost = quote.shipping_cost ?? 0;
            effectiveShippingLabel = 'Por Pagar';
        } else if (!locationChanged && !itemsMetricsChanged) {
            // Ni ubicación ni volumen/subtotal cambiaron: preservar posible ajuste manual de admin
            effectiveShippingCost = quote.shipping_cost ?? summary.shippingCost;
            effectiveShippingLabel = quote.shipping_label ?? null;
        } else {
            effectiveShippingCost = summary.shippingCost;
            effectiveShippingLabel = null;
        }

        const effectiveInstallationCost = isDirectSale ? 0 : summary.installationCost;
        const effectiveTotal = Math.max(
            0,
            summary.totalOfferPrice +
                effectiveShippingCost +
                effectiveInstallationCost -
                (quote.manual_discount || 0)
        );

        let directDeliveryPatch: Record<string, string | null> = {};
        if (isDirectSale) {
            if (summary.shippingCarrier === 'blue_express') {
                const { buildBlueExpressEstimate } = await import('@/lib/blueExpress');
                const estimate = buildBlueExpressEstimate({
                    dispatchDate: nextEventDate,
                    comunaName: nextComuna,
                    comunas: catalogRes.comunas,
                });
                directDeliveryPatch = {
                    dispatch_estimated_date: estimate.dispatchEstimatedDate,
                    delivery_estimate_min: estimate.deliveryEstimateMin,
                    delivery_estimate_max: estimate.deliveryEstimateMax,
                    delivery_estimate_label: estimate.deliveryEstimateLabel,
                    delivery_estimate_days: estimate.deliveryEstimateDays,
                };
            } else {
                directDeliveryPatch = {
                    dispatch_estimated_date: nextEventDate || null,
                    delivery_estimate_min: null,
                    delivery_estimate_max: null,
                    delivery_estimate_label: null,
                    delivery_estimate_days: null,
                };
            }
        }

        const updatedAt = new Date().toISOString();

        // 4. Actualizar cabecera solo si sigue en estado 'draft'
        const updateRes = await db
            .from('quotes')
            .update({
                client_name: nextClientName,
                client_lastname: nextClientLastname,
                client_email: nextClientEmail,
                client_phone: nextClientPhone,
                client_address: nextAddress,
                region_name: nextRegionName,
                comuna_name: nextComuna,
                comuna_other: nextComunaOther,
                guests: nextGuests,
                event_type_id: nextEventTypeId,
                event_type_other: nextEventTypeOther,
                event_date: nextEventDate,
                start_time: nextStartTime,
                pickup_date: nextPickupDate,
                pickup_time: nextPickupTime,
                comments: nextComments,
                dispenser: effectiveDispenser,
                total_normal_price: summary.totalNormalPrice,
                total_offer_price: summary.totalOfferPrice,
                shipping_cost: effectiveShippingCost,
                shipping_label: effectiveShippingLabel,
                installation_cost: effectiveInstallationCost,
                total_price: effectiveTotal,
                total_liters: summary.totalLiters,
                ...directDeliveryPatch,
                updated_at: updatedAt,
            })
            .eq('id', quote.id)
            .eq('status', 'draft')
            .select('id');

        if (updateRes.error) {
            throw new Error(updateRes.error.message);
        }
        if (!updateRes.data?.length) {
            return {
                success: false,
                code: 'NOT_DRAFT',
                error: 'Esta cotización ya no está en borrador y no puede modificarse.',
            };
        }

        // 5. Sincronizar quote_items por diferencia (conserva UUIDs existentes y evita delete-all)
        const usedExistingIds = new Set<string>();
        const updates: { id: string; payload: Record<string, unknown> }[] = [];
        const inserts: Record<string, unknown>[] = [];

        for (const item of resolvedCatalog.items) {
            const existingMatch = existingItems.find(
                (ex) =>
                    !usedExistingIds.has(ex.id) &&
                    ex.product_id === item.product_id &&
                    ex.size === item.size &&
                    (ex.variant || null) === (item.variant || null)
            );

            const rowPayload = {
                quote_id: quote.id,
                product_id: item.product_id,
                product_name: item.product_name,
                size: item.size,
                size_value: typeof item.size_value === 'number' ? item.size_value : null,
                unit_id: item.unit_id || null,
                is_disposable: Boolean(item.is_disposable),
                quantity: item.quantity,
                variant: item.variant || null,
                price_at_time: item.price_at_time,
                offer_price_at_time: item.offer_price_at_time,
            };

            if (existingMatch) {
                usedExistingIds.add(existingMatch.id);
                const changed =
                    existingMatch.quantity !== rowPayload.quantity ||
                    existingMatch.price_at_time !== rowPayload.price_at_time ||
                    existingMatch.offer_price_at_time !== rowPayload.offer_price_at_time ||
                    existingMatch.product_name !== rowPayload.product_name ||
                    (existingMatch.variant || null) !== (rowPayload.variant || null);
                if (changed) {
                    updates.push({ id: existingMatch.id, payload: rowPayload });
                }
            } else {
                inserts.push(rowPayload);
            }
        }

        for (const customItem of resolvedCustomItems) {
            usedExistingIds.add(customItem._matchedExistingId);
            const existingMatch = existingItems.find((ex) => ex.id === customItem._matchedExistingId);
            if (!existingMatch || existingMatch.quantity !== customItem.quantity) {
                updates.push({
                    id: customItem._matchedExistingId,
                    payload: { quantity: customItem.quantity },
                });
            }
        }

        const idsToDelete = existingItems
            .filter((ex) => !usedExistingIds.has(ex.id))
            .map((ex) => ex.id);

        const itemOps: PromiseLike<{ error: { message: string } | null }>[] = [];
        if (idsToDelete.length > 0) {
            itemOps.push(db.from('quote_items').delete().in('id', idsToDelete).eq('quote_id', quote.id));
        }
        for (const u of updates) {
            itemOps.push(db.from('quote_items').update(u.payload).eq('id', u.id).eq('quote_id', quote.id));
        }
        if (inserts.length > 0) {
            itemOps.push(db.from('quote_items').insert(inserts));
        }

        const opResults = await Promise.all(itemOps);
        const failedOp = opResults.find((r) => r.error);
        if (failedOp?.error) {
            throw new Error(failedOp.error.message);
        }

        const { data: freshItems, error: freshErr } = await db
            .from('quote_items')
            .select(
                'id, quote_id, product_id, product_name, size, size_value, unit_id, is_disposable, quantity, variant, price_at_time, offer_price_at_time'
            )
            .eq('quote_id', quote.id);

        if (freshErr) {
            throw new Error(freshErr.message);
        }

        revalidatePath(`/cotizar/${data.token}`);
        revalidatePath(`/admin/quotes/${quote.id}`);

        return {
            success: true,
            quote: {
                total_normal_price: summary.totalNormalPrice,
                total_offer_price: summary.totalOfferPrice,
                shipping_cost: effectiveShippingCost,
                installation_cost: effectiveInstallationCost,
                total_price: effectiveTotal,
                total_liters: summary.totalLiters,
                shipping_label: effectiveShippingLabel,
                dispenser: effectiveDispenser,
                region_name: nextRegionName,
                comuna_name: nextComuna,
                updated_at: updatedAt,
            },
            items: (freshItems ?? []) as QuoteItem[],
        };
    } catch (err) {
        console.error('[UpdateDraftQuote] Error:', err);
        return {
            success: false,
            code: 'SERVER_ERROR',
            error: 'No se pudieron guardar los cambios. Intenta nuevamente.',
        };
    }
}
