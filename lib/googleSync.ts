import { PROJECT_TIMEZONE } from './config';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// IDs de los Calendarios
const CALENDAR_RESERVA_ID = process.env.GOOGLE_CALENDAR_RESERVA_ID;
const CALENDAR_RETIRO_ID = process.env.GOOGLE_CALENDAR_RETIRO_ID;
const CALENDAR_DESECHABLE_ID = process.env.GOOGLE_CALENDAR_DESECHABLE_ID;

if (!CALENDAR_RESERVA_ID || !CALENDAR_RETIRO_ID || !CALENDAR_DESECHABLE_ID) {
    console.error('CRITICAL: One or more GOOGLE_CALENDAR IDs are not defined in environment variables.');
}

/**
 * Tipado básico para respuestas de Google
 */
interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

interface GoogleErrorResponse {
    error?: {
        message: string;
        code?: number;
    };
    error_description?: string;
}

let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Helper para obtener el Access Token usando el Refresh Token (Fetch Nativo)
 * Implementa cache en memoria para optimizar el consumo de la cuota de logs de Workspace.
 */
async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiry > Date.now()) {
        return cachedToken.token;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID!,
            client_secret: CLIENT_SECRET!,
            refresh_token: REFRESH_TOKEN!,
            grant_type: 'refresh_token',
        }),
    });

    const data = await response.json() as GoogleTokenResponse & GoogleErrorResponse;
    if (!response.ok) {
        throw new Error(`Google OAuth2 Error: ${data.error_description || data.error?.message || response.statusText}`);
    }

    // Cache por el tiempo de expiración menos un margen de seguridad de 2 minutos
    cachedToken = { 
        token: data.access_token, 
        expiry: Date.now() + (data.expires_in - 120) * 1000 
    };

    return data.access_token;
}

/**
 * Cliente Genérico de Google API usando Fetch
 */
async function googleFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (response.status === 204) return null as T;

    const data = await response.json();
    if (!response.ok) {
        const errorData = data as GoogleErrorResponse;
        console.error(`Google API Error Detail [${url}]:`, JSON.stringify(data, null, 2));
        throw new Error(`Google API Error [${response.status}]: ${errorData.error?.message || response.statusText}`);
    }
    return data as T;
}

interface GooglePerson {
    resourceName: string;
    etag: string;
    names?: { givenName: string; familyName: string }[];
    emailAddresses?: { value: string }[];
    phoneNumbers?: { value: string }[];
    addresses?: { streetAddress: string }[];
    biographies?: { value: string }[];
}

interface GoogleSearchResponse {
    results?: { person: GooglePerson }[];
}

interface GoogleCalendarEvent {
    id: string;
    summary: string;
    location?: string;
    description?: string;
    // ... otros campos
}

/**
 * Crea o actualiza un contacto en Google Contacts con lógica inteligente para direcciones y notas.
 */
export async function syncGoogleContact(data: {
    resourceName?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    eventDate?: string;
    quoteUrl?: string;
    confirmed?: boolean;
    noteLabel?: string;
}) {
    if (!data.email && !data.resourceName && !data.phone) return null;

    try {
        let existingResourceName = data.resourceName;
        let etag: string | undefined;
        let existingAddresses: any[] = [];
        let existingBio = '';
        let existingGivenName = '';

        // 1. Obtener datos existentes (si hay resourceName o encontramos por búsqueda)
        const fetchExistingData = async (resourceName: string) => {
            try {
                const data = await googleFetch<GooglePerson>(
                    `https://people.googleapis.com/v1/${resourceName}?personFields=names,emailAddresses,phoneNumbers,addresses,biographies`
                );
                existingAddresses = data.addresses || [];
                existingBio = data.biographies?.[0]?.value || '';
                existingGivenName = data.names?.[0]?.givenName || '';
                return data.etag || undefined;
            } catch (err) {
                return undefined;
            }
        };

        if (existingResourceName) {
            etag = await fetchExistingData(existingResourceName);
            if (!etag) existingResourceName = undefined;
        }

        // 2. Búsqueda por Email o Teléfono si aún no hay resourceName
        if (!existingResourceName) {
            const queries = [data.email, data.phone].filter(Boolean);
            for (const query of queries) {
                const searchResponse = await googleFetch<GoogleSearchResponse>(
                    `https://people.googleapis.com/v1/people:searchContacts?readMask=names,emailAddresses,phoneNumbers,addresses,biographies&query=${encodeURIComponent(query!)}`
                );
                const foundPerson = searchResponse.results?.[0]?.person;
                if (foundPerson && foundPerson.resourceName) {
                    existingResourceName = foundPerson.resourceName;
                    etag = await fetchExistingData(existingResourceName);
                    break;
                }
            }
        }

        // 3. Preparar datos de contacto básicos
        let prefix = data.confirmed ? 'Cócteles' : 'Cotización';
        
        // Evitar "downgrade" si un cliente confirmado (Cócteles) hace una nueva cotización borrador
        if (!data.confirmed && existingGivenName.startsWith('Cócteles')) {
            prefix = 'Cócteles';
        }

        const givenName = `${prefix} - ${data.firstName}`;
        const contactData: any = {
            names: [{ givenName, familyName: data.lastName || '' }],
        };
        const updateFields = ['names'];

        if (data.email) {
            contactData.emailAddresses = [{ value: data.email }];
            updateFields.push('emailAddresses');
        }

        if (data.phone) {
            contactData.phoneNumbers = [{ value: data.phone }];
            updateFields.push('phoneNumbers');
        }

        // 4. Lógica de Direcciones (Evitar duplicación)
        if (data.address) {
            const normalizedNew = data.address.toLowerCase().trim();
            const isDuplicate = existingAddresses.some(addr => 
                addr.streetAddress?.toLowerCase().trim() === normalizedNew
            );

            if (!isDuplicate) {
                contactData.addresses = [...existingAddresses, { streetAddress: data.address }];
            } else {
                contactData.addresses = existingAddresses;
            }
            updateFields.push('addresses');
        }

        // 5. Lógica de Notas (Bitácora: lo nuevo primero, deduplicando por URL)
        let newNoteEntry = '';
        if (data.eventDate || data.quoteUrl) {
            let dateFormatted = data.eventDate || 'S/F';
            if (dateFormatted.includes('-')) {
                dateFormatted = dateFormatted.split('-').reverse().join('/');
            }

            const label = data.noteLabel || (data.confirmed ? 'Evento (Confirmado)' : 'Evento');
            const linkStr = data.quoteUrl ? ` - ${data.quoteUrl}` : '';
            newNoteEntry = `${label}: ${dateFormatted}${linkStr}`;
        }

        if (newNoteEntry) {
            let bioToUpdate = existingBio;

            if (data.quoteUrl && bioToUpdate) {
                const lines = bioToUpdate.split('\n');
                const filteredLines: string[] = [];
                let skipNext = false;

                for (let i = 0; i < lines.length; i++) {
                    if (skipNext) {
                        skipNext = false;
                        continue;
                    }
                    if (lines[i].includes(data.quoteUrl)) {
                        if (lines[i + 1]?.startsWith('Notas:')) {
                            skipNext = true;
                        }
                        continue;
                    }
                    filteredLines.push(lines[i]);
                }
                bioToUpdate = filteredLines.join('\n').trim();
            }

            const combinedBio = bioToUpdate 
                ? `${newNoteEntry}\n\n${bioToUpdate}` 
                : newNoteEntry;

            contactData.biographies = [{ value: combinedBio.trim(), contentType: 'TEXT_PLAIN' }];
            updateFields.push('biographies');
        }

        if (existingResourceName) {
            // 6. Actualizar
            console.log('Actualizando contacto inteligente (historial):', existingResourceName);
            const response = await googleFetch<GooglePerson>(
                `https://people.googleapis.com/v1/${existingResourceName}:updateContact?updatePersonFields=${updateFields.join(',')}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        ...contactData,
                        etag,
                    })
                }
            );
            return response.resourceName;
        } else {
            // 7. Crear
            console.log('Creando nuevo contacto:', data.email || data.phone);
            const response = await googleFetch<GooglePerson>(
                `https://people.googleapis.com/v1/people:createContact`,
                {
                    method: 'POST',
                    body: JSON.stringify(contactData)
                }
            );
            return response.resourceName;
        }
    } catch (error) {
        console.error('Error syncing Google Contact inteligente:', error);
        throw error;
    }
}

/**
 * deleteGoogleCalendarEvent: Borra un evento de un calendario.
 * 404 / 410 = ya no existe → se trata como éxito (idempotente al cancelar).
 */
export async function deleteGoogleCalendarEvent(
    calendarId: string,
    eventId: string
): Promise<{ deleted: boolean; alreadyGone?: boolean }> {
    if (!calendarId || !eventId) {
        return { deleted: false };
    }

    try {
        await googleFetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            { method: 'DELETE' }
        );
        return { deleted: true };
    } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('[404]') || msg.includes('[410]')) {
            console.warn(`Evento ${eventId} ya no existe en ${calendarId} (404/410).`);
            return { deleted: true, alreadyGone: true };
        }
        console.error(`Error borrando evento ${eventId} de ${calendarId}:`, err);
        throw err;
    }
}

/**
 * Crea o actualiza un evento en un calendario específico.
 */
export async function syncGoogleEvent(calendarId: string, event: {
    eventId?: string;
    summary: string;
    location: string;
    description: string;
    startISO: string;
    endISO: string;
    isAllDay?: boolean;
    attendees?: string[];
}) {
    try {
        // Ajuste para eventos de todo el día: Google requiere que la fecha de 'end' sea EXCLUSIVA.
        // Ejem: Si el evento es el 2026-04-20, el fin debe ser 2026-04-21.
        let startDateValue = event.startISO.split('T')[0];
        let endDateValue = event.endISO.split('T')[0];


        const body: any = {
            summary: event.summary,
            location: event.location,
            description: event.description,
            start: event.isAllDay 
                ? { date: startDateValue } 
                : { dateTime: event.startISO, timeZone: PROJECT_TIMEZONE },
            end: event.isAllDay 
                ? { date: endDateValue } 
                : { dateTime: event.endISO, timeZone: PROJECT_TIMEZONE },
            attendees: event.attendees ? event.attendees.map(email => ({ email })) : [],
        };

        const queryParams = '';

        if (event.eventId) {
            console.log(`Actualizando evento ${event.eventId} en calendario ${calendarId} (Notificar: false)`);
            try {
                return await googleFetch<GoogleCalendarEvent>(
                    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.eventId}${queryParams}`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(body)
                    }
                );
            } catch (err: any) {
                // Si el error es 404, el evento ya no existe o cambió de calendario.
                // Reintentamos creándolo como nuevo.
                if (err.message?.includes('[404]')) {
                    console.warn(`Evento ${event.eventId} no encontrado (404). Reintentando como nuevo evento.`);
                    return await googleFetch<GoogleCalendarEvent>(
                        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${queryParams}`,
                        {
                            method: 'POST',
                            body: JSON.stringify(body)
                        }
                    );
                }
                throw err;
            }
        } else {
            console.log(`Creando nuevo evento en calendario ${calendarId} (Notificar: false)`);
            return await googleFetch<GoogleCalendarEvent>(
                `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${queryParams}`,
                {
                    method: 'POST',
                    body: JSON.stringify(body)
                }
            );
        }
    } catch (error) {
        console.error(`Error syncing event in calendar ${calendarId}:`, error);
        throw error;
    }
}

export { CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID, CALENDAR_DESECHABLE_ID };
