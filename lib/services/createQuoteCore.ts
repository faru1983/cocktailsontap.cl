/**
 * Dominio compartido: crear cotización (evento draft o venta directa confirmed).
 * Con confirmNow (solo evento) crea draft y confirma en el mismo flujo.
 * Usado por Server Actions (web/admin) y por /api/v1/* (integraciones).
 */
import * as React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { CreateQuoteSchema } from '@/lib/types';
import type { WizardState, CocktailForWizard, Comuna, QuoteItem } from '@/lib/types';
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';
import { QuoteService } from '@/lib/services/quoteService';
import { GoogleSyncService } from '@/lib/services/googleSyncService';
import { SettingsService } from '@/lib/services/settingsService';
import { resolveQuoteSource, type QuoteSource } from '@/lib/quoteSource';
import { confirmQuoteCore } from '@/lib/services/confirmQuoteCore';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { resolveRegionShortName } from '@/lib/wizardLogic';

export interface CreateQuoteInput {
    state: WizardState;
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    skipEmail?: boolean;
    isAdmin?: boolean;
    /** Si true (evento), confirma la reserva en el mismo request. */
    confirmNow?: boolean;
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

export { validateConfirmNowState } from '@/lib/confirmNowValidation';

function buildConfirmPayload(state: WizardState, token: string, items: QuoteItem[], comunas: Comuna[]) {
    return {
        token,
        client_phone: state.contact.phone,
        client_lastname: state.contact.lastName.trim(),
        client_address: state.contact.address.trim(),
        region_name: resolveRegionShortName(state.contact.region, comunas),
        comuna_name: state.contact.comuna,
        comuna_other: state.contact.comuna === 'Otra' ? state.contact.otherComuna || null : null,
        guests: state.consumption.guests || 0,
        event_type_id: state.eventData.type === 'Otro' ? null : state.eventData.type || null,
        event_type_other: state.eventData.type === 'Otro' ? state.eventData.otherType || null : null,
        event_date: state.eventData.date,
        start_time: state.eventData.startTime || null,
        pickup_date: state.eventData.pickupDate || null,
        pickup_time:
            state.eventData.pickupDate === state.eventData.date
                ? null
                : state.eventData.pickupTime || null,
        comments: state.contact.comments?.trim() || null,
        dispenser: state.dispenser as 'portatil' | 'muro' | 'desechable',
        items: items.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            size: item.size,
            size_value: item.size_value,
            unit_id: item.unit_id,
            is_disposable: item.is_disposable ?? false,
            quantity: item.quantity,
            price_at_time: item.price_at_time,
            offer_price_at_time: item.offer_price_at_time,
        })),
    };
}

export async function createQuoteCore(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    try {
        const {
            state,
            cocktails,
            comunas,
            skipEmail,
            isAdmin,
            confirmNow,
            overrides,
            source: sourceInput,
        } = input;
        const source = resolveQuoteSource({ source: sourceInput, isAdmin });
        const wantsConfirmNow = Boolean(confirmNow) && state.serviceType === 'event';

        if (!isAdmin) {
            const validation = CreateQuoteSchema.safeParse({ ...input, confirmNow: wantsConfirmNow });
            if (!validation.success) {
                const errorMsg = validation.error.issues
                    .map((i) => `${i.path.join('.')}: ${i.message}`)
                    .join(', ');
                console.error('Validation Error Details:', errorMsg);
                return { success: false, error: `Datos de cotización inválidos (${errorMsg}).` };
            }
        } else if (wantsConfirmNow) {
            const confirmErr = validateConfirmNowState(state);
            if (confirmErr) return { success: false, error: confirmErr };
        }

        if (cocktails) {
            const hasMainProduct = state.selections.some((sel) => {
                const product = cocktails.find((c) => c.id === sel.id);
                return product && product.category !== 'Otros';
            });

            if (!hasMainProduct) {
                return { success: false, error: 'Debes incluir al menos un producto principal en tu pedido.' };
            }
        }

        const clientId = await QuoteService.upsertClient(state, source);
        const createResult = await QuoteService.createDraftQuote(
            state,
            cocktails,
            comunas,
            clientId,
            overrides,
            source
        );

        if (!createResult.success || !createResult.token || !createResult.quote) {
            return { success: false, error: createResult.error || 'No se pudo guardar la cotización.' };
        }

        const isDirect = state.serviceType === 'direct';

        if (clientId) {
            try {
                const { advanceClientStage } = await import('@/lib/services/clientLifecycleService');
                const contentName = isDirect
                    ? source === 'whatsapp'
                        ? 'Venta Barriles WhatsApp'
                        : source === 'admin'
                          ? 'Venta Barriles Admin'
                          : 'Pedido Barriles'
                    : source === 'whatsapp'
                      ? 'Cotización Eventos WhatsApp'
                      : source === 'admin'
                        ? 'Cotización Eventos Admin'
                        : 'Cotización Eventos';

                const quoteCity =
                    state.contact.comuna && state.contact.comuna !== 'Otra'
                        ? state.contact.comuna
                        : state.contact.otherComuna || null;

                await advanceClientStage(clientId, isDirect ? 'customer' : 'quoted', {
                    reason: isDirect
                        ? `Direct sale created (${source})`
                        : `Event quote draft created (${source})`,
                    source,
                    quoteId: createResult.quote.id,
                    quoteToken: createResult.token,
                    value: createResult.quote.total_price,
                    contentName,
                    intent: isDirect ? 'direct' : 'event',
                    contents: createResult.quoteItems || [],
                    city: quoteCity,
                });
            } catch (stageErr) {
                console.error('CRM stage advance on quote create failed:', stageErr);
            }
        }

        // Evento con confirmación inmediata: saltar email/draft sync y confirmar
        if (wantsConfirmNow) {
            const items = createResult.quoteItems || [];
            if (items.length === 0) {
                return { success: false, error: 'No se pudieron guardar los productos de la cotización.' };
            }
            const confirmRes = await confirmQuoteCore(
                buildConfirmPayload(state, createResult.token, items, comunas),
                { skipEmail: Boolean(skipEmail) }
            );
            if (!confirmRes.success) {
                return {
                    success: false,
                    error: confirmRes.error || 'Se creó el borrador pero falló la confirmación.',
                    token: createResult.token,
                    quoteId: createResult.quote.id,
                    status: 'draft',
                };
            }
            return {
                success: true,
                token: createResult.token,
                quoteId: createResult.quote.id,
                totalPrice: createResult.quote.total_price,
                status: 'confirmed',
            };
        }

        const resendKey = process.env.RESEND_API_KEY;
        const fullQuote = {
            ...createResult.quote,
            quote_items: createResult.quoteItems ?? [],
        };

        if (!isAdmin || isDirect) {
            const resend = resendKey ? new Resend(resendKey) : null;
            const tasks: Promise<unknown>[] = [];

            tasks.push(
                isDirect
                    ? GoogleSyncService.updateContactConfirmedStatus(fullQuote as any)
                    : GoogleSyncService.syncContactForQuote(
                          state,
                          createResult.token,
                          clientId ?? undefined
                      )
            );

            if (isDirect) {
                tasks.push(
                    (async () => {
                        try {
                            const calResult = await GoogleSyncService.scheduleCalendarEvents(
                                fullQuote as any,
                                { isDirectSaleOverride: isDirect }
                            );
                            if (calResult?.eventId || calResult?.pickupEventId) {
                                const { createServerClient } = await import('@/lib/supabaseServer');
                                const dbServer = createServerClient();
                                await dbServer
                                    .from('quotes')
                                    .update({
                                        google_event_id: calResult.eventId,
                                        google_pickup_event_id: calResult.pickupEventId,
                                    })
                                    .eq('id', fullQuote.id);
                            }
                        } catch (calErr: any) {
                            console.error('Error auto-syncing calendar:', calErr);
                            const { createServerClient } = await import('@/lib/supabaseServer');
                            const dbServer = createServerClient();
                            await dbServer.from('sync_logs').insert({
                                quote_id: fullQuote.id,
                                type: 'google_calendar',
                                status: 'error',
                                error_msg: `Auto-sync failed: ${calErr.message || 'Unknown error'}`,
                            });
                        }
                    })()
                );
            }

            if (!skipEmail && resend && state.contact.email && createResult.quoteItems) {
                tasks.push(
                    (async () => {
                        const EmailComponent = isDirect
                            ? (await import('@/components/emails/ConfirmationEmail')).default
                            : (await import('@/components/emails/QuoteEmail')).default;

                        const eventDate = fullQuote.event_date
                            ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                              })
                            : '';
                        const fullNameClient =
                            `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();
                        const emailVars = { full_name: fullNameClient, event_date: eventDate };

                        const [clientHtml, adminHtml, clientSubject, adminSubject] = await Promise.all([
                            render(
                                React.createElement(EmailComponent, {
                                    quote: fullQuote as any,
                                    isAdmin: false,
                                })
                            ),
                            render(
                                React.createElement(EmailComponent, {
                                    quote: fullQuote as any,
                                    isAdmin: true,
                                })
                            ),
                            SettingsService.getResolvedValue(
                                isDirect ? 'email_direct_sale_subject' : 'email_quote_draft_subject',
                                emailVars,
                                isDirect
                                    ? `✅ Tu pedido ha sido confirmado – ${eventDate}`
                                    : `🍸 Tu cotización – ${eventDate}`
                            ),
                            SettingsService.getResolvedValue(
                                isDirect
                                    ? 'email_direct_sale_admin_subject'
                                    : 'email_quote_draft_admin_subject',
                                emailVars,
                                isDirect
                                    ? `[Pedido Confirmado] ${fullNameClient} – ${eventDate}`
                                    : `[Nueva Cotización] ${fullNameClient} – ${eventDate}`
                            ),
                        ]);

                        return Promise.allSettled([
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
                    })()
                );
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
