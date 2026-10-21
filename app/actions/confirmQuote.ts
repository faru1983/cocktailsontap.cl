'use server';

import { confirmQuoteCore } from '@/lib/services/confirmQuoteCore';
import type { ConfirmQuoteResult } from '@/lib/services/confirmQuoteCore';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { headers } from 'next/headers';

/** Server Action — confirma reserva vía dominio compartido. */
export async function confirmQuote(formData: unknown): Promise<ConfirmQuoteResult> {
    const rl = await enforceRateLimit('confirmQuote', { limit: 15, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return { success: false, error: RATE_LIMIT_MESSAGE };

    const reqHeaders = await headers();
    const clientIp = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || reqHeaders.get('x-real-ip') || null;
    const clientUserAgent = reqHeaders.get('user-agent') || null;

    return confirmQuoteCore(formData, { clientIp, clientUserAgent });
}
