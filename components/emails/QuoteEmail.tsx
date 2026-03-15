import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Heading, Link, Hr } from '@react-email/components';
import type { Quote, QuoteItem } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { formatEventDate } from '@/lib/wizardLogic';

interface QuoteEmailProps {
  quote: Quote & { quote_items: QuoteItem[] };
  isAdmin?: boolean;
}

export const QuoteEmail: React.FC<Readonly<QuoteEmailProps>> = ({ quote, isAdmin = false }) => {
  const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
  const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
  
  const title = isAdmin 
      ? `🚨 Nueva Cotización: ${quote.client_name}` 
      : `Cotización Cócteles on Tap - ${quote.client_name}`;
      
  const greeting = isAdmin 
      ? `Se ha generado una nueva cotización en la web.`
      : `¡Hola ${quote.client_name}! Aquí tienes el resumen de tu cotización en Cócteles on Tap.`;

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{greeting}</Text>
          
          <Section style={section}>
            <Heading as="h2" style={h2}>Resumen del Evento</Heading>
            <Text style={text}><strong>Fecha:</strong> {formatEventDate(quote.event_date || '')} {quote.start_time ? `(${quote.start_time} hrs)` : ''}</Text>
            <Text style={text}><strong>Ubicación:</strong> {quote.client_address}, {quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name}</Text>
            <Text style={text}><strong>Invitados Estimados:</strong> {quote.guests} personas</Text>
            <Text style={text}><strong>Consumo Aproximado:</strong> {quote.drinks_per_person} cócteles por persona</Text>
            <Text style={text}><strong>Total a Servir:</strong> {quote.total_liters || 0} Litros (~{(quote.total_liters || 0) * 4} cócteles)</Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Heading as="h2" style={h2}>Productos Seleccionados</Heading>
            {quote.quote_items.map((item, idx) => (
              <Text key={idx} style={listItem}>
                • {item.quantity}x {item.size} {item.product_name} - {currency.format(item.offer_price_at_time * item.quantity)}
              </Text>
            ))}
            <Text style={listItem}>• Transporte e Instalación: {currency.format((quote.shipping_cost || 0) + (quote.installation_cost || 0))}</Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Heading as="h2" style={h2}>Resumen Financiero</Heading>
            <Text style={text}><strong>Precio Normal:</strong> <span style={{ textDecoration: 'line-through' }}>{currency.format(quote.total_normal_price || 0)}</span></Text>
            <Text style={text}><strong>Precio Oferta:</strong> {currency.format(quote.total_offer_price || 0)}</Text>
            <Text style={totalText}>Total Cotizado: {currency.format(quote.total_price || 0)}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Link href={quoteUrl} style={button}>Ver Cotización Online</Link>
          </Section>

          {!isAdmin && (
            <Text style={footerText}>
              ¿Tienes dudas? Responde este correo o háblanos por WhatsApp y te ayudaremos de inmediato.
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e4e4e7',
  marginTop: '40px',
  paddingLeft: '40px',
  paddingRight: '40px',
};

const h1 = {
  color: '#09090b',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
};

const h2 = {
  color: '#09090b',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
};

const text = {
  color: '#3f3f46',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 8px',
};

const listItem = {
  ...text,
  margin: '0 0 4px',
};

const totalText = {
  color: '#09090b',
  fontSize: '18px',
  fontWeight: '700',
  margin: '16px 0 0',
  padding: '12px',
  backgroundColor: '#f4f4f5',
  borderRadius: '6px',
};

const hr = {
  borderColor: '#e4e4e7',
  margin: '24px 0',
};

const section = {
  margin: '24px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0 24px',
};

const button = {
  backgroundColor: '#09090b',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const footerText = {
  color: '#71717a',
  fontSize: '12px',
  lineHeight: '20px',
  marginTop: '32px',
  textAlign: 'center' as const,
};

export default QuoteEmail;
