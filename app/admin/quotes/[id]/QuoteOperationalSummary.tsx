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
    User,
    Mail,
    PartyPopper,
    ShoppingBag,
    Receipt,
    StickyNote,
    Edit2,
    Save,
    X,
    Trash2,
    Plus,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { formatQuoteAddress } from '@/lib/geo';
import { formatPhoneDisplay, toWhatsAppDigits, normalizePhoneE164 } from '@/lib/phone';
import PhoneInput from '@/components/ui/PhoneInput';
import type { Comuna, Product, QuoteItem, Region, Quote } from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import { resolveDispatchTrackingUrl } from '@/lib/directSaleFulfillment';
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
    quote_items?: { size_value?: number | null; quantity?: number | null; size?: string | null }[] | null;
}): number | null {
    if (quote.total_liters != null && quote.total_liters > 0) return quote.total_liters;
    const items = quote.quote_items || [];
    if (!items.length) return null;
    const sum = items.reduce((acc, i) => {
        const fromValue = Number(i.size_value) || 0;
        const fromLabel = fromValue > 0 ? 0 : parseFloat(String(i.size || '').replace(/[^\d.]/g, '')) || 0;
        return acc + (fromValue || fromLabel) * (Number(i.quantity) || 0);
    }, 0);
    return sum > 0 ? sum : null;
}

const MUTED = '#64748b';
const TEXT = '#f1f5f9';
const SOFT = '#94a3b8';
const GOLD = '#E2A049';

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: '13px',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    color: MUTED,
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '5px',
};

const chipLinkStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
    textDecoration: 'none',
    background: bg,
    color,
    border: `1px solid ${border}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
});

type EditCosts = {
    manual_discount: number;
    shipping_cost: number;
    installation_cost: number;
    dispenser: string;
};

export type QuoteOperationalSummaryProps = {
    quote: Quote & { event_types?: { name: string } | null };
    isDirectSale: boolean;
    balance: number;
    isEditing: boolean;
    isPending: boolean;
    onCopied?: (msg: string) => void;
    onEditStart: () => void;
    onEditCancel: () => void;
    onEditSave: () => void;
    editInfo: Record<string, unknown>;
    setEditInfo: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    editItems: QuoteItem[];
    editCosts: EditCosts;
    setEditCosts: React.Dispatch<React.SetStateAction<EditCosts>>;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    allProducts: Product[];
    eventTypes: { id: string; name: string }[];
    comunas: Comuna[];
    regions: Region[];
    onAddItem: (p: Product, size: string, price: number, offer: number) => void;
    onRemoveItem: (idx: number) => void;
    onUpdateItem: (idx: number, field: keyof QuoteItem, val: unknown) => void;
    onRegisterPayment: () => void;
    onQuickFullPayment: () => void;
    onDeletePayment: (idx: number) => void;
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
                ...chipLinkStyle(
                    copied ? '#34d399' : SOFT,
                    copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                    copied ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'
                ),
            }}
        >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
        </button>
    );
}

function SectionCard({
    icon,
    title,
    children,
    accent,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
    accent?: string;
}) {
    return (
        <div
            style={{
                padding: '16px 18px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                    style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        background: 'rgba(226,160,73,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: accent || GOLD,
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </div>
                <span
                    style={{
                        color: accent || GOLD,
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}
                >
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
            <span style={{ color: MUTED, fontSize: '12px', fontWeight: 700, minWidth: '72px', flexShrink: 0 }}>
                {label}
            </span>
            <span
                style={{
                    color: TEXT,
                    fontSize: '13.5px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    minWidth: 0,
                }}
            >
                {children}
            </span>
        </div>
    );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={labelStyle}>{label}</label>
            {children}
        </div>
    );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
    return (
        <div
            style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.06)',
                minWidth: 0,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: MUTED,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '5px',
                }}
            >
                {icon}
                {label}
            </div>
            <div style={{ color: TEXT, fontSize: '15px', fontWeight: 800, lineHeight: 1.25 }}>{value}</div>
        </div>
    );
}

function CostRow({
    label,
    value,
    color,
    bold,
    editNode,
}: {
    label: string;
    value: string;
    color?: string;
    bold?: boolean;
    editNode?: ReactNode;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: color || SOFT, fontSize: bold ? '14px' : '13px', fontWeight: bold ? 900 : 600 }}>
                {label}
            </span>
            {editNode ?? (
                <span style={{ color: color || TEXT, fontSize: bold ? '18px' : '13px', fontWeight: bold ? 900 : 700 }}>
                    {value}
                </span>
            )}
        </div>
    );
}

function PickupTimeEditor({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const isAllDay = value === '--:--';
    const isRange = value.includes(' a ');
    const startVal = isRange ? value.split(' a ')[0] : isAllDay ? '' : value;
    const endVal = isRange ? value.split(' a ')[1] : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: TEXT, cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => onChange(e.target.checked ? '--:--' : '')}
                />
                Todo el día
            </label>
            {!isAllDay && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10px', color: MUTED, fontWeight: 600 }}>Inicio</span>
                        <input
                            type="time"
                            value={startVal}
                            onChange={(e) => {
                                let s = e.target.value;
                                let ev = endVal;
                                if (ev && s && ev < s) ev = s;
                                onChange(s && ev ? `${s} a ${ev}` : s || ev || '');
                            }}
                            style={inputStyle}
                        />
                    </div>
                    <span style={{ color: MUTED, paddingTop: '16px' }}>-</span>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10px', color: MUTED, fontWeight: 600 }}>Fin</span>
                        <input
                            type="time"
                            value={endVal}
                            min={startVal}
                            onChange={(e) => {
                                let ev = e.target.value;
                                let s = startVal;
                                if (ev && s && ev < s) ev = s;
                                onChange(s && ev ? `${s} a ${ev}` : ev || s || '');
                            }}
                            style={inputStyle}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function QuoteOperationalSummary({
    quote,
    isDirectSale,
    balance,
    isEditing,
    isPending,
    onCopied,
    onEditStart,
    onEditCancel,
    onEditSave,
    editInfo,
    setEditInfo,
    editItems,
    editCosts,
    setEditCosts,
    searchTerm,
    setSearchTerm,
    allProducts,
    eventTypes,
    comunas,
    regions,
    onAddItem,
    onRemoveItem,
    onUpdateItem,
    onRegisterPayment,
    onQuickFullPayment,
    onDeletePayment,
}: QuoteOperationalSummaryProps) {
    const q = quote as {
        client_name?: string | null;
        client_lastname?: string | null;
        client_email?: string | null;
        client_phone?: string | null;
        event_date?: string | null;
        start_time?: string | null;
        pickup_date?: string | null;
        pickup_time?: string | null;
        client_address?: string | null;
        comuna_name?: string | null;
        comuna_other?: string | null;
        region_name?: string | null;
        guests?: number | null;
        total_price?: number | null;
        shipping_cost?: number | null;
        installation_cost?: number | null;
        manual_discount?: number | null;
        payments?: { date: string; amount: number; note: string }[] | null;
        quote_items?: {
            id?: string;
            product_name?: string;
            size?: string;
            quantity?: number;
            offer_price_at_time?: number;
            size_value?: number | null;
        }[] | null;
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

    const displayItems = isEditing ? editItems : (q.quote_items || []);
    const fullName = [q.client_name, q.client_lastname].filter(Boolean).join(' ') || '—';
    const email = q.client_email || null;
    const phone = q.client_phone ? formatPhoneDisplay(q.client_phone) : null;
    const waDigits = q.client_phone ? toWhatsAppDigits(q.client_phone) : '';

    const fullAddress = formatQuoteAddress(q) || '—';
    const mapsQuery = fullAddress !== '—' ? encodeURIComponent(fullAddress) : '';
    const totalLiters = resolveTotalLiters({ ...q, quote_items: displayItems });

    const itemsSubtotal = displayItems.reduce(
        (acc, i) => acc + (Number(i.offer_price_at_time) || 0) * (Number(i.quantity) || 0),
        0
    );
    const shipping = isEditing ? editCosts.shipping_cost : Number(q.shipping_cost) || 0;
    const installation = isEditing ? editCosts.installation_cost : Number(q.installation_cost) || 0;
    const discount = isEditing ? editCosts.manual_discount : Number(q.manual_discount) || 0;
    const total = isEditing
        ? itemsSubtotal + shipping + installation - discount
        : Number(q.total_price) || 0;
    const totalPaid = Math.max(0, total - balance);
    const isPaid = balance <= 0;
    const payments = q.payments || [];

    const showDispatch =
        isDirectSale && (q.status === 'in_delivery' || Boolean(q.dispatch_mode || q.dispatch_tracking_number));
    const dispatchTrackingUrl = resolveDispatchTrackingUrl(q);

    const regionCode = (() => {
        const name = String(editInfo.region_name || q.region_name || '');
        const byName = regions.find((r) => r.name === name || r.shortName === name);
        return byName?.code || DEFAULT_REGION_CODE;
    })();

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, rgba(226,160,73,0.08) 0%, rgba(30,36,51,1) 40%)',
                borderRadius: '16px',
                border: '1px solid rgba(226,160,73,0.2)',
                padding: '22px 24px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '18px',
                }}
            >
                <h3
                    style={{
                        color: GOLD,
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '1.2px',
                        margin: 0,
                    }}
                >
                    {isEditing ? 'Editando cotización' : 'Detalle del pedido'}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {!isEditing && (
                        <span
                            style={{
                                padding: '5px 12px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: isPaid ? '#34d399' : '#fbbf24',
                                background: isPaid ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                                border: `1px solid ${isPaid ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
                            }}
                        >
                            {isPaid ? 'Pagado' : `Saldo ${formatCLP(balance)}`}
                        </span>
                    )}
                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={onEditStart}
                            style={chipLinkStyle(GOLD, 'rgba(226,160,73,0.12)', 'rgba(226,160,73,0.25)')}
                        >
                            <Edit2 size={13} />
                            Editar
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onEditCancel}
                                disabled={isPending}
                                style={chipLinkStyle(SOFT, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)')}
                            >
                                <X size={13} />
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={onEditSave}
                                disabled={isPending}
                                style={chipLinkStyle('#1a1a2e', GOLD, GOLD)}
                            >
                                <Save size={13} />
                                {isPending ? 'Guardando…' : 'Guardar'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
                        gap: '14px',
                    }}
                >
                    <SectionCard icon={<User size={14} />} title="Cliente">
                        {isEditing ? (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '12px',
                                }}
                            >
                                <EditField label="Nombre">
                                    <input
                                        value={String(editInfo.client_name || '')}
                                        onChange={(e) => setEditInfo((p) => ({ ...p, client_name: e.target.value }))}
                                        style={inputStyle}
                                    />
                                </EditField>
                                <EditField label="Apellido">
                                    <input
                                        value={String(editInfo.client_lastname || '')}
                                        onChange={(e) => setEditInfo((p) => ({ ...p, client_lastname: e.target.value }))}
                                        style={inputStyle}
                                    />
                                </EditField>
                                <EditField label="Email">
                                    <input
                                        type="email"
                                        value={String(editInfo.client_email || '')}
                                        onChange={(e) => setEditInfo((p) => ({ ...p, client_email: e.target.value }))}
                                        style={inputStyle}
                                    />
                                </EditField>
                                <EditField label="Celular">
                                    <PhoneInput
                                        value={normalizePhoneE164(String(editInfo.client_phone || '')) || ''}
                                        onChange={(e164) => setEditInfo((p) => ({ ...p, client_phone: e164 }))}
                                        style={inputStyle}
                                    />
                                </EditField>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Field label="Nombre">{fullName}</Field>
                                    <Field label="Email">{email || '—'}</Field>
                                    <Field label="Celular">{phone || '—'}</Field>
                                </div>
                                {(phone || email) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {phone && <CopyBtn text={phone} label="Teléfono" onCopied={onCopied} />}
                                        {waDigits && (
                                            <a
                                                href={`https://wa.me/${waDigits}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={chipLinkStyle('#25D366', 'rgba(37,211,102,0.12)', 'rgba(37,211,102,0.2)')}
                                            >
                                                <Phone size={13} />
                                                WhatsApp
                                            </a>
                                        )}
                                        {email && <CopyBtn text={email} label="Email" onCopied={onCopied} />}
                                        {email && (
                                            <a
                                                href={`mailto:${email}`}
                                                style={chipLinkStyle('#a78bfa', 'rgba(167,139,250,0.12)', 'rgba(167,139,250,0.2)')}
                                            >
                                                <Mail size={13} />
                                                Escribir
                                            </a>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </SectionCard>

                    <SectionCard
                        icon={<Calendar size={14} />}
                        title={isDirectSale ? 'Entrega' : 'Evento y logística'}
                    >
                        {isEditing ? (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '12px',
                                }}
                            >
                                <EditField label={isDirectSale ? 'Fecha entrega' : 'Fecha evento'}>
                                    <input
                                        type="date"
                                        value={String(editInfo.event_date || '')}
                                        onChange={(e) => setEditInfo((p) => ({ ...p, event_date: e.target.value }))}
                                        style={inputStyle}
                                    />
                                </EditField>
                                {!isDirectSale && (
                                    <>
                                        <EditField label="Hora inicio">
                                            <input
                                                type="time"
                                                value={String(editInfo.start_time || '')}
                                                onChange={(e) => setEditInfo((p) => ({ ...p, start_time: e.target.value }))}
                                                style={inputStyle}
                                            />
                                        </EditField>
                                        <EditField label="Fecha retiro">
                                            <input
                                                type="date"
                                                value={String(editInfo.pickup_date || '')}
                                                onChange={(e) => setEditInfo((p) => ({ ...p, pickup_date: e.target.value }))}
                                                style={inputStyle}
                                            />
                                        </EditField>
                                        <EditField label="Horario retiro">
                                            <PickupTimeEditor
                                                value={String(editInfo.pickup_time || '')}
                                                onChange={(v) => setEditInfo((p) => ({ ...p, pickup_time: v }))}
                                            />
                                        </EditField>
                                        <EditField label="Temática">
                                            <select
                                                value={String(editInfo.event_type_id || '')}
                                                onChange={(e) => setEditInfo((p) => ({ ...p, event_type_id: e.target.value }))}
                                                style={inputStyle}
                                            >
                                                <option value="">Selecciona…</option>
                                                {eventTypes.map((et) => (
                                                    <option key={et.id} value={et.id}>
                                                        {et.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {editInfo.event_type_id === 'Otro' && (
                                                <input
                                                    placeholder="Especificar temática…"
                                                    value={String(editInfo.event_type_other || '')}
                                                    onChange={(e) =>
                                                        setEditInfo((p) => ({ ...p, event_type_other: e.target.value }))
                                                    }
                                                    style={{ ...inputStyle, marginTop: '6px' }}
                                                />
                                            )}
                                        </EditField>
                                        <EditField label="Invitados">
                                            <input
                                                type="number"
                                                value={String(editInfo.guests ?? '')}
                                                onChange={(e) =>
                                                    setEditInfo((p) => ({ ...p, guests: Number(e.target.value) }))
                                                }
                                                style={inputStyle}
                                            />
                                        </EditField>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <Field label={isDirectSale ? 'Entrega' : 'Evento'}>
                                    <span style={{ fontWeight: 800 }}>{formatDateCL(q.event_date)}</span>
                                    {!isDirectSale && formatTimeCL(q.start_time) && (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: SOFT,
                                                fontWeight: 600,
                                                marginLeft: '8px',
                                            }}
                                        >
                                            <Clock size={12} />
                                            {formatTimeCL(q.start_time)}
                                        </span>
                                    )}
                                </Field>
                                {!isDirectSale && (
                                    <>
                                        <Field label="Retiro">
                                            {q.pickup_date || q.pickup_time ? (
                                                <>
                                                    {q.pickup_date ? formatDateCL(q.pickup_date) : '—'}
                                                    <span style={{ color: SOFT, marginLeft: '8px' }}>
                                                        {formatPickupLabel(q.pickup_time)}
                                                    </span>
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </Field>
                                        <Field label="Temática">{formatTheme(q)}</Field>
                                        <Field label="Invitados">{q.guests ?? '—'}</Field>
                                    </>
                                )}
                                {isDirectSale && <Field label="Formato">{dispenserLabel(q)}</Field>}
                            </div>
                        )}
                    </SectionCard>
                </div>

                <SectionCard icon={<MapPin size={14} />} title="Dirección de entrega">
                    {isEditing ? (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '12px',
                            }}
                        >
                            <EditField label="Dirección">
                                <input
                                    value={String(editInfo.client_address || '')}
                                    onChange={(e) => setEditInfo((p) => ({ ...p, client_address: e.target.value }))}
                                    style={inputStyle}
                                />
                            </EditField>
                            <EditField label="Región">
                                <select
                                    value={regionCode}
                                    onChange={(e) => {
                                        const r = regions.find((x) => x.code === e.target.value);
                                        setEditInfo((p) => ({
                                            ...p,
                                            region_name: r?.shortName || e.target.value,
                                            comuna_name: '',
                                            comuna_other: null,
                                        }));
                                    }}
                                    style={inputStyle}
                                >
                                    {regions
                                        .filter((r) => r.isActive)
                                        .sort((a, b) => a.displayOrder - b.displayOrder)
                                        .map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.shortName}
                                            </option>
                                        ))}
                                </select>
                            </EditField>
                            <EditField label="Comuna">
                                <select
                                    value={String(editInfo.comuna_name || '')}
                                    onChange={(e) => setEditInfo((p) => ({ ...p, comuna_name: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">Selecciona…</option>
                                    {comunas
                                        .filter((c) => c.regionCode === regionCode)
                                        .sort((a, b) =>
                                            a.name === 'Otra' ? 1 : b.name === 'Otra' ? -1 : a.name.localeCompare(b.name, 'es')
                                        )
                                        .map((c) => (
                                            <option key={c.name} value={c.name}>
                                                {c.name === 'Otra' ? 'Otra / No está en la lista' : c.name}
                                            </option>
                                        ))}
                                </select>
                                {editInfo.comuna_name === 'Otra' && (
                                    <input
                                        placeholder="Especificar comuna…"
                                        value={String(editInfo.comuna_other || '')}
                                        onChange={(e) => setEditInfo((p) => ({ ...p, comuna_other: e.target.value }))}
                                        style={{ ...inputStyle, marginTop: '6px' }}
                                    />
                                )}
                            </EditField>
                        </div>
                    ) : (
                        <>
                            <div
                                style={{
                                    color: TEXT,
                                    fontSize: '14.5px',
                                    fontWeight: 700,
                                    lineHeight: 1.45,
                                    wordBreak: 'break-word',
                                }}
                            >
                                {fullAddress}
                            </div>
                            {fullAddress !== '—' && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    <CopyBtn text={fullAddress} label="Dirección" onCopied={onCopied} />
                                    {mapsQuery && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={chipLinkStyle('#60a5fa', 'rgba(96,165,250,0.12)', 'rgba(96,165,250,0.2)')}
                                        >
                                            <ExternalLink size={13} />
                                            Ver en Maps
                                        </a>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </SectionCard>

                {!isEditing && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '10px',
                        }}
                    >
                        {!isDirectSale && (
                            <>
                                <Stat icon={<Users size={12} />} label="Invitados" value={q.guests ?? '—'} />
                                <Stat icon={<Package size={12} />} label="Equipo" value={dispenserLabel(q)} />
                            </>
                        )}
                        {totalLiters != null && (
                            <Stat icon={<Droplets size={12} />} label="Volumen" value={`${totalLiters} L`} />
                        )}
                        <Stat
                            icon={<ShoppingBag size={12} />}
                            label="Barriles"
                            value={displayItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0) || '—'}
                        />
                    </div>
                )}

                <SectionCard
                    icon={<PartyPopper size={14} />}
                    title={`Pedido (${displayItems.length} producto${displayItems.length === 1 ? '' : 's'})`}
                >
                    {isEditing && (
                        <div style={{ position: 'relative', marginBottom: '4px' }}>
                            <label style={labelStyle}>Añadir producto</label>
                            <input
                                placeholder="Buscar por nombre…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={inputStyle}
                            />
                            {searchTerm.length > 1 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: '#1e2433',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        zIndex: 20,
                                        marginTop: '4px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    {allProducts
                                        .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map((p) => (
                                            <div
                                                key={p.id}
                                                style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                            >
                                                <div style={{ color: TEXT, fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                                                    {p.name}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {p.sizes.map((s) => (
                                                        <button
                                                            key={s.size}
                                                            type="button"
                                                            onClick={() => onAddItem(p, s.size, s.price, s.offerPrice)}
                                                            style={chipLinkStyle(GOLD, 'rgba(226,160,73,0.1)', 'rgba(226,160,73,0.2)')}
                                                        >
                                                            <Plus size={11} />
                                                            {s.size} ({formatCLP(s.offerPrice)})
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {displayItems.length === 0 ? (
                        <p style={{ color: MUTED, fontSize: '13px', margin: 0 }}>Sin productos.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {displayItems.map((item, idx) => {
                                const qty = Number(item.quantity) || 0;
                                const unit = Number(item.offer_price_at_time) || 0;
                                return (
                                    <div
                                        key={item.id || idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        {isEditing ? (
                                            <>
                                                <div style={{ flex: 1, minWidth: '120px' }}>
                                                    <div style={{ color: TEXT, fontSize: '14px', fontWeight: 700 }}>
                                                        {item.product_name}
                                                    </div>
                                                    <div style={{ color: MUTED, fontSize: '12px' }}>{item.size}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        value={qty}
                                                        onChange={(e) => onUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                        style={{ ...inputStyle, width: '60px', padding: '6px' }}
                                                        title="Cantidad"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={unit}
                                                        onChange={(e) =>
                                                            onUpdateItem(idx, 'offer_price_at_time', Number(e.target.value))
                                                        }
                                                        style={{ ...inputStyle, width: '90px', padding: '6px' }}
                                                        title="Precio"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveItem(idx)}
                                                        style={{
                                                            background: 'rgba(248,113,113,0.1)',
                                                            border: 'none',
                                                            color: '#f87171',
                                                            padding: '8px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span
                                                    style={{
                                                        minWidth: '58px',
                                                        textAlign: 'center',
                                                        padding: '3px 8px',
                                                        borderRadius: '7px',
                                                        background: 'rgba(226,160,73,0.12)',
                                                        color: GOLD,
                                                        fontSize: '12px',
                                                        fontWeight: 800,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {qty} × {item.size}
                                                </span>
                                                <span
                                                    style={{
                                                        color: TEXT,
                                                        fontSize: '14px',
                                                        fontWeight: 700,
                                                        flex: 1,
                                                        minWidth: '120px',
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {item.product_name}
                                                </span>
                                                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <span style={{ color: TEXT, fontSize: '13px', fontWeight: 800 }}>
                                                        {formatCLP(unit * qty)}
                                                    </span>
                                                    {qty > 1 && (
                                                        <span style={{ color: MUTED, fontSize: '11px', marginLeft: '6px' }}>
                                                            ({formatCLP(unit)} c/u)
                                                        </span>
                                                    )}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                <SectionCard icon={<Receipt size={14} />} title="Cobro">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <CostRow label="Productos" value={formatCLP(itemsSubtotal)} />
                        <CostRow
                            label="Transporte"
                            value={shipping > 0 ? formatCLP(shipping) : 'Incluido'}
                            editNode={
                                isEditing ? (
                                    <input
                                        type="number"
                                        value={editCosts.shipping_cost}
                                        onChange={(e) =>
                                            setEditCosts((p) => ({ ...p, shipping_cost: Number(e.target.value) }))
                                        }
                                        style={{ ...inputStyle, width: '120px', textAlign: 'right' }}
                                    />
                                ) : undefined
                            }
                        />
                        {(installation > 0 || isEditing) && (
                            <CostRow
                                label={isEditing ? 'Instalación / equipo' : 'Instalación'}
                                value={formatCLP(installation)}
                                editNode={
                                    isEditing ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <select
                                                value={editCosts.dispenser}
                                                onChange={(e) => {
                                                    const d = e.target.value;
                                                    setEditCosts((p) => ({
                                                        ...p,
                                                        dispenser: d,
                                                        installation_cost:
                                                            d === 'muro' ? p.installation_cost || 50000 : 0,
                                                    }));
                                                }}
                                                style={{ ...inputStyle, width: 'auto', fontSize: '12px', padding: '6px 8px' }}
                                            >
                                                <option value="portatil">Portátil</option>
                                                <option value="muro">Muro</option>
                                                <option value="desechable">Desechable</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={editCosts.installation_cost}
                                                onChange={(e) =>
                                                    setEditCosts((p) => ({
                                                        ...p,
                                                        installation_cost: Number(e.target.value),
                                                    }))
                                                }
                                                style={{ ...inputStyle, width: '100px', textAlign: 'right' }}
                                            />
                                        </div>
                                    ) : undefined
                                }
                            />
                        )}
                        {(discount > 0 || isEditing) && (
                            <CostRow
                                label="Descuento"
                                value={`-${formatCLP(discount)}`}
                                color="#f87171"
                                editNode={
                                    isEditing ? (
                                        <input
                                            type="number"
                                            value={editCosts.manual_discount}
                                            onChange={(e) =>
                                                setEditCosts((p) => ({
                                                    ...p,
                                                    manual_discount: Number(e.target.value),
                                                }))
                                            }
                                            style={{ ...inputStyle, width: '120px', textAlign: 'right', color: '#f87171' }}
                                        />
                                    ) : undefined
                                }
                            />
                        )}
                        <div
                            style={{
                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                paddingTop: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                            }}
                        >
                            <CostRow label="Total" value={formatCLP(total)} color={GOLD} bold />
                            {!isEditing && totalPaid > 0 && (
                                <CostRow label="Pagado" value={formatCLP(totalPaid)} color="#34d399" />
                            )}
                            {!isEditing && (
                                <CostRow
                                    label={isPaid ? 'Saldo' : 'Saldo pendiente'}
                                    value={formatCLP(Math.max(0, balance))}
                                    color={isPaid ? '#34d399' : '#fbbf24'}
                                />
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                {isDirectSale && balance > 0 && (
                                    <button
                                        type="button"
                                        onClick={onQuickFullPayment}
                                        style={chipLinkStyle('#1a1a2e', GOLD, GOLD)}
                                    >
                                        Transferencia total ({formatCLP(balance)})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onRegisterPayment}
                                    style={chipLinkStyle('#1a1a2e', '#34d399', 'rgba(52,211,153,0.4)')}
                                >
                                    <Plus size={13} />
                                    Registrar pago
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ ...labelStyle, marginBottom: 0 }}>Historial de pagos</span>
                                {payments.length === 0 ? (
                                    <p style={{ color: MUTED, fontSize: '12px', margin: 0 }}>Sin pagos registrados.</p>
                                ) : (
                                    payments.map((p, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                            }}
                                        >
                                            <div>
                                                <div style={{ color: TEXT, fontSize: '13px', fontWeight: 800 }}>
                                                    {formatCLP(p.amount)}
                                                </div>
                                                <div style={{ color: MUTED, fontSize: '11px' }}>
                                                    {new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL')} — {p.note}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onDeletePayment(idx)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#f87171',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                }}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </SectionCard>

                {showDispatch && !isEditing && (
                    <SectionCard icon={<Truck size={14} />} title="Despacho" accent="#38bdf8">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Field label="Modo">
                                {q.dispatch_mode === 'own' ? 'Reparto propio' : q.dispatch_carrier_name || 'Carrier'}
                            </Field>
                            {q.dispatch_tracking_number && (
                                <Field label="Tracking">
                                    {dispatchTrackingUrl ? (
                                        <a
                                            href={dispatchTrackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 700 }}
                                        >
                                            {q.dispatch_tracking_number}
                                        </a>
                                    ) : (
                                        q.dispatch_tracking_number
                                    )}
                                </Field>
                            )}
                        </div>
                    </SectionCard>
                )}

                {(isEditing || q.comments?.trim()) && (
                    <SectionCard icon={<StickyNote size={14} />} title="Notas del pedido" accent="#fbbf24">
                        {isEditing ? (
                            <textarea
                                value={String(editInfo.comments || '')}
                                onChange={(e) => setEditInfo((p) => ({ ...p, comments: e.target.value }))}
                                rows={4}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        ) : (
                            <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                                {q.comments}
                            </div>
                        )}
                    </SectionCard>
                )}
            </div>
        </div>
    );
}
