import * as React from 'react';
import { Section, Text } from '@react-email/components';
import type { Quote, QuoteItem } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { 
    BaseLayout, QuoteButton, ContactNote, ItemsTable, YieldsSection, 
    PriceBreakdownSection, ReservationInfoSection, fullName, 
    brandColor, brandDark, gray 
} from './EmailShared';

interface QuoteEmailProps {
  quote: Quote & { quote_items: QuoteItem[] };
  isAdmin?: boolean;
}

export const QuoteEmail: React.FC<Readonly<QuoteEmailProps>> = ({ quote, isAdmin = false }) => {
  const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
  
  const eventDate = quote.event_date
      ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
  const clientName = fullName(quote);

  if (isAdmin) {
    return (
      <BaseLayout preview={`[Nueva Cotización] ${clientName} - ${eventDate}`} accentColor={brandDark}>
        <h2 style={{ color: brandDark, margin: '0 0 8px', fontSize: '20px', lineHeight: '1.3' }}>⚡ Nueva cotización recibida</h2>
        
        <ItemsTable items={quote.quote_items} />
        <YieldsSection quote={quote} />
        <PriceBreakdownSection quote={quote} />
        <ReservationInfoSection quote={quote} />
        
        <QuoteButton url={quoteUrl} label="Ver cotización completa →" bg={brandDark} />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout preview={`Tu cotización – ${eventDate}`} accentColor={brandColor}>
      <h2 style={{ color: brandDark, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>¡Hemos recibido tu cotización!</h2>
      <Text style={{ color: gray, margin: '0 0 28px', fontSize: '15px', lineHeight: '1.6' }}>
        Hola <strong>{clientName}</strong>, aquí tienes el resumen de tu solicitud para el evento del <strong>{eventDate}</strong>.
      </Text>
      
      <ItemsTable items={quote.quote_items} />
      <YieldsSection quote={quote} />
      <PriceBreakdownSection quote={quote} />
      <ReservationInfoSection quote={quote} />
      
      <Section style={{ backgroundColor: brandColor, borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
        <Text style={{ color: '#fff', margin: '0 0 14px', fontSize: '15px', fontWeight: 700, lineHeight: '1.4' }}>
          ¿Todo en orden? Revisa y confirma tu reserva ahora.
        </Text>
        <QuoteButton url={quoteUrl} label="Revisar y confirmar cotización →" bg="#ffffff" textColor={brandDark} />
      </Section>
      
      <ContactNote />
    </BaseLayout>
  );
};

export default QuoteEmail;
