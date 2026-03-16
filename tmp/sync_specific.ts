

import { createServerClient } from './lib/supabaseServer';
import { syncGoogleContact } from './lib/googleSync';
import { QuoteService } from './lib/services/quoteService';

async function syncSpecificClients() {
    const emails = ['carrasco.wladimir@gmail.com', 'marverariver2803@gmail.com'];
    const db = createServerClient();

    for (const email of emails) {
        console.log(`Sincronizando: ${email}...`);
        const { data: client, error } = await db.from('clients').select('*').eq('email', email).single();
        
        if (error || !client) {
            console.error(`Error al encontrar cliente ${email}:`, error?.message);
            continue;
        }

        try {
            const googleContactId = await syncGoogleContact({
                resourceName: client.google_contact_id || undefined,
                firstName: client.first_name,
                lastName: client.last_name || '',
                email: client.email,
                phone: client.phone || '',
            });

            if (googleContactId && googleContactId !== client.google_contact_id) {
                await db.from('clients').update({ google_contact_id: googleContactId }).eq('id', client.id);
                console.log(`✅ Sincronizado: ${email} (ID: ${googleContactId})`);
            } else if (googleContactId) {
                console.log(`ℹ️ Ya sincronizado: ${email}`);
            } else {
                console.warn(`⚠️ No se obtuvo ID para: ${email}`);
            }
        } catch (e: any) {
            console.error(`❌ Error en sync para ${email}:`, e.message);
        }
    }
}

syncSpecificClients().catch(console.error);
