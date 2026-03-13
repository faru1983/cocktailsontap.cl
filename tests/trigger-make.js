/**
 * Script para enviar datos de prueba a Make con la nueva estructura de retiro.
 * Úsalo para que Make "redetermine" la estructura de datos.
 */
async function triggerMake() {
    const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_CALENDAR_URL;

    if (!MAKE_WEBHOOK_URL) {
        console.error('❌ Error: La variable de entorno MAKE_WEBHOOK_CALENDAR_URL no está definida.');
        process.exit(1);
    }

    const payload = {
        title: "Cócteles - Juan Pérez 50px",
        customerName: "Juan",
        customerLastname: "Pérez",
        phone: "+56912345678",
        description: "Nombre: Juan Pérez\nEvento: Cumpleaños (50 pers.)\nRetiro: 16 de Agosto (14:00 a 16:00hrs)\nTotal: $250.000",
        start_date: "2026-08-15T19:00:00",
        end_date: "2026-08-15T19:00:00",
        location: "Av. Providencia 1234, Providencia",
        guests_email: "juan.perez@ejemplo.com",
        guests: 50,
        // --- Campos Nuevos para el Retiro ---
        pickup_is_all_day: false,
        pickup_start: "2026-08-16T14:00:00",
        pickup_end: "2026-08-16T16:00:00",
        pickup_title: "Retiro - Juan Pérez"
    };

    console.log('🚀 Enviando datos de prueba a Make...');
    
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('✅ ¡Éxito! Make recibió los datos.');
            console.log('💡 Ahora puedes mapear pickup_start, pickup_end y pickup_is_all_day en tu escenario.');
        } else {
            console.error('❌ Error en Make:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('❌ Error de red:', error.message);
    }
}

triggerMake();
