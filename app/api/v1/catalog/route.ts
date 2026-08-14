import { NextResponse } from 'next/server';
import { verifyIntegrationAuth } from '@/lib/integrationAuth';
import { jsonError } from '@/lib/integrationApi';
import { fetchAllProductData } from '@/lib/serverData';

/**
 * GET /api/v1/catalog
 * Catálogo activo para integraciones (WhatsApp bot, CRM).
 * Auth: Bearer INTEGRATION_API_KEY.
 * Reutiliza fetchAllProductData (caché server 5 min) — no duplica queries.
 */
export async function GET(request: Request) {
    try {
        const auth = verifyIntegrationAuth(request);
        if (!auth.ok) {
            return jsonError(auth.status, auth.error);
        }

        const { cocktails, comunas, eventTypes, regions, blueExpressRates } = await fetchAllProductData();

        // Payload liviano: lo que el bot necesita para armar items (productId + size exacto).
        const products = cocktails.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            sizes: Object.entries(c.prices).map(([size, meta]) => ({
                size,
                sizeValue: meta.sizeValue,
                unit: meta.unit,
                isDisposable: meta.isDisposable,
                price: meta.price,
                offerPrice: meta.offerPrice,
            })),
        }));

        return NextResponse.json({
            success: true,
            products,
            // Bot WhatsApp: solo comunas de regiones habilitadas para eventos (hoy = RM)
            comunas: comunas
                .filter((c) => {
                    const region = regions.find((r) => r.id === c.regionId);
                    return region?.availableForEvents && region.isActive && c.isActive;
                })
                .map((c) => ({
                    name: c.name,
                    cost: c.cost ?? c.regionCost,
                    freeFrom: c.freeFrom ?? c.regionFreeFrom,
                    directSaleDeliveryCost: c.directSaleDeliveryCost ?? c.regionDirectSaleDeliveryCost,
                })),
            regions: regions.map((r) => ({
                code: r.code,
                shortName: r.shortName,
                availableForEvents: r.availableForEvents,
                availableForDirect: r.availableForDirect,
                shippingCarrier: r.shippingCarrier,
                blueExpressZone: r.blueExpressZone,
            })),
            blueExpressRates,
            eventTypes: eventTypes.map((e) => ({
                id: e.id,
                name: e.name,
            })),
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('GET /api/v1/catalog:', err);
        return jsonError(500, 'Error inesperado al cargar el catálogo.');
    }
}
