// Usando fetch global de Node.js
// El script debe ejecutarse con: node --env-file=.env.local tests/trigger-make.js

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_CALENDAR_URL;

if (!MAKE_WEBHOOK_URL) {
    console.error('❌ Error: No se encontró la variable MAKE_WEBHOOK_CALENDAR_URL en el entorno.');
    console.log('Asegúrate de ejecutar el script con: node --env-file=.env.local tests/trigger-make.js');
    process.exit(1);
}

const testPayload = {
    title: "TEST: Juan Pérez 20px",
    customerName: "Juan",
    customerLastname: "Pérez",
    phone: "+56912345678",
    description: "Nombre: Juan Pérez\nTeléfono: +56912345678\nEmail: juan.perez@test.com\nDirección: Av Providencia 1234, Providencia\nEvento: Cumpleaños (20 pers.)\nVer cotización: http://localhost:3000/cotizar/test-token\n\nProductos:\n5x Margarita (5L) $50.000\nTransporte: $10.000\nDispensador Portátil: $0\nTotal: $60.000",
    start_date: new Date().toISOString(),
    // En el código actual pusimos endDate = startDate para duración 0
    end_date: new Date().toISOString(), 
    location: "Av Providencia 1234, Providencia",
    guests_email: "juan.perez@test.com",
    guests: 20
};

async function runTest() {
    console.log('Enviando datos de prueba a Make...');
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
            console.log('✅ Prueba enviada exitosamente!');
            console.log('Make debería haber detectado el nuevo campo: customerLastname');
        } else {
            console.error('❌ Error al enviar:', response.statusText);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    }
}

runTest();
