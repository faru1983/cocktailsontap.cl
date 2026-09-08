'use server';

import { confirmQuoteCore } from '@/lib/services/confirmQuoteCore';
import type { ConfirmQuoteResult } from '@/lib/services/confirmQuoteCore';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

/** Server Action — confirma reserva vía dominio compartido. */
export async function confirmQuote(formData: unknown): Promise<ConfirmQuoteResult> {
    const rl = await enforceRateLimit('confirmQuote', { limit: 15, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return { success: false, error: RATE_LIMIT_MESSAGE };

    return confirmQuoteCore(formData);
}
