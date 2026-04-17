import * as React from 'react';
import { render } from '@react-email/components';
import { Resend } from 'resend';
import { DirectSaleEmail } from '../../components/emails/DirectSaleEmail';
import { ConfirmationEmail } from '../../components/emails/ConfirmationEmail';
import type { Quote, QuoteItem } from '../../lib/types';



if (!process.env.RESEND_API_KEY) {
  console.error('❌ ERROR: RESEND_API_KEY no encontrada en .env.local');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const TEST_EMAIL = 'feliperamirez1983@gmail.com';
const FROM_EMAIL = 'Cocktails on Tap <contacto@cocktailsontap.cl>';

/**
 * DATOS DE MOCK PARA LA PRUEBA (COMPRA DIRECTA)
 * -----------------------------------------------------------------------------
 */
const mockItems: QuoteItem[] = [
  {
    id: 'test-item-1',
    product_id: 'pisco-sour-id',
    product_name: 'Pisco Sour Tradicional',
    size: '5L',
    size_value: 5,
    unit_id: 'L',
    is_disposable: true,
    quantity: 3,
    price_at_time: 45000,
    offer_price_at_time: 42000,
  },
  {
      id: 'test-item-2',
      product_id: 'hielo-id',
      product_name: 'Bolsa de Hielo',
      size: '5kg',
      size_value: 5,
      unit_id: 'kg', 
      is_disposable: false,
      quantity: 2,
      price_at_time: 5000,
      offer_price_at_time: 5000,
  }
];

const mockQuote: Quote & { quote_items: QuoteItem[] } = {
  id: 'test-quote-direct-id',
  token: 'test-token-direct',
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  client_name: 'Felipe',
  client_lastname: 'Ramírez',
  client_email: TEST_EMAIL,
  client_phone: '+56912345678',
  client_address: 'Av. Test 123, Vitacura',
  comuna_name: 'Vitacura',
  comuna_other: null,
  event_type_id: null,
  event_type_other: null,
  event_date: '2026-05-20',
  start_time: '18:00',
  pickup_date: null,
  pickup_time: null,
  guests: 0,
  drinks_per_person: 0,
  dispenser: 'desechable',
  total_normal_price: 136000,
  total_offer_price: 136000,
  shipping_cost: 5000,
  installation_cost: 0,
  manual_discount: 0,
  total_price: 141000,
  total_liters: 15,
  comments: 'Esto es un test masivo para validar los 4 layouts de compra directa.',
  quote_items: mockItems
};

/**
 * EJECUCIÓN DEL TEST
 * -----------------------------------------------------------------------------
 */
async function runEmailTests() {
  console.log('🚀 Iniciando envío de correos de prueba (4 versiones)...');
  
  try {
    // 1. DirectSaleEmail - CLIENTE (Borrador)
    console.log('📧 1/4 Renderizando DirectSaleEmail (CLIENTE)...');
    const draftUserHtml = await render(React.createElement(DirectSaleEmail, { quote: mockQuote, isAdmin: false }));
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `📦 [TEST-CLIENTE] Tu pedido de compra directa – ${mockQuote.event_date}`,
      html: draftUserHtml,
    });

    // 2. DirectSaleEmail - ADMIN (Notificación Nuevo Pedido)
    console.log('📧 2/4 Renderizando DirectSaleEmail (ADMIN)...');
    const draftAdminHtml = await render(React.createElement(DirectSaleEmail, { quote: mockQuote, isAdmin: true }));
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `📦 [TEST-ADMIN] Nuevo pedido de Barril Desechable – ${mockQuote.event_date}`,
      html: draftAdminHtml,
    });

    // Preparar para confirmación
    const confirmedQuote = { ...mockQuote, status: 'confirmed' as const };

    // 3. ConfirmationEmail - CLIENTE (Pago Recibido)
    console.log('📧 3/4 Renderizando ConfirmationEmail (CLIENTE)...');
    const confirmUserHtml = await render(React.createElement(ConfirmationEmail, { quote: confirmedQuote, isAdmin: false }));
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `✅ [TEST-CLIENTE] Pedido confirmado y pagado – ${mockQuote.event_date}`,
      html: confirmUserHtml,
    });

    // 4. ConfirmationEmail - ADMIN (Aviso de Pago)
    console.log('📧 4/4 Renderizando ConfirmationEmail (ADMIN)...');
    const confirmAdminHtml = await render(React.createElement(ConfirmationEmail, { quote: confirmedQuote, isAdmin: true }));
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `✅ [TEST-ADMIN] Pedido pagado y agendado – ${mockQuote.event_date}`,
      html: confirmAdminHtml,
    });

    console.log('✨ ¡Las 4 versiones han sido enviadas a feliperamirez1983@gmail.com!');
    console.log('Por favor revisa tu bandeja y confirma si el layout es el deseado.');
    
  } catch (error) {
    console.error('❌ Error enviando los correos:', error);
  }
}

runEmailTests();
