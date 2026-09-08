'use server';

import { fetchAllProductData } from '@/lib/serverData';
import { createQuoteCore } from '@/lib/services/createQuoteCore';
import type { CreateQuoteResult } from '@/lib/services/createQuoteCore';
import type { WizardState } from '@/lib/types';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export interface PublicCreateQuoteInput {
    state: WizardState;
    confirmNow?: boolean;
}

/** Server Action pública — catálogo y precios solo desde el servidor. */
export async function createQuote(input: PublicCreateQuoteInput): Promise<CreateQuoteResult> {
    const rl = await enforceRateLimit('createQuote', { limit: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return { success: false, error: RATE_LIMIT_MESSAGE };

    const { cocktails, comunas } = await fetchAllProductData();
    return createQuoteCore({
        state: input.state,
        cocktails,
        comunas,
        confirmNow: input.confirmNow,
        isAdmin: false,
        source: 'web',
    });
}
