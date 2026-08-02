import { IntegrationDirectSaleSchema } from '@/lib/integrationSchemas';
import { mapDirectSaleToWizardState } from '@/lib/integrationMapper';
import { handleIntegrationCreate, jsonError } from '@/lib/integrationApi';
import { normalizeQuoteSource } from '@/lib/quoteSource';

export async function POST(request: Request) {
    try {
        return await handleIntegrationCreate({
            request,
            parseBody: (raw) => {
                const validation = IntegrationDirectSaleSchema.safeParse(raw);
                if (!validation.success) {
                    const error = validation.error.issues
                        .map((i) => `${i.path.join('.')}: ${i.message}`)
                        .join(', ');
                    return { ok: false, error: `Datos inválidos (${error}).` };
                }
                const dto = validation.data;
                return {
                    ok: true,
                    state: mapDirectSaleToWizardState(dto),
                    items: dto.items,
                    source: dto.source ? normalizeQuoteSource(dto.source) : 'whatsapp',
                };
            },
        });
    } catch (err) {
        console.error('POST /api/v1/direct-sales:', err);
        return jsonError(500, 'Error inesperado. Intenta nuevamente.');
    }
}
