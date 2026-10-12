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

    const isDirect = quote.service_type === 'direct' || quote.dispenser === 'desechable';
    const paidInFull = balanceAfter <= 0;
    const concept = isDirect ? 'pedido' : 'evento';

    return (
        <BaseLayout
            preview={`${paidInFull ? 'Pago recibido' : 'Abono registrado'} – ${clientName}`}
            accentColor={greenColor}
        >
            <h2 style={{ color: greenColor, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>
                {paidInFull ? '✅ Pago registrado' : '✅ Abono registrado'}
            </h2>
            <Text style={{ color: gray, margin: '0 0 24px', fontSize: '15px', lineHeight: '1.6' }}>
                Hola <strong>{clientName}</strong>, registramos tu pago de{' '}
                <strong>{formatCurrency(paymentAmount)}</strong> para tu {concept} del{' '}
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
                    {isDirect ? (
                        <>Tu pedido está <strong>pagado en su totalidad</strong>. Pronto coordinaremos el despacho.</>
                    ) : (
                        <>Tu evento está <strong>pagado en su totalidad</strong>. ¡Tenemos todo agendado y listo para tu celebración!</>
                    )}
                </Text>
            ) : (
                <div
                    style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px',
                        margin: '0 0 20px',
                    }}
                >
                    <Text style={{ color: '#0f172a', margin: '0 0 6px', fontSize: '15px', lineHeight: '1.4', fontWeight: 600 }}>
                        Saldo pendiente: <strong style={{ color: '#E2A049' }}>{formatCurrency(balanceAfter)}</strong>
                    </Text>
                    <Text style={{ color: gray, margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                        {isDirect
                            ? 'Recuerda que el saldo pendiente debe estar pagado antes de despachar tu pedido.'
                            : 'Recuerda que el saldo pendiente puede abonarse según lo coordinado o a más tardar el día del evento.'}
                    </Text>
                </div>
            )}
            <QuoteButton url={quoteUrl} label={`Ver detalle de tu ${isDirect ? 'pedido' : 'reserva'} →`} bg={brandDark} />
            <ContactNote />
        </BaseLayout>
    );
};

export default PaymentRegisteredEmail;
