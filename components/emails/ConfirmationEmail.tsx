import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Heading, Hr } from '@react-email/components';
import type { Quote, QuoteItem } from '@/lib/types';
import { formatEventDate } from '@/lib/wizardLogic';

interface ConfirmationEmailProps {
  quote: Quote & { quote_items: QuoteItem[] };
  isAdmin?: boolean;
}

export const ConfirmationEmail: React.FC<Readonly<ConfirmationEmailProps>> = ({ quote, isAdmin = false }) => {
  const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
  
  const title = isAdmin 
      ? `✅ Cotización Confirmada: ${quote.client_name}` 
      : '¡Tu Reserva está Confirmada!';
      
  const greeting = isAdmin 
      ? `El cliente ha confirmado la cotización y agendado el evento.`
      : `¡Hola ${quote.client_name}! Excelentes noticias, hemos recibido la confirmación de tu reserva con Cócteles on Tap.`;

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{greeting}</Text>
          
          <Section style={successBox}>
            <Text style={successText}>
              <strong>Reserva Confirmada Oficialmente</strong><br/>
              Nos pondremos en contacto contigo pronto para coordinar los últimos detalles de entrega.
            </Text>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={h2}>Detalles del Evento Confirmado</Heading>
            <Text style={text}><strong>Fecha:</strong> {formatEventDate(quote.event_date || '')} {quote.start_time ? `(${quote.start_time} hrs)` : ''}</Text>
            <Text style={text}><strong>Ubicación:</strong> {quote.client_address}, {quote.comuna_name === 'Otra' ? quote.comuna_other : quote.comuna_name}</Text>
            <Text style={text}><strong>Teléfono:</strong> {quote.client_phone}</Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Heading as="h2" style={h2}>Resumen Final</Heading>
            {quote.quote_items.map((item, idx) => (
              <Text key={idx} style={listItem}>
                • {item.quantity}x {item.size} {item.product_name}
              </Text>
            ))}
            <Text style={totalText}>Total Confirmado: {currency.format(quote.total_price || 0)}</Text>
          </Section>

          {!isAdmin && (
            <Text style={footerText}>
              Falta poco para disfrutar de la mejor coctelería de autor. Si necesitas realizar algún cambio, por favor contáctanos lo antes posible.
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
};

// Styles (Reusing most from QuoteEmail for consistency)
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
  fontSize: '16px',
  fontWeight: '700',
  margin: '16px 0 0',
};

const hr = {
  borderColor: '#e4e4e7',
  margin: '24px 0',
};

const section = {
  margin: '24px 0',
};

const successBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0',
};

const successText = {
  color: '#166534',
  fontSize: '14px',
  lineHeight: '24px',
  margin: 0,
};

const footerText = {
  color: '#71717a',
  fontSize: '12px',
  lineHeight: '20px',
  marginTop: '32px',
  textAlign: 'center' as const,
};

export default ConfirmationEmail;
