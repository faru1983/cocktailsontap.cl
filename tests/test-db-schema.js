// Comprobación de integridad de la base de datos
// Ejecutar con: node --env-file=.env.local tests/test-db-schema.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
    console.log('🔍 Verificando integridad de la base de datos...');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Faltan variables de entorno de Supabase.');
        return;
    }

    try {
        // Consultamos la tabla quotes para ver si podemos acceder a la nueva columna
        const response = await fetch(`${SUPABASE_URL}/rest/v1/quotes?select=client_name,client_lastname&limit=1`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Conexión con Supabase: OK');
            const data = await response.json();
            console.log('✅ Acceso a tabla "quotes": OK');
            
            // Si hay datos, verificamos que el campo exista aunque sea null
            if (data.length >= 0) {
                console.log('✅ Columna "client_lastname" detectada correctamente.');
            }
        } else {
            const error = await response.json();
            console.error('❌ Error al consultar la tabla:', error.message);
            if (error.message.includes('column "client_lastname" does not exist')) {
                console.error('👉 SUGERENCIA: Debes ejecutar la migración SQL en el dashboard de Supabase.');
            }
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
    }
}

checkSchema();
