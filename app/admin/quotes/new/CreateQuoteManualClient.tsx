'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Trash2, Search, Check, AlertCircle, MessageCircle, RefreshCw, Copy, MapPin, Loader2, X } from 'lucide-react';
import { createQuoteAdmin } from '@/app/actions/admin/createQuoteAdmin';
import { getClientAddressesFromQuotes, type ClientQuoteAddress } from '@/app/actions/admin/adminActions';
import type { Product, Comuna, Region, EventType, WizardState } from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import { calculateSummaryData, calculateMaxPickupDate } from '@/lib/wizardLogic';
import { getDirectSaleDateFieldCopy } from '@/lib/blueExpress';
import { validateConfirmNowState } from '@/lib/confirmNowValidation';
import { SITE_URL, MURO_INSTALLATION_COST, PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import { isValidPhoneE164, toWhatsAppDigits, normalizePhoneE164 } from '@/lib/phone';

interface CreateQuoteManualClientProps {
    allProducts: Product[];
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
    existingClients: any[];
    initialServiceType?: 'event' | 'direct';
}

export default function CreateQuoteManualClient({ allProducts, comunas, regions, eventTypes, existingClients, initialServiceType = 'event' }: CreateQuoteManualClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // ─── 1. Form State ────────────────────────────────────────────────────────
    const [contact, setContact] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        region: DEFAULT_REGION_CODE,
        comuna: '',
        otherComuna: '',
        comments: ''
    });

    const [clientSearch, setClientSearch] = useState('');
    const [clientAddresses, setClientAddresses] = useState<ClientQuoteAddress[]>([]);
    const [addressesLoading, setAddressesLoading] = useState(false);
    const [selectedAddressKey, setSelectedAddressKey] = useState<string | null>(null);

    // Overrides (undefined means use default)
    const [shippingOverride, setShippingOverride] = useState<number | undefined>(undefined);
    const [shippingPorPagar, setShippingPorPagar] = useState(false);
    const [installationOverride, setInstallationOverride] = useState<number | undefined>(undefined);
    const [discountOverride, setDiscountOverride] = useState<number>(0);

    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return [];
        const q = clientSearch.toLowerCase().trim();
        const qDigits = q.replace(/\D/g, '');
        return existingClients.filter(c => {
            const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
            const email = String(c.email || '').toLowerCase();
            const phone = String(c.phone || '').toLowerCase();
            const phoneDigits = phone.replace(/\D/g, '');
            return (
                name.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                (qDigits.length >= 4 && phoneDigits.includes(qDigits))
            );
        }).slice(0, 5);
    }, [clientSearch, existingClients]);

    const addressKey = (a: ClientQuoteAddress) =>
        `${a.address.toLowerCase()}|${a.comuna.toLowerCase()}|${a.otherComuna.toLowerCase()}`;

    const applyAddress = (a: ClientQuoteAddress) => {
        const regionFromComuna =
            comunas.find((c) => c.name === a.comuna)?.regionCode || DEFAULT_REGION_CODE;
        setContact(prev => ({
            ...prev,
            address: a.address,
            region: regionFromComuna,
            comuna: a.comuna,
            otherComuna: a.otherComuna,
        }));
        setSelectedAddressKey(addressKey(a));
        setShippingOverride(undefined);
    };

    const handleSelectClient = (c: any) => {
        setContact(prev => ({
            ...prev,
            firstName: c.first_name,
            lastName: c.last_name || '',
            email: c.email || '',
            phone: normalizePhoneE164(c.phone || '') || '',
            address: '',
            region: DEFAULT_REGION_CODE,
            comuna: '',
            otherComuna: '',
        }));
        setClientSearch('');
        setClientAddresses([]);
        setSelectedAddressKey(null);
        setShippingOverride(undefined);

        setAddressesLoading(true);
        void (async () => {
            const res = await getClientAddressesFromQuotes(c.id);
            setAddressesLoading(false);
            if (!res.success || !res.addresses?.length) {
                setClientAddresses([]);
                return;
            }
            setClientAddresses(res.addresses);
        })();
    };

    const [eventData, setEventData] = useState({
        type: '',
        otherType: '',
        date: '', 
        startTime: '',
        pickupDate: '',
        pickupTime: ''
    });

    const [consumption, setConsumption] = useState({
        guests: 0,
        drinksPerPerson: 3 
    });

    const [serviceType, setServiceType] = useState<'event' | 'direct'>(initialServiceType);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro'>('portatil');
    const [selections, setSelections] = useState<{ id: string; size: string; quantity: number; customPrice?: number; customName?: string }[]>([]);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [customQty, setCustomQty] = useState(1);
    const [customSize, setCustomSize] = useState('Servicio');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [successData, setSuccessData] = useState<{
        token: string;
        quoteId: string;
        status: string;
    } | null>(null);
    const [confirmNow, setConfirmNow] = useState(false);

    // ─── 2. Reactive Calculations (Single Source of Truth) ─────────────────────
    
    // Map products to the format calculateSummaryData expects
    const cocktailsForWizard = useMemo(() => allProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        desc: p.description,
        image: p.image,
        prices: p.sizes.reduce((acc, s) => {
            acc[s.size] = {
                price: s.price,
                offerPrice: s.offerPrice,
                sizeValue: s.sizeValue,
                unit: s.unit,
                unitId: s.unitId,
                isDisposable: s.isDisposable,
                image: s.image
            };
            return acc;
        }, {} as any)
    })), [allProducts]);

    // Current State as WizardState
    const currentWizardState: WizardState = useMemo(() => ({
        step: 6,
        eventData,
        consumption,
        contact,
        selections,
        dispenser: serviceType === 'direct' ? 'desechable' : dispenser,
        expandedCocktailId: null,
        expandedCategoryId: '',
        serviceType: serviceType
    }), [eventData, consumption, contact, selections, dispenser, serviceType]);

    // Summary Data (Prices, Delivery, Rules)
    const summary = useMemo(() => 
        calculateSummaryData(currentWizardState, cocktailsForWizard, comunas),
    [currentWizardState, cocktailsForWizard, comunas]);

    // Final Pricing with Overrides
    // For Admin: If 'muro' is selected, we suggest the cost even if business rules (liters) aren't met,
    // as the admin overrides the rule by picking the option explicitly.
    const suggestedInstallation = currentWizardState.dispenser === 'muro' ? MURO_INSTALLATION_COST : summary.installationCost;

    const finalShipping = shippingOverride !== undefined ? shippingOverride : summary.shippingCost;
    const finalInstallation = installationOverride !== undefined ? installationOverride : suggestedInstallation;
    const finalTotal = summary.totalOfferPrice + finalShipping + finalInstallation - discountOverride;
    const activeMinLiters = currentWizardState.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const belowEventMinLiters =
        serviceType === 'event' && selections.length > 0 && summary.totalLiters < activeMinLiters;
    const directDateCopy =
        serviceType === 'direct' ? getDirectSaleDateFieldCopy(summary.shippingCarrier) : null;

    // ─── 3. Handlers ──────────────────────────────────────────────────────────

    const filteredProducts = allProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddCustomProduct = (name: string, price: number, quantity: number, size: string) => {
        const customId = `custom-${Date.now()}`;
        setSelections(prev => [
            ...prev,
            {
                id: customId,
                size: size.trim() || 'Servicio',
                quantity: Math.max(1, quantity),
                customPrice: price,
                customName: name.trim(),
            }
        ]);
    };

    const handleAddProduct = (p: Product, size: string) => {
        setSelections(prev => {
            const existing = prev.find(s => s.id === p.id && s.size === size);
            if (existing) {
                return prev.map(s => s.id === p.id && s.size === size ? { ...s, quantity: s.quantity + 1 } : s);
            }
            const price = p.sizes.find(sz => sz.size === size)?.offerPrice;
            return [...prev, { id: p.id, size, quantity: 1, customPrice: price }];
        });
        setSearchTerm('');
    };

    const handleRemoveProduct = (id: string, size: string) => {
        setSelections(prev => prev.filter(s => !(s.id === id && s.size === size)));
    };

    const updateQuantity = (id: string, size: string, delta: number) => {
        setSelections(prev => prev.map(s => 
            s.id === id && s.size === size ? { ...s, quantity: Math.max(1, (s.quantity || 0) + delta) } : s
        ));
    };

    const setDirectQuantity = (id: string, size: string, qty: number) => {
        setSelections(prev => prev.map(s => 
            s.id === id && s.size === size ? { ...s, quantity: qty } : s
        ));
    };

    const updatePrice = (id: string, size: string, newPrice: number) => {
        setSelections(prev => prev.map(s => 
            s.id === id && s.size === size ? { ...s, customPrice: isNaN(newPrice) ? 0 : newPrice } : s
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!contact.firstName || !contact.lastName || !isValidPhoneE164(contact.phone)) {
            return setError('Nombre, Apellido y un Celular válido (+56 9 ...) son obligatorios.');
        }
        if (selections.length === 0) {
            return setError('Debe seleccionar al menos un producto.');
        }
        if (serviceType === 'event' && confirmNow) {
            const confirmErr = validateConfirmNowState(currentWizardState);
            if (confirmErr) return setError(confirmErr);
        }

        const cleanedSelections = selections.map(s => (!s.quantity || s.quantity < 1 ? { ...s, quantity: 1 } : s));
        const stateToSubmit: WizardState = {
            ...currentWizardState,
            selections: cleanedSelections
        };

        startTransition(async () => {
            const res = await createQuoteAdmin({
                state: stateToSubmit,
                confirmNow: serviceType === 'event' && confirmNow,
                overrides: {
                    ...(shippingPorPagar ? { shippingCost: 0, shippingLabel: 'Por Pagar' } : shippingOverride !== undefined ? { shippingCost: shippingOverride } : {}),
                    ...(serviceType === 'event' && installationOverride !== undefined && { installationCost: installationOverride }),
                    ...(serviceType === 'direct' && { installationCost: 0 }),
                    manualDiscount: discountOverride
                }
            });

            if (res.success && res.token) {
                setSuccessData({
                    token: res.token,
                    quoteId: res.quoteId!,
                    status: res.status || (serviceType === 'direct' ? 'confirmed' : 'draft'),
                });
                router.refresh();
            } else {
                setError(res.error || 'Error al crear la cotización.');
            }
        });
    };

    const getWhatsAppUrl = () => {
        if (!successData) return '';
        const phone = toWhatsAppDigits(contact.phone);
        const msg =
            successData.status === 'confirmed'
                ? `¡Hola *${contact.firstName}*! Tu reserva ya quedó confirmada.\n\nPuedes verla aquí:\n${SITE_URL}/cotizar/${successData.token}`
                : `¡Hola *${contact.firstName}*! Te envío la cotización solicitada para tu evento\n\nPuedes revisarla, completar tus datos faltantes y reservarla directamente en este link:\n${SITE_URL}/cotizar/${successData.token}`;
        return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : '';
    };

    if (successData) {
        const isConfirmed = successData.status === 'confirmed' || serviceType === 'direct';
        return (
            <div className="max-w-xl mx-auto py-20 text-center animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/20">
                    <Check size={40} strokeWidth={3} />
                </div>
                <h1 className="text-white text-3xl font-black mb-4 uppercase tracking-tighter">
                    {isConfirmed ? '¡Reserva Confirmada!' : '¡Cotización Creada!'}
                </h1>
                <p className="text-slate-400 mb-10 leading-relaxed text-sm">
                    {isConfirmed
                        ? 'La reserva quedó confirmada y se envió el email al cliente. Puedes avisar también por WhatsApp si lo deseas.'
                        : 'La cotización se generó y se envió por email al cliente. Comparte el link si necesitas contactarlo por otro canal.'}
                </p>

                <div className="grid grid-cols-1 gap-4">
                    <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-500/20">
                        <MessageCircle size={18} /> Compartir por WhatsApp
                    </a>

                    <div className="mt-4 p-4 bg-black/40 border border-white/5 rounded-2xl">
                        <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-3 text-left ml-1">Link Público de Cotización</div>
                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 group">
                            <input 
                                readOnly 
                                value={`${SITE_URL}/cotizar/${successData.token}`} 
                                className="bg-transparent text-slate-300 text-xs px-2 flex-1 outline-none font-medium truncate"
                            />
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${SITE_URL}/cotizar/${successData.token}`);
                                    alert('Link copiado al portapapeles 📋');
                                }}
                                className="bg-[#E2A049]/10 hover:bg-[#E2A049]/20 text-[#E2A049] p-2.5 rounded-lg transition-all active:scale-90 flex items-center justify-center"
                                title="Copiar link"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="pt-10 flex items-center justify-center gap-8 border-t border-white/5 mt-6">
                        <Link href="/admin/quotes" className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors">Ver Listado</Link>
                        <button onClick={() => window.location.reload()} className="text-[#E2A049] text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors">Crear otra</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                    <Link href="/admin/quotes" className="p-3 bg-white/5 text-slate-400 hover:text-white rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                             <span className="px-2.5 py-0.5 bg-[#E2A049]/10 text-[#E2A049] text-[10px] font-black uppercase tracking-widest rounded-full">Admin Panel</span>
                             <h1 className="text-white text-2xl font-black tracking-tight">Nueva Cotización Manual</h1>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Solo los datos personales y productos son obligatorios.</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-rose-400 text-sm font-bold animate-in slide-in-from-top-4 duration-300">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-10">
                    
                    {/* TYPE TOGGLE */}
                    <div className="flex bg-black/40 border border-white/5 p-1.5 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setServiceType('event')}
                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${serviceType === 'event' ? 'bg-[#E2A049] text-black shadow-lg shadow-[#E2A049]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Reserva de Evento
                        </button>
                        <button
                            type="button"
                            onClick={() => { setServiceType('direct'); setConfirmNow(false); }}
                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${serviceType === 'direct' ? 'bg-[#E2A049] text-black shadow-lg shadow-[#E2A049]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Venta Desechables
                        </button>
                    </div>

                    <SectionBox title="Datos Personales" icon={<span className="w-1.5 h-6 bg-[#E2A049] rounded-full" />}>
                        <div className="mb-6 relative">
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Buscar Cliente Existente</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
                                <input 
                                    value={clientSearch} 
                                    onChange={e => setClientSearch(e.target.value)} 
                                    className="admin-input !pl-12 !border-dashed !border-[#E2A049]/30 focus:!border-[#E2A049] !bg-[#E2A049]/5" 
                                    placeholder="Nombre o email del cliente..." 
                                />
                                {clientSearch && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2433] border border-[#E2A049]/20 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {filteredClients.length > 0 ? (
                                            filteredClients.map(c => (
                                                <button 
                                                    key={c.id} 
                                                    type="button"
                                                    onClick={() => handleSelectClient(c)}
                                                    className="w-full text-left p-3 hover:bg-[#E2A049]/10 rounded-xl transition-colors group flex items-start justify-between gap-4"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-white font-bold text-sm truncate">{c.first_name} {c.last_name}</div>
                                                        <div className="text-slate-500 text-xs truncate">{c.email}</div>
                                                    </div>
                                                    <Plus size={14} className="text-[#E2A049] opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-slate-500 text-xs italic">No se encontraron clientes</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Nombre" required>
                                <input required value={contact.firstName} onChange={e => setContact(c => ({...c, firstName: e.target.value}))} className="admin-input" placeholder="Juan" />
                            </Field>
                            <Field label="Apellido" required>
                                <input required value={contact.lastName} onChange={e => setContact(c => ({...c, lastName: e.target.value}))} className="admin-input" placeholder="Pérez" />
                            </Field>
                            <Field label="Email">
                                <input type="email" value={contact.email} onChange={e => setContact(c => ({...c, email: e.target.value}))} className="admin-input" placeholder="juan@correo.com (opcional)" />
                            </Field>
                            <Field label="Celular" required>
                                <PhoneInput
                                    required
                                    value={contact.phone}
                                    onChange={(e164) => setContact(c => ({ ...c, phone: e164 }))}
                                    className="admin-input"
                                />
                            </Field>
                        </div>

                        {(addressesLoading || clientAddresses.length > 0) && (
                            <div className="mt-6 pt-6 border-t border-white/5">
                                <label className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">
                                    <MapPin size={12} />
                                    Direcciones anteriores
                                    {addressesLoading && <Loader2 size={12} className="animate-spin text-[#E2A049]" />}
                                </label>
                                {!addressesLoading && clientAddresses.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {clientAddresses.map((a) => {
                                            const key = addressKey(a);
                                            const selected = selectedAddressKey === key;
                                            const comunaLabel = a.comuna === 'Otra' && a.otherComuna
                                                ? a.otherComuna
                                                : (a.comuna || 'Sin comuna');
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => applyAddress(a)}
                                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                                        selected
                                                            ? 'border-[#E2A049] bg-[#E2A049]/10'
                                                            : 'border-white/10 bg-black/20 hover:border-[#E2A049]/40 hover:bg-[#E2A049]/5'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className={`text-sm font-bold truncate ${selected ? 'text-[#E2A049]' : 'text-white'}`}>
                                                            {a.address}
                                                        </div>
                                                        <div className="text-slate-500 text-xs mt-0.5">{comunaLabel}</div>
                                                    </div>
                                                    {selected && <Check size={16} className="text-[#E2A049] shrink-0 mt-0.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </SectionBox>

                    {serviceType === 'direct' ? (
                        <SectionBox title="Información de Despacho" icon={<span className="w-1.5 h-6 bg-[#E2A049] rounded-full" />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <RegionComunaFields
                                    regions={regions}
                                    comunas={comunas}
                                    serviceType={serviceType}
                                    regionCode={contact.region || DEFAULT_REGION_CODE}
                                    comunaName={contact.comuna}
                                    otherComuna={contact.otherComuna}
                                    onRegionChange={(code) => setContact(c => ({...c, region: code, comuna: '', otherComuna: ''}))}
                                    onComunaChange={(name) => setContact(c => ({...c, comuna: name}))}
                                    onOtherComunaChange={(v) => setContact(c => ({...c, otherComuna: v}))}
                                    variant="admin"
                                />
                                <Field label="Dirección (Calle y Número)" className="md:col-span-2">
                                    <input value={contact.address} onChange={e => {
                                        setContact(c => ({...c, address: e.target.value}));
                                        setSelectedAddressKey(null);
                                    }} className="admin-input" placeholder="Av. Siempre Viva 123" />
                                </Field>
                                <Field label={directDateCopy?.label ?? 'Fecha de entrega'} className="md:col-span-2">
                                    <input
                                        type="date"
                                        value={eventData.date}
                                        onChange={e => setEventData(d => ({...d, date: e.target.value}))}
                                        className="admin-input"
                                    />
                                    {directDateCopy && (
                                        <p className="text-slate-500 text-[10px] mt-2 leading-relaxed">{directDateCopy.hint}</p>
                                    )}
                                </Field>
                            </div>
                        </SectionBox>
                    ) : (
                        <>
                            <SectionBox title="Detalles del Evento" icon={<span className="w-1.5 h-6 bg-slate-600 rounded-full" />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Field label="Temática">
                                        <select
                                            value={eventData.type}
                                            onChange={(e) => setEventData(d => ({
                                                ...d,
                                                type: e.target.value,
                                                otherType: e.target.value === 'Otro' ? d.otherType : ''
                                            }))}
                                            className="admin-input appearance-none"
                                        >
                                            <option value="">Selecciona temática...</option>
                                            {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </Field>
                                    {eventData.type === 'Otro' && (
                                        <Field label="Especificar temática">
                                            <input
                                                type="text"
                                                value={eventData.otherType}
                                                onChange={e => setEventData(d => ({ ...d, otherType: e.target.value }))}
                                                className="admin-input"
                                                placeholder="Ej: Aniversario, Graduación..."
                                            />
                                        </Field>
                                    )}
                                    <Field label="N° Invitados">
                                        <input type="number" value={consumption.guests === 0 ? '' : consumption.guests} onChange={e => setConsumption(c => ({...c, guests: Number(e.target.value)}))} className="admin-input" placeholder="0" />
                                    </Field>
                                    <Field label="Dirección (Calle y Número)" className="md:col-span-2">
                                        <input value={contact.address} onChange={e => {
                                            setContact(c => ({...c, address: e.target.value}));
                                            setSelectedAddressKey(null);
                                        }} className="admin-input" placeholder="Av. Siempre Viva 123" />
                                    </Field>
                                    <RegionComunaFields
                                    regions={regions}
                                    comunas={comunas}
                                    serviceType={serviceType}
                                    regionCode={contact.region || DEFAULT_REGION_CODE}
                                    comunaName={contact.comuna}
                                    otherComuna={contact.otherComuna}
                                    onRegionChange={(code) => setContact(c => ({...c, region: code, comuna: '', otherComuna: ''}))}
                                    onComunaChange={(name) => setContact(c => ({...c, comuna: name}))}
                                    onOtherComunaChange={(v) => setContact(c => ({...c, otherComuna: v}))}
                                    variant="admin"
                                />
                                </div>
                            </SectionBox>

                            <SectionBox title="Logística y Horarios" icon={<span className="w-1.5 h-6 bg-slate-600 rounded-full" />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                                    <Field label="Fecha Evento">
                                        <input
                                            type="date"
                                            value={eventData.date}
                                            onChange={e => {
                                                const newDate = e.target.value;
                                                setEventData(d => {
                                                    const nextDay = newDate ? calculateMaxPickupDate(newDate) : '';
                                                    const shouldAutoFillPickupDate = !d.pickupDate || (d.date && d.pickupDate === calculateMaxPickupDate(d.date));
                                                    const shouldAutoFillPickupTime = !d.pickupTime || d.pickupTime === '12:00 a 14:00';
                                                    return {
                                                        ...d,
                                                        date: newDate,
                                                        pickupDate: shouldAutoFillPickupDate && nextDay ? nextDay : d.pickupDate,
                                                        pickupTime: shouldAutoFillPickupTime && newDate ? '12:00 a 14:00' : d.pickupTime,
                                                    };
                                                });
                                            }}
                                            className="admin-input"
                                        />
                                    </Field>
                                    <Field label="Hora Inicio (Evento)">
                                        <input type="time" value={eventData.startTime} onChange={e => setEventData(d => ({...d, startTime: e.target.value}))} className="admin-input" />
                                    </Field>
                                    <Field label="Fecha Retiro">
                                        <input type="date" value={eventData.pickupDate} onChange={e => setEventData(d => ({...d, pickupDate: e.target.value}))} className="admin-input" />
                                    </Field>
                                    
                                    <div className="flex flex-col gap-2">
                                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                                            Horario Retiro
                                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors normal-case">
                                                <input 
                                                    type="checkbox" 
                                                    checked={eventData.pickupTime === '--:--'} 
                                                    onChange={e => setEventData(d => ({...d, pickupTime: e.target.checked ? '--:--' : ''}))}
                                                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 text-[#E2A049] focus:ring-0 focus:ring-offset-0"
                                                />
                                                <span className="text-[9px]">Todo el día</span>
                                            </label>
                                        </label>
                                        
                                        {eventData.pickupTime === '--:--' ? (
                                            <div className="admin-input flex items-center justify-center text-slate-500 font-bold bg-emerald-500/5 border-emerald-500/10">
                                                TODO EL DÍA
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="time" 
                                                    className="admin-input !py-2.5 !px-3 text-xs"
                                                    value={eventData.pickupTime.includes(' a ') ? eventData.pickupTime.split(' a ')[0] : eventData.pickupTime}
                                                    onChange={e => {
                                                        const start = e.target.value;
                                                        const end = eventData.pickupTime.includes(' a ') ? eventData.pickupTime.split(' a ')[1] : '';
                                                        setEventData(d => ({...d, pickupTime: (start && end) ? `${start} a ${end}` : start}));
                                                    }}
                                                />
                                                <span className="text-slate-600">-</span>
                                                <input 
                                                    type="time" 
                                                    className="admin-input !py-2.5 !px-3 text-xs"
                                                    value={eventData.pickupTime.includes(' a ') ? eventData.pickupTime.split(' a ')[1] : ''}
                                                    onChange={e => {
                                                        const start = eventData.pickupTime.includes(' a ') ? eventData.pickupTime.split(' a ')[0] : eventData.pickupTime;
                                                        const end = e.target.value;
                                                        setEventData(d => ({...d, pickupTime: (start && end) ? `${start} a ${end}` : end}));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </SectionBox>
                        </>
                    )}

                    <SectionBox title="Comentarios" icon={<span className="w-1.5 h-6 bg-slate-600 rounded-full" />}>
                        <textarea value={contact.comments} onChange={e => setContact(c => ({...c, comments: e.target.value}))} rows={4} className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-[#E2A049] transition-all text-sm resize-none" placeholder="Notas especiales, alergias o detalles internos..." />
                    </SectionBox>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-[#1e2433] border border-white/5 rounded-[32px] p-8 shadow-2xl shadow-black/20 sticky top-10 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E2A049]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        
                        <h3 className="text-white font-black text-lg mb-8 flex items-center gap-3 uppercase tracking-tight">
                            <span className="w-1.5 h-6 bg-[#E2A049] rounded-full" />
                            Productos
                        </h3>
                        
                        <div className="relative mb-8">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white text-sm outline-none focus:border-[#E2A049] transition-all placeholder:text-slate-600 shadow-inner" placeholder="Añadir cóctel..." />
                            {searchTerm.length > 1 && (
                                <div className="absolute top-full left-0 right-0 bg-[#252c3d] border border-white/10 rounded-2xl mt-3 z-50 max-h-[350px] overflow-y-auto shadow-2xl p-3 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                                    {filteredProducts.map(p => (
                                        <div key={p.id} className="p-4 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-xl transition-colors">
                                            <div className="text-white font-bold text-xs mb-3">{p.name}</div>
                                            <div className="flex flex-wrap gap-2">
                                                {p.sizes.map(s => (
                                                    <button key={s.size} type="button" onClick={() => handleAddProduct(p, s.size)} className="px-3 py-1.5 bg-black/40 hover:bg-[#E2A049] hover:text-black border border-white/5 rounded-lg text-slate-400 text-[10px] font-black transition-all flex flex-col items-center gap-0.5">
                                                        <span>+ {s.size}</span>
                                                        <span className="opacity-50 font-medium text-[8px]">${s.offerPrice.toLocaleString('es-CL')}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Botón y panel para ítem personalizado */}
                        <div className="mb-8">
                            {!showCustomForm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCustomForm(true)}
                                    className="w-full py-3 px-4 bg-[#E2A049]/10 hover:bg-[#E2A049]/20 border border-[#E2A049]/30 rounded-2xl text-[#E2A049] text-xs font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} />
                                    <span>Agregar ítem personalizado (Solo Admin)</span>
                                </button>
                            ) : (
                                <div className="bg-black/40 border border-[#E2A049]/30 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-[#E2A049] font-black text-xs uppercase tracking-wider">
                                            Nuevo ítem personalizado (Solo Admin)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCustomForm(false);
                                                setCustomName('');
                                                setCustomPrice('');
                                                setCustomSize('Servicio');
                                                setCustomQty(1);
                                            }}
                                            className="text-slate-500 hover:text-white transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block">
                                                Nombre del ítem / servicio
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Personal de Apoyo, Bartender extra..."
                                                value={customName}
                                                onChange={(e) => setCustomName(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E2A049]"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block">
                                                    Formato
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Servicio"
                                                    value={customSize}
                                                    onChange={(e) => setCustomSize(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E2A049]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block">
                                                    Valor CLP
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="Ej: 60000"
                                                    value={customPrice}
                                                    onChange={(e) => setCustomPrice(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E2A049]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block">
                                                    Cantidad
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={customQty}
                                                    onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E2A049]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCustomForm(false);
                                                setCustomName('');
                                                setCustomPrice('');
                                                setCustomSize('Servicio');
                                                setCustomQty(1);
                                            }}
                                            className="px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/5 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!customName.trim()) {
                                                    alert('Por favor escribe un nombre para el ítem.');
                                                    return;
                                                }
                                                const priceNum = Number(customPrice);
                                                if (isNaN(priceNum) || priceNum < 0) {
                                                    alert('Por favor ingresa un valor válido.');
                                                    return;
                                                }
                                                handleAddCustomProduct(customName, priceNum, customQty, customSize || 'Servicio');
                                                setShowCustomForm(false);
                                                setCustomName('');
                                                setCustomPrice('');
                                                setCustomSize('Servicio');
                                                setCustomQty(1);
                                            }}
                                            className="px-4 py-1.5 rounded-xl bg-[#E2A049] text-[#1a1a2e] text-xs font-black hover:bg-[#E2A049]/90 transition-all flex items-center gap-1.5"
                                        >
                                            <Plus size={14} />
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {belowEventMinLiters && (
                            <div className="mb-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 flex items-start gap-3 text-amber-200 text-xs leading-relaxed">
                                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                                <span>
                                    Volumen actual: <strong className="text-amber-100">{summary.totalLiters}L</strong> (mínimo web: {activeMinLiters}L).
                                    Desde admin puedes generar la cotización igual; el cliente no podrá confirmarla por debajo del mínimo salvo que la confirmes aquí.
                                </span>
                            </div>
                        )}

                        <div className="space-y-4 mb-10 pr-1">
                            {selections.length === 0 ? (
                                <div className="text-center py-10 text-slate-600 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl opacity-50">Sin productos</div>
                            ) : selections.map(s => {
                                const product = allProducts.find(p => p.id === s.id);
                                return (
                                    <div key={s.id + s.size} className="p-3.5 bg-black/25 rounded-2xl border border-white/5 group hover:border-[#E2A049]/20 transition-all flex flex-col gap-2.5">
                                        {/* Fila 1: Badge, Nombre, Formato y Botón Borrar */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {!product && (
                                                        <span className="text-[9px] font-black bg-[#E2A049]/15 text-[#E2A049] px-1.5 py-0.5 rounded border border-[#E2A049]/20 uppercase shrink-0">
                                                            Custom
                                                        </span>
                                                    )}
                                                    <span className="text-white font-bold text-[12px] uppercase tracking-tight leading-snug break-words">
                                                        {s.customName || product?.name || 'Producto Desconocido'}
                                                    </span>
                                                </div>
                                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                                                    {s.size}
                                                </div>
                                            </div>

                                            {/* Eliminar */}
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveProduct(s.id, s.size)} 
                                                className="text-rose-500/40 hover:text-rose-500 p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                                                title="Eliminar producto"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        
                                        {/* Fila 2: Precio Unitario y Controles de Cantidad */}
                                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                                            {/* Input de Precio */}
                                            <div className="flex items-center text-[#E2A049] text-xs font-black bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/5 focus-within:border-[#E2A049]/40 transition-colors">
                                                <span className="mr-1 text-[10px] opacity-40">$</span>
                                                <input 
                                                    type="number"
                                                    value={s.customPrice ?? 0}
                                                    onChange={(e) => updatePrice(s.id, s.size, parseInt(e.target.value))}
                                                    className="bg-transparent w-20 outline-none focus:text-white transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                                                    title="Precio unitario"
                                                />
                                            </div>

                                            {/* Controles de Cantidad */}
                                            <div className="flex items-center gap-1 bg-black/60 rounded-xl p-0.5 border border-white/5 focus-within:border-[#E2A049]/40 transition-colors">
                                                <button type="button" onClick={() => updateQuantity(s.id, s.size, -1)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors" title="Disminuir">-</button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={s.quantity === 0 ? '' : s.quantity}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        const parsed = raw === '' ? 0 : parseInt(raw, 10);
                                                        setDirectQuantity(s.id, s.size, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                                    }}
                                                    onBlur={() => {
                                                        if (!s.quantity || s.quantity < 1) {
                                                            setDirectQuantity(s.id, s.size, 1);
                                                        }
                                                    }}
                                                    className="bg-transparent text-xs font-black text-[#E2A049] w-12 text-center outline-none focus:text-white transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    title="Cantidad editable"
                                                />
                                                <button type="button" onClick={() => updateQuantity(s.id, s.size, 1)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors" title="Aumentar">+</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-4 mb-8 pt-6 border-t border-white/5">
                            {/* Dispensador (Moved from main form) */}
                            {serviceType === 'event' && (
                                <Field label="Tipo de Servicio">
                                    <select value={dispenser} onChange={e => {
                                        setDispenser(e.target.value as any);
                                        setInstallationOverride(undefined); // Reset override on change
                                    }} className="admin-input appearance-none font-bold text-[#E2A049] !bg-black/40 !py-3 !rounded-xl">
                                        <option value="portatil">Dispensador Portátil</option>
                                        <option value="muro">Muro de Coctelería</option>
                                    </select>
                                </Field>
                            )}

                            {/* Valor Traslado Override */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-slate-500 text-[9px] font-black uppercase tracking-widest ml-1">Valor Traslado</label>
                                    {shippingOverride !== undefined && !shippingPorPagar && (
                                        <button type="button" onClick={() => setShippingOverride(undefined)} className="text-[#E2A049] text-[8px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                                            <RefreshCw size={10} /> Auto
                                        </button>
                                    )}
                                </div>
                                {!shippingPorPagar && (
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                        <input 
                                            type="number" 
                                            value={shippingOverride !== undefined ? shippingOverride : (summary.shippingCost === 0 && selections.length > 0 ? 0 : summary.shippingCost || '')} 
                                            onChange={e => setShippingOverride(e.target.value === '' ? undefined : Number(e.target.value))} 
                                            className={`w-full bg-black/30 border rounded-xl pl-8 pr-4 py-3 text-white text-sm outline-none transition-all ${shippingOverride !== undefined ? 'border-[#E2A049] shadow-[0_0_10px_rgba(226,160,73,0.1)]' : 'border-white/10 focus:border-[#E2A049]'}`} 
                                            placeholder={selections.length > 0 ? summary.shippingCost.toString() : 'Selecciona comuna...'}
                                        />
                                    </div>
                                )}
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-amber-500 shrink-0"
                                        checked={shippingPorPagar}
                                        onChange={e => {
                                            setShippingPorPagar(e.target.checked);
                                            if (e.target.checked) setShippingOverride(0);
                                            else setShippingOverride(undefined);
                                        }}
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Por Pagar <span className="text-slate-600 normal-case font-normal">(el cliente paga el envío al carrier)</span></span>
                                </label>
                            </div>

                            {/* Valor Dispensador Override */}
                            {serviceType === 'event' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-slate-500 text-[9px] font-black uppercase tracking-widest ml-1">Valor Dispensador</label>
                                        {installationOverride !== undefined && (
                                            <button type="button" onClick={() => setInstallationOverride(undefined)} className="text-[#E2A049] text-[8px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                                                <RefreshCw size={10} /> Auto
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                        <input 
                                            type="number" 
                                            value={installationOverride !== undefined ? installationOverride : (suggestedInstallation === 0 && selections.length > 0 ? 0 : suggestedInstallation || '')} 
                                            onChange={e => setInstallationOverride(e.target.value === '' ? undefined : Number(e.target.value))} 
                                            className={`w-full bg-black/30 border rounded-xl pl-8 pr-4 py-3 text-white text-sm outline-none transition-all ${installationOverride !== undefined ? 'border-[#E2A049] shadow-[0_0_10px_rgba(226,160,73,0.1)]' : 'border-white/10 focus:border-[#E2A049]'}`}
                                            placeholder={selections.length > 0 ? suggestedInstallation.toString() : 'Calculando...'}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Descuento Extra */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 text-[9px] font-black uppercase tracking-widest ml-1">Descuento Extra</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500 text-sm">- $</span>
                                    <input 
                                        type="number" 
                                        value={discountOverride === 0 ? '' : discountOverride} 
                                        onChange={e => setDiscountOverride(e.target.value === '' ? 0 : Number(e.target.value))} 
                                        className={`w-full bg-black/30 border rounded-xl pl-10 pr-4 py-3 text-rose-400 text-sm outline-none transition-all ${discountOverride > 0 ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-white/10 focus:border-[#E2A049]'}`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 relative">
                            <div className="flex justify-between items-baseline mb-6">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Total Estimado</div>
                                <div className="text-3xl font-black text-[#E2A049] tracking-tighter">
                                    ${finalTotal.toLocaleString('es-CL')}
                                </div>
                            </div>
                            {serviceType === 'event' && (
                                <label className="flex items-start gap-3 cursor-pointer mb-5 p-3 rounded-xl border border-white/10 bg-black/20">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-[#E2A049] shrink-0"
                                        checked={confirmNow}
                                        onChange={(e) => {
                                            setConfirmNow(e.target.checked);
                                            if (e.target.checked && !eventData.pickupDate && eventData.date) {
                                                setEventData((d) => ({ ...d, pickupDate: d.date }));
                                            }
                                        }}
                                    />
                                    <span className="text-[11px] text-slate-300 leading-snug">
                                        <strong className="text-white font-black">Crear como reserva confirmada</strong>
                                        <span className="block text-slate-500 mt-0.5">
                                            Requiere dirección, hora de inicio y retiro. Sincroniza Calendar/CRM (sin email automático).
                                        </span>
                                    </span>
                                </label>
                            )}
                            <button type="submit" disabled={isPending} className="w-full bg-[#E2A049] hover:bg-[#f0b05b] text-[#1a1a2e] py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-[#E2A049]/10 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait">
                                {isPending ? 'Procesando...' : <><Save size={20} /> {serviceType === 'direct' ? 'Generar Pedido' : confirmNow ? 'Confirmar Reserva' : 'Generar Cotización'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>


        </div>
    );
}

function SectionBox({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="bg-[#1e2433] border border-white/5 rounded-[32px] p-10 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
            <h3 className="text-white font-black text-lg mb-8 flex items-center gap-4 uppercase tracking-tight">{icon}{title}</h3>
            {children}
        </div>
    );
}

function Field({ label, required, children, className }: { label: string, required?: boolean, children: React.ReactNode, className?: string }) {
    return (
        <div className={`space-y-2 flex flex-col ${className || ''}`}>
            <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1">{label}{required && <span className="text-[#E2A049]">*</span>}</label>
            {children}
        </div>
    );
}

