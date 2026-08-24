'use client';

import {
    MapPin,
    Calendar,
    Users,
    Package,
    Truck,
    Copy,
    Check,
    Phone,
    Clock,
    ExternalLink,
    Droplets,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { formatQuoteAddress } from '@/lib/geo';
import { formatPhoneDisplay, toWhatsAppDigits } from '@/lib/phone';
import { useState, type ReactNode } from 'react';

const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

function formatDateCL(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatTimeCL(time: string | null | undefined): string | null {
    if (!time || time === '--:--') return null;
    return time;
}

function formatPickupLabel(pickupTime: string | null | undefined): string {
    if (!pickupTime) return '—';
    if (pickupTime === '--:--') return 'Todo el día';
    return pickupTime;
}

function formatTheme(quote: {
    event_types?: { name?: string } | null;
    event_type_other?: string | null;
}): string {
    const type = quote.event_types?.name;
    const other = quote.event_type_other;
    if (!type && !other) return '—';
    if (type && other) return `${type} (${other})`;
    return type || other || '—';
}

function dispenserLabel(quote: { dispenser?: string | null; service_type?: string | null }): string {
    if (quote.dispenser === 'muro') return 'Muro de coctelería';
    if (quote.service_type === 'direct' || quote.dispenser === 'desechable') return 'Barril desechable';
    return 'Dispensador portátil';
}

function resolveTotalLiters(quote: {
    total_liters?: number | null;
    quote_items?: { size_value?: number | null; quantity?: number | null }[] | null;
}): number | null {
    if (quote.total_liters != null && quote.total_liters > 0) return quote.total_liters;
    const items = quote.quote_items || [];
    if (!items.length) return null;
    const sum = items.reduce(
        (acc, i) => acc + (Number(i.size_value) || 0) * (Number(i.quantity) || 0),
        0
    );
    return sum > 0 ? sum : null;
}

type QuoteOperationalSummaryProps = {
    quote: Record<string, unknown>;
    isDirectSale: boolean;
    balance: number;
    onCopied?: (msg: string) => void;
};

function CopyBtn({ text, label, onCopied }: { text: string; label: string; onCopied?: (msg: string) => void }) {
    const [copied, setCopied] = useState(false);
    if (!text || text === '—') return null;

    const handleCopy = async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
            setCopied(true);
            onCopied?.(`${label} copiado`);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            type="button"
            onClick={() => void handleCopy()}
            title={`Copiar ${label.toLowerCase()}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                color: copied ? '#34d399' : '#94a3b8',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}
        >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
        </button>
    );
}

function Row({
    icon,
    label,
    children,
}: {
    icon: ReactNode;
    label?: string;
    children: ReactNode;
}) {
    return (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div
                style={{
                    flexShrink: 0,
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'rgba(226,160,73,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E2A049',
                }}
            >
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                {label && (
                    <div
                        style={{
                            color: '#64748b',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            marginBottom: '4px',
                        }}
                    >
                        {label}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

export default function QuoteOperationalSummary({
    quote,
    isDirectSale,
    balance,
    onCopied,
}: QuoteOperationalSummaryProps) {
    const q = quote as {
        event_date?: string | null;
        start_time?: string | null;
        pickup_date?: string | null;
        pickup_time?: string | null;
        client_address?: string | null;
        comuna_name?: string | null;
        comuna_other?: string | null;
        region_name?: string | null;
        guests?: number | null;
        client_phone?: string | null;
        total_price?: number | null;
        quote_items?: { product_name?: string; size?: string; quantity?: number }[] | null;
        status?: string;
        dispatch_mode?: string | null;
        dispatch_carrier_name?: string | null;
        dispatch_tracking_number?: string | null;
        dispatch_tracking_url?: string | null;
        comments?: string | null;
        event_types?: { name?: string } | null;
        event_type_other?: string | null;
        dispenser?: string | null;
        service_type?: string | null;
        total_liters?: number | null;
    };

    const fullAddress = formatQuoteAddress(q) || '—';
    const mapsQuery = fullAddress !== '—' ? encodeURIComponent(fullAddress) : '';
    const totalLiters = resolveTotalLiters(q);
    const items = q.quote_items || [];
    const phone = q.client_phone ? formatPhoneDisplay(q.client_phone) : null;
    const waDigits = q.client_phone ? toWhatsAppDigits(q.client_phone) : '';
    const isPaid = balance <= 0;
    const showDispatch =
        q.status === 'in_delivery' ||
        Boolean(q.dispatch_mode || q.dispatch_tracking_number);

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, rgba(226,160,73,0.08) 0%, rgba(30,36,51,1) 40%)',
                borderRadius: '16px',
                border: '1px solid rgba(226,160,73,0.2)',
                padding: '22px 24px',
                marginBottom: '24px',
            }}
        >
            <h3
                style={{
                    color: '#E2A049',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1.2px',
                    margin: '0 0 18px',
                }}
            >
                Resumen operativo
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Fecha principal */}
                <Row
                    icon={<Calendar size={16} />}
                    label={isDirectSale ? 'Fecha de entrega' : 'Fecha del evento'}
                >
                    <div style={{ color: '#f1f5f9', fontSize: '17px', fontWeight: 800, lineHeight: 1.35 }}>
                        {formatDateCL(q.event_date)}
                    </div>
                    {!isDirectSale && formatTimeCL(q.start_time) && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#94a3b8',
                                fontSize: '14px',
                                fontWeight: 600,
                                marginTop: '4px',
                            }}
                        >
                            <Clock size={14} />
                            Inicio {formatTimeCL(q.start_time)}
                        </div>
                    )}
                </Row>

                {/* Dirección */}
                <Row icon={<MapPin size={16} />} label="Dirección">
                    <div
                        style={{
                            color: '#f1f5f9',
                            fontSize: '15px',
                            fontWeight: 600,
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                        }}
                    >
                        {fullAddress}
                    </div>
                    {fullAddress !== '—' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                            <CopyBtn text={fullAddress} label="Dirección" onCopied={onCopied} />
                            {mapsQuery && (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        background: 'rgba(96,165,250,0.12)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(96,165,250,0.2)',
                                    }}
                                >
                                    <ExternalLink size={13} />
                                    Maps
                                </a>
                            )}
                        </div>
                    )}
                </Row>

                {/* Evento: invitados, dispensador, litros, retiro */}
                {!isDirectSale && (
                    <>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '12px',
                            }}
                        >
                            <div
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                    <Users size={12} />
                                    Invitados
                                </div>
                                <div style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800 }}>
                                    {q.guests ?? '—'}
                                </div>
                            </div>
                            <div
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                    <Package size={12} />
                                    Equipo
                                </div>
                                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>
                                    {dispenserLabel(q)}
                                </div>
                            </div>
                            {totalLiters != null && (
                                <div
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                        <Droplets size={12} />
                                        Volumen
                                    </div>
                                    <div style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800 }}>
                                        {totalLiters} L
                                    </div>
                                </div>
                            )}
                        </div>

                        {(q.pickup_date || q.pickup_time) && (
                            <Row icon={<Truck size={16} />} label="Retiro de equipos">
                                <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>
                                    {q.pickup_date ? formatDateCL(q.pickup_date) : '—'}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                                    {formatPickupLabel(q.pickup_time)}
                                </div>
                            </Row>
                        )}

                        <Row icon={<Calendar size={16} />} label="Temática">
                            <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600 }}>
                                {formatTheme(q)}
                            </div>
                        </Row>
                    </>
                )}

                {/* Productos */}
                {items.length > 0 && (
                    <div>
                        <div
                            style={{
                                color: '#64748b',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: '10px',
                            }}
                        >
                            Productos ({items.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {items.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <span
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#34d399',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, flex: 1 }}>
                                        {item.product_name}
                                    </span>
                                    <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
                                        {item.size} × {item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Total + pago */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div>
                        <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                            Total
                        </div>
                        <div style={{ color: '#E2A049', fontSize: '20px', fontWeight: 900 }}>
                            {formatCLP(Number(q.total_price) || 0)}
                        </div>
                    </div>
                    <span
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: isPaid ? '#34d399' : '#fbbf24',
                            background: isPaid ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                            border: `1px solid ${isPaid ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        }}
                    >
                        {isPaid ? 'Pagado' : `Pendiente ${formatCLP(balance)}`}
                    </span>
                </div>

                {/* Despacho venta directa */}
                {isDirectSale && showDispatch && (
                    <Row icon={<Truck size={16} />} label="Despacho">
                        <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>
                            {q.dispatch_mode === 'own'
                                ? 'Reparto propio'
                                : q.dispatch_carrier_name || 'Carrier'}
                        </div>
                        {q.dispatch_tracking_number && (
                            <div style={{ marginTop: '6px' }}>
                                {q.dispatch_tracking_url ? (
                                    <a
                                        href={q.dispatch_tracking_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
                                    >
                                        Seguimiento: {q.dispatch_tracking_number}
                                    </a>
                                ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                                        Seguimiento: {q.dispatch_tracking_number}
                                    </span>
                                )}
                            </div>
                        )}
                    </Row>
                )}

                {/* Contacto */}
                {phone && (
                    <Row icon={<Phone size={16} />} label="Contacto">
                        <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>{phone}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                            <CopyBtn text={phone} label="Teléfono" onCopied={onCopied} />
                            {waDigits && (
                                <a
                                    href={`https://wa.me/${waDigits}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        background: 'rgba(37,211,102,0.12)',
                                        color: '#25D366',
                                        border: '1px solid rgba(37,211,102,0.2)',
                                    }}
                                >
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </Row>
                )}

                {/* Comentarios destacados si hay */}
                {q.comments?.trim() && (
                    <div
                        style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: 'rgba(251,191,36,0.06)',
                            border: '1px solid rgba(251,191,36,0.15)',
                        }}
                    >
                        <div style={{ color: '#fbbf24', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                            Notas del pedido
                        </div>
                        <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {q.comments}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
