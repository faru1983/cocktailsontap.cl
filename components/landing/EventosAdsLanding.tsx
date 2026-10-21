'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import type { CocktailForWizard, Comuna, Region, EventType, WizardSelection } from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import {
    calculateEstimatedProposal,
    calculateSummaryData,
    getWhatsAppUrl,
    isEventBarrelSizeLabelCompatible,
} from '@/lib/wizardLogic';
import { formatCurrency } from '@/lib/utils';
import {
    MURO_MIN_LITERS,
    PORTATIL_MIN_LITERS,
    MURO_INSTALLATION_COST,
    WHATSAPP_NUMBER,
} from '@/lib/config';
import { createQuote } from '@/app/actions/createQuote';
import { getClientMetaAttribution } from '@/lib/attribution';
import { trackOnce } from '@/lib/fpixel';
import { isValidPhoneE164, isChilePrefixOnly } from '@/lib/phone';
import { validateShippingDate } from '@/lib/shippingMethods';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import {
    Sparkles,
    Wine,
    Snowflake,
    Leaf,
    GlassWater,
    Martini,
    Infinity as InfinityIcon,
    Check,
    ArrowRight,
    Star,
    Loader2,
    AlertCircle,
    Clock,
    ShieldCheck,
    ExternalLink,
    ChevronDown,
    Plus,
    Minus,
    Users,
    Play,
    Instagram,
    Zap,
    Award,
    CheckCircle2,
    SlidersHorizontal,
    Mail,
} from 'lucide-react';
import { WhatsappIcon } from '@/components/shared/icons';

interface Props {
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
}

const STEP_PHOTOS = [
    {
        step: '01',
        title: 'Hielo a tope',
        desc: 'Incluimos sacos de hielo para toda la noche. Tus invitados llenan su copa sin preocuparse.',
        img: '/assets/pasos_1.webp',
    },
    {
        step: '02',
        title: 'Tira la canilla',
        desc: 'En 5 segundos sale el cóctel helado, con la mezcla exacta de un bar de autor.',
        img: '/assets/pasos_2.webp',
    },
    {
        step: '03',
        title: 'Toque de Garnish',
        desc: 'Decoraciones de cítricos deshidratados incluidas para coronar cada copa.',
        img: '/assets/pasos_3.webp',
    },
    {
        step: '04',
        title: 'Sin límite de horas',
        desc: 'Nadie te apura ni te cobra horas extra. Retiramos los equipos al día siguiente.',
        img: '/assets/pasos_4.webp',
    },
];

const ZERO_COST_PERKS = [
    {
        icon: Snowflake,
        title: 'Hielo ilimitado para tu barra',
        valueTag: 'Valor ref. $45.000',
        desc: 'Calculado según los litros de tu evento para que nunca falte frío.',
    },
    {
        icon: GlassWater,
        title: 'Préstamo de copas y vasos',
        valueTag: 'Valor ref. $65.000',
        desc: 'Cristalería reutilizable de alta resistencia lista para servir.',
    },
    {
        icon: Leaf,
        title: 'Garnish cítrico deshidratado',
        valueTag: 'Valor ref. $30.000',
        desc: 'Naranja, limón o pomelo deshidratado más hieleras, pinzas y palas.',
    },
    {
        icon: InfinityIcon,
        title: 'Arriendo sin límite de horario',
        valueTag: 'Sin cobro por hora',
        desc: 'Instalamos horas antes de tu fiesta y retiramos al día siguiente.',
    },
];

const GOOGLE_REVIEWS = [
    {
        initials: 'CV',
        name: 'Catalina Valenzuela',
        context: 'Matrimonio · 120 invitados',
        timeAgo: 'Reseña en Google Maps',
        comment:
            'Contratamos el Muro de Coctelería con Aperol Spritz y Pisco Sour para nuestro matrimonio. Fue la sensación de la fiesta, cero filas en toda la noche y los cócteles estaban exquisitos. Llegaron súper puntuales.',
    },
    {
        initials: 'RM',
        name: 'Rodrigo Morales',
        context: 'Cumpleaños 40 · 50 invitados',
        timeAgo: 'Reseña en Google Maps',
        comment:
            'Pedí el dispensador portátil con Mojito y Moscow Mule. Nos despreocupamos por completo del hielo y los vasos porque trajeron todo listo. Retiraron al día siguiente sin ningún apuro.',
    },
    {
        initials: 'PE',
        name: 'Paulina Echeverría',
        context: 'Evento Empresa · 80 personas',
        timeAgo: 'Reseña en Google Maps',
        comment:
            'Una solución redonda para nuestro evento corporativo. Presentación impecable, cada persona se servía en segundos y ahorramos muchísimo comparado con contratar barra tradicional con garzones por hora.',
    },
    {
        initials: 'MS',
        name: 'Matías Silva',
        context: 'Fiesta en casa · 60 invitados',
        timeAgo: 'Reseña en Google Maps',
        comment:
            'Los cócteles son 100% naturales, nada que ver con premezclas artificiales. El Pisco Sour y el Ramazzotti estaban a nivel de bar top. Todos los invitados nos pidieron el dato.',
    },
];

export default function EventosAdsLanding({ cocktails, comunas, regions, eventTypes }: Props) {
    // Media Showcase en Hero: 'video' (loop instantáneo) | 'reel' (Instagram Embed oficial)
    const [heroMediaTab, setHeroMediaTab] = useState<'video' | 'reel'>('video');

    // Estado de la calculadora interactiva
    const [guests, setGuests] = useState<number>(60);
    const [customGuests, setCustomGuests] = useState<string>('');
    const [isCustomGuests, setIsCustomGuests] = useState<boolean>(false);
    const [drinksPerPerson, setDrinksPerPerson] = useState<number>(3);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro'>('portatil');
    const [userOverrodeDispenser, setUserOverrodeDispenser] = useState(false);

    // Personalización de sabores
    const [showCocktailDrawer, setShowCocktailDrawer] = useState(false);
    const [manualSelections, setManualSelections] = useState<WizardSelection[]>([]);

    // Formulario de contacto
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('+56');
    const [email, setEmail] = useState('');
    const [region, setRegion] = useState(DEFAULT_REGION_CODE);
    const [comuna, setComuna] = useState('');
    const [otherComuna, setOtherComuna] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventType, setEventType] = useState(eventTypes[0]?.name || 'Cumpleaños');
    const [otherType, setOtherType] = useState('');

    // Estados de envío y errores
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sendStatus, setSendStatus] = useState<'idle' | 'saving' | 'error'>('idle');
    const [activeCta, setActiveCta] = useState<'whatsapp' | 'email' | null>(null);
    const [saveError, setSaveError] = useState('');
    const [inStudioView, setInStudioView] = useState(false);

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;

    // Detectar cuando el usuario ya está en el configurador para ocultar la barra flotante móvil
    useEffect(() => {
        const el = document.getElementById('bar-studio');
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const obs = new IntersectionObserver(
            ([entry]) => setInStudioView(entry.isIntersecting),
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Propuesta calculada
    const proposal = useMemo(() => {
        return calculateEstimatedProposal(guests, drinksPerPerson, cocktails);
    }, [guests, drinksPerPerson, cocktails]);

    const recommendedDispenser: 'portatil' | 'muro' =
        proposal.liters >= MURO_MIN_LITERS ? 'muro' : 'portatil';

    useEffect(() => {
        if (!userOverrodeDispenser) {
            setDispenser(recommendedDispenser);
        }
    }, [recommendedDispenser, userOverrodeDispenser]);

    const activeDispenser = dispenser;

    // Cócteles de evento (sin categoría 'Otros')
    const baseCocktails = useMemo(() => {
        return cocktails.filter((c) => c.category !== 'Otros');
    }, [cocktails]);

    // Top Sellers reales del catálogo
    const topSellers = useMemo(() => {
        const priorityKeywords = [
            'pisco sour',
            'aperol',
            'mojito',
            'ramazzotti',
            'moscow mule',
            'sangria',
            'sangría',
            'maracuya',
            'maracuyá',
            'gin',
        ];
        const picked: CocktailForWizard[] = [];
        priorityKeywords.forEach((kw) => {
            const match = baseCocktails.find((c) => c.name.toLowerCase().includes(kw));
            if (match && !picked.some((p) => p.id === match.id)) {
                picked.push(match);
            }
        });
        for (const c of baseCocktails) {
            if (picked.length >= 8) break;
            if (!picked.some((p) => p.id === c.id)) picked.push(c);
        }
        return picked;
    }, [baseCocktails]);

    // Pre-selección inteligente de barriles compatibles con el dispensador elegido
    const autoSelections: WizardSelection[] = useMemo(() => {
        const result: WizardSelection[] = [];
        if (topSellers.length === 0) return result;

        // Si el usuario eligió Muro (solo 20L y 30L, mín 60L) o Portátil (solo 5L y 10L, mín 10L)
        if (activeDispenser === 'muro') {
            const targetLiters = Math.max(MURO_MIN_LITERS, proposal.liters);
            let remaining = targetLiters;
            let idx = 0;
            while (remaining > 0 && idx < 20) {
                const sizeNum = remaining >= 30 && remaining % 20 !== 0 ? 30 : 20;
                const sizeLabel = `${sizeNum}L`;
                const cocktail = topSellers[idx % topSellers.length];
                idx++;
                const existing = result.find((r) => r.id === cocktail.id && r.size === sizeLabel);
                if (existing) existing.quantity += 1;
                else result.push({ id: cocktail.id, size: sizeLabel, quantity: 1 });
                remaining -= sizeNum;
            }
            return result;
        }

        // Portátil: barriles de 10L y 5L
        const targetLiters = Math.max(PORTATIL_MIN_LITERS, proposal.liters);
        let remaining = targetLiters;
        let idx = 0;
        while (remaining > 0 && idx < 30) {
            const sizeNum = remaining >= 10 ? 10 : 5;
            const sizeLabel = `${sizeNum}L`;
            const cocktail = topSellers[idx % topSellers.length];
            idx++;
            const existing = result.find((r) => r.id === cocktail.id && r.size === sizeLabel);
            if (existing) existing.quantity += 1;
            else result.push({ id: cocktail.id, size: sizeLabel, quantity: 1 });
            remaining -= sizeNum;
        }
        return result;
    }, [proposal.liters, activeDispenser, topSellers]);

    const currentSelections = manualSelections.length > 0 ? manualSelections : autoSelections;

    // Resumen exacto de precios con la lógica oficial del servidor
    const summaryData = useMemo(() => {
        return calculateSummaryData(
            {
                step: 5,
                serviceType: 'event',
                dispenser: activeDispenser,
                selections: currentSelections,
                consumption: { guests, drinksPerPerson },
                contact: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    address: '',
                    region,
                    comuna,
                    otherComuna,
                    comments: '',
                },
                eventData: {
                    type: eventType,
                    otherType,
                    date: eventDate,
                    startTime: '',
                    pickupDate: '',
                    pickupTime: '',
                },
                expandedCocktailId: null,
                expandedCategoryId: '',
            },
            cocktails,
            comunas
        );
    }, [
        currentSelections,
        activeDispenser,
        guests,
        drinksPerPerson,
        firstName,
        lastName,
        email,
        phone,
        region,
        comuna,
        otherComuna,
        eventType,
        otherType,
        eventDate,
        cocktails,
        comunas,
    ]);

    const pricePerCocktail = Math.round(
        summaryData.totalPrice / Math.max(1, summaryData.totalCocktails)
    );

    const scrollToStudio = (presetGuests?: number, presetDispenser?: 'portatil' | 'muro') => {
        if (presetGuests !== undefined) {
            setIsCustomGuests(false);
            setCustomGuests('');
            setGuests(presetGuests);
            setManualSelections([]);
        }
        if (presetDispenser !== undefined) {
            setUserOverrodeDispenser(true);
            setDispenser(presetDispenser);
            setManualSelections([]);
        }
        const el = document.getElementById('bar-studio');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleGuestSelect = (num: number) => {
        setIsCustomGuests(false);
        setCustomGuests('');
        setGuests(num);
        setManualSelections([]);
    };

    const handleCustomGuestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        setCustomGuests(val);
        const parsed = parseInt(val, 10);
        if (parsed > 0) {
            setGuests(parsed);
            setManualSelections([]);
        }
    };

    const handleDispenserSelect = (disp: 'portatil' | 'muro') => {
        setUserOverrodeDispenser(true);
        setDispenser(disp);
        if (manualSelections.length > 0) {
            setManualSelections(
                manualSelections.filter((s) => isEventBarrelSizeLabelCompatible(s.size, disp))
            );
        }
    };

    const handleQuantityChange = (cocktailId: string, sizeLabel: string, delta: number) => {
        const source = manualSelections.length > 0 ? manualSelections : autoSelections;
        const copy = source.map((item) => ({ ...item }));
        const idx = copy.findIndex((s) => s.id === cocktailId && s.size === sizeLabel);

        if (idx >= 0) {
            const nextQty = copy[idx].quantity + delta;
            if (nextQty <= 0) copy.splice(idx, 1);
            else copy[idx].quantity = nextQty;
        } else if (delta > 0) {
            copy.push({ id: cocktailId, size: sizeLabel, quantity: 1 });
        }
        setManualSelections(copy);
    };

    const clearFieldError = (key: string) => {
        if (!errors[key]) return;
        setErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const validate = (targetCta: 'whatsapp' | 'email') => {
        const errs: Record<string, string> = {};

        if (!firstName.trim() || firstName.trim().length < 2) {
            errs.firstName = 'Ingresa tu nombre';
        }
        if (!lastName.trim() || lastName.trim().length < 2) {
            errs.lastName = 'Ingresa tu apellido';
        }
        if (!phone.trim() || isChilePrefixOnly(phone) || !isValidPhoneE164(phone)) {
            errs.phone = 'Ingresa un celular válido (+56 9 XXXX XXXX)';
        }
        if (targetCta === 'email') {
            if (!email.trim()) {
                errs.email = 'Ingresa tu email para enviarte la cotización formal';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                errs.email = 'Formato de email inválido';
            }
        } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errs.email = 'Formato de email inválido';
        }

        if (!comuna.trim()) {
            errs.comuna = 'Selecciona tu comuna';
        } else if (comuna === 'Otra' && !otherComuna.trim()) {
            errs.comuna = 'Especifica el nombre de tu comuna';
        }

        if (!eventDate.trim()) {
            errs.date = 'Elige la fecha tentativa de tu evento';
        } else {
            const dateErr = validateShippingDate(eventDate, eventMethodConfig, 5);
            if (dateErr) errs.date = dateErr;
        }

        const minLiters = activeDispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
        if (summaryData.totalLiters < minLiters) {
            errs.liters = `El pedido mínimo para ${
                activeDispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'
            } es de ${minLiters}L (actual: ${summaryData.totalLiters}L).`;
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (ctaChannel: 'whatsapp' | 'email') => {
        if (!validate(ctaChannel)) {
            const formEl = document.getElementById('studio-checkout-card');
            if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSendStatus('saving');
        setActiveCta(ctaChannel);
        setSaveError('');

        try {
            const attribution = getClientMetaAttribution();

            const result = await createQuote({
                state: {
                    step: 6,
                    serviceType: 'event',
                    dispenser: activeDispenser,
                    consumption: {
                        guests,
                        drinksPerPerson,
                    },
                    contact: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        email: email.trim(),
                        phone: phone.trim(),
                        address: '',
                        region,
                        comuna,
                        otherComuna: comuna === 'Otra' ? otherComuna.trim() : '',
                        comments: '',
                    },
                    eventData: {
                        type: eventType,
                        otherType: eventType === 'Otro' ? otherType.trim() : '',
                        date: eventDate,
                        startTime: '',
                        pickupDate: '',
                        pickupTime: '',
                    },
                    selections: currentSelections,
                    expandedCocktailId: null,
                    expandedCategoryId: '',
                },
                confirmNow: false,
                fbc: attribution.fbc,
                fbp: attribution.fbp,
                landingMeta: {
                    landing: 'lp_eventos',
                    ctaChannel,
                },
            });

            if (!result.success || !result.token) {
                setSaveError(
                    result.error || 'No pudimos generar tu propuesta. Revisa los datos e intenta de nuevo.'
                );
                setSendStatus('error');
                return;
            }

            // Deduplicación exacta con CAPI server-side (initiateCheckout_TOKEN)
            trackOnce(`initiateCheckout_${result.token}`, 'InitiateCheckout', {
                content_name: 'Cotización Eventos Landing Ads',
                content_category: 'Eventos',
                value: result.totalPrice || summaryData.totalPrice,
                currency: 'CLP',
                service: 'eventos',
                cta_channel: ctaChannel,
            });

            if (ctaChannel === 'whatsapp') {
                const totalFormatted = formatCurrency(result.totalPrice || summaryData.totalPrice);
                const quoteUrl = `https://cocktailsontap.cl/cotizar/${result.token}`;
                const itemsList = currentSelections
                    .map((s) => {
                        const prod = cocktails.find((c) => c.id === s.id);
                        return `  • ${s.quantity}x ${s.size} ${prod?.name || 'Cóctel'}`;
                    })
                    .join('\n');

                const waMessage = `¡Hola Cocktails on Tap! 🍸 Acabo de armar mi propuesta en la web:
• Nombre: ${firstName.trim()} ${lastName.trim()}
• Evento: ${eventType}${eventType === 'Otro' && otherType ? ` (${otherType})` : ''} (${guests} invitados)
• Fecha: ${eventDate} en ${comuna === 'Otra' ? otherComuna : comuna}
• Formato: ${activeDispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'} (${summaryData.totalLiters}L — ~${summaryData.totalCocktails} cócteles)
• Sabores sugeridos:
${itemsList}
• Total estimado: ${totalFormatted}
• Link de mi cotización: ${quoteUrl}

Quiero confirmar disponibilidad para mi fecha.`;

                window.location.href = getWhatsAppUrl(waMessage);
                return;
            }

            window.location.href = `/cotizar/${result.token}?new=true`;
        } catch (err) {
            console.error('Error en handleSubmit /lp/eventos:', err);
            setSaveError('Error de conexión. Intenta nuevamente.');
            setSendStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-[#090B10] text-white font-sans antialiased selection:bg-primary selection:text-slate-950">
            {/* ═══════════════════════════════════════════════════════════════════
                FLOATING GLASS DOCK HEADER (Sin menú de fuga, logo blanco visible)
               ═══════════════════════════════════════════════════════════════════ */}
            <header className="fixed top-3 inset-x-0 z-50 px-3 sm:px-6 pointer-events-none">
                <div className="max-w-6xl mx-auto flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-full px-4 sm:px-6 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] pointer-events-auto">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/assets/logo.webp"
                            alt="Cocktails on Tap Chile"
                            width={120}
                            height={40}
                            className="h-8 sm:h-9 w-auto object-contain"
                            priority
                        />
                        <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-white/10 text-xs text-zinc-300 font-medium">
                            <div className="flex items-center text-amber-400">
                                <Star className="w-3.5 h-3.5 fill-current" />
                            </div>
                            <span className="font-bold text-white">5.0</span>
                            <span className="text-zinc-400">en Google Maps · +500 Eventos</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setHeroMediaTab('reel');
                                const el = document.getElementById('hero-media-showcase');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                        >
                            <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                            <span>Ver cómo funciona</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => scrollToStudio()}
                            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-primary to-[#d98a2b] text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_25px_rgba(226,160,73,0.4)] hover:brightness-110 transition-transform active:scale-95 cursor-pointer"
                        >
                            <span>Calcular mi Barra</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════
                1. SPLIT ASYMMETRIC HERO: Propuesta de Valor + Media Showcase
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
                {/* Ambient Copper/Gold Radial Glows */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-40 left-1/4 w-[550px] h-[550px] rounded-full bg-primary/15 blur-[130px]"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/3 -right-32 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[120px]"
                />

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
                    {/* Columna Izquierda: Copy Editorial + Selector Rápido de Invitados */}
                    <div className="lg:col-span-7 flex flex-col items-start text-left">
                        <a
                            href="https://maps.app.goo.gl/AYMHTHg8eWSMTa888"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-zinc-200 mb-6 transition-colors"
                        >
                            <span className="flex items-center text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                ))}
                            </span>
                            <span>5.0 en Google · Bar Móvil Autoservicio #1 en Chile</span>
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </a>

                        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.06] text-white mb-6">
                            Cócteles de autor tirados de barril.{' '}
                            <span className="bg-gradient-to-r from-amber-200 via-primary to-amber-400 bg-clip-text text-transparent">
                                Cero filas. Cero bartenders por hora.
                            </span>
                        </h1>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed mb-8 max-w-xl font-normal">
                            Instalamos una estación de coctelería profesional en tu matrimonio, cumpleaños o evento corporativo. Tus invitados tiran la canilla y se sirven un{' '}
                            <strong className="text-white font-bold">
                                Pisco Sour, Aperol Spritz, Mojito o Moscow Mule helado en 5 segundos
                            </strong>
                            .
                        </p>

                        {/* Ecuación de valor: Todo incluido a $0 */}
                        <div className="w-full bg-zinc-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 mb-8 shadow-xl">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" />
                                    Todo incluido sin letra chica
                                </span>
                                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    Ahorras +$140.000 en extras
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Hielo ilimitado ($0)</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Copas de vidrio ($0)</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Garnish cítrico ($0)</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Sin límite de horas</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Micro-Hook: "¿Cuántos invitados tendrás?" */}
                        <div className="w-full">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-primary" />
                                    ¿Para cuántas personas es tu evento? Toca para ver tu precio:
                                </span>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                                {[30, 50, 80, 100, 150].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => scrollToStudio(num)}
                                        className="group relative py-3.5 px-3 rounded-2xl bg-white/[0.06] hover:bg-primary border border-white/15 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm active:scale-95"
                                    >
                                        <span className="text-base sm:text-lg font-black text-white group-hover:text-slate-950 leading-none">
                                            {num}
                                        </span>
                                        <span className="text-[0.68rem] font-bold text-zinc-400 group-hover:text-slate-900 mt-1">
                                            invitados →
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha: Showcase Multimedia Interactivo (Video Loop + Instagram Reel Oficial) */}
                    <div className="lg:col-span-5 flex flex-col items-center" id="hero-media-showcase">
                        <div className="w-full max-w-[380px] rounded-[2rem] bg-zinc-900 border border-white/15 p-3 shadow-[0_25px_70px_rgba(0,0,0,0.75)] relative">
                            {/* Selector superior de modo de video */}
                            <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1.5 rounded-2xl mb-3 border border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setHeroMediaTab('video')}
                                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        heroMediaTab === 'video'
                                            ? 'bg-primary text-slate-950 shadow-sm'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Vista en Acción</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHeroMediaTab('reel')}
                                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        heroMediaTab === 'reel'
                                            ? 'bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-sm'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <Instagram className="w-3.5 h-3.5" />
                                    <span>Reel Explicativo</span>
                                </button>
                            </div>

                            {/* Contenedor 9:16 */}
                            <div className="relative aspect-[9/15] w-full rounded-2xl overflow-hidden bg-zinc-950">
                                {heroMediaTab === 'video' ? (
                                    <>
                                        <video
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            poster="/assets/hero-bg.webp"
                                            className="w-full h-full object-cover"
                                        >
                                            <source src="/assets/hero-bg.webm" type="video/webm" />
                                        </video>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

                                        {/* Badge flotante superior */}
                                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                                            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[0.7rem] font-extrabold text-amber-300">
                                                🍸 1 Litro = 5 Cócteles de 200ml
                                            </span>
                                        </div>

                                        {/* Botón central para cambiar al Reel con audio */}
                                        <div className="absolute bottom-4 inset-x-4 flex flex-col gap-2.5">
                                            <div className="bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 text-left">
                                                <p className="text-xs font-extrabold text-white leading-snug mb-1">
                                                    ¿Quieres ver cómo se instala y cómo funciona paso a paso?
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setHeroMediaTab('reel')}
                                                    className="mt-1.5 w-full py-2 px-3 rounded-xl bg-white text-slate-950 font-black text-xs flex items-center justify-center gap-2 hover:bg-amber-300 transition-colors cursor-pointer"
                                                >
                                                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                                                    <span>Reproducir Reel Explicativo con Audio</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-white flex flex-col">
                                        <iframe
                                            src="https://www.instagram.com/p/DY-WKXHgBXz/embed/"
                                            className="w-full h-full border-0"
                                            title="Reel Cocktails on Tap - Cómo Funciona"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-2.5 flex items-center justify-between px-1 text-[0.72rem] text-zinc-400">
                                <span>@cocktailsontap.chile</span>
                                <a
                                    href="https://www.instagram.com/p/DY-WKXHgBXz/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                                >
                                    <span>Abrir en Instagram</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                2. EDITORIAL BENTO GRID: Los 4 Pasos Reales + Todo Incluido + Formatos
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0D1017] border-y border-white/[0.07] [content-visibility:auto] [contain-intrinsic-size:auto_900px]">
                <div className="max-w-6xl mx-auto">
                    {/* Cabecera Editorial */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                        <div>
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em] block mb-2">
                                Experiencia Autoservicio Llave en Mano
                            </span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                                Tú disfrutas tu fiesta.{' '}
                                <span className="text-zinc-400">Nosotros hacemos el resto.</span>
                            </h2>
                        </div>
                        <p className="text-zinc-400 text-sm sm:text-base max-w-md">
                            Sin comprar bolsas de hielo a última hora, sin lavar vasos prestados y sin depender del ritmo de un barman.
                        </p>
                    </div>

                    {/* Tirilla Visual: Los 4 Pasos con Fotos Reales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {STEP_PHOTOS.map((item) => (
                            <div
                                key={item.step}
                                className="group relative rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 flex flex-col justify-end min-h-[290px] p-5"
                            >
                                <Image
                                    src={item.img}
                                    alt={item.title}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                    className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

                                <div className="relative z-10">
                                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-primary text-slate-950 font-black text-xs mb-2">
                                        PASO {item.step}
                                    </span>
                                    <h3 className="text-lg font-black text-white mb-1">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-zinc-300 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bento Asimétrico: Comparativa de Formatos + Perks a $0 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Formato 1: Dispensador Portátil */}
                        <div className="lg:col-span-4 rounded-3xl bg-zinc-900/90 border border-white/10 overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="relative h-52 w-full">
                                    <Image
                                        src="/assets/dispensador3.webp"
                                        alt="Dispensador Portátil Cocktails on Tap"
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 33vw"
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/30" />
                                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-md">
                                        Instalación $0 (Gratis)
                                    </span>
                                </div>

                                <div className="p-6">
                                    <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-zinc-400">
                                        Eventos de 15 a 70 personas
                                    </span>
                                    <h3 className="text-2xl font-black text-white mt-0.5 mb-2">
                                        Dispensador Portátil
                                    </h3>
                                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                                        2 salidas simultáneas y enfriamiento continuo con hielo. No usa electricidad: cabe en cualquier mesa, quincho o terraza.
                                    </p>
                                    <div className="space-y-2 text-xs text-zinc-200 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <span>Barriles de 5L (25 copas) y 10L (50 copas)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <span>Pedido mínimo desde 10 Litros</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 pb-6">
                                <button
                                    type="button"
                                    onClick={() => scrollToStudio(40, 'portatil')}
                                    className="w-full py-3 rounded-2xl bg-white/10 hover:bg-primary hover:text-slate-950 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Cotizar Formato Portátil →
                                </button>
                            </div>
                        </div>

                        {/* Formato 2: Muro de Coctelería */}
                        <div className="lg:col-span-4 rounded-3xl bg-zinc-900/90 border border-primary/40 overflow-hidden flex flex-col justify-between shadow-[0_0_40px_rgba(226,160,73,0.1)]">
                            <div>
                                <div className="relative h-52 w-full">
                                    <Image
                                        src="/assets/dispensador2.webp"
                                        alt="Muro de Coctelería Cocktails on Tap"
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 33vw"
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/30" />
                                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-primary text-slate-950 font-black text-xs shadow-md">
                                        Favorito en Matrimonios & Empresas
                                    </span>
                                </div>

                                <div className="p-6">
                                    <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-primary">
                                        Eventos de 60 a 300+ personas
                                    </span>
                                    <h3 className="text-2xl font-black text-white mt-0.5 mb-2">
                                        Muro de Coctelería LED
                                    </h3>
                                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                                        Estructura escénica tipo barra con iluminación LED y múltiples canillas de alto flujo. El centro de atención fotográfico de la fiesta.
                                    </p>
                                    <div className="space-y-2 text-xs text-zinc-200 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                            <span>Barriles de 20L (100 copas) y 30L (150 copas)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                            <span>Pedido mínimo {MURO_MIN_LITERS}L · Montaje {formatCurrency(MURO_INSTALLATION_COST)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 pb-6">
                                <button
                                    type="button"
                                    onClick={() => scrollToStudio(80, 'muro')}
                                    className="w-full py-3 rounded-2xl bg-primary hover:bg-primary-dark text-slate-950 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Cotizar Muro de Coctelería →
                                </button>
                            </div>
                        </div>

                        {/* Tarjeta 3: Desglose de Equipamiento Incluido a $0 */}
                        <div className="lg:col-span-4 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 p-6 flex flex-col justify-between">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-black mb-4">
                                    <Award className="w-3.5 h-3.5" />
                                    <span>Incluido en todas las reservas</span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white mb-4">
                                    Todo lo que viene gratis con tus barriles:
                                </h3>

                                <div className="space-y-3.5">
                                    {ZERO_COST_PERKS.map((perk, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-start gap-3"
                                        >
                                            <div className="p-2 rounded-xl bg-primary/15 text-primary shrink-0 mt-0.5">
                                                <perk.icon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="font-bold text-white text-xs sm:text-sm">
                                                        {perk.title}
                                                    </h4>
                                                    <span className="text-[0.65rem] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">
                                                        $0
                                                    </span>
                                                </div>
                                                <p className="text-[0.72rem] text-zinc-400 mt-0.5 leading-snug">
                                                    {perk.desc}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                                <span>¿Solo pagas por el líquido?</span>
                                <span className="font-black text-white">Sí, 100% transparente.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                3. CARTA DE AUTOR: Vitrina Visual de los Top Sellers
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="py-14 sm:py-20 px-4 sm:px-6 bg-[#090B10] [content-visibility:auto] [contain-intrinsic-size:auto_420px]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
                        <div>
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em] block mb-1.5">
                                +25 Variedades en Catálogo
                            </span>
                            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                                Los sabores más pedidos en eventos
                            </h2>
                        </div>
                        <span className="text-xs sm:text-sm text-zinc-400">
                            Elaborados con fruta natural y destilados originales.
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        {topSellers.map((c) => (
                            <div
                                key={c.id}
                                className="group bg-zinc-900/80 hover:bg-zinc-900 border border-white/10 hover:border-primary/50 rounded-2xl p-3 flex flex-col items-center text-center transition-all"
                            >
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2.5 rounded-xl overflow-hidden bg-zinc-950/60">
                                    <Image
                                        src={c.image || '/assets/logo.webp'}
                                        alt={c.name}
                                        fill
                                        sizes="80px"
                                        className="object-contain p-1 group-hover:scale-110 transition-transform"
                                    />
                                </div>
                                <h3 className="text-xs font-extrabold text-white leading-tight line-clamp-2 mb-1">
                                    {c.name}
                                </h3>
                                <span className="text-[0.65rem] font-bold text-primary mt-auto">
                                    {c.category}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                4. BAR STUDIO: Calculadora Interactiva + Ticket de Cotización Dual
               ═══════════════════════════════════════════════════════════════════ */}
            <section
                id="bar-studio"
                className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-[#0D1017] to-[#090B10] border-t border-white/10 scroll-mt-16"
            >
                <div className="max-w-6xl mx-auto">
                    {/* Título del Configurador */}
                    <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black uppercase tracking-wider mb-3">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Cotizador Interactivo en Vivo</span>
                        </span>
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
                            Configura tu Barra en 30 Segundos
                        </h2>
                        <p className="text-zinc-400 text-sm sm:text-base">
                            Ajusta tus invitados y recibe tu cotización oficial al instante por{' '}
                            <strong className="text-white">WhatsApp</strong> o en tu{' '}
                            <strong className="text-white">Email</strong>.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* ─── COLUMNA IZQUIERDA (7 cols): Configurador de Evento y Sabores ─── */}
                        <div className="lg:col-span-7 bg-zinc-900/95 border border-white/10 rounded-[2rem] p-5 sm:p-8 shadow-2xl space-y-8">
                            {/* PASO 1: Invitados */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center">
                                            1
                                        </span>
                                        <span>Cantidad de Invitados</span>
                                    </label>
                                    <span className="text-sm sm:text-base font-black text-primary">
                                        {guests} personas
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {[30, 50, 80, 100, 150].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleGuestSelect(num)}
                                            className={`py-3 rounded-xl font-black text-sm transition-all cursor-pointer border ${
                                                !isCustomGuests && guests === num
                                                    ? 'bg-primary text-slate-950 border-primary shadow-[0_0_20px_rgba(226,160,73,0.35)]'
                                                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-200 border-white/10'
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomGuests(true);
                                            if (!customGuests) setCustomGuests(String(guests));
                                        }}
                                        className={`py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer border ${
                                            isCustomGuests
                                                ? 'bg-primary text-slate-950 border-primary'
                                                : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-200 border-white/10'
                                        }`}
                                    >
                                        Otro
                                    </button>
                                </div>

                                {isCustomGuests && (
                                    <div className="mt-3 flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-primary/40">
                                        <span className="text-xs font-bold text-zinc-300">
                                            Número exacto de invitados:
                                        </span>
                                        <input
                                            type="number"
                                            min="10"
                                            max="1000"
                                            value={customGuests}
                                            onChange={handleCustomGuestChange}
                                            className="w-24 py-1.5 px-3 rounded-lg bg-zinc-900 border border-primary text-white font-black text-sm text-center focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* PASO 2: Intensidad de Consumo */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center">
                                            2
                                        </span>
                                        <span>Cócteles por Persona</span>
                                    </label>
                                    <span className="text-xs font-bold text-zinc-400">
                                        Total sugerido: ~{proposal.totalDrinks} cócteles
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {[
                                        {
                                            drinks: 2,
                                            title: '2 Tragos p/p',
                                            sub: 'Barra complemento (recepción)',
                                        },
                                        {
                                            drinks: 3,
                                            title: '3 Tragos p/p ⭐',
                                            sub: 'El más elegido para fiestas',
                                        },
                                        {
                                            drinks: 4,
                                            title: '4 Tragos p/p',
                                            sub: 'Barra principal toda la noche',
                                        },
                                    ].map((opt) => (
                                        <button
                                            key={opt.drinks}
                                            type="button"
                                            onClick={() => {
                                                setDrinksPerPerson(opt.drinks);
                                                setManualSelections([]);
                                            }}
                                            className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                                                drinksPerPerson === opt.drinks
                                                    ? 'bg-primary/15 border-primary text-white shadow-sm'
                                                    : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10 text-zinc-300'
                                            }`}
                                        >
                                            <div className="font-black text-sm text-white mb-0.5">
                                                {opt.title}
                                            </div>
                                            <div className="text-[0.72rem] text-zinc-400 leading-tight">
                                                {opt.sub}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* PASO 3: Formato de Dispensador */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center">
                                            3
                                        </span>
                                        <span>Estación de Servicio</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDispenserSelect('portatil')}
                                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                                            activeDispenser === 'portatil'
                                                ? 'bg-primary/15 border-primary'
                                                : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10'
                                        }`}
                                    >
                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                            <Image
                                                src="/assets/dispensador3.webp"
                                                alt="Portátil"
                                                fill
                                                sizes="56px"
                                                className="object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-black text-sm text-white">
                                                    Portátil
                                                </span>
                                                <span className="text-[0.68rem] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                                    Instalación $0
                                                </span>
                                            </div>
                                            <p className="text-[0.72rem] text-zinc-400 mt-0.5 leading-snug">
                                                Barriles de 5L y 10L · Sin electricidad
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDispenserSelect('muro')}
                                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                                            activeDispenser === 'muro'
                                                ? 'bg-primary/15 border-primary'
                                                : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10'
                                        }`}
                                    >
                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                            <Image
                                                src="/assets/dispensador2.webp"
                                                alt="Muro LED"
                                                fill
                                                sizes="56px"
                                                className="object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-black text-sm text-white">
                                                    Muro LED
                                                </span>
                                                <span className="text-[0.68rem] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                                    +{formatCurrency(MURO_INSTALLATION_COST)}
                                                </span>
                                            </div>
                                            <p className="text-[0.72rem] text-zinc-400 mt-0.5 leading-snug">
                                                Barriles 20L y 30L (Mín. {MURO_MIN_LITERS}L)
                                            </p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* PASO 4: Selección de Sabores (Pre-armada con Top Sellers + Personalizable) */}
                            <div className="bg-zinc-950 rounded-2xl p-4 sm:p-5 border border-white/10">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-primary block">
                                            Sabores incluidos ({summaryData.totalLiters}L ={' '}
                                            {summaryData.totalCocktails} cócteles)
                                        </span>
                                        <p className="text-[0.72rem] text-zinc-400">
                                            Pre-seleccionamos nuestros Top Sellers. Puedes cambiarlos ahora o decidirlos después.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowCocktailDrawer(!showCocktailDrawer)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold text-amber-300 transition-colors cursor-pointer self-start sm:self-center shrink-0"
                                    >
                                        <span>
                                            {showCocktailDrawer
                                                ? 'Listo'
                                                : 'Personalizar sabores'}
                                        </span>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 transition-transform ${
                                                showCocktailDrawer ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Chips de los barriles actuales */}
                                <div className="flex flex-wrap gap-2">
                                    {currentSelections.map((sel, i) => {
                                        const prod = cocktails.find((c) => c.id === sel.id);
                                        return (
                                            <div
                                                key={`${sel.id}-${sel.size}-${i}`}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs"
                                            >
                                                <span className="font-black text-primary">
                                                    {sel.quantity}x {sel.size}
                                                </span>
                                                <span className="font-semibold text-white">
                                                    {prod?.name || 'Cóctel'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Drawer de personalización de sabores */}
                                {showCocktailDrawer && (
                                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                        {baseCocktails.map((c) => {
                                            const compatibleSizes = Object.entries(
                                                c.prices || {}
                                            ).filter(
                                                ([sizeLabel, p]) =>
                                                    isEventBarrelSizeLabelCompatible(
                                                        sizeLabel,
                                                        activeDispenser
                                                    ) && !p.isDisposable
                                            );
                                            if (compatibleSizes.length === 0) return null;

                                            return (
                                                <div
                                                    key={c.id}
                                                    className="bg-zinc-900/90 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                                                >
                                                    <span className="font-bold text-white truncate">
                                                        {c.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {compatibleSizes.map(([sizeLabel]) => {
                                                            const qty =
                                                                currentSelections.find(
                                                                    (s) =>
                                                                        s.id === c.id &&
                                                                        s.size === sizeLabel
                                                                )?.quantity || 0;
                                                            return (
                                                                <div
                                                                    key={sizeLabel}
                                                                    className="flex items-center gap-1 bg-zinc-950 px-1.5 py-1 rounded-lg border border-white/10"
                                                                >
                                                                    <span className="text-[0.65rem] text-zinc-400 font-bold">
                                                                        {sizeLabel}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleQuantityChange(
                                                                                c.id,
                                                                                sizeLabel,
                                                                                -1
                                                                            )
                                                                        }
                                                                        className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </button>
                                                                    <span className="w-4 text-center font-black text-primary">
                                                                        {qty}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleQuantityChange(
                                                                                c.id,
                                                                                sizeLabel,
                                                                                1
                                                                            )
                                                                        }
                                                                        className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                                                                    >
                                                                        <Plus className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── COLUMNA DERECHA (5 cols): Ticket de Propuesta + Doble CTA ─── */}
                        <div
                            id="studio-checkout-card"
                            className="lg:col-span-5 lg:sticky lg:top-20 bg-white text-slate-900 rounded-[2rem] p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.5)] border-2 border-primary/40"
                        >
                            {/* Cabecera del Ticket: Resumen Financiero en Vivo */}
                            <div className="bg-slate-950 text-white rounded-2xl p-5 mb-6 relative overflow-hidden">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="text-[0.68rem] font-black uppercase tracking-wider text-amber-400 block">
                                            Propuesta Todo Incluido
                                        </span>
                                        <div className="text-3xl font-black text-white mt-0.5">
                                            {formatCurrency(summaryData.totalPrice)}
                                        </div>
                                        <span className="text-xs text-zinc-300 font-medium">
                                            Aprox.{' '}
                                            <strong className="text-amber-300 font-black">
                                                {formatCurrency(pricePerCocktail)}
                                            </strong>{' '}
                                            por cóctel servido
                                        </span>
                                    </div>

                                    <div className="text-right bg-white/10 px-3 py-2 rounded-xl border border-white/10">
                                        <div className="text-lg font-black text-white leading-none">
                                            {summaryData.totalCocktails}
                                        </div>
                                        <div className="text-[0.65rem] font-bold text-zinc-300 uppercase mt-0.5">
                                            Cócteles ({summaryData.totalLiters}L)
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-zinc-300">
                                    <span>✓ Hielo + Copas + Garnish: $0</span>
                                    <span>
                                        {comuna
                                            ? `✓ Despacho ${comuna}: ${
                                                  summaryData.shippingCost === 0
                                                      ? '¡Gratis!'
                                                      : formatCurrency(summaryData.shippingCost)
                                              }`
                                            : 'Selecciona comuna abajo'}
                                    </span>
                                </div>
                            </div>

                            {saveError && (
                                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                                    <span>{saveError}</span>
                                </div>
                            )}

                            {errors.liters && (
                                <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span>{errors.liters}</span>
                                </div>
                            )}

                            {/* Inputs Compactos del Cliente */}
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">
                                            Nombre *
                                        </label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => {
                                                setFirstName(e.target.value);
                                                clearFieldError('firstName');
                                            }}
                                            placeholder="Ej: Camila"
                                            className={`w-full p-2.5 rounded-xl border text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                                errors.firstName
                                                    ? 'border-red-400 bg-red-50/40'
                                                    : 'border-slate-200'
                                            }`}
                                        />
                                        {errors.firstName && (
                                            <span className="text-[0.68rem] text-red-600 font-bold mt-0.5 block">
                                                {errors.firstName}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">
                                            Apellido *
                                        </label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => {
                                                setLastName(e.target.value);
                                                clearFieldError('lastName');
                                            }}
                                            placeholder="Ej: Rojas"
                                            className={`w-full p-2.5 rounded-xl border text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                                errors.lastName
                                                    ? 'border-red-400 bg-red-50/40'
                                                    : 'border-slate-200'
                                            }`}
                                        />
                                        {errors.lastName && (
                                            <span className="text-[0.68rem] text-red-600 font-bold mt-0.5 block">
                                                {errors.lastName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* WhatsApp */}
                                <div>
                                    <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">
                                        WhatsApp *
                                    </label>
                                    <PhoneInput
                                        value={phone}
                                        onChange={(val) => {
                                            setPhone(val);
                                            clearFieldError('phone');
                                        }}
                                        className={`w-full p-2.5 rounded-xl border text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                            errors.phone
                                                ? 'border-red-400 bg-red-50/40'
                                                : 'border-slate-200'
                                        }`}
                                    />
                                    {errors.phone && (
                                        <span className="text-[0.68rem] text-red-600 font-bold mt-0.5 block">
                                            {errors.phone}
                                        </span>
                                    )}
                                </div>

                                {/* Región y Comuna */}
                                <div>
                                    <RegionComunaFields
                                        regions={regions}
                                        comunas={comunas}
                                        regionCode={region}
                                        comuna={comuna}
                                        otherComuna={otherComuna}
                                        onRegionChange={(reg) => setRegion(reg)}
                                        onComunaChange={(com) => {
                                            setComuna(com);
                                            clearFieldError('comuna');
                                        }}
                                        onOtherComunaChange={(other) => {
                                            setOtherComuna(other);
                                            clearFieldError('comuna');
                                        }}
                                        serviceType="event"
                                        comunaError={errors.comuna}
                                    />
                                </div>

                                {/* Fecha y Tipo de Evento */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">
                                            Fecha del Evento *
                                        </label>
                                        <ShippingDatePicker
                                            value={eventDate}
                                            onChange={(date) => {
                                                setEventDate(date);
                                                clearFieldError('date');
                                            }}
                                            methodConfig={eventMethodConfig}
                                            fallbackOffsetDays={5}
                                            placeholder="Elegir fecha"
                                        />
                                        {errors.date && (
                                            <span className="text-[0.68rem] text-red-600 font-bold mt-0.5 block">
                                                {errors.date}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">
                                            Celebración
                                        </label>
                                        <select
                                            value={eventType}
                                            onChange={(e) => setEventType(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:border-primary focus:outline-none"
                                        >
                                            {eventTypes
                                                .filter((t) => t.name.toLowerCase() !== 'otro')
                                                .map((t) => (
                                                    <option key={t.id} value={t.name}>
                                                        {t.name}
                                                    </option>
                                                ))}
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="flex items-center justify-between text-[0.75rem] font-bold text-slate-700 mb-1">
                                        <span>Tu Email</span>
                                        <span className="text-[0.65rem] font-normal text-slate-500">
                                            Requerido si eliges recibir por correo
                                        </span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            clearFieldError('email');
                                        }}
                                        placeholder="tu@correo.cl"
                                        className={`w-full p-2.5 rounded-xl border text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                            errors.email
                                                ? 'border-red-400 bg-red-50/40'
                                                : 'border-slate-200'
                                        }`}
                                    />
                                    {errors.email && (
                                        <span className="text-[0.68rem] text-red-600 font-bold mt-0.5 block">
                                            {errors.email}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* DOBLE CTA EXPERIMENTAL: WhatsApp vs. Email */}
                            <div className="mt-6 space-y-2.5">
                                <button
                                    type="button"
                                    disabled={sendStatus === 'saving'}
                                    onClick={() => handleSubmit('whatsapp')}
                                    className="w-full py-4 px-5 rounded-2xl bg-[#25D366] hover:bg-[#1da851] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_8px_25px_rgba(37,211,102,0.35)] transition-all cursor-pointer active:scale-98 disabled:opacity-60"
                                >
                                    {sendStatus === 'saving' && activeCta === 'whatsapp' ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Generando tu link de cotización...</span>
                                        </>
                                    ) : (
                                        <>
                                            <WhatsappIcon className="w-5 h-5 text-white shrink-0" />
                                            <span>Recibir propuesta y continuar en WhatsApp</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    disabled={sendStatus === 'saving'}
                                    onClick={() => handleSubmit('email')}
                                    className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
                                >
                                    {sendStatus === 'saving' && activeCta === 'email' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Enviando a tu correo...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4 text-primary shrink-0" />
                                            <span>Enviar a mi Email y ver Reserva Online</span>
                                            <ArrowRight className="w-4 h-4 text-primary" />
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="mt-4 flex items-center justify-center gap-2 text-[0.7rem] text-slate-500 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                    Recibes tu link único al instante · Sin pago por adelantado
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                5. PRUEBA SOCIAL VERIFICADA: Reseñas Reales en Google Maps
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="py-16 sm:py-24 px-4 sm:px-6 bg-[#090B10] border-t border-white/[0.07] [content-visibility:auto] [contain-intrinsic-size:auto_550px]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-black mb-3">
                                <span className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                    ))}
                                </span>
                                <span>5.0 Calificación en Google Maps</span>
                            </div>
                            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                                Clientes reales. Eventos sin estrés.
                            </h2>
                        </div>

                        <a
                            href="https://maps.app.goo.gl/AYMHTHg8eWSMTa888"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-bold text-white transition-colors self-start sm:self-auto"
                        >
                            <span>Verificar todas las reseñas en Google Maps</span>
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {GOOGLE_REVIEWS.map((rev, i) => (
                            <div
                                key={i}
                                className="bg-zinc-900/90 border border-white/10 rounded-3xl p-5 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-3.5">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                                            {rev.initials}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-extrabold text-white truncate">
                                                {rev.name}
                                            </h3>
                                            <span className="text-[0.7rem] text-primary font-bold block truncate">
                                                {rev.context}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 text-amber-400 mb-2.5">
                                        {[...Array(5)].map((_, s) => (
                                            <Star key={s} className="w-3.5 h-3.5 fill-current" />
                                        ))}
                                    </div>

                                    <p className="text-xs text-zinc-300 leading-relaxed">
                                        &ldquo;{rev.comment}&rdquo;
                                    </p>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between text-[0.65rem] text-zinc-500 font-semibold">
                                    <span>✓ {rev.timeAgo}</span>
                                    <span>Verificada</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                6. FOOTER MINIMALISTA DE CAMPAÑA
               ═══════════════════════════════════════════════════════════════════ */}
            <footer className="bg-[#06070B] border-t border-white/10 py-10 pb-24 sm:pb-12 px-4 text-center">
                <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
                    <Image
                        src="/assets/logo.webp"
                        alt="Cocktails on Tap Chile"
                        width={120}
                        height={40}
                        className="h-8 w-auto opacity-80"
                    />
                    <p className="text-xs text-zinc-500">
                        Cocktails on Tap Chile · Bar Móvil Autoservicio para Matrimonios, Cumpleaños y Empresas.
                    </p>
                    <p className="text-[0.7rem] text-zinc-600">
                        © 2026 Cocktails on Tap Chile. Todos los derechos reservados.
                    </p>
                </div>
            </footer>

            {/* ═══════════════════════════════════════════════════════════════════
                STICKY BOTTOM BAR EN MÓVIL (Se oculta sola al llegar al Bar Studio)
               ═══════════════════════════════════════════════════════════════════ */}
            <div
                className={`fixed bottom-0 inset-x-0 z-40 sm:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-white/15 px-4 py-3 transition-transform duration-300 ${
                    inStudioView ? 'translate-y-full pointer-events-none' : 'translate-y-0'
                }`}
            >
                <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
                    <div>
                        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400 block">
                            Propuesta {guests} inv. ({summaryData.totalCocktails} copas)
                        </span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-black text-amber-400">
                                {formatCurrency(summaryData.totalPrice)}
                            </span>
                            <span className="text-[0.68rem] text-zinc-300">
                                (~{formatCurrency(pricePerCocktail)}/copa)
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => scrollToStudio()}
                        className="px-4 py-2.5 rounded-xl bg-primary text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer shrink-0"
                    >
                        <span>Personalizar</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
