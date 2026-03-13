/**
 * Test de preview de todos los correos del sistema.
 * Envía los 4 correos reales con datos de ejemplo a la dirección de admin.
 *
 * Ejecutar con:
 *   node --env-file=.env.local --experimental-strip-types tests/test-email-preview.ts
 */

// @ts-nocheck
import { buildQuoteCreatedClientEmail }           from '../lib/emails';
import { buildAdminNotificationEmail }            from '../lib/emails';
import { buildQuoteConfirmedEmail }               from '../lib/emails';
import { buildAdminConfirmationNotificationEmail } from '../lib/emails';

// ─── Mock de una cotización completa ─────────────────────────────────────────
const mockQuote = {
    id: 'test-id-001',
    token: 'TOKEN-PREVIEW-001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'confirmed',
    client_name: 'Juan',
    client_lastname: 'Pérez',
    client_email: 'juan.perez@ejemplo.com',
    client_phone: '+56912345678',
    client_address: 'Av. Providencia 1234, Depto 5B',
    comments: 'Me gustaría que los vasos sean copas de cristal si es posible.',
    event_type_id: 'Cumpleaños',
    event_type_other: null,
    event_date: '2026-08-15',
    start_time: '19:00',
    pickup_date: '2026-08-16',
    pickup_time: '10:00',
    comuna_name: 'Providencia',
    comuna_other: null,
    guests: 50,
    drinks_per_person: 4,
    dispenser: 'muro' as 'muro' | 'portatil',
    total_normal_price: 250_000,
    total_offer_price: 200_000,
    shipping_cost: 0,
    installation_cost: 50_000,
    total_price: 250_000,
    total_liters: 35,
    quote_items: [
        {
            id: 'item-1',
            quote_id: 'test-id-001',
            product_id: 'margarita',
            product_name: 'Margarita',
            size: '20L',
            quantity: 1,
            price_at_time: 100_000,
            offer_price_at_time: 80_000,
        },
        {
            id: 'item-2',
            quote_id: 'test-id-001',
            product_id: 'mojito',
            product_name: 'Mojito Clásico',
            size: '15L',
            quantity: 1,
            price_at_time: 90_000,
            offer_price_at_time: 75_000,
        },
        {
            id: 'item-3',
            quote_id: 'test-id-001',
            product_id: 'piscola',
            product_name: 'Pisco Sour',
            size: '10L',
            quantity: 1,
            price_at_time: 60_000,
            offer_price_at_time: 45_000,
        },
    ],
};

// ─── Envío de correos ─────────────────────────────────────────────────────────
const RESEND_KEY  = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'contacto@cocktailsontap.cl';
const FROM_EMAIL  = 'Cocktails on Tap <contacto@cocktailsontap.cl>';

if (!RESEND_KEY) {
    console.error('❌ Falta RESEND_API_KEY en el entorno.');
    process.exit(1);
}

const emails = [
    { name: '1. Nueva cotización → Cliente',      ...buildQuoteCreatedClientEmail(mockQuote) },
    { name: '2. Nueva cotización → Admin',         ...buildAdminNotificationEmail(mockQuote) },
    { name: '3. Reserva confirmada → Cliente',     ...buildQuoteConfirmedEmail(mockQuote) },
    { name: '4. Reserva confirmada → Admin',       ...buildAdminConfirmationNotificationEmail(mockQuote) },
];

async function sendAllPreviews() {
    console.log(`\n📧 Enviando ${emails.length} correos de preview a: ${ADMIN_EMAIL}\n`);
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const email of emails) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_KEY}`,
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: [ADMIN_EMAIL],
                    subject: `[PREVIEW] ${email.subject}`,
                    html: email.html,
                }),
            });

            if (res.ok) {
                const { id } = await res.json();
                console.log(`✅ ${email.name} → ID: ${id}`);
            } else {
                const err = await res.json();
                console.error(`❌ ${email.name} → Error:`, err.message);
            }
        } catch (err) {
            console.error(`❌ ${email.name} → Error de red:`, err.message);
        }
        await delay(600); // Respetar el rate limit de Resend (2 req/s)
    }

    console.log('\n✨ Listo. Revisa tu bandeja de entrada para ver el diseño de todos los correos.\n');
}

sendAllPreviews();
