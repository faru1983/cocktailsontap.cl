import { formatCurrency } from '@/lib/utils';
import { SITE_URL, LOGO_URL, MURO_INSTALLATION_COST } from '@/lib/config';
import type { Quote, QuoteItem } from '@/lib/types';

const brandColor = '#E2A049';
const brandDark = '#1a1a2e';
const gray = '#64748b';
const lightGray = '#f8fafc';
const borderColor = '#e2e8f0';

// ─── Layout base ──────────────────────────────────────────────────────────────

function baseLayout(content: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cocktails on Tap</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:24px 40px;text-align:center;border-bottom:1px solid ${borderColor};">
            <a href="${SITE_URL}" style="display:inline-block;text-decoration:none;">
              <img src="${LOGO_URL}" alt="Cocktails on Tap" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;" />
            </a>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:40px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:${lightGray};border-top:1px solid ${borderColor};padding:20px 40px;text-align:center;">
            <p style="color:${gray};font-size:12px;margin:0;">Cocktails on Tap Chile &bull; <a href="mailto:contacto@cocktailsontap.cl" style="color:${gray};">contacto@cocktailsontap.cl</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Helpers reutilizables ────────────────────────────────────────────────────

function itemsTable(items: QuoteItem[]): string {
    const rows = items.map(item => {
        const hasOffer = item.price_at_time > item.offer_price_at_time;
        return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};font-size:14px;color:${brandDark};">
        <strong>${item.product_name}</strong> <span style="color:${gray};">(${item.size})</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:center;color:${gray};font-size:14px;">x${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:right;font-size:14px;">
        ${hasOffer ? `<span style="text-decoration:line-through;color:${gray};font-size:12px;">${formatCurrency(item.price_at_time * item.quantity)}</span><br/>` : ''}
        <strong style="color:#059669;">${formatCurrency(item.offer_price_at_time * item.quantity)}</strong>
      </td>
    </tr>`;
    }).join('');

    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <th align="left" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Cóctel</th>
      <th align="center" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Cant.</th>
      <th align="right" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Precio</th>
    </tr>
    ${rows}
  </table>`;
}

function priceBreakdownSection(quote: Quote): string {
    const dispenserLabel = quote.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil';
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 32px;border-top:2px solid ${brandColor};padding-top:12px;">
      ${quote.total_normal_price > quote.total_offer_price ? `
      <tr>
        <td style="font-size:13px;color:${gray};padding:3px 0;width:50%;">Subtotal</td>
        <td style="font-size:13px;color:${gray};text-align:right;">${formatCurrency(quote.total_normal_price)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#059669;padding:3px 0;">Descuento</td>
        <td style="font-size:13px;color:#059669;text-align:right;">-${formatCurrency(quote.total_normal_price - quote.total_offer_price)}</td>
      </tr>` : `
      <tr>
        <td style="font-size:13px;color:${gray};padding:3px 0;width:50%;">Subtotal</td>
        <td style="font-size:13px;color:${gray};text-align:right;">${formatCurrency(quote.total_normal_price)}</td>
      </tr>`}
      <tr>
        <td style="font-size:13px;color:${gray};padding:3px 0;">Transporte</td>
        <td style="font-size:13px;${quote.shipping_cost === 0 ? `color:#059669;` : `color:${gray};`}text-align:right;">${quote.shipping_cost === 0 ? '¡Gratis!' : formatCurrency(quote.shipping_cost)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${gray};padding:3px 0;">${dispenserLabel}</td>
        <td style="font-size:13px;${quote.installation_cost === 0 ? `color:#059669;` : `color:${gray};`}text-align:right;">${quote.installation_cost === 0 ? '¡Gratis!' : formatCurrency(quote.installation_cost)}</td>
      </tr>
      <tr style="border-top:1px solid ${borderColor};">
        <td style="font-size:16px;color:${brandDark};font-weight:900;padding:10px 0 0;">TOTAL</td>
        <td style="font-size:16px;color:${brandDark};font-weight:900;text-align:right;padding:10px 0 0;">${formatCurrency(quote.total_price)}</td>
      </tr>
    </table>`;
}

function reservationInfoSection(quote: Quote): string {
    const communaDisplay = quote.comuna_name === 'Otra' ? (quote.comuna_other || '') : (quote.comuna_name || '');
    const fullAddress = [quote.client_address, communaDisplay].filter(Boolean).join(', ');
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    return `<div style="background:${lightGray};border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Información de Reserva</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_name}</td></tr>
        ${quote.client_lastname ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Apellido</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_lastname}</td></tr>` : ''}
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Email</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_email}</td></tr>
        ${quote.client_phone ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Celular</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_phone}</td></tr>` : ''}
        ${fullAddress ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Dirección</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${fullAddress}</td></tr>` : ''}
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Evento</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.event_type_other || quote.event_type_id || 'No especificado'} (${quote.guests} pers.)</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Fecha</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${eventDate}${quote.start_time && quote.start_time !== '--:--' ? ` · (${quote.start_time})` : ''}</td></tr>
        ${quote.pickup_date ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Retiro</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${new Date(quote.pickup_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}${quote.pickup_time ? ` · (${quote.pickup_time})` : ''}</td></tr>` : ''}
        ${quote.comments ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Comentarios</td><td style="font-size:14px;color:${brandDark};font-weight:400;font-style:italic;padding:4px 0;">"${quote.comments}"</td></tr>` : ''}
      </table>
    </div>`;
}

// ─── Email 1: Cotización creada → al cliente ──────────────────────────────────

export function buildQuoteCreatedClientEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const resumeLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const fullName = `${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''}`;
    const content = `
    <h2 style="color:${brandDark};margin:0 0 8px;font-size:22px;">¡Hemos recibido tu cotización!</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:15px;">Hola <strong>${fullName}</strong>, aquí tienes el resumen de tu solicitud.</p>

    <h3 style="color:${brandDark};font-size:14px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Productos seleccionados</h3>
    ${itemsTable(quote.quote_items)}
    ${priceBreakdownSection(quote)}
    ${reservationInfoSection(quote)}

    <div style="background:${brandColor};border-radius:12px;padding:24px;margin-top:8px;text-align:center;">
      <p style="color:#fff;margin:0 0 16px;font-size:15px;font-weight:700;">¿Listo para confirmar tu reserva?</p>
      <a href="${resumeLink}" style="display:inline-block;background:#fff;color:${brandDark};font-weight:900;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Confirmar cotización →</a>
    </div>

    <p style="color:${gray};font-size:13px;margin-top:24px;">Si tienes dudas, escríbenos por WhatsApp al <a href="https://wa.me/56929672978" style="color:${brandColor};">+56 9 2967 2978</a></p>
  `;

    return {
        subject: `🍸 Tu cotización – ${eventDate}`,
        html: baseLayout(content),
    };
}


// ─── Email 2: Notificación al administrador (nueva cotización) ────────────────

export function buildAdminNotificationEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const adminLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
    <h2 style="color:${brandDark};margin:0 0 8px;font-size:20px;">⚡ Nueva cotización recibida</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:14px;">Se ha creado una nueva cotización en el sistema.</p>

    <h3 style="color:${brandDark};font-size:14px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Productos Seleccionados</h3>
    ${itemsTable(quote.quote_items)}
    ${priceBreakdownSection(quote)}
    ${reservationInfoSection(quote)}

    <a href="${adminLink}" style="display:inline-block;background:${brandDark};color:#fff;font-weight:900;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:8px;">Ver cotización completa →</a>
  `;

    return {
        subject: `[Nueva Cotización] ${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''} – ${eventDate} – ${formatCurrency(quote.total_price)}`,
        html: baseLayout(content),
    };
}


// ─── Email 3: Confirmación de reserva → al cliente ───────────────────────────

export function buildQuoteConfirmedEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const halfAmount = quote.total_price / 2;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const fullName = `${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''}`;
    const resumeLink = `${SITE_URL}/cotizar/${quote.token}`;
    const content = `
    <h2 style="color:#059669;margin:0 0 8px;font-size:22px;">✅ ¡Reserva confirmada!</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:15px;">Hola <strong>${fullName}</strong>, tu reserva para el <strong>${eventDate}</strong> ha sido confirmada exitosamente.</p>

    <!-- Monto a pagar -->
    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="color:#166534;margin:0 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Abono para asegurar fecha (50%)</p>
      <p style="color:#059669;margin:0;font-size:36px;font-weight:900;">${formatCurrency(halfAmount)}</p>
      <p style="color:#166534;margin:8px 0 0;font-size:12px;">El 50% restante (${formatCurrency(halfAmount)}) se paga el día del montaje.</p>
    </div>

    <!-- Detalle de Productos -->
    <h3 style="color:${brandDark};font-size:14px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Detalle de tu pedido</h3>
    ${itemsTable(quote.quote_items)}
    ${priceBreakdownSection(quote)}

    <!-- Datos de Transferencia -->
    <div style="background:${lightGray};border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Datos de Transferencia</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;width:45%;">Banco</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Mercado Pago</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Tipo de cuenta</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Cuenta Vista</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Número</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">1098081647</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Felipe Ramírez</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">RUT</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">15.332.189-2</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Email</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">contacto@cocktailsontap.cl</td></tr>
      </table>
    </div>

    ${reservationInfoSection(quote)}

    <div style="margin-bottom:32px;text-align:center;">
      <p style="color:${gray};font-size:14px;margin-bottom:12px;">Puedes revisar los detalles actualizados de tu reserva en el siguiente enlace:</p>
      <a href="${resumeLink}" style="display:inline-block;color:${brandColor};font-weight:700;font-size:14px;text-decoration:underline;">Ver detalles de tu reserva →</a>
    </div>

    <p style="color:${gray};font-size:13px;margin:0 0 8px;">Una vez realizada la transferencia, envíanos el comprobante por WhatsApp para confirmar tu pago.</p>
    <a href="https://wa.me/56929672978" style="display:inline-block;background:#25D366;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">Enviar comprobante por WhatsApp →</a>

    <p style="color:${gray};font-size:13px;margin-top:24px;">Si tienes preguntas, escríbenos a <a href="mailto:contacto@cocktailsontap.cl" style="color:${brandColor};">contacto@cocktailsontap.cl</a></p>
  `;

    return {
        subject: `✅ Reserva confirmada – ${eventDate}`,
        html: baseLayout(content),
    };
}


// ─── Email 4: Notificación al administrador (reserva confirmada) ──────────────

export function buildAdminConfirmationNotificationEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const adminLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
    <h2 style="color:#059669;margin:0 0 8px;font-size:20px;">✅ Reserva Confirmada por el Cliente</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:14px;">El cliente ha confirmado su reserva y debería estar realizando la transferencia.</p>

    <h3 style="color:${brandDark};font-size:14px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Pedido Confirmado</h3>
    ${itemsTable(quote.quote_items)}
    ${priceBreakdownSection(quote)}
    ${reservationInfoSection(quote)}

    <a href="${adminLink}" style="display:inline-block;background:#059669;color:#fff;font-weight:900;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:8px;">Ver reserva confirmada →</a>
  `;

    return {
        subject: `✅ [Reserva Confirmada] ${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''} – ${eventDate}`,
        html: baseLayout(content),
    };
}

// Re-export constant for backward compatibility with any direct import
export { MURO_INSTALLATION_COST };
