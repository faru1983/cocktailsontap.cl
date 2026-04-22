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
        
        // ─── 1.1 Validación lógica de productos (Zero Trust) ──────────────────
        // No permitir pedidos que solo contengan productos de la categoría "Otros" (hielo, vasos, etc.)
        if (cocktails) {
            const hasMainProduct = state.selections.some(sel => {
                const product = cocktails.find(c => c.id === sel.id);
                return product && product.category !== 'Otros';
            });

            if (!hasMainProduct) {
                return { success: false, error: 'Debes incluir al menos un producto principal en tu pedido.' };
            }
        }

        // ─── 2. Upsert Cliente (CRM) ──────────────────────────────────────────
        const clientId = await QuoteService.upsertClient(state);

        // ─── 3 & 4. Crear Cotización y Congelar Precios ───────────────────────
        const createResult = await QuoteService.createDraftQuote(state, cocktails, comunas, clientId, overrides);

        if (!createResult.success || !createResult.token || !createResult.quote) {
            return { success: false, error: createResult.error || 'No se pudo guardar la cotización.' };
        }

        const isDirect = state.serviceType === 'direct';
        const resendKey = process.env.RESEND_API_KEY;
        const fullQuote = {
            ...createResult.quote,
            quote_items: createResult.quoteItems ?? []
        };

        // ─── 5 & 6. Automatizaciones reactivas (Paralelizado y Optimizado) ────────────
        // Estas acciones disparan procesos externos. Usamos Promise.allSettled para 
        // maximizar la velocidad y evitar que un fallo en uno bloquee los demás.
        if (!isAdmin || isDirect) {
            const resend = resendKey ? new Resend(resendKey) : null;
            
            // Preparamos las tareas
            const tasks: Promise<any>[] = [];

            // Tarea 1: Sincronización de Contactos (People API)
            tasks.push(isDirect 
                ? GoogleSyncService.updateContactConfirmedStatus(fullQuote as any)
                : GoogleSyncService.syncContactForQuote(state, createResult.token, clientId ?? undefined)
            );

            // Tarea 2: Sincronización de Calendario (Solo si es Directo)
            if (isDirect) {
                tasks.push((async () => {
                    try {
                        const calResult = await GoogleSyncService.scheduleCalendarEvents(fullQuote as any);
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

            // Tarea 3: Envío de Emails (Resend)
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

                    // Renderizados en paralelo para ahorrar tiempo de CPU
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

            // Ejecutamos todas las automatizaciones en paralelo
            // Await asegura que Vercel no mate el proceso antes de terminar las llamadas externas
            await Promise.allSettled(tasks);
        }

        return { success: true, token: createResult.token, quoteId: createResult.quote.id };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
