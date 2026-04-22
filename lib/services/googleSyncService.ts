import { syncGoogleContact, syncGoogleEvent, CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID, CALENDAR_DESECHABLE_ID } from '@/lib/googleSync';
import { SITE_URL } from '@/lib/config';
import type { WizardState, Quote } from '@/lib/types';
import { QuoteService } from './quoteService';
import { calculateMaxPickupDate } from '@/lib/wizardLogic';
import { createServerClient } from '@/lib/supabaseServer';
import { SettingsService } from './settingsService';

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
             const street = state.contact.address.trim();
             const isAddressComplete = street.length > 0 && /[a-zA-Z]/.test(street);

             const googleContactId = await syncGoogleContact({
                 resourceName: clientData?.google_contact_id || undefined, // USAR ID EXISTENTE SI DISPONIBLE
                 firstName: state.contact.firstName.trim(),
                 lastName: state.contact.lastName?.trim() || undefined,
                 email: emailTrimmed,
                 phone: phoneToSend,
                 address: isAddressComplete ? fullAddress : undefined,
                 notes: state.contact.comments?.trim() || undefined,
                 eventDate: state.eventData.date,
                 quoteUrl: quoteUrl,
                 confirmed: false,
                 noteLabel: await SettingsService.getResolvedValue(
                     'google_contacts_note_draft_template',
                     { date_formatted: state.eventData.date?.split('-').reverse().join('/') || 'S/F', quote_url: quoteUrl },
                     'Evento'
                 )
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

             const street = quote.client_address?.trim() || '';
             const isAddressComplete = street.length > 0 && /[a-zA-Z]/.test(street);

             const googleContactId = await syncGoogleContact({
                 resourceName: googleId || undefined,
                 firstName: quote.client_name,
                 lastName: quote.client_lastname || undefined,
                 email: quote.client_email || undefined,
                 phone: quote.client_phone || undefined,
                 address: isAddressComplete ? fullAddress : undefined,
                 notes: quote.comments || undefined,
                 eventDate: quote.event_date,
                 quoteUrl: quoteUrl,
                 confirmed: true,
                 noteLabel: await SettingsService.getResolvedValue(
                     quote.service_type === 'direct' ? 'google_contacts_direct_sale_note_confirmed_template' : 'google_contacts_note_confirmed_template',
                     { date_formatted: quote.event_date?.split('-').reverse().join('/') || 'S/F', quote_url: quoteUrl },
                     quote.service_type === 'direct' ? 'Pedido Directo (Confirmado)' : 'Evento (Confirmado)'
                 )
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
     * Returns the created event IDs for persistence in the database.
     */
    async scheduleCalendarEvents(quote: Quote, options?: { updateEventId?: string; updatePickupEventId?: string }): Promise<{ eventId?: string; pickupEventId?: string }> {
        try {
            const fullName = `${quote.client_name} ${quote.client_lastname || ''}`.trim();
            const comunaStr = quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name;
            const fullLocation = `${quote.client_address || ''}, ${comunaStr || ''}`.trim();
            const link = `${SITE_URL}/cotizar/${quote.token}`;

            // Formatting currency helper for the description
            const formatClp = (amount: number) => 
                new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);

            // Generar la lista limpia de productos y totales para ambas descripciones
            const itemsText = quote.quote_items?.map(item => 
                `${item.size} ${item.product_name} (x${item.quantity}) ${formatClp(item.offer_price_at_time * item.quantity)}`
            ).join('\n') || 'Sin productos';

            const dispenserLabel = quote.dispenser === 'muro' ? 'Muro' : 'Portátil';
            
            const commentsText = quote.comments ? `Comentarios: ${quote.comments}\n` : '';

            // Resumen de pagos
            const payments = quote.payments || [];
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalPending = (quote.total_price || 0) - totalPaid;

            const paymentsSummary = payments.length > 0 
                ? `\nREGISTRO DE PAGOS:\n` + 
                  payments.map((p) => `- ${new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL')}: ${formatClp(p.amount)} (${p.note || 'Pago'})`).join('\n') +
                  `\nSaldo Pendiente: ${formatClp(totalPending < 0 ? 0 : totalPending)}`
                : `\nREGISTRO DE PAGOS:\nSaldo Pendiente: ${formatClp(quote.total_price || 0)}`;
            

            const formatDate = (dateStr: string) => 
                dateStr ? dateStr.split('-').reverse().join('/') : '';

            const variables = {
                full_name: fullName,
                guests: quote.guests,
                phone: quote.client_phone || '',
                email: quote.client_email || '',
                link: link,
                comments: commentsText,
                items_list: itemsText,
                shipping_cost: formatClp(quote.shipping_cost || 0),
                dispenser_label: dispenserLabel,
                installation_cost: formatClp(quote.installation_cost || 0),
                total_price: formatClp(quote.total_price || 0),
                payments_summary: paymentsSummary,
                // NUEVAS VARIABLES SOLICITADAS:
                event_date: formatDate(quote.event_date || ''),
                pickup_date: formatDate(quote.pickup_date || ''),
                start_time: quote.start_time || 'Sin definir',
                pickup_time: quote.pickup_time || 'Sin definir',
                event_type: quote.event_type_id === 'Otro' ? quote.event_type_other : quote.event_type_id,
                comuna: comunaStr || '',
                address: quote.client_address || '',
                total_liters: quote.total_liters || '0',
            };

            const isDirectSale = quote.service_type === 'direct';
            
            // Si es venta directa (por tipo de servicio o por dispensador), usamos el calendario de desechables
            const targetCalendarId = isDirectSale ? (CALENDAR_DESECHABLE_ID || CALENDAR_RESERVA_ID) : CALENDAR_RESERVA_ID;
            
            const sharedDescription = await SettingsService.getResolvedValue(
                isDirectSale ? 'calendar_direct_sale_description_template' : 'calendar_event_description_template', 
                variables,
                `${commentsText}Celular: ${quote.client_phone || ''}\nVer Cotización: ${link}\n\nPRODUCTOS:\n${itemsText}\nTransporte: ${formatClp(quote.shipping_cost || 0)}\nInstalación (${dispenserLabel}): ${formatClp(quote.installation_cost || 0)}\nTotal: ${formatClp(quote.total_price || 0)}\n${paymentsSummary}`
            );

            // Determine if times are provided, else fallback to ALL DAY events.
            const hasStartTime = quote.start_time && quote.start_time !== '--:--';
            const hasPickupTime = quote.pickup_time && quote.pickup_time !== '--:--';
            let eventId = options?.updateEventId || quote.google_event_id || undefined;
            let pickupEventId = options?.updatePickupEventId || quote.google_pickup_event_id || undefined;

            // 1. Create Service/Delivery Event
            if (targetCalendarId && quote.event_date) {
                const serviceSummary = await SettingsService.getResolvedValue(
                    isDirectSale ? 'calendar_direct_sale_summary_template' : 'calendar_event_summary_template',
                    variables,
                    isDirectSale ? `Pedido Directo - ${fullName}` : `Cócteles - ${fullName} ${quote.guests}px`
                );
                
                let startISO, endISO, isAllDay;

                // Para directos/desechables siempre es todo el día por defecto (o según lógica de negocio)
                if (!isDirectSale && hasStartTime) {
                    startISO = formatLiteral(quote.event_date, quote.start_time as string);
                    
                    const startDateObj = new Date(startISO);
                    startDateObj.setHours(startDateObj.getHours() + 3);
                    endISO = new Date(startDateObj.getTime() - (startDateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
                    
                    isAllDay = false;
                } else {
                    startISO = `${quote.event_date}`;
                    endISO = startISO;
                    isAllDay = true;
                }

                const created = await syncGoogleEvent(targetCalendarId, {
                    eventId: eventId || undefined, 
                    summary: serviceSummary,
                    location: fullLocation,
                    description: sharedDescription,
                    startISO,
                    endISO,
                    isAllDay,
                    attendees: quote.client_email ? [quote.client_email] : []
                });
                eventId = created?.id || undefined;
            }

            // 2. Create Pickup Event (SOLO SI NO ES VENTA DIRECTA)
            if (!isDirectSale && CALENDAR_RETIRO_ID && quote.pickup_date) {
                const pickupSummary = await SettingsService.getResolvedValue(
                    'calendar_pickup_summary_template',
                    variables,
                    `Retiro - ${fullName}`
                );
                
                let pStartISO, pEndISO, pIsAllDay;

                if (hasPickupTime) {
                    const timeValue = (quote.pickup_time as string);
                    
                    if (timeValue.includes(' a ')) {
                        // Rango específico (12:00 a 14:00)
                        const [startPart, endPart] = timeValue.split(' a ');
                        pStartISO = formatLiteral(quote.pickup_date, startPart.trim());
                        pEndISO = formatLiteral(quote.pickup_date, endPart.trim());
                    } else {
                        // Fallback original (+1h)
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

                const createdPickup = await syncGoogleEvent(CALENDAR_RETIRO_ID, {
                    eventId: pickupEventId || undefined,
                    summary: pickupSummary,
                    location: fullLocation,
                    description: sharedDescription,
                    startISO: pStartISO,
                    endISO: pEndISO,
                    isAllDay: pIsAllDay
                });
                pickupEventId = createdPickup?.id || undefined;
            }

            return { eventId, pickupEventId };

        } catch (error: any) {
            console.error('GoogleSyncService - Error in scheduleCalendarEvents:', error);
            throw error; // Lanzar para que el Dashboard lo capture
        }
    }
}
