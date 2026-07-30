'use server';

import { createQuoteCore } from '@/lib/services/createQuoteCore';
import type { CreateQuoteInput, CreateQuoteResult } from '@/lib/services/createQuoteCore';

/** Server Action web/admin — delega al dominio compartido. */
export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    return createQuoteCore(input);
}
