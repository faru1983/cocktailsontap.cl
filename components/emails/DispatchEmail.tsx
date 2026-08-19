import * as React from 'react';
import { Link, Section, Text } from '@react-email/components';
import type { Quote } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import {
    BaseLayout,
    QuoteButton,
    ContactNote,
    fullName,
    brandDark,
    gray,
    brandColor,
} from './EmailShared';

interface DispatchEmailProps {
    quote: Quote;
}

export const DispatchEmail: React.FC<Readonly<DispatchEmailProps>> = ({ quote }) => {
    const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
    const clientName = fullName(quote);
    const eventDate = quote.event_date
        ? new Date(quote.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : '';

    const isOwn = quote.dispatch_mode === 'own';
    const carrier = quote.dispatch_carrier_name?.trim() || 'el transportista';
    const trackingNumber = quote.dispatch_tracking_number?.trim() || '';
    const trackingUrl = quote.dispatch_tracking_url?.trim() || '';

    return (
        <BaseLayout preview={`Tu pedido en reparto – ${clientName}`} accentColor={brandColor}>
            <h2 style={{ color: brandDark, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>
                Tu pedido está en camino
            </h2>
            {isOwn ? (
                <Text style={{ color: gray, margin: '0 0 24px', fontSize: '15px', lineHeight: '1.6' }}>
                    Hola <strong>{clientName}</strong>, tu pedido está en reparto y será entregado durante el día
                    {eventDate ? <> (fecha de entrega: <strong>{eventDate}</strong>)</> : null}.
                </Text>
            ) : (
                <>
                    <Text style={{ color: gray, margin: '0 0 16px', fontSize: '15px', lineHeight: '1.6' }}>
                        Hola <strong>{clientName}</strong>, tu pedido ya fue despachado a través de{' '}
                        <strong>{carrier}</strong>.
                    </Text>
                    {trackingNumber ? (
                        <Section
                            style={{
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '20px',
                                border: '1px solid #e2e8f0',
                            }}
                        >
                            <Text style={{ color: gray, margin: '0 0 8px', fontSize: '12px', fontWeight: 700 }}>
                                Número de seguimiento
                            </Text>
                            <Text
                                style={{
                                    color: brandDark,
                                    margin: 0,
                                    fontSize: '20px',
                                    fontWeight: 900,
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {trackingNumber}
                            </Text>
                        </Section>
                    ) : null}
                    {trackingUrl ? (
                        <Section style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <Link
                                href={trackingUrl}
                                style={{
                                    display: 'inline-block',
                                    backgroundColor: brandColor,
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '14px',
                                    padding: '12px 24px',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                }}
                            >
                                Rastrear envío →
                            </Link>
                        </Section>
                    ) : null}
                </>
            )}
            <QuoteButton url={quoteUrl} label="Ver detalle de tu pedido →" bg={brandDark} />
            <ContactNote />
        </BaseLayout>
    );
};

export default DispatchEmail;
