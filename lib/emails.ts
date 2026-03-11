import { formatCurrency } from '@/lib/utils';
import type { Quote, QuoteItem } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cocktailsontap.cl';

const brandColor = '#E2A049';
const brandDark = '#1a1a2e';
const gray = '#64748b';
const lightGray = '#f8fafc';
const borderColor = '#e2e8f0';

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
          <td style="background:${brandDark};padding:32px 40px;text-align:center;">
            <h1 style="color:${brandColor};margin:0;font-size:22px;letter-spacing:1px;font-weight:900;">🍸 Cocktails on Tap</h1>
            <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">cocktailsontap.cl</p>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:40px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:${lightGray};border-top:1px solid ${borderColor};padding:24px 40px;text-align:center;">
            <p style="color:${gray};font-size:12px;margin:0;">Cocktails on Tap Chile &bull; contacto@cocktailsontap.cl</p>
            <p style="color:${gray};font-size:12px;margin:4px 0 0;">Este email fue generado automáticamente, por favor no respondas a este correo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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
      <th align="left" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Producto</th>
      <th align="center" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Cant.</th>
      <th align="right" style="font-size:12px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Precio</th>
    </tr>
    ${rows}
  </table>`;
}

// ─── Email 1: Cotización creada → al cliente ──────────────────────────────────

export function buildQuoteCreatedClientEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const resumeLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';

    const content = `
    <h2 style="color:${brandDark};margin:0 0 8px;font-size:22px;">¡Hemos recibido tu cotización!</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:15px;">Hola <strong>${quote.client_name}</strong>, aquí tienes el resumen de tu solicitud.</p>

    <h3 style="color:${brandDark};font-size:15px;margin:0 0 4px;">Productos seleccionados</h3>
    ${itemsTable(quote.quote_items)}

    <div style="border-top:2px solid ${brandColor};padding-top:12px;margin-top:4px;margin-bottom:32px;">
      ${quote.total_normal_price > quote.total_offer_price ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:${gray};font-size:13px;">Subtotal</span><span style="color:${gray};font-size:13px;text-decoration:line-through;">${formatCurrency(quote.total_normal_price)}</span></div>` : ''}
      ${quote.shipping_cost > 0 ? `<div style="margin-bottom:4px;color:${gray};font-size:13px;">Transporte: ${formatCurrency(quote.shipping_cost)}</div>` : `<div style="margin-bottom:4px;color:#059669;font-size:13px;">Transporte: ¡Gratis!</div>`}
      ${quote.installation_cost > 0 ? `<div style="margin-bottom:4px;color:${gray};font-size:13px;">Dispensador: ${formatCurrency(quote.installation_cost)}</div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <strong style="color:${brandDark};font-size:17px;">TOTAL</strong>
        <strong style="color:${brandColor};font-size:21px;">${formatCurrency(quote.total_price)}</strong>
      </div>
    </div>

    <div style="background:${lightGray};border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Datos de Contacto</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_name}</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Email</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_email}</td></tr>
        ${quote.client_phone ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Celular</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_phone}</td></tr>` : ''}
        <tr>
          <td style="font-size:13px;color:${gray};padding:4px 0;">Dirección</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${[quote.client_address, quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name].filter(Boolean).join(', ')}</td>
        </tr>
      </table>
    </div>

    <div style="background:${lightGray};border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Detalles del Evento</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Temática</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.event_type_other || quote.event_type_id || 'No especificada'}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Invitados</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.guests} personas</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:${gray};padding:4px 0;">Fecha del Evento</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${eventDate}</td>
        </tr>
        ${quote.start_time ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Hora Inicio</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.start_time}</td></tr>` : ''}
        ${quote.pickup_date ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Fecha Retiro</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${new Date(quote.pickup_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>` : ''}
        ${quote.pickup_time ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Horario Retiro</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.pickup_time}</td></tr>` : ''}
        ${quote.comments ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Comentarios</td><td style="font-size:14px;color:${brandDark};font-weight:400;font-style:italic;padding:4px 0;">"${quote.comments}"</td></tr>` : ''}
      </table>
    </div>

    <div style="background:${brandColor};border-radius:12px;padding:24px;margin-top:32px;text-align:center;">
      <p style="color:#fff;margin:0 0 16px;font-size:15px;font-weight:700;">¿Listo para confirmar tu reserva?</p>
      <a href="${resumeLink}" style="display:inline-block;background:#fff;color:${brandDark};font-weight:900;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Ver y confirmar cotización →</a>
      <p style="color:rgba(255,255,255,0.8);margin:12px 0 0;font-size:12px;">${resumeLink}</p>
    </div>

    <p style="color:${gray};font-size:13px;margin-top:24px;">Si tienes dudas, escríbenos por WhatsApp al <a href="https://wa.me/56929672978" style="color:${brandColor};">+56 9 2967 2978</a></p>
  `;

    return {
        subject: `Tu cotización de Cocktails on Tap – ${eventDate}`,
        html: baseLayout(content),
    };
}

// ─── Email 2: Notificación al administrador ───────────────────────────────────

export function buildAdminNotificationEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const adminLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';

    const content = `
    <h2 style="color:${brandDark};margin:0 0 8px;font-size:20px;">⚡ Nueva cotización recibida</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:14px;">Se ha creado una nueva cotización en el sistema.</p>

    <h3 style="color:${brandDark};font-size:14px;margin:0 0 4px;">Productos</h3>
    ${itemsTable(quote.quote_items)}
    
    <div style="margin-top:16px;margin-bottom:32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:14px;color:${gray};padding:4px 0;width:40%;">Total</td><td style="font-size:18px;color:${brandColor};font-weight:900;padding:4px 0;">${formatCurrency(quote.total_price)}</td></tr>
      </table>
    </div>

    <div style="background:${lightGray};border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Datos de Contacto</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_name}</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Email</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_email}</td></tr>
        ${quote.client_phone ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Celular</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.client_phone}</td></tr>` : ''}
        <tr>
          <td style="font-size:13px;color:${gray};padding:4px 0;">Dirección</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${[quote.client_address, quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name].filter(Boolean).join(', ')}</td>
        </tr>
      </table>
    </div>

    <div style="background:${lightGray};border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Detalles del Evento</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Temática</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.event_type_other || quote.event_type_id || 'No especificada'}</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;width:40%;">Invitados</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.guests} personas</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:4px 0;">Evento</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${eventDate}</td></tr>
        ${quote.start_time ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Hora Inicio</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.start_time}</td></tr>` : ''}
        ${quote.comments ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Comentarios</td><td style="font-size:14px;color:${brandDark};font-weight:400;font-style:italic;padding:4px 0;">"${quote.comments}"</td></tr>` : ''}
      </table>
    </div>

    <a href="${adminLink}" style="display:inline-block;background:${brandDark};color:#fff;font-weight:900;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:16px;">Ver cotización completa →</a>
  `;

    return {
        subject: `[Nueva Cotización] ${quote.client_name} – ${eventDate} – ${formatCurrency(quote.total_price)}`,
        html: baseLayout(content),
    };
}

// ─── Email 3: Confirmación de reserva → al cliente ───────────────────────────

export function buildQuoteConfirmedEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const halfAmount = quote.total_price / 2;
    const eventDate = quote.event_date ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';

    const content = `
    <h2 style="color:#059669;margin:0 0 8px;font-size:22px;">✅ ¡Reserva confirmada!</h2>
    <p style="color:${gray};margin:0 0 24px;font-size:15px;">Hola <strong>${quote.client_name}</strong>, tu reserva para el <strong>${eventDate}</strong> ha sido confirmada. Para asegurarla, debes abonar el 50% del total.</p>

    <!-- Monto a pagar -->
    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="color:#166534;margin:0 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Monto a abonar ahora (50%)</p>
      <p style="color:#059669;margin:0;font-size:36px;font-weight:900;">${formatCurrency(halfAmount)}</p>
      <p style="color:#166534;margin:8px 0 0;font-size:12px;">El 50% restante (${formatCurrency(halfAmount)}) se paga el día del montaje del evento.</p>
    </div>

    <!-- Datos bancarios -->
    <div style="background:${lightGray};border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid ${borderColor};">
      <h3 style="color:${brandDark};margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Resumen del Evento</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;width:45%;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">${quote.client_name}</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Temática</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">${quote.event_type_other || quote.event_type_id || 'No especificada'}</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Invitados</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">${quote.guests} pers.</td></tr>
        <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Fecha</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">${eventDate}</td></tr>
        ${quote.start_time ? `<tr><td style="font-size:13px;color:${gray};padding:4px 0;">Hora Inicio</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:4px 0;">${quote.start_time}</td></tr>` : ''}
        <tr>
          <td style="font-size:13px;color:${gray};padding:5px 0;">Dirección</td>
          <td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">${[quote.client_address, quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name].filter(Boolean).join(', ')}</td>
        </tr>
      </table>
      <div style="margin-top:16px;border-top:1px solid ${borderColor};padding-top:16px;">
        <h3 style="color:${brandDark};margin:0 0 12px;font-size:15px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">📲 Datos de Transferencia</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;width:45%;">Banco</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Mercado Pago</td></tr>
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Tipo de cuenta</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Cuenta Vista</td></tr>
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Número</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">1098081647</td></tr>
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Nombre</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">Felipe Ramírez</td></tr>
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;">RUT</td><td style="font-size:14px;color:${brandDark};font-weight:700;padding:5px 0;">15.332.189-2</td></tr>
          <tr><td style="font-size:13px;color:${gray};padding:5px 0;">Total Abono</td><td style="font-size:16px;color:#059669;font-weight:900;padding:5px 0;">${formatCurrency(halfAmount)}</td></tr>
        </table>
      </div>
    </div>

    <p style="color:${gray};font-size:13px;margin:0 0 8px;">Una vez realizada la transferencia, envíanos el comprobante por WhatsApp para confirmar tu pago.</p>
    <a href="https://wa.me/56929672978" style="display:inline-block;background:#25D366;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">Enviar comprobante por WhatsApp →</a>

    <p style="color:${gray};font-size:13px;margin-top:24px;">Si tienes preguntas, escríbenos a <a href="mailto:contacto@cocktailsontap.cl" style="color:${brandColor};">contacto@cocktailsontap.cl</a></p>
  `;

    return {
        subject: `✅ Reserva confirmada – ${eventDate} – Cocktails on Tap`,
        html: baseLayout(content),
    };
}
