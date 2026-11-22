import { SITE_URL } from '@/lib/config';
import { isDirectSaleQuote, sumQuotePayments } from '@/lib/directSaleFulfillment';
import type { Quote } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { formatEventDate } from '@/lib/wizardLogic';

export type PaymentKind = 'full_single' | 'final_balance' | 'partial';
export type PaymentServiceTiming = 'upcoming' | 'today' | 'past';

export interface PaymentMessageContext {
    isDirect: boolean;
    paidInFull: boolean;
    paymentKind: PaymentKind;
    timing: PaymentServiceTiming;
    isDispatched: boolean;
    isCompleted: boolean;
    hasPriorPayments: boolean;
    paymentCount: number;
    paymentAmount: number;
    totalPaid: number;
    totalPrice: number;
    balanceAfter: number;
    dateShort: string | null;
    dateCompact: string | null;
    dateLong: string | null;
    deliveryEstimateLabel: string | null;
    quoteUrl: string;
    clientFirstName: string;
    clientFullName: string;
    emailSubject: string;
    emailPreview: string;
    emailHeading: string;
    emailIntroLead: string;
    emailIntroTail: string;
    emailDateLine: string | null;
    emailStatusHighlight: string;
    emailStatusFollowup: string;
    emailPendingHint: string;
    emailButtonLabel: string;
    whatsappBody: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getChileTodayIso(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

function formatDateShortCL(dateStr: string | null | undefined): string | null {
    if (!dateStr || !ISO_DATE_RE.test(dateStr.trim())) return null;
    const d = new Date(dateStr.trim() + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatDateCompactCL(dateStr: string | null | undefined, todayIso: string): string | null {
    if (!dateStr || !ISO_DATE_RE.test(dateStr.trim())) return null;
    const clean = dateStr.trim();
    const d = new Date(clean + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    const sameYear = clean.slice(0, 4) === todayIso.slice(0, 4);
    return d.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

function formatDateInlineCL(dateStr: string | null | undefined, todayIso: string): string | null {
    if (!dateStr || !ISO_DATE_RE.test(dateStr.trim())) return null;
    const clean = dateStr.trim();
    const d = new Date(clean + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    const sameYear = clean.slice(0, 4) === todayIso.slice(0, 4);
    const formatted = d.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
    return formatted.replace(',', '').toLowerCase();
}

function getFirstName(quote: Quote): string {
    const first = (quote.client_name || '').trim().split(/\s+/)[0];
    return first || 'hola';
}

function getFullName(quote: Quote): string {
    return [quote.client_name, quote.client_lastname].filter(Boolean).join(' ').trim() || 'Cliente';
}

export function resolvePaymentMessageContext(
    quote: Quote,
    paymentAmount: number,
    balanceAfter: number,
    options?: { paymentCount?: number; now?: Date }
): PaymentMessageContext {
    const isDirect = isDirectSaleQuote(quote);
    const paidInFull = balanceAfter <= 0;
    const safeAmount = Math.max(0, Number(paymentAmount) || 0);
    const safeBalance = Math.max(0, Number(balanceAfter) || 0);
    const totalPrice = Math.max(0, Number(quote.total_price) || 0);

    const paymentsList = Array.isArray(quote.payments) ? quote.payments : [];
    const paymentCount = Math.max(1, options?.paymentCount ?? (paymentsList.length || 1));
    const summedPayments = paymentsList.length > 0 ? sumQuotePayments(quote) : 0;
    const totalPaid =
        summedPayments > 0
            ? summedPayments
            : Math.max(safeAmount, Math.max(0, totalPrice - safeBalance));

    const hasPriorPayments = paymentCount > 1 || totalPaid - safeAmount > 1;
    const paymentKind: PaymentKind = !paidInFull
        ? 'partial'
        : hasPriorPayments
          ? 'final_balance'
          : 'full_single';

    const todayIso = getChileTodayIso(options?.now);
    const isCompleted = quote.status === 'completed';
    const isDispatched = isDirect && (quote.status === 'in_delivery' || Boolean(quote.dispatched_at));

    const deliveryEstimateLabel = isDirect ? quote.delivery_estimate_label?.trim() || null : null;
    const rawEventDate = quote.event_date?.trim() || null;
    const rawDeliveryMax = isDirect ? quote.delivery_estimate_max?.trim() || null : null;
    const referenceDate =
        rawDeliveryMax && ISO_DATE_RE.test(rawDeliveryMax)
            ? rawDeliveryMax
            : rawEventDate && ISO_DATE_RE.test(rawEventDate)
              ? rawEventDate
              : null;

    let timing: PaymentServiceTiming = 'upcoming';
    if (isCompleted) {
        timing = 'past';
    } else if (referenceDate) {
        if (referenceDate < todayIso) timing = 'past';
        else if (referenceDate === todayIso) timing = 'today';
        else timing = 'upcoming';
    }

    const dateShort = formatDateShortCL(rawEventDate);
    const dateCompact = formatDateCompactCL(rawEventDate, todayIso);
    const dateLong = formatDateInlineCL(rawEventDate, todayIso);
    const dateLabelLong =
        rawEventDate && ISO_DATE_RE.test(rawEventDate) ? formatEventDate(rawEventDate) : null;
    const quoteUrl = `${SITE_URL}/cotizar/${quote.token}`;
    const clientFirstName = getFirstName(quote);
    const clientFullName = getFullName(quote);
    const formattedAmount = formatCurrency(safeAmount);
    const formattedBalance = formatCurrency(safeBalance);
    const formattedTotalPaid = formatCurrency(totalPaid);

    // ─── Textos compartidos y específicos por tipo de servicio ────────────────
    if (isDirect) {
        const directDateBadge = deliveryEstimateLabel || dateCompact;
        const subjectSuffix =
            !isCompleted && timing !== 'past' && directDateBadge ? ` (${directDateBadge})` : '';

        const emailSubject =
            paymentKind === 'final_balance'
                ? `✅ Saldo recibido – Pedido de barriles${subjectSuffix}`
                : paymentKind === 'full_single'
                  ? `✅ Pago recibido – Pedido de barriles${subjectSuffix}`
                  : `✅ Abono registrado – Pedido de barriles${subjectSuffix}`;

        const emailPreview =
            paymentKind === 'final_balance'
                ? `Saldo recibido – ${clientFullName}`
                : paymentKind === 'full_single'
                  ? `Pago recibido – ${clientFullName}`
                  : `Abono registrado – ${clientFullName}`;

        const emailHeading =
            paymentKind === 'final_balance'
                ? '✅ Saldo recibido'
                : paymentKind === 'full_single'
                  ? '✅ Pago registrado'
                  : '✅ Abono registrado';

        const isPastOrDone = isCompleted || isDispatched || timing === 'past';
        const emailIntroLead =
            paymentKind === 'final_balance'
                ? 'recibimos el saldo pendiente de'
                : paymentKind === 'full_single'
                  ? isPastOrDone
                      ? 'recibimos tu pago de'
                      : 'registramos tu pago de'
                  : 'registramos tu abono de';
        const emailIntroTail = 'correspondiente a tu pedido de barriles.';

        let emailDateLine: string | null = null;
        if (!isCompleted && !isDispatched && timing !== 'past') {
            if (deliveryEstimateLabel) {
                emailDateLine = `Llegada estimada: ${deliveryEstimateLabel} (vía Blue Express).`;
            } else if (dateShort) {
                emailDateLine = `Fecha de entrega agendada: ${dateShort}.`;
            }
        }

        const emailStatusHighlight = 'pagado en su totalidad';
        const emailStatusFollowup =
            isCompleted || timing === 'past'
                ? '¡Muchas gracias por tu compra!'
                : isDispatched
                  ? 'Tu pedido ya se encuentra en despacho. ¡Muchas gracias por tu compra!'
                  : 'Pronto coordinaremos el despacho de tu pedido.';

        const emailPendingHint = isPastOrDone
            ? 'Cuando realices la transferencia del saldo pendiente, envíanos el comprobante por correo o WhatsApp.'
            : 'Recuerda que el saldo pendiente debe estar pagado antes de despachar tu pedido.';

        const emailButtonLabel = isPastOrDone
            ? 'Ver comprobante de tu pedido →'
            : 'Ver detalle de tu pedido →';

        const waLines: string[] = [`¡Hola ${clientFirstName}! ${paidInFull ? '✅' : '💸'}`];
        if (paymentKind === 'final_balance') {
            waLines.push(
                `Gracias, recibimos el saldo pendiente de *${formattedAmount}* de tu pedido de barriles.`
            );
        } else if (paymentKind === 'full_single') {
            waLines.push(
                `${isPastOrDone ? 'Gracias, recibimos' : 'Registramos'} tu pago de *${formattedAmount}* de tu pedido de barriles.`
            );
        } else {
            waLines.push(
                `Registramos tu abono de *${formattedAmount}* para tu pedido de barriles.`
            );
        }

        if (paidInFull) {
            if (isCompleted || timing === 'past') {
                waLines.push('Tu pedido quedó *100% pagado* ✅. ¡Muchas gracias por tu compra!');
            } else if (isDispatched) {
                waLines.push(
                    'Tu pedido quedó *100% pagado* ✅ y ya se encuentra en despacho. ¡Muchas gracias por tu compra!'
                );
            } else {
                waLines.push('Tu pedido quedó *100% pagado* ✅.');
            }
        } else if (hasPriorPayments) {
            waLines.push(
                `Total abonado: *${formattedTotalPaid}* · Saldo pendiente: *${formattedBalance}*.`
            );
        } else {
            waLines.push(`Saldo pendiente actual: *${formattedBalance}*.`);
        }

        if (!isCompleted && !isDispatched && timing !== 'past') {
            if (deliveryEstimateLabel) {
                waLines.push(`📦 Llegada estimada: ${deliveryEstimateLabel} (Blue Express)`);
            } else if (dateLabelLong && dateLabelLong !== 'No especificada' && dateLabelLong !== 'Fecha inválida') {
                waLines.push(`📅 Fecha de entrega: ${dateLabelLong}`);
            }
        }

        waLines.push('', `*Ver comprobante actualizado:*\n${quoteUrl}`);

        return {
            isDirect,
            paidInFull,
            paymentKind,
            timing,
            isDispatched,
            isCompleted,
            hasPriorPayments,
            paymentCount,
            paymentAmount: safeAmount,
            totalPaid,
            totalPrice,
            balanceAfter: safeBalance,
            dateShort,
            dateCompact,
            dateLong,
            deliveryEstimateLabel,
            quoteUrl,
            clientFirstName,
            clientFullName,
            emailSubject,
            emailPreview,
            emailHeading,
            emailIntroLead,
            emailIntroTail,
            emailDateLine,
            emailStatusHighlight,
            emailStatusFollowup,
            emailPendingHint,
            emailButtonLabel,
            whatsappBody: waLines.join('\n'),
        };
    }

    // ─── Eventos (Dispensador Portátil / Muro de Coctelería) ──────────────────
    const eventDateSubjectPart = dateCompact ? ` – Evento ${dateCompact}` : ' – Tu evento';

    const emailSubject =
        paymentKind === 'final_balance'
            ? `✅ Saldo recibido${eventDateSubjectPart}`
            : paymentKind === 'full_single'
              ? `✅ ${timing === 'past' ? 'Pago recibido' : 'Pago total recibido'}${eventDateSubjectPart}`
              : `✅ Abono registrado${eventDateSubjectPart}`;

    const emailPreview =
        paymentKind === 'final_balance'
            ? `Saldo recibido – ${clientFullName}`
            : paymentKind === 'full_single'
              ? `Pago recibido – ${clientFullName}`
              : `Abono registrado – ${clientFullName}`;

    const emailHeading =
        paymentKind === 'final_balance'
            ? '✅ Saldo recibido'
            : paymentKind === 'full_single'
              ? timing === 'past'
                  ? '✅ Pago registrado'
                  : '✅ Pago total registrado'
              : '✅ Abono registrado';

    const dateClauseShort = dateShort ? ` del ${dateShort}` : '';
    const dateClauseLong = dateLong ? ` del ${dateLong}` : '';

    const emailIntroLead =
        paymentKind === 'final_balance'
            ? 'recibimos el saldo pendiente de'
            : paymentKind === 'full_single'
              ? timing === 'past'
                  ? 'recibimos tu pago de'
                  : 'registramos tu pago total de'
              : 'registramos tu abono de';

    const emailIntroTail =
        timing === 'past'
            ? `correspondiente a tu evento${dateClauseShort}.`
            : `para tu evento${dateClauseShort}.`;

    const emailStatusHighlight = 'pagado en su totalidad';
    const emailStatusFollowup =
        timing === 'past'
            ? '¡Muchas gracias por elegirnos, esperamos que hayan disfrutado muchísimo!'
            : timing === 'today'
              ? '¡Todo listo para disfrutar hoy!'
              : '¡Tenemos todo agendado y listo para tu celebración!';

    const emailPendingHint =
        timing === 'past'
            ? 'Cuando realices la transferencia del saldo pendiente, envíanos el comprobante por correo o WhatsApp para cerrar tu cuenta.'
            : timing === 'today'
              ? 'Recuerda completar el saldo pendiente hoy según lo coordinado y enviarnos el comprobante.'
              : 'Recuerda que el saldo pendiente puede abonarse según lo coordinado o a más tardar el día del evento.';

    const emailButtonLabel =
        timing === 'past' ? 'Ver comprobante de tu evento →' : 'Ver detalle de tu reserva →';

    const waLines: string[] = [`¡Hola ${clientFirstName}! ${paidInFull ? '✅' : '💸'}`];

    if (paymentKind === 'final_balance') {
        waLines.push(
            timing === 'past'
                ? `Gracias, recibimos el saldo pendiente de *${formattedAmount}* correspondiente a tu evento${dateClauseLong}.`
                : `Gracias, recibimos el saldo pendiente de *${formattedAmount}* para tu reserva${dateClauseLong}.`
        );
    } else if (paymentKind === 'full_single') {
        waLines.push(
            timing === 'past'
                ? `Gracias, recibimos tu pago de *${formattedAmount}* correspondiente a tu evento${dateClauseLong}.`
                : `Registramos tu pago total de *${formattedAmount}* para tu reserva${dateClauseLong}.`
        );
    } else {
        waLines.push(
            timing === 'past'
                ? `Registramos tu abono de *${formattedAmount}* correspondiente a tu evento${dateClauseLong}.`
                : `Registramos tu abono de *${formattedAmount}* para tu reserva${dateClauseLong}.`
        );
    }

    if (paidInFull) {
        if (timing === 'past') {
            waLines.push('Tu cuenta quedó *100% pagada* ✅. ¡Muchas gracias por preferirnos!');
        } else if (timing === 'today') {
            waLines.push('Tu reserva quedó *100% pagada* ✅. ¡Todo listo para disfrutar hoy!');
        } else {
            waLines.push(
                'Tu reserva quedó *100% pagada* ✅. ¡Tenemos todo agendado y listo para tu celebración!'
            );
        }
    } else if (hasPriorPayments) {
        waLines.push(
            `Total abonado: *${formattedTotalPaid}* · Saldo pendiente: *${formattedBalance}*.`
        );
    } else {
        waLines.push(`Saldo pendiente actual: *${formattedBalance}*.`);
    }

    waLines.push('', `*Ver comprobante actualizado:*\n${quoteUrl}`);

    return {
        isDirect,
        paidInFull,
        paymentKind,
        timing,
        isDispatched,
        isCompleted,
        hasPriorPayments,
        paymentCount,
        paymentAmount: safeAmount,
        totalPaid,
        totalPrice,
        balanceAfter: safeBalance,
        dateShort,
        dateCompact,
        dateLong,
        deliveryEstimateLabel,
        quoteUrl,
        clientFirstName,
        clientFullName,
        emailSubject,
        emailPreview,
        emailHeading,
        emailIntroLead,
        emailIntroTail,
        emailDateLine: null,
        emailStatusHighlight,
        emailStatusFollowup,
        emailPendingHint,
        emailButtonLabel,
        whatsappBody: waLines.join('\n'),
    };
}
