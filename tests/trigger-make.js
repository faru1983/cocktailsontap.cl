/**
 * Script para enviar datos de prueba a Make con fechas dinámicas.
 * Úsalo para que Make "redetermine" la estructura de datos con información real del momento.
 */
async function triggerMake() {
    // URL directamente del .env para este test manual
    const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/yj983lq9x7byk3p3souc2vgcwye2a3s7";

    // Helper para formatear fechas ISO locales (sin desfase UTC)
    const formatLiteral = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);

    const payload = {
        title: `Cócteles - Prueba Dinámica ${now.getHours()}:${now.getMinutes()}`,
        customerName: "Prueba",
        customerLastname: "Dinámica",
        customerEmail: "soporte@cocktailsontap.cl",
        phone: "+56912345678",
        description: "Enviado desde script de test con fechas dinámicas",
        start_date: formatLiteral(now),
        end_date: formatLiteral(now),
        location: "Calle Prueba 123, Santiago",
        guests: 40,
        pickup_is_all_day: true,
        pickup_start: formatLiteral(tomorrow).split('T')[0] + "T00:00:00",
        pickup_end: formatLiteral(tomorrow).split('T')[0] + "T23:59:59",
        pickup_title: "Retiro - Prueba Dinámica"
    };

    console.log(`🚀 Enviando datos de prueba a Make (${formatLiteral(now)})...`);
    
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('✅ ¡Éxito! Make recibió los datos actualizados.');
            console.log(`📅 Evento: ${payload.start_date}`);
            console.log(`🚚 Retiro: ${payload.pickup_start}`);
        } else {
            console.error('❌ Error en Make:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('❌ Error de red:', error.message);
    }
}

triggerMake();
