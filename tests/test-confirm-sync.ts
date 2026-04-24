import { GoogleSyncService } from '../lib/services/googleSyncService';
import type { Quote, QuoteItem } from '../lib/types';

/**
 * MOCK DATA: Simulamos una cotización real con los datos que causaban fallos
 * (Horas con "hrs", items con ID nulo, etc.)
 */
const mockQuote: Quote & { quote_items: any[] } = {
    id: 'test-uuid-123',
    token: 'test-token-456',
    client_name: 'Test',
    client_lastname: 'Confirmación',
    client_email: 'test@ejemplo.com',
    client_phone: '+56912345678',
    client_address: 'Calle Falsa 123',
    comuna_name: 'Las Condes',
    event_date: '2026-12-01',
    start_time: '12:00hrs', // Formato con texto (el que fallaba)
    pickup_date: '2026-12-02',
    pickup_time: '12:00 a 14:00hrs', // Rango con texto (el que fallaba)
    guests: 50,
    dispenser: 'portatil',
    service_type: 'event',
    total_price: 150000,
    shipping_cost: 10000,
    installation_cost: 0,
    total_liters: 20,
    quote_items: [
        {
            product_id: null, // Producto manual (el que fallaba)
            product_name: 'Cóctel Especial Manual',
            size: '10L',
            quantity: 2,
            offer_price_at_time: 70000
        },
        {
            product_id: 'real-id-abc',
            product_name: 'Mojito Menta',
            size: '5L',
            quantity: 1,
            offer_price_at_time: 35000
        }
    ]
};

async function runTest() {
    console.log('🚀 Iniciando Test de Integración: Sincronización de Confirmación');
    console.log('------------------------------------------------------------');

    try {
        // 1. Probar Sincronización de Contacto
        console.log('1. Probando actualización de contacto en Google...');
        await GoogleSyncService.updateContactConfirmedStatus(mockQuote as any);
        console.log('✅ Contacto procesado (verificar en Google Contacts)');

        // 2. Probar Sincronización de Calendario
        console.log('\n2. Probando creación de eventos en Google Calendar...');
        console.log('   (Esto verificará el formato RFC3339 con offset -04:00)');
        
        const calendarResults = await GoogleSyncService.scheduleCalendarEvents(mockQuote as any);
        
        console.log('✅ Eventos de Calendario creados con éxito:');
        console.log(`   - ID Evento Reserva: ${calendarResults.eventId}`);
        console.log(`   - ID Evento Retiro: ${calendarResults.pickupEventId}`);

        console.log('\n------------------------------------------------------------');
        console.log('✨ TEST COMPLETADO CON ÉXITO');
        console.log('El sistema es ahora robusto contra formatos de hora e IDs nulos.');
        
    } catch (error: any) {
        console.error('\n❌ EL TEST FALLÓ:');
        console.error('Mensaje:', error.message);
        if (error.response?.data) {
            console.error('Detalle API:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

runTest();
