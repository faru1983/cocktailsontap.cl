import { google } from 'googleapis';
import { PROJECT_TIMEZONE } from './config';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// IDs de los Calendarios
const CALENDAR_RESERVA_ID = process.env.GOOGLE_CALENDAR_RESERVA_ID;
const CALENDAR_RETIRO_ID = process.env.GOOGLE_CALENDAR_RETIRO_ID;

if (!CALENDAR_RESERVA_ID || !CALENDAR_RETIRO_ID) {
    console.error('CRITICAL: GOOGLE_CALENDAR_RESERVA_ID or GOOGLE_CALENDAR_RETIRO_ID is not defined in environment variables.');
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Redirect URI usado para obtener el token
);

oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const people = google.people({ version: 'v1', auth: oauth2Client });

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
}) {
    if (!data.email && !data.resourceName && !data.phone) return null;

    try {
        let existingResourceName = data.resourceName;
        let etag: string | undefined;
        let existingAddresses: any[] = [];
        let existingBio = '';

        // 1. Obtener datos existentes (si hay resourceName o encontramos por búsqueda)
        const fetchExistingData = async (resourceName: string) => {
            try {
                const response = await people.people.get({
                    resourceName,
                    personFields: 'names,emailAddresses,phoneNumbers,addresses,biographies',
                });
                existingAddresses = response.data.addresses || [];
                existingBio = response.data.biographies?.[0]?.value || '';
                return response.data.etag || undefined;
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
                const searchResponse = await people.people.searchContacts({
                    query: query!,
                    readMask: 'names,emailAddresses,phoneNumbers,addresses,biographies',
                });
                const foundPerson = searchResponse.data.results?.[0]?.person;
                if (foundPerson && foundPerson.resourceName) {
                    existingResourceName = foundPerson.resourceName;
                    etag = await fetchExistingData(existingResourceName);
                    break;
                }
            }
        }

        // 3. Preparar datos de contacto básicos
        const givenName = `Cócteles - ${data.firstName}`;
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
            // Formatear fecha a DD/MM/YYYY si viene como YYYY-MM-DD
            let dateFormatted = data.eventDate || 'S/F';
            if (dateFormatted.includes('-')) {
                dateFormatted = dateFormatted.split('-').reverse().join('/');
            }

            const label = data.confirmed ? 'Evento (Confirmado)' : 'Evento';
            const linkStr = data.quoteUrl ? ` - ${data.quoteUrl}` : '';
            newNoteEntry = `${label}: ${dateFormatted}${linkStr}`;
        }

        if (newNoteEntry) {
            let bioToUpdate = existingBio;

            // Limpiar entradas previas para esta misma cotización (buscando por el link único)
            if (data.quoteUrl && bioToUpdate) {
                const lines = bioToUpdate.split('\n');
                const filteredLines: string[] = [];
                let skipNext = false;

                for (let i = 0; i < lines.length; i++) {
                    if (skipNext) {
                        skipNext = false;
                        continue;
                    }

                    // Si la línea contiene el URL de esta cotización, la saltamos
                    if (lines[i].includes(data.quoteUrl)) {
                        // Si la línea siguiente es de "Notas: ", también la saltamos
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
            const response = await people.people.updateContact({
                resourceName: existingResourceName,
                updatePersonFields: updateFields.join(','),
                requestBody: {
                    ...contactData,
                    etag: etag,
                }
            });
            return response.data.resourceName;
        } else {
            // 7. Crear
            console.log('Creando nuevo contacto:', data.email || data.phone);
            const response = await people.people.createContact({
                requestBody: contactData,
            });
            return response.data.resourceName;
        }
    } catch (error) {
        console.error('Error syncing Google Contact inteligente:', error);
        throw error;
    }
}

/**
 * Crea un evento en un calendario específico.
 */
export async function createGoogleEvent(calendarId: string, event: {
    summary: string;
    location: string;
    description: string;
    startISO: string;
    endISO: string;
    isAllDay?: boolean;
}) {
    try {
        const requestBody: any = {
            summary: event.summary,
            location: event.location,
            description: event.description,
            start: event.isAllDay 
                ? { date: event.startISO.split('T')[0] } 
                : { dateTime: event.startISO, timeZone: PROJECT_TIMEZONE },
            end: event.isAllDay 
                ? { date: event.endISO.split('T')[0] } 
                : { dateTime: event.endISO, timeZone: PROJECT_TIMEZONE },
        };

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: requestBody,
        });

        return response.data;
    } catch (error) {
        console.error(`Error creating event in calendar ${calendarId}:`, error);
        throw error;
    }
}

export { CALENDAR_RESERVA_ID, CALENDAR_RETIRO_ID };
