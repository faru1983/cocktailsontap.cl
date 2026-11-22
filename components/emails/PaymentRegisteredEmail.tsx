import * as React from 'react';
import { Text } from '@react-email/components';
import type { Quote } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { resolvePaymentMessageContext } from '@/lib/paymentMessageContext';
import {
    BaseLayout,
    QuoteButton,
    ContactNote,
    brandDark,
    gray,
    greenColor,
} from './EmailShared';

interface PaymentRegisteredEmailProps {
    quote: Quote;
    paymentAmount: number;
    balanceAfter: number;
    paymentCount?: number;
}

export const PaymentRegisteredEmail: React.FC<Readonly<PaymentRegisteredEmailProps>> = ({
    quote,
    paymentAmount,
    balanceAfter,
    paymentCount,
}) => {
    const ctx = resolvePaymentMessageContext(quote, paymentAmount, balanceAfter, {
        paymentCount,
    });

    const subjectPaidLabel = ctx.isDirect
        ? 'Tu pedido quedó'
        : ctx.timing === 'past'
          ? 'Tu cuenta quedó'
          : 'Tu evento quedó';

    const subjectPaidAdj =
        !ctx.isDirect && ctx.timing === 'past'
            ? 'pagada en su totalidad'
            : 'pagado en su totalidad';

    return (
        <BaseLayout preview={ctx.emailPreview} accentColor={greenColor}>
            <h2 style={{ color: greenColor, margin: '0 0 8px', fontSize: '22px', lineHeight: '1.3' }}>
                {ctx.emailHeading}
            </h2>
            <Text style={{ color: gray, margin: '0 0 18px', fontSize: '15px', lineHeight: '1.6' }}>
                Hola <strong>{ctx.clientFullName}</strong>, {ctx.emailIntroLead}{' '}
                <strong>{formatCurrency(ctx.paymentAmount)}</strong> {ctx.emailIntroTail}
            </Text>

            {ctx.emailDateLine && (
                <Text
                    style={{
                        color: '#334155',
                        margin: '0 0 18px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                    }}
                >
                    {ctx.emailDateLine}
                </Text>
            )}

            {ctx.paidInFull ? (
                <div
                    style={{
                        backgroundColor: '#f0fdf4',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #86efac',
                        margin: '0 0 20px',
                    }}
                >
                    <Text
                        style={{
                            color: '#166534',
                            margin: ctx.hasPriorPayments ? '0 0 8px' : 0,
                            fontSize: '14px',
                            lineHeight: '1.6',
                        }}
                    >
                        {subjectPaidLabel} <strong>{subjectPaidAdj}</strong>. {ctx.emailStatusFollowup}
                    </Text>
                    {ctx.hasPriorPayments && (
                        <Text
                            style={{
                                color: '#15803d',
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '1.5',
                            }}
                        >
                            Este pago: <strong>{formatCurrency(ctx.paymentAmount)}</strong> · Total pagado:{' '}
                            <strong>{formatCurrency(ctx.totalPaid)}</strong> · Saldo pendiente:{' '}
                            <strong>{formatCurrency(0)}</strong>
                        </Text>
                    )}
                </div>
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
                    <Text
                        style={{
                            color: '#0f172a',
                            margin: '0 0 6px',
                            fontSize: '15px',
                            lineHeight: '1.4',
                            fontWeight: 600,
                        }}
                    >
                        Saldo pendiente:{' '}
                        <strong style={{ color: '#E2A049' }}>{formatCurrency(ctx.balanceAfter)}</strong>
                    </Text>
                    {ctx.hasPriorPayments && (
                        <Text
                            style={{
                                color: '#475569',
                                margin: '0 0 6px',
                                fontSize: '12px',
                                lineHeight: '1.5',
                            }}
                        >
                            Este abono: <strong>{formatCurrency(ctx.paymentAmount)}</strong> · Total abonado a
                            la fecha: <strong>{formatCurrency(ctx.totalPaid)}</strong>
                        </Text>
                    )}
                    <Text style={{ color: gray, margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                        {ctx.emailPendingHint}
                    </Text>
                </div>
            )}

            <QuoteButton url={ctx.quoteUrl} label={ctx.emailButtonLabel} bg={brandDark} />
            <ContactNote />
        </BaseLayout>
    );
};

export default PaymentRegisteredEmail;
