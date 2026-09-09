import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/config';
import { verifyIntegrationAuth } from '@/lib/integrationAuth';
import { fetchAllProductData } from '@/lib/serverData';
import { createQuoteCore } from '@/lib/services/createQuoteCore';
import type { WizardState } from '@/lib/types';
import type { QuoteSource } from '@/lib/quoteSource';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import {
    applyConfirmNowPickupDefault,
    applyContactRegionFromCatalog,
    validateItemsAgainstCatalog,
} from '@/lib/integrationMapper';

export function jsonError(status: number, error: string) {
    return NextResponse.json({ success: false, error }, { status });
}

export async function handleIntegrationCreate(opts: {
    request: Request;
    parseBody: (raw: unknown) =>
        | {
              ok: true;
              state: WizardState;
              items: { productId: string; size: string; quantity: number }[];
              source?: QuoteSource;
              confirmNow?: boolean;
          }
        | { ok: false; error: string };
}) {
    const auth = await verifyIntegrationAuth(opts.request);
    if (!auth.ok) {
        return jsonError(auth.status, auth.error);
    }

    let raw: unknown;
    try {
        raw = await opts.request.json();
    } catch {
        return jsonError(400, 'JSON inválido.');
    }

    const parsed = opts.parseBody(raw);
    if (!parsed.ok) {
        return jsonError(400, parsed.error);
    }

    const { cocktails, comunas } = await fetchAllProductData();
    const catalogError = validateItemsAgainstCatalog(parsed.items, cocktails);
    if (catalogError) {
        return jsonError(400, catalogError);
    }

    applyContactRegionFromCatalog(parsed.state, comunas);

    const confirmNow = parsed.confirmNow === true && parsed.state.serviceType === 'event';
    if (confirmNow) {
        applyConfirmNowPickupDefault(parsed.state);
        const confirmErr = validateConfirmNowState(parsed.state);
        if (confirmErr) {
            return jsonError(400, confirmErr);
        }
    }

    const result = await createQuoteCore({
        state: parsed.state,
        cocktails,
        comunas,
        source: parsed.source ?? 'whatsapp',
        confirmNow,
    });

    if (!result.success || !result.token) {
        return jsonError(400, result.error || 'No se pudo crear la cotización.');
    }

    return NextResponse.json({
        success: true,
        token: result.token,
        quoteId: result.quoteId,
        url: `${SITE_URL}/cotizar/${result.token}`,
        totalPrice: result.totalPrice,
        status: result.status,
    });
}
