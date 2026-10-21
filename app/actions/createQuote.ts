'use server';

import { fetchAllProductData } from '@/lib/serverData';
import { createQuoteCore } from '@/lib/services/createQuoteCore';
import type { CreateQuoteResult } from '@/lib/services/createQuoteCore';
import type { WizardState } from '@/lib/types';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { headers } from 'next/headers';

export interface PublicCreateQuoteInput {
    state: WizardState;
    confirmNow?: boolean;
    fbc?: string | null;
    fbp?: string | null;
    ctwaClid?: string | null;
    landingMeta?: { landing: string; ctaChannel: 'whatsapp' | 'email' };
}

/** Server Action pública — catálogo y precios solo desde el servidor. */
export async function createQuote(input: PublicCreateQuoteInput): Promise<CreateQuoteResult> {
    const rl = await enforceRateLimit('createQuote', { limit: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return { success: false, error: RATE_LIMIT_MESSAGE };

    const reqHeaders = await headers();
    const clientIp = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || reqHeaders.get('x-real-ip') || null;
    const clientUserAgent = reqHeaders.get('user-agent') || null;

    const { cocktails, comunas } = await fetchAllProductData();
    return createQuoteCore({
        clientIp,
        clientUserAgent,
        state: input.state,
        cocktails,
        comunas,
        confirmNow: input.confirmNow,
        isAdmin: false,
        source: 'web',
        fbc: input.fbc,
        fbp: input.fbp,
        ctwaClid: input.ctwaClid,
        landingMeta: input.landingMeta,
    });
}
