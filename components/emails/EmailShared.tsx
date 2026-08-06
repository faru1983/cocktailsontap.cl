import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Link, Img } from '@react-email/components';
import { formatCurrency } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import { SITE_URL, LOGO_URL, CONTACT_EMAIL, WHATSAPP_URL } from '@/lib/config';
import type { Quote, QuoteItem } from '@/lib/types';

export const brandColor = '#E2A049';
export const brandDark  = '#1a1a2e';
export const gray       = '#64748b';
export const lightGray  = '#f8fafc';
export const borderColor = '#e2e8f0';
export const greenColor  = '#059669';
export const whatsappColor = '#25D366';

export function fullName(quote: Quote): string {
    return `${quote.client_name}${quote.client_lastname ? ' ' + quote.client_lastname : ''}`;
}

export const BaseLayout: React.FC<{ preview: string, accentColor?: string, children: React.ReactNode }> = ({ preview, accentColor = brandColor, children }) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ margin: 0, padding: 0, backgroundColor: '#f1f5f9', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>
      <Container style={{ margin: '24px auto', maxWidth: '600px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Section style={{ height: '4px', backgroundColor: accentColor, fontSize: 0 }}>&nbsp;</Section>
        <Section style={{ backgroundColor: '#ffffff', padding: '24px 24px 20px', textAlign: 'center', borderBottom: `1px solid ${borderColor}` }}>
          <Link href={SITE_URL} style={{ display: 'inline-block', textDecoration: 'none' }}>
            <Img src={LOGO_URL} alt="Cocktails on Tap" width="180" style={{ display: 'block', margin: '0 auto', maxWidth: '180px', height: 'auto' }} />
          </Link>
        </Section>
        <Section style={{ padding: '32px 24px' }}>
          {children}
        </Section>
        <Section style={{ backgroundColor: lightGray, borderTop: `1px solid ${borderColor}`, padding: '20px 24px', textAlign: 'center' }}>
          <Text style={{ color: gray, fontSize: '12px', margin: '0 0 6px' }}>
            <Link href={SITE_URL} style={{ color: brandColor, fontWeight: 700, textDecoration: 'none' }}>www.cocktailsontap.cl</Link>
            &nbsp;&bull;&nbsp;
            <Link href={`mailto:${CONTACT_EMAIL}`} style={{ color: gray, textDecoration: 'none' }}>{CONTACT_EMAIL}</Link>
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>© Cocktails on Tap Chile</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const QuoteButton: React.FC<{ url: string, label?: string, bg?: string, textColor?: string }> = ({ url, label = 'Ver detalles de la cotización →', bg = brandDark, textColor = '#fff' }) => (
  <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
    <Link href={url} style={{ display: 'inline-block', backgroundColor: bg, color: textColor, fontWeight: 900, fontSize: '15px', padding: '14px 32px', borderRadius: '12px', textDecoration: 'none', letterSpacing: '0.3px' }}>
      {label}
    </Link>
  </Section>
);

export const ContactNote: React.FC = () => (
  <Section style={{ backgroundColor: lightGray, borderRadius: '10px', padding: '16px 20px', marginTop: '24px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
    <Text style={{ color: gray, fontSize: '13px', margin: '0 0 8px', lineHeight: '1.6' }}>
      ¿Tienes dudas? Puedes responder directamente este correo o escribirnos por WhatsApp.
    </Text>
    <Link href={WHATSAPP_URL} style={{ display: 'inline-block', backgroundColor: whatsappColor, color: '#fff', fontWeight: 700, fontSize: '13px', padding: '9px 20px', borderRadius: '8px', textDecoration: 'none' }}>
      💬 Escribir por WhatsApp
    </Link>
  </Section>
);

export const ItemsTable: React.FC<{ items: QuoteItem[] }> = ({ items }) => (
  <table width="100%" cellPadding="0" cellSpacing="0" style={{ margin: '12px 0' }}>
    <thead>
      <tr>
        <th align="left" style={{ fontSize: '11px', textTransform: 'uppercase', color: gray, paddingBottom: '8px', borderBottom: `2px solid ${brandColor}` }}>Cóctel</th>
        <th align="center" style={{ fontSize: '11px', textTransform: 'uppercase', color: gray, paddingBottom: '8px', borderBottom: `2px solid ${brandColor}` }}>Cant.</th>
        <th align="right" style={{ fontSize: '11px', textTransform: 'uppercase', color: gray, paddingBottom: '8px', borderBottom: `2px solid ${brandColor}` }}>Precio</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item, idx) => {
        const hasOffer = (item.price_at_time || 0) > (item.offer_price_at_time || 0);
        return (
          <tr key={idx}>
            <td style={{ padding: '10px 0', borderBottom: `1px solid ${borderColor}`, fontSize: '14px', color: brandDark }}>
              <strong>{item.product_name}</strong> <span style={{ color: gray }}>({item.size})</span>
            </td>
            <td style={{ padding: '10px 0', borderBottom: `1px solid ${borderColor}`, textAlign: 'center', color: gray, fontSize: '14px' }}>
              x{item.quantity}
            </td>
            <td style={{ padding: '10px 0', borderBottom: `1px solid ${borderColor}`, textAlign: 'right', fontSize: '14px' }}>
              {hasOffer && (
                <><span style={{ textDecoration: 'line-through', color: gray, fontSize: '12px' }}>{formatCurrency(item.price_at_time * item.quantity)}</span><br/></>
              )}
              <strong style={{ color: greenColor }}>{formatCurrency(item.offer_price_at_time * item.quantity)}</strong>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const YieldsSection: React.FC<{ quote: Quote, isDirect?: boolean }> = ({ quote, isDirect = false }) => {
  const totalLiters = quote.total_liters ?? 0;
  const totalDrinks = totalLiters * 5;
  const guests = Math.max(quote.guests, 1);
  const avgDrinks = (totalDrinks / guests).toFixed(1);

  return (
    <Section style={{ backgroundColor: lightGray, borderRadius: '12px', padding: '20px', margin: '24px 0', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
      <Text style={{ color: brandDark, fontSize: '11px', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>Rendimientos Estimados</Text>
      <table width="100%" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td style={{ width: isDirect ? '50%' : '33%', padding: '0 4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: brandColor }}>{totalLiters}L</div>
              <div style={{ fontSize: '10px', color: gray, textTransform: 'uppercase', fontWeight: 700 }}>Volumen Total</div>
            </td>
            <td style={{ width: isDirect ? '50%' : '34%', padding: '0 4px', borderLeft: `1px solid ${borderColor}`, borderRight: isDirect ? 'none' : `1px solid ${borderColor}` }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: brandColor }}>{totalDrinks}</div>
              <div style={{ fontSize: '10px', color: gray, textTransform: 'uppercase', fontWeight: 700 }}>Cócteles Totales</div>
            </td>
            {!isDirect && (
              <td style={{ width: '33%', padding: '0 4px' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, color: brandColor }}>{avgDrinks}</div>
                <div style={{ fontSize: '10px', color: gray, textTransform: 'uppercase', fontWeight: 700 }}>Tragos x Persona</div>
              </td>
            )}
          </tr>
        </tbody>
      </table>
      {!isDirect && <Text style={{ color: gray, fontSize: '11px', margin: '12px 0 0', fontStyle: 'italic' }}>*Rendimiento basado en vasos estándar con 200ml de cóctel.</Text>}
    </Section>
  );
};

export const PriceBreakdownSection: React.FC<{ quote: Quote, isDirect?: boolean }> = ({ quote, isDirect = false }) => {
  let dispenserLabel = quote.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil';
  if (isDirect || quote.service_type === 'direct') dispenserLabel = 'Barril Desechable';
  
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

  return (
    <table width="100%" cellPadding="0" cellSpacing="0" style={{ margin: '0 0 28px', borderTop: `2px solid ${brandColor}`, paddingTop: '12px' }}>
      <tbody>
        {hasDiscount && (
          <tr>
            <td style={{ fontSize: '13px', color: gray, padding: '3px 0', width: '55%' }}>Subtotal</td>
            <td style={{ fontSize: '13px', color: gray, textAlign: 'right' }}>{formatCurrency(quote.total_normal_price)}</td>
          </tr>
        )}
        {hasDiscount && (
          <tr>
            <td style={{ fontSize: '13px', color: greenColor, padding: '3px 0' }}>Descuento</td>
            <td style={{ fontSize: '13px', color: greenColor, textAlign: 'right' }}>-{formatCurrency(quote.total_normal_price - quote.total_offer_price)}</td>
          </tr>
        )}
        {!hasDiscount && (
          <tr>
            <td style={{ fontSize: '13px', color: gray, padding: '3px 0', width: '55%' }}>Subtotal</td>
            <td style={{ fontSize: '13px', color: gray, textAlign: 'right' }}>{formatCurrency(quote.total_normal_price)}</td>
          </tr>
        )}
        <tr>
          <td style={{ fontSize: '13px', color: gray, padding: '3px 0' }}>Transporte</td>
          <td style={{ fontSize: '13px', color: shippingColor, textAlign: 'right' }}>{shippingLabel}</td>
        </tr>
        {!isDirect && (
          <tr>
            <td style={{ fontSize: '13px', color: gray, padding: '3px 0' }}>{dispenserLabel}</td>
            <td style={{ fontSize: '13px', color: quote.installation_cost === 0 ? greenColor : gray, textAlign: 'right' }}>{quote.installation_cost === 0 ? '¡Gratis!' : formatCurrency(quote.installation_cost)}</td>
          </tr>
        )}
        <tr style={{ borderTop: `1px solid ${borderColor}` }}>
          <td style={{ fontSize: '17px', color: brandDark, fontWeight: 900, padding: '10px 0 0' }}>TOTAL</td>
          <td style={{ fontSize: '17px', color: brandDark, fontWeight: 900, textAlign: 'right', padding: '10px 0 0' }}>{formatCurrency(quote.total_price)}</td>
        </tr>
        <tr>
          <td colSpan={2} style={{ fontSize: '11px', color: gray, padding: '6px 0 0', fontWeight: 500 }}>
            Valores netos. No incluyen IVA.
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export const ReservationInfoSection: React.FC<{ quote: Quote, isDirect?: boolean }> = ({ quote, isDirect = false }) => {
  const directMode = isDirect || (quote as any).isDirect || quote.service_type === 'direct';
  const comunaDisplay = quote.comuna_name === 'Otra' ? (quote.comuna_other || '') : (quote.comuna_name || '');
  const fullAddress   = [quote.client_address, comunaDisplay].filter(Boolean).join(', ');
  const eventDate     = quote.event_date
      ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '';
  const clientFullName = fullName(quote);

  const Row = ({ label, value }: { label: string, value: string | React.ReactNode }) => (
    <tr>
      <td style={{ fontSize: '12px', color: gray, padding: '3px 0', width: '38%', verticalAlign: 'top' }}>{label}</td>
      <td style={{ fontSize: '14px', color: brandDark, fontWeight: 700, padding: '3px 0' }}>{value}</td>
    </tr>
  );

  return (
    <>
      <Section style={{ backgroundColor: lightGray, borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', border: `1px solid ${borderColor}` }}>
        <Text style={{ color: brandDark, fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>
          {directMode ? 'Información de Contacto' : 'Información de Reserva'}
        </Text>
        <table width="100%" cellPadding="0" cellSpacing="0">
          <tbody>
            <Row label="Nombre" value={clientFullName} />
            <Row label="Email" value={quote.client_email || ''} />
            {quote.client_phone && <Row label="Celular" value={formatPhoneDisplay(quote.client_phone)} />}
            {fullAddress && <Row label="Dirección" value={fullAddress} />}
            {!directMode && <Row label="Evento" value={`${quote.event_type_other || quote.event_type_id || 'No especificado'} • ${quote.guests} pers.`} />}
            <Row label={directMode ? "Fecha Despacho" : "Fecha"} value={`${eventDate}${(!directMode && quote.start_time && quote.start_time !== '--:--') ? ` • ${quote.start_time}` : ''}`} />
            {!directMode && quote.pickup_date && <Row label="Retiro" value={`${new Date(quote.pickup_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}${quote.pickup_time ? ` • ${quote.pickup_time}` : ''}`} />}
          </tbody>
        </table>
      </Section>
      {quote.comments && (
        <Section style={{ backgroundColor: '#fffbeb', borderLeft: `3px solid ${brandColor}`, borderRadius: '6px', padding: '14px 18px', marginBottom: '24px' }}>
          <Text style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: brandColor, fontWeight: 700, margin: '0 0 6px' }}>Comentarios</Text>
          <Text style={{ fontSize: '14px', color: brandDark, fontStyle: 'italic', margin: 0 }}>"{quote.comments}"</Text>
        </Section>
      )}
    </>
  );
};
