import * as React from 'react';
import { Text } from '@react-email/components';
import type { Quote } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';
import {
    BaseLayout,
    QuoteButton,
    ContactNote,
    fullName,
    brandDark,
    gray,
    greenColor,
} from './EmailShared';

interface PaymentRegisteredEmailProps {
    quote: Quote;
    paymentAmount: number;
    balanceAfter: number;
}

export const PaymentRegisteredEmail: React.FC<Readonly<PaymentRegisteredEmailProps>> = ({
    quote,
    paymentAmount,
    balanceAfter,
}) => {
    const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
    const clientName = fullName(quote);
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : '';

    const paidInFull = balanceAfter <= 0;

    return (
        <BaseLayout
            preview={`Pago registrado – ${clientName}`}
            accentColor={greenColor}
        >
            <h2 style={{ color: greenColor, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>
                Pago registrado
            </h2>
            <Text style={{ color: gray, margin: '0 0 24px', fontSize: '15px', lineHeight: '1.6' }}>
                Hola <strong>{clientName}</strong>, registramos tu pago de{' '}
                <strong>{formatCurrency(paymentAmount)}</strong> para tu pedido del{' '}
                <strong>{eventDate}</strong>.
            </Text>
            {paidInFull ? (
                <Text
                    style={{
                        color: '#166534',
                        margin: '0 0 20px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        backgroundColor: '#f0fdf4',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #86efac',
                    }}
                >
                    Tu pedido está <strong>pagado en su totalidad</strong>. Pronto coordinaremos el despacho.
                </Text>
            ) : (
                <Text style={{ color: gray, margin: '0 0 20px', fontSize: '14px', lineHeight: '1.6' }}>
                    Saldo pendiente: <strong>{formatCurrency(balanceAfter)}</strong>
                </Text>
            )}
            <QuoteButton url={quoteUrl} label="Ver detalle de tu pedido →" bg={brandDark} />
            <ContactNote />
        </BaseLayout>
    );
};

export default PaymentRegisteredEmail;
