'use server';

import { validateSession } from '@/lib/adminAuth';
import { fetchAllProductData } from '@/lib/serverData';
import { createQuoteCore } from '@/lib/services/createQuoteCore';
import type { CreateQuoteResult } from '@/lib/services/createQuoteCore';
import type { WizardState } from '@/lib/types';

export interface AdminCreateQuoteInput {
    state: WizardState;
    confirmNow?: boolean;
    skipEmail?: boolean;
    overrides?: {
        shippingCost?: number;
        installationCost?: number;
        manualDiscount?: number;
        shippingLabel?: string | null;
    };
}

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

/** Server Action admin — isAdmin derivado de sesión, no del cliente. */
export async function createQuoteAdmin(input: AdminCreateQuoteInput): Promise<CreateQuoteResult> {
    await checkAuth();
    const { cocktails, comunas } = await fetchAllProductData();
    return createQuoteCore({
        state: input.state,
        cocktails,
        comunas,
        confirmNow: input.confirmNow,
        skipEmail: input.skipEmail,
        overrides: input.overrides,
        isAdmin: true,
        source: 'admin',
    });
}
