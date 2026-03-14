'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import { buildQuoteCreatedClientEmail, buildAdminNotificationEmail } from '@/lib/emails';
import { CreateQuoteSchema } from '@/lib/types';
import type { WizardState, Quote, QuoteItem, CocktailForWizard, Comuna } from '@/lib/types';
import { calculateSummaryData } from '@/lib/wizardLogic';
import { ADMIN_EMAIL, FROM_EMAIL } from '@/lib/config';

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
        const db = createServerClient();
        const data = calculateSummaryData(state, cocktails, comunas);

        // ─── 2. Upsert Cliente (CRM) ──────────────────────────────────────────
        let clientId: string | null = null;
        const emailTrimmed = state.contact.email.trim().toLowerCase();

        if (emailTrimmed) {
            const { data: clientData, error: clientError } = await db
                .from('clients')
                .upsert({
                    email: emailTrimmed,
                    first_name: state.contact.firstName.trim(),
                    last_name: state.contact.lastName?.trim() || null,
                    phone: state.contact.phone.trim() || null,
                }, { onConflict: 'email' })
                .select('id')
                .single();

            if (!clientError && clientData) {
                clientId = clientData.id;
            } else {
                console.error('Error gestionando cliente:', clientError);
            }
        }

        // ─── 3. Insertar la cotización ─────────────────────────────────────────
        const { data: quote, error: quoteError } = await db
            .from('quotes')
            .insert({
                status: 'draft',
                client_id: clientId,
                client_name: state.contact.firstName.trim(),
                client_lastname: state.contact.lastName?.trim() || null,
                client_email: emailTrimmed || null,
                client_phone: state.contact.phone.trim() || null,
                client_address: state.contact.address.trim() || null,
                comments: state.contact.comments?.trim() || null,

                event_type_id: state.eventData.type === 'Otro' ? null : state.eventData.type || null,
                event_type_other: state.eventData.type === 'Otro' ? state.eventData.otherType : null,
                event_date: state.eventData.date,
                start_time: state.eventData.startTime || null,
                pickup_date: state.eventData.pickupDate || null,
                pickup_time: state.eventData.pickupTime || null,

                comuna_name: state.contact.comuna || null,
                comuna_other: state.contact.otherComuna || null,

                guests: state.consumption.guests,
                drinks_per_person: state.consumption.drinksPerPerson,
                dispenser: state.dispenser,

                total_normal_price: data.totalNormalPrice,
                total_offer_price: data.totalOfferPrice,
                shipping_cost: data.shippingCost,
                installation_cost: data.installationCost,
                total_price: data.totalPrice,
                total_liters: data.totalLiters,
            })
            .select('id, token')
            .single();

        if (quoteError || !quote) {
            console.error('Error creando cotización:', quoteError);
            return { success: false, error: 'No se pudo guardar la cotización. Intenta nuevamente.' };
        }

        // ─── 4. Insertar los items con precios congelados ─────────────────────
        const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

        const items = state.selections.map((sel) => {
            const cocktail = cocktailsById.get(sel.id);
            const priceData = cocktail?.prices[sel.size] ?? { price: 0, offerPrice: 0 };
            return {
                quote_id: quote.id,
                product_id: sel.id,
                product_name: cocktail?.name ?? 'Producto desconocido',
                size: sel.size,
                quantity: sel.quantity,
                price_at_time: priceData.price,
                offer_price_at_time: priceData.offerPrice,
            };
        });

        if (items.length > 0) {
            const { error: itemsError } = await db.from('quote_items').insert(items);
            if (itemsError) {
                console.error('Error insertando items:', itemsError);
            }
        }

        // ─── 5. Enviar emails ─────────────────────────────────────────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && state.contact.email) {
            try {
                const resend = new Resend(resendKey);

                // Reconstruir objeto quote para plantillas
                const fullQuote: Quote & { quote_items: QuoteItem[] } = {
                    id: quote.id,
                    token: quote.token,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'draft',
                    client_name: state.contact.firstName,
                    client_lastname: state.contact.lastName || null,
                    client_email: state.contact.email || null,
                    client_phone: state.contact.phone || null,
                    client_address: state.contact.address || null,
                    comments: state.contact.comments || null,
                    event_type_id: state.eventData.type === 'Otro' ? null : state.eventData.type || null,
                    event_type_other: state.eventData.type === 'Otro' ? (state.eventData.otherType || null) : null,
                    event_date: state.eventData.date,
                    start_time: state.eventData.startTime || null,
                    pickup_date: state.eventData.pickupDate || null,
                    pickup_time: state.eventData.pickupTime || null,
                    comuna_name: state.contact.comuna || null,
                    comuna_other: state.contact.otherComuna || null,
                    guests: state.consumption.guests,
                    drinks_per_person: state.consumption.drinksPerPerson,
                    dispenser: state.dispenser,
                    total_normal_price: data.totalNormalPrice,
                    total_offer_price: data.totalOfferPrice,
                    shipping_cost: data.shippingCost,
                    installation_cost: data.installationCost,
                    total_price: data.totalPrice,
                    total_liters: data.totalLiters,
                    client_id: clientId,
                    quote_items: items.map((item, i) => ({
                        id: String(i),
                        quote_id: quote.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        size: item.size,
                        quantity: item.quantity,
                        price_at_time: item.price_at_time,
                        offer_price_at_time: item.offer_price_at_time,
                    })),
                };

                const clientEmail = buildQuoteCreatedClientEmail(fullQuote);
                const adminEmail = buildAdminNotificationEmail(fullQuote);

                await Promise.allSettled([
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: state.contact.email,
                        subject: clientEmail.subject,
                        html: clientEmail.html,
                    }),
                    resend.emails.send({
                        from: FROM_EMAIL,
                        to: ADMIN_EMAIL,
                        subject: adminEmail.subject,
                        html: adminEmail.html,
                    }),
                ]);
            } catch (emailErr) {
                console.error('Error enviando emails:', emailErr);
            }
        }

        return { success: true, token: quote.token };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Intenta nuevamente.' };
    }
}
