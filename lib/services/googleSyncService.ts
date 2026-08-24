import {
    syncGoogleContact,
    syncGoogleEvent,
    deleteGoogleCalendarEvent,
    CALENDAR_RESERVA_ID,
    CALENDAR_RETIRO_ID,
    CALENDAR_DESECHABLE_ID,
} from '@/lib/googleSync';
import { SITE_URL } from '@/lib/config';
import type { WizardState, Quote } from '@/lib/types';
import { QuoteService } from './quoteService';
import { calculateMaxPickupDate } from '@/lib/wizardLogic';
import { formatQuoteAddress, resolveComunaDisplay, stripTrailingComuna } from '@/lib/geo';
import { createServerClient } from '@/lib/supabaseServer';
import { SettingsService } from './settingsService';

function formatLiteral(dateStr: string, timeStr: string): string {
    const cleanTime = timeStr.replace(/[^0-9:]/g, '').trim();
    return `${dateStr}T${cleanTime}:00-04:00`;
}

function getNextDay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

/**
 * Service to orchestrate complex Google API workflows.
 * Extracts integration logic out of Server Actions.
 */
export const GoogleSyncService = {
    /**
     * Syncs a quote's client to Google Contacts. Safe to fail (non-blocking).
     */
    async syncContactForQuote(
        state: WizardState,
        quoteToken: string,
        clientId?: string,
        quoteAddress?: Pick<Quote, 'client_address' | 'comuna_name' | 'comuna_other' | 'region_name'>
    ): Promise<void> {
        try {
            const emailTrimmed = state.contact.email.trim().toLowerCase();
            if (!emailTrimmed || !clientId) return;

             // Logica de De-duplicación: Buscar google_contact_id en la DB primero
             const db = createServerClient();
             const { data: clientData } = await db.from('clients').select('google_contact_id').eq('id', clientId).single();

             const fullAddress = formatQuoteAddress(
                 quoteAddress ?? {
                     client_address: state.contact.address.trim(),
                     comuna_name: state.contact.comuna,
                     comuna_other: state.contact.otherComuna,
                     region_name: state.contact.region,
                 }
             );
             const quoteUrl = `${SITE_URL}/cotizar/${quoteToken}`;

             const rawPhone = state.contact.phone.trim();
             const phoneToSend = (rawPhone === '+56' || rawPhone === '+569' || rawPhone === '+56 9' || rawPhone === '') ? undefined : rawPhone;
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
             const fullAddress = formatQuoteAddress(quote);
             
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
    async scheduleCalendarEvents(quote: Quote, options?: { updateEventId?: string; updatePickupEventId?: string; isDirectSaleOverride?: boolean }): Promise<{ eventId?: string; pickupEventId?: string }> {
        try {
            const fullName = `${quote.client_name} ${quote.client_lastname || ''}`.trim();
            const comunaStr = resolveComunaDisplay(quote.comuna_name, quote.comuna_other);
            const streetAddress = stripTrailingComuna(quote.client_address || '', comunaStr);
            const fullLocation = formatQuoteAddress(quote);
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
                address: streetAddress,
                total_liters: quote.total_liters || '0',
            };

            const isDirectSale = options?.isDirectSaleOverride ?? 
                                (quote.service_type === 'direct' || quote.dispenser === 'desechable');
            
            // Si es venta directa usamos el calendario de desechables. Solo fallback si está vacío pero registrando advertencia clara.
            const targetCalendarId = isDirectSale 
                ? (CALENDAR_DESECHABLE_ID || CALENDAR_RESERVA_ID) 
                : CALENDAR_RESERVA_ID;

            if (isDirectSale && !CALENDAR_DESECHABLE_ID) {
                console.warn(`GoogleSyncService [${quote.id}] - Venta Directa detectada pero GOOGLE_CALENDAR_DESECHABLE_ID no está definido. Usando fallback: ${targetCalendarId}`);
            } else {
                console.log(`GoogleSyncService [${quote.id}] - Sincronizando como ${isDirectSale ? 'VENTA DIRECTA' : 'EVENTO'} en calendario: ${targetCalendarId}`);
            }
            
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

            let startISO: string, endISO: string, isAllDay: boolean;

            // 1. Create Service/Delivery Event
            if (targetCalendarId && quote.event_date) {
                const serviceSummary = await SettingsService.getResolvedValue(
                    isDirectSale ? 'calendar_direct_sale_summary_template' : 'calendar_event_summary_template',
                    variables,
                    isDirectSale ? `Pedido Directo - ${fullName}` : `Cócteles - ${fullName} ${quote.guests}px`
                );
                
                // 1. Reserva de Evento: Duración 0 (Inicio y fin igual)
                if (!isDirectSale && hasStartTime) {
                    const cleanTime = (quote.start_time as string).replace(/[^0-9:]/g, '').trim();
                    startISO = `${quote.event_date}T${cleanTime}:00-04:00`;
                    endISO = startISO; // Duración 0
                    isAllDay = false;
                } else {
                    startISO = quote.event_date;
                    endISO = getNextDay(quote.event_date);
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

                // 2. Retiro de Evento:
                // REGLA: Si es el mismo día que el evento -> Todo el día.
                if (quote.pickup_date === quote.event_date) {
                    pStartISO = quote.pickup_date;
                    pEndISO = getNextDay(quote.pickup_date);
                    pIsAllDay = true;
                } else if (hasPickupTime) {
                    const timeValue = (quote.pickup_time as string);
                    if (timeValue.includes(' a ')) {
                        const [startPart, endPart] = timeValue.split(' a ');
                        pStartISO = formatLiteral(quote.pickup_date, startPart.trim());
                        pEndISO = formatLiteral(quote.pickup_date, endPart.trim());
                    } else {
                        const cleanTime = timeValue.replace(/[^0-9:]/g, '').trim();
                        pStartISO = formatLiteral(quote.pickup_date, cleanTime);
                        pEndISO = pStartISO; // Duración 0 si no hay rango
                    }
                    pIsAllDay = false;
                } else {
                    pStartISO = quote.pickup_date;
                    pEndISO = getNextDay(quote.pickup_date);
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
    },

    /**
     * removeCalendarEventsForQuote: Al cancelar, borra reserva/retiro o venta directa
     * de Google Calendar. No bloquea si Google falla; indica qué IDs se limpiaron.
     */
    async removeCalendarEventsForQuote(quote: {
        id?: string;
        service_type?: string | null;
        dispenser?: string | null;
        google_event_id?: string | null;
        google_pickup_event_id?: string | null;
    }): Promise<{ clearedEventId: boolean; clearedPickupEventId: boolean; error?: string }> {
        const isDirectSale =
            quote.service_type === 'direct' || quote.dispenser === 'desechable';
        const mainCalendarId = isDirectSale
            ? CALENDAR_DESECHABLE_ID || CALENDAR_RESERVA_ID
            : CALENDAR_RESERVA_ID;

        let clearedEventId = false;
        let clearedPickupEventId = false;
        const errors: string[] = [];

        if (quote.google_event_id && mainCalendarId) {
            try {
                await deleteGoogleCalendarEvent(mainCalendarId, quote.google_event_id);
                clearedEventId = true;
            } catch (err: any) {
                // Fallback: venta directa pudo haberse creado en reserva si faltaba DESECHABLE_ID
                if (
                    isDirectSale &&
                    CALENDAR_DESECHABLE_ID &&
                    CALENDAR_RESERVA_ID &&
                    CALENDAR_DESECHABLE_ID !== CALENDAR_RESERVA_ID
                ) {
                    try {
                        await deleteGoogleCalendarEvent(CALENDAR_RESERVA_ID, quote.google_event_id);
                        clearedEventId = true;
                    } catch (fallbackErr: any) {
                        errors.push(fallbackErr?.message || String(fallbackErr));
                    }
                } else {
                    errors.push(err?.message || String(err));
                }
            }
        } else if (!quote.google_event_id) {
            clearedEventId = true;
        }

        if (quote.google_pickup_event_id && CALENDAR_RETIRO_ID) {
            try {
                await deleteGoogleCalendarEvent(CALENDAR_RETIRO_ID, quote.google_pickup_event_id);
                clearedPickupEventId = true;
            } catch (err: any) {
                errors.push(err?.message || String(err));
            }
        } else if (!quote.google_pickup_event_id) {
            clearedPickupEventId = true;
        }

        if (errors.length) {
            console.error(
                `GoogleSyncService [${quote.id || '?'}] - Error al borrar Calendar:`,
                errors.join(' | ')
            );
        }

        return {
            clearedEventId,
            clearedPickupEventId,
            error: errors.length ? errors.join(' | ') : undefined,
        };
    },
}
