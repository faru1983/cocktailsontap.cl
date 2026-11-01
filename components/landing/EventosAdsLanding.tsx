'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
} from '@/lib/config';
import { createQuote } from '@/app/actions/createQuote';
import { getClientMetaAttribution } from '@/lib/attribution';
import { trackOnce } from '@/lib/fpixel';
import { isValidPhoneE164, isChilePrefixOnly } from '@/lib/phone';
import { validateShippingDate } from '@/lib/shippingMethods';
import PhoneInput from '@/components/ui/PhoneInput';
import RegionComunaFields from '@/components/ui/RegionComunaFields';
import ShippingDatePicker from '@/components/ui/ShippingDatePicker';
import LandingReelPlayer from '@/components/landing/LandingReelPlayer';
import {
    Sparkles,
    Wine,
    Snowflake,
    Leaf,
    GlassWater,
    Infinity as InfinityIcon,
    Check,
    ArrowRight,
    Star,
    Loader2,
    AlertCircle,
    ShieldCheck,
    ExternalLink,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
    Play,
    CalendarCheck,
    Clock,
    Zap,
    Award,
    CheckCircle2,
    SlidersHorizontal,
    Mail,
    RotateCcw,
    Search,
    X,
} from 'lucide-react';
import { WhatsappIcon } from '@/components/shared/icons';
import { getProductEnrichedInfo } from '@/lib/productDetails';

interface Props {
    cocktails: CocktailForWizard[];
    comunas: Comuna[];
    regions: Region[];
    eventTypes: EventType[];
}

const STEP_PHOTOS = [
    {
        step: '01',
        title: 'Hielo a Tope',
        desc: 'Completa tu vaso o copa con mucho hielo. ¡Mientras más, mejor!',
        img: '/assets/pasos_1.webp',
    },
    {
        step: '02',
        title: 'Tira la Canilla',
        desc: 'Elige tu cóctel favorito y sirve hasta completar el vaso.',
        img: '/assets/pasos_2.webp',
    },
    {
        step: '03',
        title: 'Decora',
        desc: 'Dale el toque final con nuestro garnish deshidratado.',
        img: '/assets/pasos_3.webp',
    },
    {
        step: '04',
        title: 'Disfruta',
        desc: '¡Salud! Ya tienes un cóctel profesional en segundos.',
        img: '/assets/pasos_4.webp',
    },
];

const ZERO_COST_PERKS = [
    {
        icon: Snowflake,
        title: 'Hielo suficiente para todo el evento',
        valueTag: 'Valor ref. $45.000',
        desc: 'Calculado según los litros de tu evento para que nunca falte frío.',
    },
    {
        icon: GlassWater,
        title: 'Vasos y Copas',
        valueTag: 'Valor ref. $65.000',
        desc: 'Vasos y copas reutilizables de alta resistencia listos para servir (también puedes solicitar vasos desechables).',
    },
    {
        icon: Leaf,
        title: 'Decoración deshidratada (Garnish)',
        valueTag: 'Valor ref. $30.000',
        desc: 'Naranja y limón deshidratado más hieleras, pinzas y palas.',
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

const QUICK_FAQS = [
    {
        q: '¿Cuándo instalan la barra y cuándo retiran los equipos?',
        a: 'Coordinamos la entrega e instalación horas antes del inicio de tu celebración y retiramos al día siguiente. No cobramos por hora ni ponemos límite de tiempo a tu fiesta.',
    },
    {
        q: '¿Puedo modificar los sabores o litros después de cotizar?',
        a: 'Sí. Al enviar tu cotización recibirás un enlace único interactivo donde podrás ajustar variedades, cantidades o formato antes de confirmar tu fecha.',
    },
    {
        q: '¿Tienen cócteles sin alcohol o combinados como Piscola?',
        a: 'Sí. Además de nuestra carta de Cócteles Clásicos, puedes incluir Mocktails sin alcohol (Mojitos frutales, Sangría 0° y Spritz 0°) y Combinados con Pisco o Whisky de marca.',
    },
    {
        q: '¿Debo pagar algo ahora para recibir mi cotización?',
        a: 'Nada. Cotizar es 100% gratis y sin compromiso. Recibes tu presupuesto detallado al instante en tu WhatsApp o correo electrónico.',
    },
];

const SERVICE_TIMELINE = [
    {
        step: '01',
        badge: 'Horas antes de tu evento',
        title: 'Llegamos e instalamos la estación completa',
        desc: 'Coordinamos la entrega con anticipación en tu casa, parcela, quincho o centro de eventos. Dejamos listos los dispensadores con barriles de acero inoxidable fríos en su interior, hieleras con hielo, vasos o copas, garnish deshidratado, pinzas y bombillas.',
        icon: CalendarCheck,
    },
    {
        step: '02',
        badge: 'Durante toda tu celebración',
        title: 'Tus invitados se sirven solos en 5 segundos',
        desc: 'Cada persona elige su cóctel y tira la canilla a su ritmo: cero filas, sin depender de un barman y sin usar electricidad en formato portátil. La barra queda abierta toda la noche sin cobros extra por hora.',
        icon: Zap,
    },
    {
        step: '03',
        badge: 'Al día siguiente',
        title: 'Retiramos todo sin que tengas que lavar',
        desc: 'Cuando termina la fiesta solo te preocupas de descansar. Al día siguiente pasamos a retirar los dispensadores, barriles vacíos, accesorios y cristalería reutilizable en el horario acordado.',
        icon: Clock,
    },
];

export default function EventosAdsLanding({ cocktails, comunas, regions, eventTypes }: Props) {
    // Carrusel horizontal de Cócteles Clásicos
    const carouselRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Estado de la calculadora interactiva
    const [guests, setGuests] = useState<number>(60);
    const [customGuests, setCustomGuests] = useState<string>('');
    const [isCustomGuests, setIsCustomGuests] = useState<boolean>(false);
    const [drinksPerPerson, setDrinksPerPerson] = useState<number>(3);
    const [dispenser, setDispenser] = useState<'portatil' | 'muro'>('portatil');
    const [userOverrodeDispenser, setUserOverrodeDispenser] = useState(false);

    // Personalización de sabores (Modo Explorador 100% Texto)
    const [showCocktailDrawer, setShowCocktailDrawer] = useState(false);
    const [flavorFilter, setFlavorFilter] = useState<'all' | 'Cocktails' | 'Combinados' | 'Mocktails'>('all');
    const [flavorSearch, setFlavorSearch] = useState('');
    const [manualSelections, setManualSelections] = useState<WizardSelection[]>([]);

    // Formulario de contacto
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
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
    const [inCheckoutView, setInCheckoutView] = useState(false);

    const eventMethodConfig = comunas[0]?.shippingMethodsConfig?.own_events;

    const updateCarouselButtons = useCallback(() => {
        const el = carouselRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 8);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    }, []);

    useEffect(() => {
        updateCarouselButtons();
        window.addEventListener('resize', updateCarouselButtons, { passive: true });
        return () => window.removeEventListener('resize', updateCarouselButtons);
    }, [updateCarouselButtons]);

    const scrollCarousel = (dir: 'left' | 'right') => {
        const el = carouselRef.current;
        if (!el) return;
        const step = Math.max(250, Math.round(el.clientWidth * 0.78));
        el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
    };

    // Ocultar la barra flotante móvil únicamente cuando el ticket/formulario final está en pantalla
    useEffect(() => {
        const el = document.getElementById('studio-checkout-card');
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const obs = new IntersectionObserver(
            ([entry]) => setInCheckoutView(entry.isIntersecting),
            { threshold: 0.12 }
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

    // Categoría Cócteles Clásicos completa para el carrusel visual
    const classicCocktails = useMemo(() => {
        const classics = baseCocktails.filter(
            (c) => c.category.trim().toLowerCase() === 'cocktails'
        );
        return classics.length > 0 ? classics : baseCocktails;
    }, [baseCocktails]);

    // Recomendaciones por defecto: Cócteles clásicos más económicos (Mojito tradicional, Sangría, Caipiriña, Mojito Sabores, Pisco Sour, etc.)
    const topSellers = useMemo(() => {
        // Filtrar exclusivamente de la categoría 'Cocktails' (cócteles clásicos)
        const classics = baseCocktails.filter(
            (c) => c.category.trim().toLowerCase() === 'cocktails'
        );

        // Prioridad comercial: los cócteles clásicos más económicos y masivos
        const priorityPatterns = [
            'mojito tradicional',
            'sangría',
            'sangria',
            'caipiriña',
            'caipirina',
            'mojito maracuyá',
            'mojito maracuya',
            'mojito frambuesa',
            'mojito mango',
            'pisco sour',
            'gin and tonic',
        ];

        const picked: CocktailForWizard[] = [];
        priorityPatterns.forEach((kw) => {
            const match = classics.find((c) => c.name.toLowerCase().includes(kw));
            if (match && !picked.some((p) => p.id === match.id)) {
                picked.push(match);
            }
        });

        // Completar con los clásicos restantes ordenados por precio ascendente
        const remainingClassics = classics
            .filter((c) => !picked.some((p) => p.id === c.id))
            .sort((a, b) => {
                const priceA = a.prices['10L']?.price || a.prices['5L']?.price || 999999;
                const priceB = b.prices['10L']?.price || b.prices['5L']?.price || 999999;
                return priceA - priceB;
            });

        return [...picked, ...remainingClassics];
    }, [baseCocktails]);

    // Conteo por categoría para los filtros del explorador de texto
    const categoryCounts = useMemo(() => {
        return {
            all: baseCocktails.length,
            Cocktails: baseCocktails.filter((c) => c.category.trim().toLowerCase() === 'cocktails').length,
            Combinados: baseCocktails.filter((c) => c.category.trim().toLowerCase() === 'combinados').length,
            Mocktails: baseCocktails.filter((c) => c.category.trim().toLowerCase() === 'mocktails').length,
        };
    }, [baseCocktails]);

    // Filtrado en vivo de cócteles por categoría y término de búsqueda (100% texto)
    const filteredCocktails = useMemo(() => {
        return baseCocktails.filter((c) => {
            if (flavorFilter !== 'all' && c.category.trim().toLowerCase() !== flavorFilter.toLowerCase()) {
                return false;
            }
            if (flavorSearch.trim()) {
                const q = flavorSearch.toLowerCase().trim();
                const info = getProductEnrichedInfo(c.name, c.category);
                const matchesName = c.name.toLowerCase().includes(q);
                const matchesCategory = c.category.toLowerCase().includes(q);
                const matchesIngredients = (info.ingredients || '').toLowerCase().includes(q);
                const matchesHeadline = info.headline.toLowerCase().includes(q);
                const matchesTags = info.tags.some((t) => t.toLowerCase().includes(q));
                return matchesName || matchesCategory || matchesIngredients || matchesHeadline || matchesTags;
            }
            return true;
        });
    }, [baseCocktails, flavorFilter, flavorSearch]);

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

    const scrollToHowItWorks = () => {
        const el = document.getElementById('como-funciona-video');
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

    const handleRemoveItem = (cocktailId: string, sizeLabel: string) => {
        const source = manualSelections.length > 0 ? manualSelections : autoSelections;
        setManualSelections(source.filter((s) => !(s.id === cocktailId && s.size === sizeLabel)));
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
                        otherComuna: '',
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
• Fecha: ${eventDate} en ${comuna}
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
                <div className="max-w-6xl mx-auto flex items-center justify-between bg-zinc-950/85 backdrop-blur-xl border border-white/10 rounded-full px-3.5 sm:px-6 py-2 sm:py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] pointer-events-auto">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Image
                            src="/assets/logo.webp"
                            alt="Cocktails on Tap Chile"
                            width={120}
                            height={40}
                            className="h-7 sm:h-9 w-auto object-contain shrink-0"
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

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={scrollToHowItWorks}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] sm:text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                        >
                            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary fill-primary shrink-0" />
                            <span className="hidden sm:inline">Cómo funciona</span>
                            <span className="sm:hidden">Cómo funciona</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => scrollToStudio()}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-full bg-gradient-to-r from-primary to-[#d98a2b] text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_25px_rgba(226,160,73,0.4)] hover:brightness-110 transition-transform active:scale-95 cursor-pointer"
                        >
                            <span>Calcular mi Barra</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════
                1. HERO NARRATIVO POST-CLIC:
                   Móvil: Texto Gancho → Video Evento Real → Ecuación de Valor + Invitados
                   Desktop: Split 7/5 con Propuesta Completa a la izquierda y Video a la derecha
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative pt-22 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 overflow-hidden">
                {/* Ambient Copper/Gold Radial Glows */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-40 left-1/4 w-[550px] h-[550px] rounded-full bg-primary/15 blur-[130px]"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/3 -right-32 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[120px]"
                />

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-y-7 lg:gap-y-6 lg:gap-x-12 items-center relative z-10">
                    {/* Bloque 1A: Gancho Principal + Narrativa Inicial */}
                    <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:self-end flex flex-col items-start text-left">
                        <a
                            href="https://maps.app.goo.gl/AYMHTHg8eWSMTa888"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[11px] sm:text-xs font-bold text-zinc-200 mb-4 sm:mb-5 transition-colors"
                        >
                            <span className="flex items-center text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                                ))}
                            </span>
                            <span>
                                5.0 en Google · +500 Eventos
                                <span className="hidden sm:inline"> · Barra Móvil Autoservicio</span>
                            </span>
                            <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                        </a>

                        <h1 className="text-[2rem] leading-[1.08] sm:text-4xl lg:text-[3.25rem] font-black tracking-tight lg:leading-[1.1] text-white mb-4 sm:mb-5">
                            <span className="block">
                                Los mejores cócteles,{' '}
                                <span className="bg-gradient-to-r from-amber-200 via-primary to-amber-400 bg-clip-text text-transparent">
                                    listos para servir.
                                </span>
                            </span>
                            <span className="block mt-1">
                                Tu evento,{' '}
                                <span className="bg-gradient-to-r from-amber-200 via-primary to-amber-400 bg-clip-text text-transparent">
                                    a otro nivel.
                                </span>
                            </span>
                        </h1>

                        <div className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-xl space-y-2.5">
                            <p>
                                Sorprende a tus invitados con una estación de coctelería autoservicio lista para disfrutar desde el primer minuto.
                            </p>
                            <p>
                                <strong className="text-white font-semibold">
                                    Mojito, Sangría, Pisco Sour, Aperol Spritz, Moscow Mule y más.
                                </strong>{' '}
                                Preparados con ingredientes naturales, licores de marca y recetas profesionales —{' '}
                                <strong className="text-white font-semibold">sin filas, sin esperas y sin límite de horario.</strong>
                            </p>
                        </div>
                    </div>

                    {/* Bloque 1B: Video 1 Nativo — Evento Real en Acción (aparece justo tras el titular en móvil; a la derecha en desktop) */}
                    <div
                        className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 flex flex-col items-center justify-center"
                        id="hero-media-showcase"
                    >
                        <LandingReelPlayer
                            id="hero-showcase"
                            src="/assets/video_lp_cot.mp4"
                            poster="/assets/video_lp_cot_poster.webp"
                            variant="showcase"
                            lazy={false}
                            badgeText="Evento Real · En Acción"
                            bottomCaption="Montaje real de día y de noche"
                            secondaryActionLabel="Cómo funciona (0:51)"
                            onSecondaryAction={scrollToHowItWorks}
                        />
                    </div>

                    {/* Bloque 1C: Ecuación de Valor ($0 en extras) + Selector Rápido de Invitados */}
                    <div className="lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:self-start w-full text-left">
                        <div className="w-full bg-zinc-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 mb-5 sm:mb-6 shadow-xl">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                    <span>Todo incluido, sin letra chica</span>
                                </span>
                                <span className="text-[11px] sm:text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    Ahorras +$140.000 en extras
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Hielo para todo el evento ($0)</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Vasos/Copas ($0)</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Decoración deshidratada ($0)</span>
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
                                <span className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 sm:gap-2">
                                    <Zap className="w-4 h-4 text-primary shrink-0" />
                                    <span>¿Para cuántas personas es tu evento? Toca para ver tu precio:</span>
                                </span>
                            </div>

                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                                {[30, 50, 80, 100, 150].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => scrollToStudio(num)}
                                        className="group relative py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-2xl bg-white/[0.06] hover:bg-primary border border-white/15 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm active:scale-95"
                                    >
                                        <span className="text-base sm:text-lg font-black text-white group-hover:text-slate-950 leading-none">
                                            {num}
                                        </span>
                                        <span className="text-[0.62rem] sm:text-[0.68rem] font-bold text-zinc-400 group-hover:text-slate-900 mt-1">
                                            <span className="sm:hidden">inv. →</span>
                                            <span className="hidden sm:inline">invitados →</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                2. CARTA DE COCTELERÍA CLÁSICA: Carrusel Visual de Fotos Oficiales + Ingredientes
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[#0D1017] border-y border-white/[0.07] [content-visibility:auto] [contain-intrinsic-size:auto_520px]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-4">
                        <div>
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em] block mb-1.5">
                                {classicCocktails.length} Cócteles Clásicos · +25 Variedades en Catálogo
                            </span>
                            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                                Nuestros cócteles clásicos
                            </h2>
                            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                                Preparados con fruta natural, licores de marca y recetas de coctelería profesional.
                            </p>
                        </div>

                        {/* Controles de navegación del carrusel en escritorio + pista táctil en móvil */}
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                            <span className="sm:hidden text-[11px] font-bold text-primary flex items-center gap-1">
                                <span>Desliza para ver todos los sabores</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </span>

                            <div className="hidden sm:flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => scrollCarousel('left')}
                                    disabled={!canScrollLeft}
                                    aria-label="Ver cócteles anteriores"
                                    className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-primary hover:text-slate-950 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollCarousel('right')}
                                    disabled={!canScrollRight}
                                    aria-label="Ver más cócteles"
                                    className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-primary hover:text-slate-950 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Carrusel Horizontal: Fotos cuadradas protagonistas (ya incluyen el nombre) + ingredientes */}
                    <div
                        ref={carouselRef}
                        onScroll={updateCarouselButtons}
                        className="flex gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-0 -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 scrollbar-none"
                    >
                        {classicCocktails.map((c) => (
                            <article
                                key={c.id}
                                className="group w-[226px] sm:w-[252px] lg:w-[266px] shrink-0 snap-start rounded-3xl bg-zinc-900/95 border border-white/10 hover:border-primary/50 overflow-hidden flex flex-col shadow-lg transition-colors"
                            >
                                <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
                                    <Image
                                        src={c.image || '/assets/logo.webp'}
                                        alt={c.name}
                                        fill
                                        sizes="(max-width: 640px) 230px, 270px"
                                        className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                    />
                                </div>

                                {c.desc && (
                                    <div className="px-3.5 py-3 border-t border-white/[0.08] flex-1 flex items-center">
                                        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                                            {c.desc}
                                        </p>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>

                    {/* Nota de catálogo completo + puente directo al cotizador */}
                    <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs sm:text-sm text-zinc-400">
                            También puedes sumar{' '}
                            <strong className="text-zinc-200 font-semibold">
                                Combinados (Piscola, Whiskcola)
                            </strong>{' '}
                            y{' '}
                            <strong className="text-zinc-200 font-semibold">
                                Mocktails Sin Alcohol
                            </strong>{' '}
                            al personalizar tu barra.
                        </p>

                        <button
                            type="button"
                            onClick={() => scrollToStudio()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-primary hover:text-slate-950 border border-white/15 hover:border-primary text-xs font-black text-white transition-all cursor-pointer self-start sm:self-auto shrink-0"
                        >
                            <span>Elegir mis sabores y cotizar</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                3. CÓMO FUNCIONA EL SERVICIO:
                   Narrativa Editorial + Video Explicativo Nativo (video_lp_como_funciona.mp4)
                   + Línea de Tiempo (Antes / Durante / Después) + 4 Pasos + Formatos
               ═══════════════════════════════════════════════════════════════════ */}
            <section
                id="como-funciona-video"
                className="py-14 sm:py-24 px-4 sm:px-6 bg-[#090B10] scroll-mt-20"
            >
                <div className="max-w-6xl mx-auto">
                    {/* Cabecera Editorial */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-3 sm:gap-4">
                        <div>
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em] block mb-2">
                                Cómo Funciona de Principio a Fin
                            </span>
                            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                                Tú disfrutas tu fiesta.{' '}
                                <span className="text-zinc-400">Nosotros hacemos el resto.</span>
                            </h2>
                        </div>
                        <p className="text-zinc-400 text-xs sm:text-base max-w-md">
                            Mira en 50 segundos cómo instalamos la estación completa antes de que lleguen tus invitados y cómo opera toda la noche sin que muevas un dedo.
                        </p>
                    </div>

                    {/* Split Editorial: Video Explicativo (Subtitulado + Audio en 1 clic) + 3 Etapas Operativas */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-14 sm:mb-20">
                        <div className="lg:col-span-5 flex flex-col items-center">
                            <LandingReelPlayer
                                id="service-explainer"
                                src="/assets/video_lp_como_funciona.mp4"
                                poster="/assets/video_lp_como_funciona_poster.webp"
                                variant="explainer"
                                lazy
                                badgeText="Explicación Paso a Paso"
                                durationHint="0:51"
                            />
                        </div>

                        <div className="lg:col-span-7 space-y-3.5 sm:space-y-4">
                            {SERVICE_TIMELINE.map((stage) => (
                                <div
                                    key={stage.step}
                                    className="rounded-3xl bg-zinc-900/90 border border-white/10 p-4 sm:p-6 flex items-start gap-3.5 sm:gap-4"
                                >
                                    <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                        <stage.icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary text-slate-950">
                                                ETAPA {stage.step}
                                            </span>
                                            <span className="text-xs font-extrabold text-amber-300">
                                                {stage.badge}
                                            </span>
                                        </div>
                                        <h3 className="text-base sm:text-lg font-black text-white mb-1 leading-snug">
                                            {stage.title}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                                            {stage.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* Puente de Conversión: Regla de Rendimiento + Salto al Cotizador */}
                            <div className="rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/35 border border-primary/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-amber-400/15 text-amber-300 shrink-0">
                                        <Wine className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-xs sm:text-sm font-black text-white block">
                                            1 Litro = 5 Cócteles reales de 200 ml
                                        </span>
                                        <span className="text-[0.72rem] sm:text-xs text-zinc-300">
                                            Calculamos por ti los litros exactos según tus invitados.
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => scrollToStudio()}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors cursor-pointer shrink-0"
                                >
                                    <span>Ver mi propuesta</span>
                                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sub-bloque Diferido: 4 Pasos Visuales en Barra (sin controles interactivos dentro de content-visibility) */}
                    <div className="[content-visibility:auto] [contain-intrinsic-size:auto_360px]">
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                                Así se sirve cada invitado en la barra:
                            </h3>
                            <span className="text-[11px] sm:text-xs font-bold text-primary">
                                Listo en 5 segundos
                            </span>
                        </div>

                        {/* Tirilla Visual: Los 4 Pasos con Fotos Reales (Grilla 2x2 compacta en móvil) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-12">
                            {STEP_PHOTOS.map((item) => (
                                <div
                                    key={item.step}
                                    className="group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 flex flex-col justify-end min-h-[195px] sm:min-h-[280px] p-3.5 sm:p-5"
                                >
                                    <Image
                                        src={item.img}
                                        alt={item.title}
                                        fill
                                        sizes="(max-width: 1024px) 50vw, 25vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

                                    <div className="relative z-10">
                                        <span className="inline-block px-2 sm:px-2.5 py-0.5 rounded-md bg-primary text-slate-950 font-black text-[10px] sm:text-xs mb-1.5 sm:mb-2">
                                            PASO {item.step}
                                        </span>
                                        <h3 className="text-sm sm:text-lg font-black text-white mb-0.5 sm:mb-1 leading-tight">
                                            {item.title}
                                        </h3>
                                        <p className="text-[11px] sm:text-xs text-zinc-300 leading-snug sm:leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bento Asimétrico: Comparativa de Formatos + Perks a $0 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                        {/* Formato 1: Dispensador Portátil */}
                        <div className="lg:col-span-4 rounded-3xl bg-zinc-900/90 border border-white/10 overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="relative h-48 sm:h-52 w-full">
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

                                <div className="p-5 sm:p-6">
                                    <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-zinc-400">
                                        Eventos Pequeños y Medianos
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5 mb-2">
                                        Dispensador Portátil
                                    </h3>
                                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                                        2 salidas simultáneas. No usa electricidad: cabe en cualquier mesa, quincho o terraza.
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

                            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
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
                                <div className="relative h-48 sm:h-52 w-full">
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

                                <div className="p-5 sm:p-6">
                                    <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-primary">
                                        Eventos Grandes y Masivos
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5 mb-2">
                                        Muro de Coctelería
                                    </h3>
                                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                                        <strong className="text-white font-bold block mb-1">
                                            El espectáculo que también sirve cócteles.
                                        </strong>
                                        Estructura escénica con iluminación LED y múltiples grifos de alto flujo para servir cócteles en segundos y convertirse en el centro de atención de tu evento.
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

                            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
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
                        <div className="lg:col-span-4 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 p-5 sm:p-6 flex flex-col justify-between">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-black mb-4">
                                    <Award className="w-3.5 h-3.5" />
                                    <span>Incluido en todas las reservas</span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white mb-4">
                                    Todo lo que viene gratis con tus barriles:
                                </h3>

                                <div className="space-y-3">
                                    {ZERO_COST_PERKS.map((perk, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-start gap-3"
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
                4. BAR STUDIO: Calculadora Interactiva + Ticket de Cotización Dual
               ═══════════════════════════════════════════════════════════════════ */}
            <section
                id="bar-studio"
                className="py-14 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-[#0D1017] to-[#090B10] border-t border-white/10 scroll-mt-16"
            >
                <div className="max-w-7xl mx-auto">
                    {/* Título del Configurador */}
                    <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-14">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black uppercase tracking-wider mb-3">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Cotizador Interactivo en Vivo</span>
                        </span>
                        <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight mb-2.5 sm:mb-3">
                            Configura tu Barra en 30 Segundos
                        </h2>
                        <p className="text-zinc-400 text-xs sm:text-base">
                            Ajusta tus invitados, personaliza tus sabores favoritos y recibe tu cotización oficial al instante por{' '}
                            <strong className="text-white">WhatsApp</strong> o en tu{' '}
                            <strong className="text-white">Email</strong>.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
                        {/* ─── COLUMNA IZQUIERDA (7 cols): Configurador de Evento y Sabores (100% Texto, Amplio y Práctico) ─── */}
                        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                            {/* Resumen en Vivo para Móvil/Tablet (evita perder de vista el precio mientras se configura) */}
                            <div className="lg:hidden rounded-2xl bg-zinc-950 border border-primary/40 p-3.5 flex items-center justify-between gap-3 shadow-lg">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                                        Estimado Todo Incluido ({summaryData.totalCocktails} copas)
                                    </span>
                                    <div className="flex items-baseline gap-1.5 mt-0.5">
                                        <span className="text-xl font-black text-white">
                                            {formatCurrency(summaryData.totalPrice)}
                                        </span>
                                        <span className="text-[11px] font-bold text-zinc-400">
                                            (~{formatCurrency(pricePerCocktail)}/copa)
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const el = document.getElementById('studio-checkout-card');
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-primary text-slate-950 font-black text-xs cursor-pointer shrink-0 active:scale-95 transition-transform"
                                >
                                    Ver Ticket ↓
                                </button>
                            </div>

                            {/* PASO 1: Invitados y Ritmo de Consumo */}
                            <div className="bg-zinc-900/95 border border-white/10 rounded-[1.75rem] p-5 sm:p-7 shadow-xl space-y-5">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                                                1
                                            </span>
                                            <span>Cantidad de Invitados</span>
                                        </span>
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
                                        <div className="mt-3 flex items-center justify-between gap-3 bg-zinc-950 p-3 rounded-xl border border-primary/40">
                                            <label
                                                htmlFor="lp-custom-guests"
                                                className="text-xs font-bold text-zinc-300"
                                            >
                                                Número exacto de invitados:
                                            </label>
                                            <input
                                                id="lp-custom-guests"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={customGuests}
                                                onChange={handleCustomGuestChange}
                                                className="w-24 py-1.5 px-3 rounded-lg bg-zinc-900 border border-primary text-white font-black text-base sm:text-sm text-center focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Intensidad de Consumo */}
                                <div className="pt-4 border-t border-white/[0.08]">
                                    <div className="flex items-center justify-between mb-3 gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                                            <span>Cócteles por Persona</span>
                                        </span>
                                        <span className="text-[11px] sm:text-xs font-bold text-amber-300">
                                            Total estimado: ~{proposal.totalDrinks} copas ({proposal.liters}L)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                                        {[
                                            {
                                                drinks: 2,
                                                title: '2 Tragos p/p',
                                                sub: 'Recepción / Barra complemento',
                                                recommended: false,
                                            },
                                            {
                                                drinks: 3,
                                                title: '3 Tragos p/p',
                                                sub: 'El más elegido para fiestas',
                                                recommended: true,
                                            },
                                            {
                                                drinks: 4,
                                                title: '4 Tragos p/p',
                                                sub: 'Barra principal toda la noche',
                                                recommended: false,
                                            },
                                        ].map((opt) => (
                                            <button
                                                key={opt.drinks}
                                                type="button"
                                                onClick={() => {
                                                    setDrinksPerPerson(opt.drinks);
                                                    setManualSelections([]);
                                                }}
                                                className={`p-3 sm:p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                                                    drinksPerPerson === opt.drinks
                                                        ? 'bg-primary/15 border-primary text-white shadow-sm'
                                                        : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10 text-zinc-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                                    <span className="font-black text-sm text-white">
                                                        {opt.title}
                                                    </span>
                                                    {opt.recommended && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-extrabold">
                                                            <Star className="w-2.5 h-2.5 fill-current" />
                                                            Popular
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[0.72rem] text-zinc-400 leading-tight">
                                                    {opt.sub}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* PASO 2: Estación de Servicio (Texto Claro, Cero Fotos Diminutas) */}
                            <div className="bg-zinc-900/95 border border-white/10 rounded-[1.75rem] p-5 sm:p-7 shadow-xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                                            2
                                        </span>
                                        <span>Estación de Coctelería</span>
                                    </span>
                                    <span className="text-[11px] text-zinc-400">
                                        {activeDispenser === 'muro' ? 'Muro LED seleccionado' : 'Formato Portátil seleccionado'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDispenserSelect('portatil')}
                                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                            activeDispenser === 'portatil'
                                                ? 'bg-primary/15 border-primary shadow-sm'
                                                : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-black text-base text-white">
                                                Dispensador Portátil
                                            </span>
                                            <span className="text-[0.68rem] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                Instalación $0
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-300 leading-relaxed">
                                            2 grifos simultáneos con hielo interno. No requiere electricidad ni cables: cabe sobre cualquier mesa, mesón o quincho.
                                        </p>
                                        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[0.7rem] text-zinc-400 font-semibold">
                                            <span>Barriles: 5L (25c) y 10L (50c)</span>
                                            <span className="text-primary font-bold">Mín. 10L</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDispenserSelect('muro')}
                                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                            activeDispenser === 'muro'
                                                ? 'bg-primary/15 border-primary shadow-sm'
                                                : 'bg-zinc-950/80 hover:bg-zinc-800/80 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-black text-base text-white">
                                                Muro de Coctelería
                                            </span>
                                            <span className="text-[0.68rem] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                +{formatCurrency(MURO_INSTALLATION_COST)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-300 leading-relaxed">
                                            Estructura escénica de madera e iluminación LED con múltiples grifos de alto flujo. Espectacular centro de atracción del evento.
                                        </p>
                                        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[0.7rem] text-zinc-400 font-semibold">
                                            <span>Barriles: 20L (100c) y 30L (150c)</span>
                                            <span className="text-amber-400 font-bold">Mín. {MURO_MIN_LITERS}L</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* PASO 3: Selección de Sabores (100% TEXTO — AMPLIO, PRÁCTICO Y TRANSPARENTE) */}
                            <div className="bg-zinc-900/95 border border-white/10 rounded-[1.75rem] p-5 sm:p-7 shadow-xl space-y-5">
                                {/* Encabezado del Paso + Barra de Balance de Litros */}
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-primary text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                                                3
                                            </span>
                                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200">
                                                Carta de Cócteles de tu Barra
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 self-start sm:self-auto">
                                            {manualSelections.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setManualSelections([])}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-300 transition-colors cursor-pointer"
                                                    title="Restaurar a la propuesta recomendada"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    <span>Sugeridos</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setShowCocktailDrawer(!showCocktailDrawer)}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-slate-950 hover:bg-amber-300 text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
                                            >
                                                <span>
                                                    {showCocktailDrawer ? 'Cerrar Carta' : 'Explorar Carta y Cambiar'}
                                                </span>
                                                <ChevronDown
                                                    className={`w-3.5 h-3.5 transition-transform ${
                                                        showCocktailDrawer ? 'rotate-180' : ''
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Medidor en vivo de Litros */}
                                    <div className="bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-white/10 space-y-2">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-bold text-zinc-300">
                                                Volumen configurado:{' '}
                                                <strong className="text-white font-black text-sm">
                                                    {summaryData.totalLiters}L
                                                </strong>{' '}
                                                <span className="text-zinc-400">
                                                    (~{summaryData.totalCocktails} copas)
                                                </span>
                                            </span>
                                            <span className="text-[11px] font-semibold text-zinc-400">
                                                Meta calculada:{' '}
                                                <strong className="text-amber-300 font-bold">
                                                    {proposal.liters}L
                                                </strong>
                                            </span>
                                        </div>

                                        {/* Barra de Progreso Visual */}
                                        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    summaryData.totalLiters < (activeDispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS)
                                                        ? 'bg-red-500'
                                                        : summaryData.totalLiters >= proposal.liters
                                                        ? 'bg-emerald-400'
                                                        : 'bg-primary'
                                                }`}
                                                style={{
                                                    width: `${Math.min(100, Math.round((summaryData.totalLiters / Math.max(1, proposal.liters)) * 100))}%`,
                                                }}
                                            />
                                        </div>

                                        {/* Feedback dinámico según el litraje actual */}
                                        <div className="flex items-center justify-between text-[11px]">
                                            {summaryData.totalLiters < (activeDispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS) ? (
                                                <span className="text-red-400 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>
                                                        Faltan {(activeDispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS) - summaryData.totalLiters}L para el mínimo de {activeDispenser === 'muro' ? 'Muro LED (60L)' : 'Portátil (10L)'}.
                                                    </span>
                                                </span>
                                            ) : summaryData.totalLiters < proposal.liters ? (
                                                <span className="text-amber-300 font-medium">
                                                    Te sugerimos sumar {proposal.liters - summaryData.totalLiters}L más para cubrir a tus {guests} invitados toda la noche.
                                                </span>
                                            ) : (
                                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Barra perfectamente balanceada para {guests} invitados.</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* LISTA DE BARRILLES ACTIVOS EN TU BARRA (Texto Limpio con Controles Directos) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
                                        <span>Sabores actualmente en tu barra ({currentSelections.length} variedades):</span>
                                        <span className="text-[11px] text-zinc-500">Ajusta cantidades directo aquí</span>
                                    </div>

                                    {currentSelections.length === 0 ? (
                                        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-dashed border-white/10 text-center text-xs text-zinc-400">
                                            Aún no has seleccionado barriles. Abre la carta abajo para armar tu barra.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {currentSelections.map((sel) => {
                                                const prod = cocktails.find((c) => c.id === sel.id);
                                                const litersNum = parseInt(sel.size, 10);
                                                const cups = litersNum * sel.quantity * 5;
                                                return (
                                                    <div
                                                        key={`${sel.id}-${sel.size}`}
                                                        className="p-3 rounded-2xl bg-zinc-950 border border-white/10 hover:border-primary/40 flex items-center justify-between gap-3 text-xs transition-colors"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-black text-white text-sm truncate">
                                                                    {prod?.name || 'Cóctel'}
                                                                </span>
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                                                                    {sel.size}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px] text-zinc-400 block mt-0.5">
                                                                {sel.quantity * litersNum}L = ~{cups} copas
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-xl border border-white/10">
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Quitar ${sel.size} de ${prod?.name}`}
                                                                    onClick={() => handleQuantityChange(sel.id, sel.size, -1)}
                                                                    className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                                                                >
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <span className="w-5 text-center font-black text-primary text-sm">
                                                                    {sel.quantity}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Agregar ${sel.size} de ${prod?.name}`}
                                                                    onClick={() => handleQuantityChange(sel.id, sel.size, 1)}
                                                                    className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                aria-label={`Eliminar ${prod?.name} de la barra`}
                                                                onClick={() => handleRemoveItem(sel.id, sel.size)}
                                                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Quitar de mi barra"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* EXPLORADOR DE CARTA COMPLETA (100% TEXTO — ESPACIOSO Y FÁCIL DE USAR) */}
                                {showCocktailDrawer && (
                                    <div className="mt-4 pt-5 border-t border-white/10 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                                    <span>Carta de Variedades Cocktails on Tap</span>
                                                    <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                                        {baseCocktails.length} disponibles
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    Toca [+] para sumar los barriles que quieras en tu evento.
                                                </p>
                                            </div>

                                            {/* Buscador de texto en vivo */}
                                            <div className="relative w-full sm:w-64">
                                                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={flavorSearch}
                                                    onChange={(e) => setFlavorSearch(e.target.value)}
                                                    placeholder="Buscar sabor o licor..."
                                                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-primary"
                                                />
                                                {flavorSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFlavorSearch('')}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Pestañas de Filtro por Categoría */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { id: 'all', label: `Todos (${categoryCounts.all})` },
                                                { id: 'Cocktails', label: `Cócteles (${categoryCounts.Cocktails})` },
                                                { id: 'Combinados', label: `Combinados (${categoryCounts.Combinados})` },
                                                { id: 'Mocktails', label: `Sin Alcohol (${categoryCounts.Mocktails})` },
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setFlavorFilter(tab.id as any)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                                        flavorFilter === tab.id
                                                            ? 'bg-primary text-slate-950 border-primary font-black shadow-sm'
                                                            : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Grilla 100% Texto de Cócteles */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                                            {filteredCocktails.length === 0 ? (
                                                <div className="col-span-full py-8 text-center text-xs text-zinc-400 bg-zinc-950 rounded-2xl border border-white/10">
                                                    No encontramos variedades que coincidan con &ldquo;{flavorSearch}&rdquo;.
                                                </div>
                                            ) : (
                                                filteredCocktails.map((c) => {
                                                    const info = getProductEnrichedInfo(c.name, c.category);
                                                    const compatibleSizes = Object.entries(c.prices || {}).filter(
                                                        ([sizeLabel, p]) =>
                                                            isEventBarrelSizeLabelCompatible(sizeLabel, activeDispenser) &&
                                                            !p.isDisposable
                                                    );
                                                    if (compatibleSizes.length === 0) return null;

                                                    // Verificar si este cóctel ya está en la barra
                                                    const totalSelectedForThis = currentSelections
                                                        .filter((s) => s.id === c.id)
                                                        .reduce((acc, s) => acc + s.quantity, 0);

                                                    const isSelected = totalSelectedForThis > 0;

                                                    return (
                                                        <div
                                                            key={c.id}
                                                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-xs ${
                                                                isSelected
                                                                    ? 'bg-gradient-to-br from-zinc-900 to-amber-950/30 border-primary shadow-[0_0_20px_rgba(226,160,73,0.12)]'
                                                                    : 'bg-zinc-950/90 border-white/10 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {/* Encabezado: Título + Categoría + ABV */}
                                                            <div>
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0 flex-1">
                                                                        <h4 className="font-black text-sm text-white leading-tight">
                                                                            {c.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                                c.category.toLowerCase() === 'mocktails'
                                                                                    ? 'bg-emerald-500/20 text-emerald-300'
                                                                                    : c.category.toLowerCase() === 'combinados'
                                                                                    ? 'bg-blue-500/20 text-blue-300'
                                                                                    : 'bg-amber-400/20 text-amber-300'
                                                                            }`}>
                                                                                {c.category.toLowerCase() === 'mocktails'
                                                                                    ? 'Sin Alcohol (0.0%)'
                                                                                    : c.category.toLowerCase() === 'combinados'
                                                                                    ? 'Combinado'
                                                                                    : 'Cóctel Clásico'}
                                                                            </span>
                                                                            <span className="text-[10px] text-zinc-400 font-medium">
                                                                                {info.abv}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {isSelected && (
                                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-slate-950 shrink-0">
                                                                            ✓ En tu barra ({totalSelectedForThis})
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Descripción simple de ingredientes */}
                                                                <p className="text-zinc-300 text-[11px] leading-relaxed mt-2 line-clamp-2">
                                                                    <span className="text-zinc-400 font-semibold">Ingredientes: </span>
                                                                    {info.ingredients}
                                                                </p>
                                                            </div>

                                                            {/* Selectores de tamaño compatible con el dispensador activo */}
                                                            <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2 flex-wrap">
                                                                {compatibleSizes.map(([sizeLabel]) => {
                                                                    const qty =
                                                                        currentSelections.find(
                                                                            (s) => s.id === c.id && s.size === sizeLabel
                                                                        )?.quantity || 0;
                                                                    const liters = parseInt(sizeLabel, 10);
                                                                    const cups = liters * 5;

                                                                    return (
                                                                        <div
                                                                            key={sizeLabel}
                                                                            className={`flex items-center justify-between gap-2 flex-1 p-2 rounded-xl border ${
                                                                                qty > 0
                                                                                    ? 'bg-primary/10 border-primary/50'
                                                                                    : 'bg-zinc-900 border-white/10'
                                                                            }`}
                                                                        >
                                                                            <div>
                                                                                <span className="font-black text-xs text-white block">
                                                                                    Barril {sizeLabel}
                                                                                </span>
                                                                                <span className="text-[10px] text-zinc-400">
                                                                                    {cups} copas
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5">
                                                                                <button
                                                                                    type="button"
                                                                                    aria-label={`Quitar ${sizeLabel} de ${c.name}`}
                                                                                    onClick={() => handleQuantityChange(c.id, sizeLabel, -1)}
                                                                                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-30"
                                                                                    disabled={qty === 0}
                                                                                >
                                                                                    <Minus className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <span className={`w-5 text-center font-black text-sm ${qty > 0 ? 'text-primary' : 'text-zinc-400'}`}>
                                                                                    {qty}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    aria-label={`Agregar ${sizeLabel} de ${c.name}`}
                                                                                    onClick={() => handleQuantityChange(c.id, sizeLabel, 1)}
                                                                                    className="w-7 h-7 rounded-lg bg-primary hover:bg-amber-300 text-slate-950 font-bold flex items-center justify-center cursor-pointer active:scale-95"
                                                                                >
                                                                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── COLUMNA DERECHA (5 cols): Ticket de Propuesta + Doble CTA ─── */}
                        <form
                            id="studio-checkout-card"
                            noValidate
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit('whatsapp');
                            }}
                            className="lg:col-span-5 lg:sticky lg:top-20 bg-white text-slate-900 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.5)] border-2 border-primary/40 scroll-mt-20"
                        >
                            {/* Cabecera del Ticket: Resumen Financiero en Vivo + Desglose de Barriles */}
                            <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 mb-5 sm:mb-6 relative overflow-hidden">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="text-[0.68rem] font-black uppercase tracking-wider text-amber-400 block">
                                            Propuesta Todo Incluido
                                        </span>
                                        <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
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

                                    <div className="text-right bg-white/10 px-3 py-2 rounded-xl border border-white/10 shrink-0">
                                        <div className="text-base sm:text-lg font-black text-white leading-none">
                                            {summaryData.totalCocktails}
                                        </div>
                                        <div className="text-[0.62rem] sm:text-[0.65rem] font-bold text-zinc-300 uppercase mt-0.5">
                                            Cócteles ({summaryData.totalLiters}L)
                                        </div>
                                    </div>
                                </div>

                                {/* Desglose en vivo de los barriles incluidos */}
                                {currentSelections.length > 0 && (
                                    <div className="mt-3.5 pt-3 border-t border-white/10 space-y-1.5">
                                        <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-wider text-amber-400">
                                            <span>Tu selección ({currentSelections.length} variedades):</span>
                                            <span>Total: {summaryData.totalLiters}L</span>
                                        </div>
                                        <div className="max-h-28 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                                            {currentSelections.map((sel, idx) => {
                                                const prod = cocktails.find((c) => c.id === sel.id);
                                                const liters = parseInt(sel.size, 10) * sel.quantity;
                                                const cups = liters * 5;
                                                return (
                                                    <div
                                                        key={`${sel.id}-${sel.size}-${idx}`}
                                                        className="flex items-center justify-between text-xs text-zinc-200"
                                                    >
                                                        <span className="truncate pr-2 font-medium">
                                                            <strong className="text-primary font-bold">
                                                                {sel.quantity}x {sel.size}
                                                            </strong>{' '}
                                                            {prod?.name || 'Cóctel'}
                                                        </span>
                                                        <span className="text-[0.7rem] text-zinc-400 shrink-0 font-mono">
                                                            {cups} copas
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-zinc-300">
                                    <span>✓ Hielo + Vasos/Copas + Decoración: $0</span>
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
                                <div
                                    role="alert"
                                    className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                                    <span>{saveError}</span>
                                </div>
                            )}

                            {errors.liters && (
                                <div
                                    role="alert"
                                    className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span>{errors.liters}</span>
                                </div>
                            )}

                            {/* Inputs Compactos del Cliente (16px en móvil para prevenir auto-zoom en iOS/Instagram) */}
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label
                                            htmlFor="lp-first-name"
                                            className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        >
                                            Nombre <span className="text-primary">*</span>
                                        </label>
                                        <input
                                            id="lp-first-name"
                                            name="firstName"
                                            type="text"
                                            autoComplete="given-name"
                                            enterKeyHint="next"
                                            required
                                            aria-invalid={Boolean(errors.firstName)}
                                            aria-describedby={errors.firstName ? 'lp-first-name-err' : undefined}
                                            value={firstName}
                                            onChange={(e) => {
                                                setFirstName(e.target.value);
                                                clearFieldError('firstName');
                                            }}
                                            placeholder="Ej: Camila"
                                            className={`w-full p-2.5 rounded-xl border text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                                errors.firstName
                                                    ? 'border-red-400 bg-red-50/40'
                                                    : 'border-slate-200'
                                            }`}
                                        />
                                        {errors.firstName && (
                                            <span
                                                id="lp-first-name-err"
                                                className="text-[0.68rem] text-red-600 font-bold mt-0.5 block"
                                            >
                                                {errors.firstName}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="lp-last-name"
                                            className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        >
                                            Apellido <span className="text-primary">*</span>
                                        </label>
                                        <input
                                            id="lp-last-name"
                                            name="lastName"
                                            type="text"
                                            autoComplete="family-name"
                                            enterKeyHint="next"
                                            required
                                            aria-invalid={Boolean(errors.lastName)}
                                            aria-describedby={errors.lastName ? 'lp-last-name-err' : undefined}
                                            value={lastName}
                                            onChange={(e) => {
                                                setLastName(e.target.value);
                                                clearFieldError('lastName');
                                            }}
                                            placeholder="Ej: Rojas"
                                            className={`w-full p-2.5 rounded-xl border text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                                errors.lastName
                                                    ? 'border-red-400 bg-red-50/40'
                                                    : 'border-slate-200'
                                            }`}
                                        />
                                        {errors.lastName && (
                                            <span
                                                id="lp-last-name-err"
                                                className="text-[0.68rem] text-red-600 font-bold mt-0.5 block"
                                            >
                                                {errors.lastName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* WhatsApp */}
                                <div>
                                    <label
                                        htmlFor="lp-phone"
                                        className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                    >
                                        WhatsApp <span className="text-primary">*</span>
                                    </label>
                                    <PhoneInput
                                        id="lp-phone"
                                        name="phone"
                                        autoComplete="tel"
                                        required
                                        value={phone}
                                        onChange={(val) => {
                                            setPhone(val);
                                            clearFieldError('phone');
                                        }}
                                        className={`w-full p-2.5 rounded-xl border text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
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
                                        comunaId="lp-comuna"
                                        labelClassName="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        selectClassName="w-full p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.85rem_center]"
                                    />
                                </div>

                                {/* Fecha y Tipo de Evento */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label
                                            htmlFor="lp-event-date"
                                            className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        >
                                            Fecha del Evento <span className="text-primary">*</span>
                                        </label>
                                        <ShippingDatePicker
                                            id="lp-event-date"
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
                                        <label
                                            htmlFor="lp-event-type"
                                            className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        >
                                            Celebración
                                        </label>
                                        <select
                                            id="lp-event-type"
                                            name="eventType"
                                            value={eventType}
                                            onChange={(e) => setEventType(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-base sm:text-sm text-slate-900 focus:border-primary focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.85rem_center]"
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

                                {eventType === 'Otro' && (
                                    <div>
                                        <label
                                            htmlFor="lp-other-type"
                                            className="block text-[0.75rem] font-bold text-slate-700 mb-1"
                                        >
                                            ¿Qué celebras?
                                        </label>
                                        <input
                                            id="lp-other-type"
                                            name="otherType"
                                            type="text"
                                            value={otherType}
                                            onChange={(e) => setOtherType(e.target.value)}
                                            placeholder="Ej: Aniversario, Graduación, Inauguración..."
                                            className="w-full p-2.5 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                )}

                                {/* Email */}
                                <div>
                                    <label
                                        htmlFor="lp-email"
                                        className="flex items-center justify-between text-[0.75rem] font-bold text-slate-700 mb-1"
                                    >
                                        <span>Tu Email</span>
                                        <span className="text-[0.65rem] font-normal text-slate-500">
                                            Requerido si eliges recibir por correo
                                        </span>
                                    </label>
                                    <input
                                        id="lp-email"
                                        name="email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        enterKeyHint="done"
                                        aria-invalid={Boolean(errors.email)}
                                        aria-describedby={errors.email ? 'lp-email-err' : undefined}
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            clearFieldError('email');
                                        }}
                                        placeholder="tu@correo.cl"
                                        className={`w-full p-2.5 rounded-xl border text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:border-primary focus:outline-none ${
                                            errors.email
                                                ? 'border-red-400 bg-red-50/40'
                                                : 'border-slate-200'
                                        }`}
                                    />
                                    {errors.email && (
                                        <span
                                            id="lp-email-err"
                                            className="text-[0.68rem] text-red-600 font-bold mt-0.5 block"
                                        >
                                            {errors.email}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* DOBLE CTA EXPERIMENTAL: WhatsApp vs. Email */}
                            <div className="mt-6 space-y-2.5">
                                <button
                                    type="submit"
                                    disabled={sendStatus === 'saving'}
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
                        </form>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                5. PRUEBA SOCIAL VERIFICADA + PREGUNTAS FRECUENTES RÁPIDAS
               ═══════════════════════════════════════════════════════════════════ */}
            <section className="py-14 sm:py-24 px-4 sm:px-6 bg-[#090B10] border-t border-white/[0.07] [content-visibility:auto] [contain-intrinsic-size:auto_700px]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
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
                            <span>Verificar reseñas en Google Maps</span>
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                        </a>
                    </div>

                    {/* En móvil: carrusel horizontal deslizable; en tablet/desktop: grilla 2/4 columnas */}
                    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-pl-4 -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0 scrollbar-none">
                        {GOOGLE_REVIEWS.map((rev, i) => (
                            <div
                                key={i}
                                className="w-[82vw] max-w-[300px] md:w-auto md:max-w-none shrink-0 snap-start bg-zinc-900/90 border border-white/10 rounded-3xl p-5 flex flex-col justify-between"
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

                    {/* Micro-FAQ de cierre para resolver dudas de último minuto antes de cotizar */}
                    <div className="mt-14 sm:mt-20 max-w-3xl mx-auto">
                        <div className="text-center mb-6 sm:mb-8">
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em] block mb-1.5">
                                Respuestas Rápidas
                            </span>
                            <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                                Dudas frecuentes antes de cotizar
                            </h3>
                        </div>

                        <div className="space-y-2.5">
                            {QUICK_FAQS.map((faq, idx) => (
                                <details
                                    key={idx}
                                    name="eventos-faq"
                                    open={idx === 0}
                                    className="group rounded-2xl bg-zinc-900/90 border border-white/10 open:border-primary/40 transition-colors"
                                >
                                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-4 sm:px-5 py-4 flex items-center justify-between gap-3 text-left font-bold text-sm sm:text-base text-white">
                                        <span>{faq.q}</span>
                                        <ChevronDown className="w-4 h-4 text-primary shrink-0 transition-transform duration-200 group-open:rotate-180" />
                                    </summary>
                                    <div className="px-4 sm:px-5 pb-4 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-white/[0.06] pt-3">
                                        {faq.a}
                                    </div>
                                </details>
                            ))}
                        </div>

                        <div className="mt-8 text-center">
                            <button
                                type="button"
                                onClick={() => scrollToStudio()}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-primary to-[#d98a2b] text-slate-950 text-sm font-black shadow-[0_0_30px_rgba(226,160,73,0.35)] hover:brightness-110 transition-transform active:scale-95 cursor-pointer"
                            >
                                <span>Calcular el precio para mi evento</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                6. FOOTER MINIMALISTA DE CAMPAÑA
               ═══════════════════════════════════════════════════════════════════ */}
            <footer className="bg-[#06070B] border-t border-white/10 py-10 pb-28 sm:pb-12 px-4 text-center">
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
                STICKY BOTTOM BAR EN MÓVIL (Se oculta únicamente al llegar al formulario final)
               ═══════════════════════════════════════════════════════════════════ */}
            <div
                className={`fixed bottom-0 inset-x-0 z-40 sm:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-white/15 px-4 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] transition-transform duration-300 ${
                    inCheckoutView ? 'translate-y-full pointer-events-none' : 'translate-y-0'
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
                        <span>Cotizar</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
