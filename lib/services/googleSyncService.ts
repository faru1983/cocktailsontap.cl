import { syncGoogleContact, createGoogleEvent, CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID } from '@/lib/googleSync';
import { SITE_URL } from '@/lib/config';
import type { WizardState, Quote } from '@/lib/types';
import { QuoteService } from './quoteService';
import { calculateMaxPickupDate } from '@/lib/wizardLogic';
import { createServerClient } from '@/lib/supabaseServer';

function formatLiteral(dateStr: string, timeStr: string): string {
    return `${dateStr}T${timeStr}:00`;
}

/**
 * Service to orchestrate complex Google API workflows.
 * Extracts integration logic out of Server Actions.
 */
export const GoogleSyncService = {
    /**
     * Syncs a quote's client to Google Contacts. Safe to fail (non-blocking).
     */
    async syncContactForQuote(state: WizardState, quoteToken: string, clientId?: string): Promise<void> {
        try {
            const emailTrimmed = state.contact.email.trim().toLowerCase();
            if (!emailTrimmed || !clientId) return;

             // Logica de De-duplicación: Buscar google_contact_id en la DB primero
             const db = createServerClient();
             const { data: clientData } = await db.from('clients').select('google_contact_id').eq('id', clientId).single();

             const comunaStr = state.contact.comuna === 'Otra' ? state.contact.otherComuna : state.contact.comuna;
             const fullAddress = [state.contact.address.trim(), comunaStr].filter(Boolean).join(', ');
             const quoteUrl = `${SITE_URL}/cotizar/${quoteToken}`;

             const rawPhone = state.contact.phone.trim();
             const phoneToSend = (rawPhone === '+569' || rawPhone === '+56 9' || rawPhone === '') ? undefined : rawPhone;

             const googleContactId = await syncGoogleContact({
                 resourceName: clientData?.google_contact_id || undefined, // USAR ID EXISTENTE SI DISPONIBLE
                 firstName: state.contact.firstName.trim(),
                 lastName: state.contact.lastName?.trim() || undefined,
                 email: emailTrimmed,
                 phone: phoneToSend,
                 address: state.contact.address.trim() ? fullAddress : undefined,
                 notes: state.contact.comments?.trim() || undefined,
                 eventDate: state.eventData.date,
                 quoteUrl: quoteUrl,
                 confirmed: false
             });

             if (googleContactId && googleContactId !== clientData?.google_contact_id) {
                await QuoteService.updateClientGoogleId(clientId, googleContactId);
             }
        } catch (error) {
             console.error('GoogleSyncService - Error in syncContactForQuote:', error);
        }
    },
    
    /**
     * Updates an existing contact reflecting a confirmed status.
     */
    async updateContactConfirmedStatus(quote: Quote): Promise<void> {
        if (!quote.client_email) return;
        try {
             const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
             const comunaDisplay = quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name;
             const fullAddress = [quote.client_address, comunaDisplay].filter(Boolean).join(', ');
             
             // Buscar ID de Google si existe en la base de datos para este cliente
             const db = createServerClient();
             let googleId = undefined;
             if (quote.client_id) {
                 const { data } = await db.from('clients').select('google_contact_id').eq('id', quote.client_id).single();
                 googleId = data?.google_contact_id;
             }

             const googleContactId = await syncGoogleContact({
                 resourceName: googleId || undefined,
                 firstName: quote.client_name,
                 lastName: quote.client_lastname || undefined,
                 email: quote.client_email,
                 phone: quote.client_phone || undefined,
                 address: fullAddress,
                 notes: quote.comments || undefined,
                 eventDate: quote.event_date,
                 quoteUrl: quoteUrl,
                 confirmed: true
             });

             // Si es un contacto nuevo que no teniamos el ID, guardarlo
             if (googleContactId && quote.client_id && googleContactId !== googleId) {
                 await QuoteService.updateClientGoogleId(quote.client_id, googleContactId);
             }
        } catch (error) {
             console.error('GoogleSyncService - Error in updateContactConfirmedStatus:', error);
        }
    },

    /**
     * Creates Google Calendar events for a confirmed quote.
     */
    async scheduleCalendarEvents(quote: Quote): Promise<void> {
        try {
            const fullName = `${quote.client_name} ${quote.client_lastname || ''}`.trim();
            const comunaStr = quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name;
            const fullLocation = `${quote.client_address || ''}, ${comunaStr || ''}`.trim();
            const link = `${SITE_URL}/cotizar/${quote.token}`;

            // Formatting currency helper for the description
            const formatClp = (amount: number) => 
                new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

            // Generar la lista limpia de productos y totales para ambas descripciones
            let itemsText = quote.quote_items?.map(item => 
                `${item.size} ${item.product_name} (x${item.quantity}) ${formatClp(item.offer_price_at_time * item.quantity)}`
            ).join('\n') || 'Sin productos';

            const dispenserLabel = quote.dispenser === 'muro' ? 'Muro' : 'Portátil';
            
            const sharedDescription = `Celular: ${quote.client_phone || ''}\n` +
                                      `Ver Cotización: ${link}\n\n` +
                                      `Productos:\n${itemsText}\n` +
                                      `Transporte: ${formatClp(quote.shipping_cost || 0)}\n` +
                                      `Dispensador ${dispenserLabel}: ${formatClp(quote.installation_cost || 0)}\n` +
                                      `Total: ${formatClp(quote.total_price || 0)}`;

            // Determine if times are provided, else fallback to ALL DAY events.
            const hasStartTime = quote.start_time && quote.start_time !== '--:--';
            const hasPickupTime = quote.pickup_time && quote.pickup_time !== '--:--';

            // 1. Create Service Event (Reserva Calendar)
            if (CALENDAR_RESERVA_ID && quote.event_date) {
                const serviceSummary = `Cócteles - ${fullName} ${quote.guests}px`;
                
                let startISO, endISO, isAllDay;

                if (hasStartTime) {
                     startISO = formatLiteral(quote.event_date, quote.start_time as string);
                     // USER REQUEST: Duración del evento de reserva = 0.
                     endISO = startISO;
                     isAllDay = false;
                } else {
                     startISO = `${quote.event_date}`;
                     endISO = startISO;
                     isAllDay = true;
                }

                await createGoogleEvent(CALENDAR_RESERVA_ID, {
                    summary: serviceSummary,
                    location: fullLocation,
                    description: sharedDescription,
                    startISO,
                    endISO,
                    isAllDay
                });
            }

            // 2. Create Pickup Event (Retiro Calendar)
            if (CALENDAR_RETIRO_ID && quote.pickup_date) {
               const pickupSummary = `Retiro - ${fullName}`;
               
               const pickupDescriptionWithAddress = `Dirección: ${fullLocation}\n\n${sharedDescription}`;
                
               let pStartISO, pEndISO, pIsAllDay;

               if (hasPickupTime) {
                    const timeValue = (quote.pickup_time as string);
                    
                    if (timeValue.includes(' a ')) {
                        // USER REQUEST: Si es un rango (12:00 a 14:00), inicio 12:00, fin 14:00
                        const [startPart, endPart] = timeValue.split(' a ');
                        pStartISO = formatLiteral(quote.pickup_date, startPart.trim());
                        pEndISO = formatLiteral(quote.pickup_date, endPart.trim());
                    } else {
                        // Lógica original de fallback por si no es un rango
                        pStartISO = formatLiteral(quote.pickup_date, timeValue);
                        const pickupStartObj = new Date(pStartISO);
                        pickupStartObj.setHours(pickupStartObj.getHours() + 1); 
                        pEndISO = new Date(pickupStartObj.getTime() - (pickupStartObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
                    }
                    pIsAllDay = false;
               } else {
                    pStartISO = `${quote.pickup_date}`;
                    pEndISO = pStartISO; // All day
                    pIsAllDay = true;
               }

               await createGoogleEvent(CALENDAR_RETIRO_ID, {
                   summary: pickupSummary,
                   location: fullLocation,
                   description: pickupDescriptionWithAddress,
                   startISO: pStartISO,
                   endISO: pEndISO,
                   isAllDay: pIsAllDay
               });
            }

        } catch (error) {
            console.error('GoogleSyncService - Error in scheduleCalendarEvents:', error);
        }
    }
}
