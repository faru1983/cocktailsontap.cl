'use server';

import { createServerClient } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import { buildQuoteCreatedClientEmail, buildAdminNotificationEmail } from '@/lib/emails';
import type { WizardState, WizardSelection, Quote, QuoteItem } from '@/lib/types';
import type { CocktailForWizard, Comuna } from '@/lib/types';
import { calculateSummaryData } from '@/lib/wizardLogic';
import { SITE_URL } from '@/lib/config';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'contacto@cocktailsontap.cl';
const FROM_EMAIL = 'Cocktails on Tap <no-reply@cocktailsontap.cl>';

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
    const { state, cocktails, comunas } = input;

    try {
        const db = createServerClient();
        const data = calculateSummaryData(state, cocktails, comunas);

        // ─── 1. Insertar la cotización ─────────────────────────────────────────
        const { data: quote, error: quoteError } = await db
            .from('quotes')
            .insert({
                status: 'draft',
                client_name: state.contact.firstName.trim(),
                client_email: state.contact.email.trim() || null,
                client_phone: state.contact.phone.trim() || null,
                client_address: state.contact.address.trim() || null,
                comments: state.contact.comments.trim() || null,

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

        // ─── 2. Insertar los items con precios congelados ─────────────────────
        const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

        const items = state.selections.map((sel: WizardSelection) => {
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
                // No bloqueamos el flujo, la cotización ya fue creada
            }
        }

        // ─── 3. Enviar emails (si Resend está configurado) ────────────────────
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && state.contact.email) {
            try {
                const resend = new Resend(resendKey);

                // Reconstruir quote completo para los emails
                const fullQuote: Quote & { quote_items: QuoteItem[] } = {
                    id: quote.id,
                    token: quote.token,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'draft',
                    client_name: state.contact.firstName,
                    client_email: state.contact.email || null,
                    client_phone: state.contact.phone || null,
                    client_address: state.contact.address || null,
                    comments: state.contact.comments || null,
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
                // No bloqueamos el flujo por fallo de email
            }
        }

        return { success: true, token: quote.token };
    } catch (err) {
        console.error('Error inesperado en createQuote:', err);
        return { success: false, error: 'Error inesperado. Por favor intenta nuevamente.' };
    }
}
