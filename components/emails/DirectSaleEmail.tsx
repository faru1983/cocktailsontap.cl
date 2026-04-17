import * as React from 'react';
import { Section, Text } from '@react-email/components';
import type { Quote, QuoteItem } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { 
    BaseLayout, QuoteButton, ContactNote, ItemsTable, YieldsSection, 
    PriceBreakdownSection, ReservationInfoSection, fullName, 
    brandColor, brandDark, gray 
} from './EmailShared';

interface DirectSaleEmailProps {
  quote: Quote & { quote_items: QuoteItem[] };
  isAdmin?: boolean;
}

export const DirectSaleEmail: React.FC<Readonly<DirectSaleEmailProps>> = ({ quote, isAdmin = false }) => {
  const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
  
  const eventDate = quote.event_date
      ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
  const clientName = fullName(quote);

  if (isAdmin) {
    return (
      <BaseLayout preview={`[Nuevo Pedido] ${clientName} - ${eventDate}`} accentColor={brandDark}>
        <h2 style={{ color: brandDark, margin: '0 0 8px', fontSize: '20px', lineHeight: '1.3' }}>📦 Nuevo pedido de Barril Desechable</h2>
        
        <ItemsTable items={quote.quote_items} />
        <YieldsSection quote={quote} isDirect={true} />
        <PriceBreakdownSection quote={quote} isDirect={true} />
        <ReservationInfoSection quote={quote} isDirect={true} />
        
        <QuoteButton url={quoteUrl} label="Ver pedido completo →" bg={brandDark} />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout preview={`Tu pedido de compra directa – ${eventDate}`} accentColor={brandColor}>
      <h2 style={{ color: brandDark, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>¡Hemos recibido tu pedido!</h2>
      <Text style={{ color: gray, margin: '0 0 28px', fontSize: '15px', lineHeight: '1.6' }}>
        Hola <strong>{clientName}</strong>, aquí tienes el resumen de tu pedido de Barril Desechable para el <strong>{eventDate}</strong>. Quedamos a la espera de la validación del pago para confirmar el despacho.
      </Text>
      
      <ItemsTable items={quote.quote_items} />
      <YieldsSection quote={quote} isDirect={true} />
      <PriceBreakdownSection quote={quote} isDirect={true} />
      <ReservationInfoSection quote={quote} isDirect={true} />
      
      <Section style={{ backgroundColor: brandColor, borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
        <Text style={{ color: '#fff', margin: '0 0 14px', fontSize: '15px', fontWeight: 700, lineHeight: '1.4' }}>
          Para finalizar tu compra, revisa tu pedido y sube el comprobante de pago.
        </Text>
        <QuoteButton url={quoteUrl} label="Revisar y pagar pedido →" bg="#ffffff" textColor={brandDark} />
      </Section>
      
      <ContactNote />
    </BaseLayout>
  );
};

export default DirectSaleEmail;
