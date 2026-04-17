'use server';

import * as React from 'react';
import { Resend } from 'resend';
import { CreateQuoteSchema } from '@/lib/types';
import { render } from '@react-email/components';
import type { WizardState, CocktailForWizard, Comuna } from '@/lib/types';
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';

import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { SettingsService } from '@/lib/services/settingsService';

interface CreateQuoteInput {
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    skipEmail?: boolean;
    isAdmin?: boolean;
    overrides?: { shippingCost?: number; installationCost?: number; manualDiscount?: number };
}

interface CreateQuoteResult {
    success: boolean;
    token?: string;
    quoteId?: string;
    error?: string;
}

export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    try {
        const { state, cocktails, comunas, skipEmail, isAdmin, overrides } = input;

        // ─── 1. Validación de Esquema ─────────────────────────────────────────
        // Saltamos validación estricta si es creación manual desde el Admin
        if (!isAdmin) {
            const validation = CreateQuoteSchema.safeParse(input);
            if (!validation.success) {
                const errorMsg = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                console.error('Validation Error Details:', errorMsg);
                return { success: false, error: `Datos de cotización inválidos (${errorMsg}).` };
            }
        }

        // ─── 2. Upsert Cliente (CRM) ──────────────────────────────────────────
        const clientId = await QuoteService.upsertClient(state);

        // ─── 3 & 4. Crear Cotización y Congelar Precios ───────────────────────
        const createResult = await QuoteService.createDraftQuote(state, cocktails, comunas, clientId, overrides);

        if (!createResult.success || !createResult.token || !createResult.quote) {
            return { success: false, error: createResult.error || 'No se pudo guardar la cotización.' };
        }

        // ─── 5. Sincronización proactiva con Google Contacts ─────────────────
        try {
            await GoogleSyncService.syncContactForQuote(state, createResult.token, clientId ?? undefined);
        } catch (e) {
            console.error('Google Sync failed:', e);
        }

        // ─── 6. Enviar emails (Condicional y Non-blocking) ───────────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (!skipEmail && resendKey && state.contact.email && createResult.quoteItems) {
            try {
                const resend = new Resend(resendKey);
                // Reconstruct full quote for the email template
                const fullQuote = {
                    ...createResult.quote,
                    quote_items: createResult.quoteItems
                };

                const isDirect = state.serviceType === 'direct';
                let EmailComponent;
                if (isDirect) {
                    EmailComponent = (await import('@/components/emails/DirectSaleEmail')).default;
                } else {
                    EmailComponent = (await import('@/components/emails/QuoteEmail')).default;
                }

                const clientHtml = await render(React.createElement(EmailComponent, { quote: fullQuote, isAdmin: false }));
                const adminHtml = await render(React.createElement(EmailComponent, { quote: fullQuote, isAdmin: true }));

                const eventDate = fullQuote.event_date
                    ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '';
                const fullName = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();


                const emailVars = {
                    full_name: fullName,
                    event_date: eventDate
                };

                const clientSubject = await SettingsService.getResolvedValue(
                    isDirect ? 'email_direct_sale_subject' : 'email_quote_draft_subject',
                    emailVars,
                    isDirect ? `📦 Tu pedido de compra directa – ${eventDate}` : `🍸 Tu cotización – ${eventDate}`
                );

                const adminSubject = await SettingsService.getResolvedValue(
                    isDirect ? 'email_direct_sale_admin_subject' : 'email_quote_draft_admin_subject',
                    emailVars,
                    isDirect ? `[Nuevo Pedido] ${fullName} – ${eventDate}` : `[Nueva Cotización] ${fullName} – ${eventDate}`
                );

                await Promise.allSettled([
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: state.contact.email,
                        subject: clientSubject,
                        html: clientHtml,
                    }),
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: ADMIN_EMAIL,
                        subject: adminSubject,
                        html: adminHtml,
                    }),
                ]);
            } catch (emailErr) {
                console.error('Error enviando emails:', emailErr);
            }
        }

        return { success: true, token: createResult.token, quoteId: createResult.quote.id };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
