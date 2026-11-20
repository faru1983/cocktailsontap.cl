'use server';

import {
    updateDraftQuoteCore,
    type UpdateDraftQuoteResult,
} from '@/lib/services/updateDraftQuoteCore';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

/** Server Action — guarda cambios automáticos en cotización borrador (`draft`). */
export async function updateDraftQuote(formData: unknown): Promise<UpdateDraftQuoteResult> {
    const rl = await enforceRateLimit('updateDraftQuote', {
        limit: 120,
        windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) return { success: false, error: RATE_LIMIT_MESSAGE };

    return updateDraftQuoteCore(formData);
}
