import * as React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { CreateQuoteSchema } from '@/lib/types';
import type { WizardState, CocktailForWizard, Comuna } from '@/lib/types';
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';
import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { SettingsService } from '@/lib/services/settingsService';
import { resolveQuoteSource, type QuoteSource } from '@/lib/quoteSource';

export interface CreateQuoteInput {
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    skipEmail?: boolean;
    isAdmin?: boolean;
    /** Canal explícito; si falta, admin → admin y web → web. API WhatsApp pasa whatsapp. */
    source?: QuoteSource;
    overrides?: { shippingCost?: number; installationCost?: number; manualDiscount?: number };
}

export interface CreateQuoteResult {
    success: boolean;
    token?: string;
    quoteId?: string;
    totalPrice?: number;
    status?: string;
    error?: string;
}

/**
 * Dominio compartido: crear cotización (evento draft o venta directa confirmed).
 * Usado por Server Actions (web/admin) y por /api/v1/* (integraciones).
 */
export async function createQuoteCore(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    try {
        const { state, cocktails, comunas, skipEmail, isAdmin, overrides, source: sourceInput } = input;
        const source = resolveQuoteSource({ source: sourceInput, isAdmin });

        if (!isAdmin) {
            const validation = CreateQuoteSchema.safeParse(input);
            if (!validation.success) {
                const errorMsg = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                console.error('Validation Error Details:', errorMsg);
                return { success: false, error: `Datos de cotización inválidos (${errorMsg}).` };
            }
        }

        if (cocktails) {
            const hasMainProduct = state.selections.some(sel => {
                const product = cocktails.find(c => c.id === sel.id);
                return product && product.category !== 'Otros';
            });

            if (!hasMainProduct) {
                return { success: false, error: 'Debes incluir al menos un producto principal en tu pedido.' };
            }
        }

        const clientId = await QuoteService.upsertClient(state, source);
        const createResult = await QuoteService.createDraftQuote(state, cocktails, comunas, clientId, overrides, source);

        // CAPI mirrors Pixel event_id (lead_TOKEN / purchase_TOKEN) for web + WhatsApp
        if (clientId && createResult.success && createResult.token && (source === 'web' || source === 'whatsapp')) {
            try {
                const { sendQuoteCreatedCapi } = await import('@/lib/services/metaCapiService');
                const isDirect = state.serviceType === 'direct';
                await sendQuoteCreatedCapi({
                    clientId,
                    token: createResult.token,
                    isDirect,
                    source,
                    value: createResult.quote?.total_price,
                    contentName: isDirect
                        ? (source === 'whatsapp' ? 'Venta WhatsApp' : 'Pedido de Barril Desechable')
                        : (source === 'whatsapp' ? 'Cotización WhatsApp' : 'Cotización de Evento (Borrador)'),
                });
            } catch (capiErr) {
                console.error('CAPI quote-created failed:', capiErr);
            }
        }

        if (!createResult.success || !createResult.token || !createResult.quote) {
            return { success: false, error: createResult.error || 'No se pudo guardar la cotización.' };
        }

        const isDirect = state.serviceType === 'direct';

        // CRM lifecycle: draft → quoted; direct sale → customer
        if (clientId) {
            try {
                const { advanceClientStage } = await import('@/lib/services/clientLifecycleService');
                await advanceClientStage(
                    clientId,
                    isDirect ? 'customer' : 'quoted',
                    {
                        reason: isDirect
                            ? `Direct sale created (${source})`
                            : `Event quote draft created (${source})`,
                        source,
                        quoteId: createResult.quote.id,
                        intent: isDirect ? 'direct' : 'event',
                    }
                );
            } catch (stageErr) {
                console.error('CRM stage advance on quote create failed:', stageErr);
            }
        }
        const resendKey = process.env.RESEND_API_KEY;
        const fullQuote = {
            ...createResult.quote,
            quote_items: createResult.quoteItems ?? []
        };

        if (!isAdmin || isDirect) {
            const resend = resendKey ? new Resend(resendKey) : null;
            const tasks: Promise<unknown>[] = [];

            tasks.push(isDirect
                ? GoogleSyncService.updateContactConfirmedStatus(fullQuote as any)
                : GoogleSyncService.syncContactForQuote(state, createResult.token, clientId ?? undefined)
            );

            if (isDirect) {
                tasks.push((async () => {
                    try {
                        const calResult = await GoogleSyncService.scheduleCalendarEvents(fullQuote as any, { isDirectSaleOverride: isDirect });
                        if (calResult?.eventId || calResult?.pickupEventId) {
                            const { createServerClient } = await import('@/lib/supabaseServer');
                            const dbServer = createServerClient();
                            await dbServer.from('quotes').update({
                                google_event_id: calResult.eventId,
                                google_pickup_event_id: calResult.pickupEventId
                            }).eq('id', fullQuote.id);
                        }
                    } catch (calErr: any) {
                        console.error('Error auto-syncing calendar:', calErr);
                        const { createServerClient } = await import('@/lib/supabaseServer');
                        const dbServer = createServerClient();
                        await dbServer.from('sync_logs').insert({
                            quote_id: fullQuote.id,
                            type: 'google_calendar',
                            status: 'error',
                            error_msg: `Auto-sync failed: ${calErr.message || 'Unknown error'}`
                        });
                    }
                })());
            }

            if (!skipEmail && resend && state.contact.email && createResult.quoteItems) {
                tasks.push((async () => {
                    const EmailComponent = isDirect
                        ? (await import('@/components/emails/ConfirmationEmail')).default
                        : (await import('@/components/emails/QuoteEmail')).default;

                    const eventDate = fullQuote.event_date
                        ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                        : '';
                    const fullNameClient = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();
                    const emailVars = { full_name: fullNameClient, event_date: eventDate };

                    const [clientHtml, adminHtml, clientSubject, adminSubject] = await Promise.all([
                        render(React.createElement(EmailComponent, { quote: fullQuote as any, isAdmin: false })),
                        render(React.createElement(EmailComponent, { quote: fullQuote as any, isAdmin: true })),
                        SettingsService.getResolvedValue(
                            isDirect ? 'email_direct_sale_subject' : 'email_quote_draft_subject',
                            emailVars,
                            isDirect ? `✅ Tu pedido ha sido confirmado – ${eventDate}` : `🍸 Tu cotización – ${eventDate}`
                        ),
                        SettingsService.getResolvedValue(
                            isDirect ? 'email_direct_sale_admin_subject' : 'email_quote_draft_admin_subject',
                            emailVars,
                            isDirect ? `[Pedido Confirmado] ${fullNameClient} – ${eventDate}` : `[Nueva Cotización] ${fullNameClient} – ${eventDate}`
                        )
                    ]);

                    return Promise.allSettled([
                        resend.emails.send({ from: FROM_EMAIL, to: state.contact.email, subject: clientSubject, html: clientHtml }),
                        resend.emails.send({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: adminSubject, html: adminHtml })
                    ]);
                })());
            }

            await Promise.allSettled(tasks);
        }

        return {
            success: true,
            token: createResult.token,
            quoteId: createResult.quote.id,
            totalPrice: createResult.quote.total_price,
            status: createResult.quote.status,
        };
    } catch (err) {
        console.error('Error inesperado en createQuoteCore:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
