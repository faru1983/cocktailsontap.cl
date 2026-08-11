'use server';

import { confirmQuoteCore } from '@/lib/services/confirmQuoteCore';
import type { ConfirmQuoteResult } from '@/lib/services/confirmQuoteCore';

/** Server Action — confirma reserva vía dominio compartido. */
export async function confirmQuote(formData: unknown): Promise<ConfirmQuoteResult> {
    return confirmQuoteCore(formData);
}
