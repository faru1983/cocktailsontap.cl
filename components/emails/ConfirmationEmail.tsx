import * as React from 'react';
import { Section, Text } from '@react-email/components';
import type { Quote, QuoteItem } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';
import { 
    BaseLayout, QuoteButton, ContactNote, ItemsTable, YieldsSection, 
    PriceBreakdownSection, ReservationInfoSection, fullName, 
    brandDark, gray, greenColor, lightGray, borderColor 
} from './EmailShared';

interface ConfirmationEmailProps {
  quote: Quote & { quote_items: QuoteItem[] };
  isAdmin?: boolean;
}

export const ConfirmationEmail: React.FC<Readonly<ConfirmationEmailProps>> = ({ quote, isAdmin = false }) => {
  const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
  
  const eventDate = quote.event_date
      ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
  const clientName = fullName(quote);
  const halfAmount = (quote.total_price || 0) / 2;

  if (isAdmin) {
    return (
      <BaseLayout preview={`[Reserva Confirmada] ${clientName} - ${eventDate}`} accentColor={greenColor}>
        <h2 style={{ color: greenColor, margin: '0 0 8px', fontSize: '20px', lineHeight: '1.3' }}>✅ Reserva confirmada por el cliente</h2>
        <Text style={{ color: gray, margin: '0 0 24px', fontSize: '14px' }}>
          <strong>{clientName}</strong> ha confirmado su reserva para el {eventDate}.
        </Text>
        
        <ItemsTable items={quote.quote_items} />
        <YieldsSection quote={quote} />
        <PriceBreakdownSection quote={quote} />
        <ReservationInfoSection quote={quote} />
        
        <QuoteButton url={quoteUrl} label="Ver reserva confirmada →" bg={greenColor} />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout preview={`✅ Reserva confirmada – ${eventDate}`} accentColor={greenColor}>
      <h2 style={{ color: greenColor, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>✅ ¡Reserva confirmada!</h2>
      <Text style={{ color: gray, margin: '0 0 24px', fontSize: '15px', lineHeight: '1.6' }}>
        Hola <strong>{clientName}</strong>, tu reserva para el <strong>{eventDate}</strong> ha sido confirmada. Para asegurar la fecha, realiza el abono del 50%.
      </Text>
      
      <Section style={{ backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '14px', padding: '24px', textAlign: 'center', marginBottom: '28px' }}>
        <Text style={{ color: '#166534', margin: 0, fontSize: '38px', fontWeight: 900 }}>{formatCurrency(halfAmount)}</Text>
        <Text style={{ color: '#166534', margin: '10px 0 0', fontSize: '12px' }}>El 50% restante se paga el día del montaje.</Text>
      </Section>

      <Section style={{ backgroundColor: lightGray, borderRadius: '12px', padding: '20px 24px', marginBottom: '28px', border: `1px solid ${borderColor}` }}>
        <table width="100%">
          <tbody>
            <tr><td style={{ padding: '2px 0' }}><strong>Banco</strong></td><td>Mercado Pago</td></tr>
            <tr><td style={{ padding: '2px 0' }}><strong>Número</strong></td><td>1098081647</td></tr>
            <tr><td style={{ padding: '2px 0' }}><strong>Nombre</strong></td><td>Felipe Ramírez</td></tr>
            <tr><td style={{ padding: '2px 0' }}><strong>RUT</strong></td><td>15.332.189-2</td></tr>
          </tbody>
        </table>
      </Section>

      <ItemsTable items={quote.quote_items} />
      <YieldsSection quote={quote} />
      <PriceBreakdownSection quote={quote} />
      <ReservationInfoSection quote={quote} />
      
      <QuoteButton url={quoteUrl} label="Ver detalles de tu reserva →" bg={brandDark} />
      
      <ContactNote />
    </BaseLayout>
  );
};

export default ConfirmationEmail;
