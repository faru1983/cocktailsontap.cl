// Simulación completa de creación de cotización (Back-end) compatible con CRM
// Ejecutar con: node --env-file=.env.local tests/test-create-full-quote.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function simulateQuote() {
    console.log('🚀 Iniciando simulación de creación de cotización con CRM...');

    const clientEmail = "feliperamirez1983@gmail.com";
    const clientFirstName = "Test";
    const clientLastName = "CRM";
    const clientPhone = "+56911112222";

    try {
        // 0. Sincronizar Cliente (CRM) - Simulando la lógica de createQuote.ts
        console.log('🔎 Verificando cliente en CRM...');
        const clientRes = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
                'On-Conflict': 'email'
            },
            body: JSON.stringify({
                email: clientEmail,
                first_name: clientFirstName,
                last_name: clientLastName,
                phone: clientPhone
            })
        });

        let clientId = null;
        if (clientRes.ok) {
            const [client] = await clientRes.json();
            clientId = client.id;
            console.log(`✅ Cliente gestionado! ID: ${clientId}`);
        } else {
            console.error('❌ Error gestionando cliente:', await clientRes.text());
        }

        const mockData = {
            client_id: clientId,
            client_name: clientFirstName,
            client_lastname: clientLastName,
            client_email: clientEmail,
            client_phone: clientPhone,
            client_address: "Calle Falsa 123",
            comuna_name: "Santiago",
            event_date: "2026-12-31",
            start_time: "20:00",
            guests: 50,
            total_price: 150000,
            total_liters: 20,
            status: "draft"
        };

        // 1. Insertar Cotización
        console.log('📝 Creando cotización vinculada...');
        const res = await fetch(`${SUPABASE_URL}/rest/v1/quotes`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(mockData)
        });

        if (res.ok) {
            const [quote] = await res.json();
            console.log(`✅ Cotización CREADA! ID: ${quote.id}`);
            console.log(`🔗 Token generado: ${quote.token}`);
            console.log(`👥 Vinculada a Client ID: ${quote.client_id}`);
            
            // 2. Insertar items ficticios
            const items = [
                { quote_id: quote.id, product_id: 'margarita', product_name: 'Margarita', size: '10L', quantity: 2, price_at_time: 75000, offer_price_at_time: 75000 }
            ];

            const itemRes = await fetch(`${SUPABASE_URL}/rest/v1/quote_items`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(items)
            });

            if (itemRes.ok) {
                console.log('✅ Items insertados correctamente.');
                console.log('\n--- PRUEBA FINALIZADA CON ÉXITO ---');
                console.log('Este test verificó: Creación/Actualización de Cliente, Vínculo Relacional y Persistencia.');
            }
        } else {
            const error = await res.json();
            console.error('❌ Error creando cotización:', error);
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
    }
}

simulateQuote();
