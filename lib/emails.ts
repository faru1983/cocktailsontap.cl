import { formatCurrency } from '@/lib/utils';
import { 
    SITE_URL, 
    LOGO_URL, 
    MURO_INSTALLATION_COST, 
    CONTACT_EMAIL, 
    WHATSAPP_URL 
} from '@/lib/config';
import type { Quote, QuoteItem } from '@/lib/types';

// ─── Tokens de diseño ────────────────────────────────────────────────────────
const brandColor = '#E2A049';
const brandDark  = '#1a1a2e';
const gray       = '#64748b';
const lightGray  = '#f8fafc';
const borderColor = '#e2e8f0';
const greenColor  = '#059669';
const whatsappColor = '#25D366';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fullName(quote: Quote): string {
    return `${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''}`;
}

function baseLayout(content: string, accentColor = brandColor): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td style="background:${accentColor};height:4px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background:#ffffff;padding:24px 24px 20px;text-align:center;border-bottom:1px solid ${borderColor};">
            <a href="${SITE_URL}" style="display:inline-block;text-decoration:none;">
              <img src="${LOGO_URL}" alt="Cocktails on Tap" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
            </a>
          </td>
        </tr>
        <tr><td style="padding:32px 24px;">${content}</td></tr>
        <tr>
          <td style="background:${lightGray};border-top:1px solid ${borderColor};padding:20px 24px;text-align:center;">
            <p style="color:${gray};font-size:12px;margin:0 0 6px;">
              <a href="${SITE_URL}" style="color:${brandColor};font-weight:700;text-decoration:none;">www.cocktailsontap.cl</a>
              &nbsp;&bull;&nbsp;
              <a href="mailto:${CONTACT_EMAIL}" style="color:${gray};text-decoration:none;">${CONTACT_EMAIL}</a>
            </p>
            <p style="color:#94a3b8;font-size:11px;margin:0;">© Cocktails on Tap Chile</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function quoteButton(url: string, label = 'Ver detalles de la cotización →', bg = brandDark, textColor = '#fff'): string {
    return `<div style="text-align:center;margin:24px 0 8px;">
  <a href="${url}" style="display:inline-block;background:${bg};color:${textColor};font-weight:900;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">${label}</a>
</div>`;
}

function contactNote(): string {
    return `<div style="background:${lightGray};border-radius:10px;padding:16px 20px;margin-top:24px;border:1px solid ${borderColor};text-align:center;">
  <p style="color:${gray};font-size:13px;margin:0 0 8px;line-height:1.6;">
    ¿Tienes dudas? Puedes responder directamente este correo o escribirnos por WhatsApp.
  </p>
  <a href="${WHATSAPP_URL}" style="display:inline-block;background:${whatsappColor};color:#fff;font-weight:700;font-size:13px;padding:9px 20px;border-radius:8px;text-decoration:none;">
    💬 Escribir por WhatsApp
  </a>
</div>`;
}

function itemsTable(items: QuoteItem[]): string {
    const rows = items.map(item => {
        const hasOffer = (item.price_at_time || 0) > (item.offer_price_at_time || 0);
        return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${borderColor};font-size:14px;color:${brandDark};">
    <strong>${item.product_name}</strong> <span style="color:${gray};">(${item.size})</span>
  </td>
  <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:center;color:${gray};font-size:14px;">x${item.quantity}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:right;font-size:14px;">
    ${hasOffer ? `<span style="text-decoration:line-through;color:${gray};font-size:12px;">${formatCurrency(item.price_at_time * item.quantity)}</span><br/>` : ''}
    <strong style="color:${greenColor};">${formatCurrency(item.offer_price_at_time * item.quantity)}</strong>
  </td>
</tr>`;
    }).join('');

    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
  <tr>
    <th align="left" style="font-size:11px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Cóctel</th>
    <th align="center" style="font-size:11px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Cant.</th>
    <th align="right" style="font-size:11px;text-transform:uppercase;color:${gray};padding-bottom:8px;border-bottom:2px solid ${brandColor};">Precio</th>
  </tr>
  ${rows}
</table>`;
}

function priceBreakdownSection(quote: Quote): string {
    const dispenserLabel = quote.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil';
    const hasDiscount = quote.total_normal_price > quote.total_offer_price;
    const isOtra = quote.comuna_name === 'Otra';

    let shippingLabel = formatCurrency(quote.shipping_cost);
    let shippingColor = gray;

    if (isOtra) {
        shippingLabel = 'Pendiente de factibilidad';
        shippingColor = brandColor;
    } else if (quote.shipping_cost === 0) {
        shippingLabel = '¡Gratis!';
        shippingColor = greenColor;
    }

    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border-top:2px solid ${brandColor};padding-top:12px;">
  ${hasDiscount ? `
  <tr>
    <td style="font-size:13px;color:${gray};padding:3px 0;width:55%;">Subtotal</td>
    <td style="font-size:13px;color:${gray};text-align:right;">${formatCurrency(quote.total_normal_price)}</td>
  </tr>
  <tr>
    <td style="font-size:13px;color:${greenColor};padding:3px 0;">Descuento</td>
    <td style="font-size:13px;color:${greenColor};text-align:right;">-${formatCurrency(quote.total_normal_price - quote.total_offer_price)}</td>
  </tr>` : `
  <tr>
    <td style="font-size:13px;color:${gray};padding:3px 0;width:55%;">Subtotal</td>
    <td style="font-size:13px;color:${gray};text-align:right;">${formatCurrency(quote.total_normal_price)}</td>
  </tr>`}
  <tr>
    <td style="font-size:13px;color:${gray};padding:3px 0;">Transporte</td>
    <td style="font-size:13px;color:${shippingColor};text-align:right;">${shippingLabel}</td>
  </tr>
  <tr>
    <td style="font-size:13px;color:${gray};padding:3px 0;">${dispenserLabel}</td>
    <td style="font-size:13px;${quote.installation_cost === 0 ? `color:${greenColor};` : `color:${gray};`}text-align:right;">${quote.installation_cost === 0 ? '¡Gratis!' : formatCurrency(quote.installation_cost)}</td>
  </tr>
  <tr style="border-top:1px solid ${borderColor};">
    <td style="font-size:17px;color:${brandDark};font-weight:900;padding:10px 0 0;">TOTAL</td>
    <td style="font-size:17px;color:${brandDark};font-weight:900;text-align:right;padding:10px 0 0;">${formatCurrency(quote.total_price)}</td>
  </tr>
</table>`;
}

function yieldsSection(quote: Quote): string {
    const totalLiters = quote.total_liters ?? 0;
    const totalDrinks = totalLiters * 5;
    const guests = Math.max(quote.guests, 1);
    const avgDrinks = (totalDrinks / guests).toFixed(1);

    return `<div style="background:${lightGray};border-radius:12px;padding:20px;margin:24px 0;border:1px solid ${borderColor};text-align:center;">
  <p style="color:${brandDark};font-size:11px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Rendimientos Estimados</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:33%;padding:0 4px;">
        <div style="font-size:18px;font-weight:900;color:${brandColor};">${totalLiters}L</div>
        <div style="font-size:10px;color:${gray};text-transform:uppercase;font-weight:700;">Volumen Total</div>
      </td>
      <td style="width:34%;padding:0 4px;border-left:1px solid ${borderColor};border-right:1px solid ${borderColor};">
        <div style="font-size:18px;font-weight:900;color:${brandColor};">${totalDrinks}</div>
        <div style="font-size:10px;color:${gray};text-transform:uppercase;font-weight:700;">Cócteles Totales</div>
      </td>
      <td style="width:33%;padding:0 4px;">
        <div style="font-size:18px;font-weight:900;color:${brandColor};">${avgDrinks}</div>
        <div style="font-size:10px;color:${gray};text-transform:uppercase;font-weight:700;">Tragos x Persona</div>
      </td>
    </tr>
  </table>
  <p style="color:${gray};font-size:11px;margin:12px 0 0;font-style:italic;">*Rendimiento basado en vasos estándar con 200ml de cóctel.</p>
</div>`;
}

function reservationInfoSection(quote: Quote): string {
    const comunaDisplay = quote.comuna_name === 'Otra' ? (quote.comuna_other || '') : (quote.comuna_name || '');
    const fullAddress   = [quote.client_address, comunaDisplay].filter(Boolean).join(', ');
    const eventDate     = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '';
    const clientFullName = fullName(quote);

    const row = (label: string, value: string) =>
        `<tr>
  <td style="font-size:12px;color:${gray};padding:3px 0;width:38%;vertical-align:top;">${label}</td>
  <td style="font-size:14px;color:${brandDark};font-weight:700;padding:3px 0;">${value}</td>
</tr>`;

    return `<div style="background:${lightGray};border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid ${borderColor};">
  <h3 style="color:${brandDark};font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1.5px;">Información de Reserva</h3>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${row('Nombre', clientFullName)}
    ${row('Email', quote.client_email || '')}
    ${quote.client_phone ? row('Celular', quote.client_phone) : ''}
    ${fullAddress ? row('Dirección', fullAddress) : ''}
    ${row('Evento', `${quote.event_type_other || quote.event_type_id || 'No especificado'} &bull; ${quote.guests} pers.`)}
    ${row('Fecha', `${eventDate}${quote.start_time && quote.start_time !== '--:--' ? ` &bull; ${quote.start_time}` : ''}`)}
    ${quote.pickup_date ? row('Retiro', `${new Date(quote.pickup_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}${quote.pickup_time ? ` &bull; ${quote.pickup_time}` : ''}`) : ''}
  </table>
</div>
${quote.comments ? `<div style="background:#fffbeb;border-left:3px solid ${brandColor};border-radius:6px;padding:14px 18px;margin-bottom:24px;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${brandColor};font-weight:700;margin:0 0 6px;">Comentarios</p>
  <p style="font-size:14px;color:${brandDark};font-style:italic;margin:0;">"${quote.comments}"</p>
</div>` : ''}`;
}

export function buildQuoteCreatedClientEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const resumeLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate  = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
<h2 style="color:${brandDark};margin:0 0 8px;font-size:22px;line-height:1.3;">¡Hemos recibido tu cotización!</h2>
<p style="color:${gray};margin:0 0 28px;font-size:15px;line-height:1.6;">
  Hola <strong>${fullName(quote)}</strong>, aquí tienes el resumen de tu solicitud para el evento del <strong>${eventDate}</strong>.
</p>
${itemsTable(quote.quote_items)}
${yieldsSection(quote)}
${priceBreakdownSection(quote)}
${reservationInfoSection(quote)}
<div style="background:${brandColor};border-radius:14px;padding:24px;text-align:center;">
  <p style="color:#fff;margin:0 0 14px;font-size:15px;font-weight:700;line-height:1.4;">¿Todo en orden? Revisa y confirma tu reserva ahora.</p>
  ${quoteButton(resumeLink, 'Revisar y confirmar cotización →', '#ffffff', brandDark)}
</div>
${contactNote()}`;

    return { subject: `🍸 Tu cotización – ${eventDate}`, html: baseLayout(content, brandColor) };
}

export function buildAdminNotificationEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const adminLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
<h2 style="color:${brandDark};margin:0 0 8px;font-size:20px;line-height:1.3;">⚡ Nueva cotización recibida</h2>
${itemsTable(quote.quote_items)}
${yieldsSection(quote)}
${priceBreakdownSection(quote)}
${reservationInfoSection(quote)}
${quoteButton(adminLink, 'Ver cotización completa →', brandDark)}`;

    return { subject: `[Nueva Cotización] ${fullName(quote)} – ${eventDate}`, html: baseLayout(content, brandDark) };
}

export function buildQuoteConfirmedEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const halfAmount = quote.total_price / 2;
    const resumeLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate  = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
<h2 style="color:${greenColor};margin:0 0 8px;font-size:22px;line-height:1.3;">✅ ¡Reserva confirmada!</h2>
<p style="color:${gray};margin:0 0 24px;font-size:15px;line-height:1.6;">
  Hola <strong>${fullName(quote)}</strong>, tu reserva para el <strong>${eventDate}</strong> ha sido confirmada. Para asegurar la fecha, realiza el abono del 50%.
</p>
<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
  <p style="color:#166534;margin:0;font-size:38px;font-weight:900;">${formatCurrency(halfAmount)}</p>
  <p style="color:#166534;margin:10px 0 0;font-size:12px;">El 50% restante se paga el día del montaje.</p>
</div>
<div style="background:${lightGray};border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid ${borderColor};">
  <table width="100%">
    <tr><td><strong>Banco</strong></td><td>Mercado Pago</td></tr>
    <tr><td><strong>Número</strong></td><td>1098081647</td></tr>
    <tr><td><strong>Nombre</strong></td><td>Felipe Ramírez</td></tr>
    <tr><td><strong>RUT</strong></td><td>15.332.189-2</td></tr>
  </table>
</div>
${itemsTable(quote.quote_items)}
${yieldsSection(quote)}
${priceBreakdownSection(quote)}
${reservationInfoSection(quote)}
${quoteButton(resumeLink, 'Ver detalles de tu reserva →', brandDark)}
${contactNote()}`;

    return { subject: `✅ Reserva confirmada – ${eventDate}`, html: baseLayout(content, greenColor) };
}

export function buildAdminConfirmationNotificationEmail(quote: Quote & { quote_items: QuoteItem[] }): { subject: string; html: string } {
    const adminLink = `${SITE_URL}/cotizar/${quote.token}`;
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    const content = `
<h2 style="color:${greenColor};margin:0 0 8px;font-size:20px;line-height:1.3;">✅ Reserva confirmada por el cliente</h2>
<p style="color:${gray};margin:0 0 24px;font-size:14px;"><strong>${fullName(quote)}</strong> ha confirmado su reserva para el ${eventDate}.</p>
${itemsTable(quote.quote_items)}
${yieldsSection(quote)}
${priceBreakdownSection(quote)}
${reservationInfoSection(quote)}
${quoteButton(adminLink, 'Ver reserva confirmada →', greenColor)}`;

    return { subject: `✅ [Reserva Confirmada] ${fullName(quote)} – ${eventDate}`, html: baseLayout(content, greenColor) };
}
