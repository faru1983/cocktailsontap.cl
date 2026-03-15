'use server';

import * as React from 'react';
import { Resend } from 'resend';
import { CreateQuoteSchema } from '@/lib/types';
import type { WizardState, CocktailForWizard, Comuna } from '@/lib/types';
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';

import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';

interface CreateQuoteInput {
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
}

interface CreateQuoteResult {
    success: boolean;
    token?: string;
    error?: string;
}

export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    try {
        // ─── 1. Validación de Esquema ─────────────────────────────────────────
        const validation = CreateQuoteSchema.safeParse(input);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
            console.error('Validation Error Details:', errorMsg);
            return { success: false, error: `Datos de cotización inválidos (${errorMsg}).` };
        }

        const { state, cocktails, comunas } = input;

        // ─── 2. Upsert Cliente (CRM) ──────────────────────────────────────────
        const clientId = await QuoteService.upsertClient(state);

        // ─── 3 & 4. Crear Cotización y Congelar Precios ───────────────────────
        const createResult = await QuoteService.createDraftQuote(state, cocktails, comunas, clientId);
        
        if (!createResult.success || !createResult.token || !createResult.quote) {
             return { success: false, error: createResult.error || 'No se pudo guardar la cotización.' };
        }

        // ─── 5. Sincronización proactiva con Google Contacts (Non-blocking) ───
        // We do not await this heavily to avoid blocking the client response.
        GoogleSyncService.syncContactForQuote(state, createResult.token, clientId ?? undefined).catch(e => 
            console.error('Non-blocking Google Sync failed:', e)
        );

        // ─── 6. Enviar emails (Non-blocking) ──────────────────────────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && state.contact.email && createResult.quoteItems) {
            try {
                const resend = new Resend(resendKey);
                // Reconstruct full quote for the email template
                const fullQuote = {
                    ...createResult.quote,
                    quote_items: createResult.quoteItems
                };

                const { render } = await import('@react-email/components');
                const QuoteEmailComponent = (await import('@/components/emails/QuoteEmail')).default;

                const clientHtml = await render(React.createElement(QuoteEmailComponent, { quote: fullQuote, isAdmin: false }));
                const adminHtml = await render(React.createElement(QuoteEmailComponent, { quote: fullQuote, isAdmin: true }));

                Promise.allSettled([
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: state.contact.email,
                        subject: `Cotización Cócteles on Tap - ${state.contact.firstName}`,
                        html: clientHtml,
                    }),
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: ADMIN_EMAIL,
                        subject: `🚨 Nueva Cotización: ${state.contact.firstName}`,
                        html: adminHtml,
                    }),
                ]).catch(e => console.error('Non-blocking Resend failed:', e));
            } catch (emailErr) {
                console.error('Error enviando emails:', emailErr);
            }
        }

        return { success: true, token: createResult.token };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
