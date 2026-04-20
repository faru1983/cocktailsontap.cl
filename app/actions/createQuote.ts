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

        const isDirect = state.serviceType === 'direct' || state.dispenser === 'desechable';
        const resendKey = process.env.RESEND_API_KEY;
        const fullQuote = {
            ...createResult.quote,
            quote_items: createResult.quoteItems ?? []
        };

        // ─── 5. Sincronización proactiva con Google Contacts ─────────────────
        // Sincronizamos el contacto siempre, ya que es nuestra base de datos CRM (People API)
        try {
            if (isDirect) {
                // Para venta directa, lo marcamos como confirmado de una vez en los contactos
                await GoogleSyncService.updateContactConfirmedStatus(fullQuote as any);
            } else {
                // Para eventos, se sincroniza como borrador inicial
                await GoogleSyncService.syncContactForQuote(state, createResult.token, clientId ?? undefined);
            }
        } catch (e) {
            console.error('Google Contact Sync failed:', e);
        }

        // ─── 6. Automatizaciones reactivas (SOLO SI NO ES ADMIN) ────────────────────────
        // Estas acciones disparan procesos externos "visibles" como emails o eventos de calendario
        if (!isAdmin) {
            if (isDirect) {
                // Calendar Sync (Solo Public Wizard)
                try {
                    const calResult = await GoogleSyncService.scheduleCalendarEvents(fullQuote as any);
                    
                    if (calResult.eventId || calResult.pickupEventId) {
                        const { createServerClient } = await import('@/lib/supabaseServer');
                        const dbServer = createServerClient();
                        await dbServer.from('quotes').update({
                            google_event_id: calResult.eventId,
                            google_pickup_event_id: calResult.pickupEventId
                        }).eq('id', fullQuote.id);
                    }
                } catch (syncErr) {
                    console.error('Error in Google Calendar Sync for Direct Sale during createQuote:', syncErr);
                }
            }

            if (!skipEmail && resendKey && state.contact.email && createResult.quoteItems) {
                try {
                    const resend = new Resend(resendKey);

                    const isDirectSale = state.serviceType === 'direct' || state.dispenser === 'desechable';
                    let EmailComponent;
                    
                    if (isDirectSale) {
                        EmailComponent = (await import('@/components/emails/ConfirmationEmail')).default;
                    } else {
                        EmailComponent = (await import('@/components/emails/QuoteEmail')).default;
                    }

                    const eventDate = fullQuote.event_date
                        ? new Date(fullQuote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                        : '';
                    const fullName = `${fullQuote.client_name} ${fullQuote.client_lastname || ''}`.trim();

                    const emailVars = {
                        full_name: fullName,
                        event_date: eventDate
                    };

                    const [clientHtml, adminHtml, clientSubject, adminSubject] = await Promise.all([
                        render(React.createElement(EmailComponent, { quote: fullQuote, isAdmin: false })),
                        render(React.createElement(EmailComponent, { quote: fullQuote, isAdmin: true })),
                        SettingsService.getResolvedValue(
                            isDirectSale ? 'email_direct_sale_subject' : 'email_quote_draft_subject',
                            emailVars,
                            isDirectSale ? `✅ Tu pedido ha sido confirmado – ${eventDate}` : `🍸 Tu cotización – ${eventDate}`
                        ),
                        SettingsService.getResolvedValue(
                            isDirectSale ? 'email_direct_sale_admin_subject' : 'email_quote_draft_admin_subject',
                            emailVars,
                            isDirectSale ? `[Pedido Confirmado] ${fullName} – ${eventDate}` : `[Nueva Cotización] ${fullName} – ${eventDate}`
                        )
                    ]);

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
        }

        return { success: true, token: createResult.token, quoteId: createResult.quote.id };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
