import { syncGoogleContact, createGoogleEvent, CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID } from '@/lib/googleSync';
import { SITE_URL } from '@/lib/config';
import type { WizardState, Quote } from '@/lib/types';
import { QuoteService } from './quoteService';
import { calculateMaxPickupDate } from '@/lib/wizardLogic';

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

             const comunaStr = state.contact.comuna === 'Otra' ? state.contact.otherComuna : state.contact.comuna;
             const fullAddress = [state.contact.address.trim(), comunaStr].filter(Boolean).join(', ');
             const quoteUrl = `${SITE_URL}/cotizar/${quoteToken}`;

             const googleContactId = await syncGoogleContact({
                 firstName: state.contact.firstName.trim(),
                 lastName: state.contact.lastName?.trim() || undefined,
                 email: emailTrimmed,
                 phone: state.contact.phone.trim() || undefined,
                 address: state.contact.address.trim() ? fullAddress : undefined,
                 notes: state.contact.comments?.trim() || undefined,
                 eventDate: state.eventData.date,
                 quoteUrl: quoteUrl,
                 confirmed: false
             });

             if (googleContactId) {
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
             
             await syncGoogleContact({
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
            const link = `${SITE_URL}/cotizar/${quote.token}`;

            // Determine if times are provided, else fallback to ALL DAY events.
            const hasStartTime = quote.start_time && quote.start_time !== '--:--';
            const hasPickupTime = quote.pickup_time && quote.pickup_time !== '--:--';

            // 1. Create Service Event (Reserva Calendar)
            if (CALENDAR_RESERVA_ID && quote.event_date) {
                const serviceSummary = `Cócteles - ${quote.client_name} ${quote.guests}px`;
                const serviceDescription = `📱 Celular: ${quote.client_phone || 'No especificado'}\n` +
                                           `🔗 Cotización: ${link}\n` +
                                           `✍️ Notas: ${quote.comments || 'Sin comentarios'}\n` +
                                           `👥 Invitados: ${quote.guests}\n` +
                                           `🥃 Litros Totales: ${quote.total_liters}L\n\n` +
                                           `Tipo Evento: ${quote.event_type_other || quote.event_type_id || 'No esp.'}\n` +
                                           `Dispensador: ${quote.dispenser === 'muro' ? 'Muro' : 'Portátil'}\n`;
                
                let startISO, endISO, isAllDay;

                if (hasStartTime) {
                     startISO = formatLiteral(quote.event_date, quote.start_time as string);
                     // Approximation: event lasts 4 hours.
                     const startDateObj = new Date(startISO);
                     startDateObj.setHours(startDateObj.getHours() + 4);
                     // Format end date to YYYY-MM-DDTHH:mm:ss ignoring timezone shift
                     endISO = new Date(startDateObj.getTime() - (startDateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
                     isAllDay = false;
                } else {
                     startISO = `${quote.event_date}`;
                     endISO = startISO;
                     isAllDay = true;
                }

                await createGoogleEvent(CALENDAR_RESERVA_ID, {
                    summary: serviceSummary,
                    location: `${quote.client_address || ''}, ${comunaStr || ''}`.trim(),
                    description: serviceDescription,
                    startISO,
                    endISO,
                    isAllDay
                });
            }

            // 2. Create Pickup Event (Retiro Calendar)
            if (CALENDAR_RETIRO_ID && quote.pickup_date) {
               const pickupSummary = `Retiro - ${fullName}`;
               const pickupDesc = `📱 Celular: ${quote.client_phone || 'No especificado'}\n` +
                                  `🔗 Cotización: ${link}\n`;
                
               let pStartISO, pEndISO, pIsAllDay;

               if (hasPickupTime) {
                    pStartISO = formatLiteral(quote.pickup_date, quote.pickup_time as string);
                    const pickupStartObj = new Date(pStartISO);
                    pickupStartObj.setHours(pickupStartObj.getHours() + 1); // 1 hr window
                    pEndISO = new Date(pickupStartObj.getTime() - (pickupStartObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
                    pIsAllDay = false;
               } else {
                    pStartISO = `${quote.pickup_date}`;
                    pEndISO = pStartISO; // All day
                    pIsAllDay = true;
               }

               await createGoogleEvent(CALENDAR_RETIRO_ID, {
                   summary: pickupSummary,
                   location: `${quote.client_address || ''}, ${comunaStr || ''}`.trim(),
                   description: pickupDesc,
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
