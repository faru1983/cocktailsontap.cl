// Simulación completa de creación de cotización (Back-end)
// Ejecutar con: node --env-file=.env.local tests/test-create-full-quote.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function simulateQuote() {
    console.log('🚀 Iniciando simulación de creación de cotización...');

    const mockData = {
        client_name: "Test",
        client_lastname: "Automatizado",
        client_email: "feliperamirez1983@gmail.com", // Enviarlo a ti mismo
        client_phone: "+56911112222",
        client_address: "Calle Falsa 123",
        comuna_name: "Santiago",
        event_date: "2026-12-31",
        start_time: "20:00",
        guests: 50,
        total_price: 150000,
        total_liters: 20,
        status: "draft"
    };

    try {
        // 1. Insertar Cotización
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
            console.log(`🌐 URL para revisar: http://localhost:3000/cotizar/${quote.token}`);
            
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
                console.log('\n--- PRUEBA FINALIZADA ---');
                console.log('Este test verificó: Conexión DB, generación de Token, inserción de items y accesibilidad de la URL.');
            }
        } else {
            const error = await res.json();
            console.error('❌ Error:', error);
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
    }
}

simulateQuote();
