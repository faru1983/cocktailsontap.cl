// Prueba de envío de correo administrativo (Notificación de reserva)
// Ejecutar con: node --env-file=.env.local tests/test-emails.js

const RESEND_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function testEmail() {
    console.log('📧 Probando sistema de correos (Resend)...');

    if (!RESEND_KEY || !ADMIN_EMAIL) {
        console.error('❌ Faltan variables RESEND_API_KEY o ADMIN_EMAIL.');
        return;
    }

    // Simulamos un objeto de cotización para el test
    const mockHtml = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #e2a049;">🧪 TEST: Notificación de Reserva</h1>
            <p>Este es un correo de prueba para verificar que la integración con Resend está activa.</p>
            <hr />
            <p><strong>Cliente:</strong> Juan Pérez (TEST)</p>
            <p><strong>Configuración:</strong> 20 Litros - Muro de Coctelería</p>
            <p><strong>Total:</strong> $150.000</p>
        </div>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_KEY}`
            },
            body: JSON.stringify({
                from: 'Cocktails on Tap <contacto@cocktailsontap.cl>',
                to: [ADMIN_EMAIL],
                subject: '🧪 TEST: Funcionamiento de Emails',
                html: mockHtml
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Email enviado exitosamente! ID:', result.id);
            console.log(`📩 Revisa la bandeja de: ${ADMIN_EMAIL}`);
        } else {
            const error = await response.json();
            console.error('❌ Error de Resend:', error);
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
    }
}

testEmail();
