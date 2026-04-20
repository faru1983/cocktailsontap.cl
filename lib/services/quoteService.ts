import { createServerClient } from '@/lib/supabaseServer';
import type { WizardState, CocktailForWizard, Comuna, Quote, QuoteItem } from '@/lib/types';
import { calculateSummaryData } from '@/lib/wizardLogic';

interface CreateQuoteResult {
    success: boolean;
    token?: string;
    error?: string;
    clientId?: string;
    quote?: Quote;
    quoteItems?: QuoteItem[];
}

/**
 * Service to handle all database transactions related to Quotes.
 * Separates DB logic from Next.js Server Actions.
 */
export const QuoteService = {
    /**
     * Upserts a client based on their email.
     */
    async upsertClient(state: WizardState): Promise<string | null> {
        const db = createServerClient();
        const emailTrimmed = state.contact.email.trim().toLowerCase();

        if (!emailTrimmed) return null;

        const { data: existingClient } = await db
            .from('clients')
            .select('id, first_name, last_name, phone')
            .eq('email', emailTrimmed)
            .single();

        const clientUpdate: any = {
            email: emailTrimmed,
            first_name: state.contact.firstName.trim() || existingClient?.first_name,
            last_name: state.contact.lastName?.trim() || existingClient?.last_name || null,
            phone: state.contact.phone.trim() || existingClient?.phone || null,
        };

        const { data: clientData, error } = await db
            .from('clients')
            .upsert(clientUpdate, { onConflict: 'email' })
            .select('id')
            .single();

        if (error || !clientData) {
            console.error('Error in upsertClient:', error);
            return null;
        }

        return clientData.id;
    },

    /**
     * Updates the google_contact_id for a given client.
     */
    async updateClientGoogleId(clientId: string, googleContactId: string): Promise<void> {
        const db = createServerClient();
        await db.from('clients').update({ google_contact_id: googleContactId }).eq('id', clientId);
    },

    /**
     * Creates a new quote and locks in the prices.
     */
    async createDraftQuote(
        state: WizardState,
        cocktails: CocktailForWizard[],
        comunas: Comuna[],
        clientId: string | null,
        overrides?: { shippingCost?: number; installationCost?: number; manualDiscount?: number }
    ): Promise<CreateQuoteResult> {
        const db = createServerClient();
        const data = calculateSummaryData(state, cocktails, comunas);

        const finalShipping = overrides?.shippingCost !== undefined ? overrides.shippingCost : data.shippingCost;
        const finalInstallation = overrides?.installationCost !== undefined ? overrides.installationCost : data.installationCost;
        const finalDiscount = overrides?.manualDiscount !== undefined ? overrides.manualDiscount : 0;
        
        const finalTotalPrice = data.totalOfferPrice + finalShipping + finalInstallation - finalDiscount;

        const emailTrimmed = state.contact.email.trim().toLowerCase();

        // Insert quote
        const { data: quote, error: quoteError } = await db
            .from('quotes')
            .insert({
                status: state.dispenser === 'desechable' ? 'confirmed' : 'draft',
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
                shipping_cost: finalShipping,
                installation_cost: finalInstallation,
                manual_discount: finalDiscount,
                total_price: finalTotalPrice,
                total_liters: data.totalLiters,
                service_type: state.serviceType || (state.dispenser === 'desechable' ? 'direct' : 'event'),
            })
            .select('*')
            .single();

        if (quoteError || !quote) {
            console.error('Error during quote insert:', quoteError);
            return { success: false, error: 'No se pudo guardar la cotización.' };
        }

        // Insert quote items
        const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));
        const itemsToInsert = state.selections.map((sel) => {
            const cocktail = cocktailsById.get(sel.id);
            const priceData = cocktail?.prices[sel.size] ?? { price: 0, offerPrice: 0, sizeValue: 0, unitId: null, isDisposable: false };
            return {
                quote_id: quote.id,
                product_id: sel.id,
                product_name: cocktail?.name ?? 'Producto desconocido',
                size: sel.size,
                size_value: priceData.sizeValue,
                unit_id: priceData.unitId,
                is_disposable: priceData.isDisposable,
                quantity: sel.quantity,
                price_at_time: priceData.price,
                offer_price_at_time: sel.customPrice !== undefined ? sel.customPrice : priceData.offerPrice,
            };
        });

        let insertedItems: QuoteItem[] = [];
        if (itemsToInsert.length > 0) {
            const { data: items, error: itemsError } = await db
                .from('quote_items')
                .insert(itemsToInsert)
                .select('*');
            
            if (itemsError) {
                console.error('Error inserting quote items:', itemsError);
            } else if (items) {
                insertedItems = items;
            }
        }

        return { 
            success: true, 
             token: quote.token,
             clientId: clientId || undefined,
             quote: quote,
             quoteItems: insertedItems
        };
    },

    /**
     * Confirms a quote and updates its status.
     */
    async confirmQuote(token: string): Promise<{ success: boolean; quote?: Quote & { quote_items: QuoteItem[] }; error?: string }> {
         const db = createServerClient();
         
         const { data: quote, error: fetchError } = await db
            .from('quotes')
            .select('*, quote_items(*)')
            .eq('token', token)
            .single();

        if (fetchError || !quote) {
            return { success: false, error: 'Cotización no encontrada.' };
        }
        
        if (quote.status === 'confirmed') {
            return { success: false, error: 'Esta cotización ya fue confirmada anteriormente.' };
        }

        const { error: updateError } = await db
            .from('quotes')
            .update({ status: 'confirmed', updated_at: new Date().toISOString() })
            .eq('id', quote.id);

        if (updateError) {
             console.error('Error updating quote status:', updateError);
             return { success: false, error: 'No se pudo confirmar la cotización.' };
        }

        return { success: true, quote };
    }
};
