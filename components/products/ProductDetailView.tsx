'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Check,
    ShoppingBag,
    Sparkles,
    Clock,
    Thermometer,
    GlassWater,
    ShieldCheck,
    Truck,
    Info,
    Plus,
    Minus,
    HelpCircle,
    CheckCircle2,
    Wine
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { getProductEnrichedInfo, slugifyProductName } from '@/lib/productDetails';
import { trackProductViewContent, trackProductAddToCart } from '@/lib/fpixel';
import { WHATSAPP_URL } from '@/lib/config';

interface AddonItem {
    id: string;
    name: string;
    description: string;
    price: number;
    size: string;
    image: string;
}

interface Props {
    product: Product;
    relatedProducts: Product[];
    availableAddons: Product[];
}

export default function ProductDetailView({ product, relatedProducts, availableAddons }: Props) {
    const router = useRouter();
    const enriched = useMemo(() => getProductEnrichedInfo(product.name, product.category), [product.name, product.category]);
    const pdp = product.pdp_metadata;

    // Metadatos comerciales dinámicos con fallback al catálogo enriquecido
    const headline = pdp?.headline?.trim() || enriched.headline;
    const commercialDesc = pdp?.commercial_desc?.trim() || enriched.commercialDesc;
    const abv = pdp?.abv?.trim() || enriched.abv;
    const servingTemperature = pdp?.serving_temperature?.trim() || enriched.servingTemperature;
    const glassware = pdp?.glassware?.trim() || enriched.glassware;
    const garnish = pdp?.garnish?.trim() || enriched.garnish;
    const flavorProfile = useMemo(() => ({
        sweetness: pdp?.flavor_profile?.sweetness ?? enriched.flavorProfile.sweetness,
        acidity: pdp?.flavor_profile?.acidity ?? enriched.flavorProfile.acidity,
        intensity: pdp?.flavor_profile?.intensity ?? enriched.flavorProfile.intensity,
        freshness: pdp?.flavor_profile?.freshness ?? enriched.flavorProfile.freshness,
    }), [pdp?.flavor_profile, enriched.flavorProfile]);
    
    // Buscar estrictamente el formato desechable (Party Keg 5L)
    const priceInfo = useMemo(() => {
        return (
            product.sizes.find(s => s.isDisposable) ||
            product.sizes.find(s => s.size.toLowerCase().includes('desechable')) ||
            product.sizes.find(s => s.size.toLowerCase().includes('5l')) ||
            product.sizes[0]
        );
    }, [product.sizes]);

    const unitPrice = priceInfo ? priceInfo.offerPrice : 0;
    const originalPrice = priceInfo ? priceInfo.price : 0;
    const hasDiscount = originalPrice > unitPrice;

    // Priorizar siempre la imagen específica del barril desechable Party Keg
    const displayImage = useMemo(() => {
        const disposableSize = product.sizes.find(s => s.isDisposable && s.image);
        return disposableSize?.image || priceInfo?.image || product.image;
    }, [product.sizes, priceInfo, product.image]);

    // Estado local
    const [quantity, setQuantity] = useState(1);
    const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [cartItemCount, setCartItemCount] = useState(0);

    // Mapear y filtrar complementos según los recomendados para este cóctel
    const addonsList: AddonItem[] = useMemo(() => {
        const rawAddons = availableAddons.map(a => {
            const firstSize = a.sizes[0];
            return {
                id: a.id,
                name: a.name,
                description: a.description,
                price: firstSize ? firstSize.offerPrice : 2500,
                size: firstSize ? firstSize.size : 'Unidad',
                image: a.image
            };
        });

        const recIds = pdp?.recommended_addon_ids;
        if (Array.isArray(recIds) && recIds.length > 0) {
            const filtered = rawAddons.filter(a => recIds.includes(a.id));
            if (filtered.length > 0) return filtered;
        }

        return rawAddons;
    }, [availableAddons, pdp?.recommended_addon_ids]);

    // Cócteles relacionados priorizando los configurados en pdp_metadata
    const sortedRelatedProducts = useMemo(() => {
        const relIds = pdp?.related_product_ids;
        if (Array.isArray(relIds) && relIds.length > 0) {
            const prioritized: Product[] = [];
            relIds.forEach(id => {
                const found = relatedProducts.find(p => p.id === id);
                if (found && !prioritized.some(p => p.id === found.id)) {
                    prioritized.push(found);
                }
            });
            const remaining = relatedProducts.filter(p => !relIds.includes(p.id));
            return [...prioritized, ...remaining];
        }
        return relatedProducts;
    }, [pdp?.related_product_ids, relatedProducts]);

    // Cantidad total de complementos seleccionados
    const activeAddonsCount = useMemo(() => {
        return Object.values(addonQuantities).reduce((acc, qty) => acc + (qty > 0 ? qty : 0), 0);
    }, [addonQuantities]);

    // Calcular subtotal combinado (barril + addons seleccionados con sus cantidades)
    const addonsTotal = useMemo(() => {
        return Object.entries(addonQuantities).reduce((sum, [id, qty]) => {
            if (qty <= 0) return sum;
            const addon = addonsList.find(a => a.id === id);
            return sum + (addon ? addon.price * qty : 0);
        }, 0);
    }, [addonQuantities, addonsList]);

    const totalBundlePrice = (unitPrice * quantity) + addonsTotal;

    // Disparar Meta Pixel ViewContent con el ID único del producto al cargar
    useEffect(() => {
        if (priceInfo) {
            trackProductViewContent({
                id: product.id,
                name: product.name,
                price: priceInfo.offerPrice,
                category: product.category
            });
        }
    }, [product, priceInfo]);

    // Sincronizar contador de carrito actual desde localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('cot_direct_selections');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const totalQty = parsed.reduce((acc: number, item: { quantity?: number }) => acc + (item.quantity || 0), 0);
                    setCartItemCount(totalQty);
                }
            }
        } catch {
            // Ignorar errores de storage
        }
    }, []);

    const toggleAddon = (addonId: string) => {
        setAddonQuantities(prev => {
            const current = prev[addonId] || 0;
            if (current > 0) {
                const copy = { ...prev };
                delete copy[addonId];
                return copy;
            }
            return { ...prev, [addonId]: 1 };
        });
    };

    const handleAddonQtyChange = (addonId: string, delta: number) => {
        setAddonQuantities(prev => {
            const current = prev[addonId] || 0;
            const next = Math.max(0, current + delta);
            if (next === 0) {
                const copy = { ...prev };
                delete copy[addonId];
                return copy;
            }
            return { ...prev, [addonId]: next };
        });
    };

    /**
     * Guarda las selecciones actuales en localStorage para que /barriles las tome
     */
    const saveToSharedCart = () => {
        try {
            const saved = localStorage.getItem('cot_direct_selections');
            let currentSelections: Array<{ id: string; size: string; quantity: number }> = [];
            if (saved) {
                currentSelections = JSON.parse(saved);
            }

            const targetSize = priceInfo?.size || '5L';

            // Actualizar o agregar el barril principal
            const existingIndex = currentSelections.findIndex(s => s.id === product.id && s.size === targetSize);
            if (existingIndex >= 0) {
                currentSelections[existingIndex].quantity += quantity;
            } else {
                currentSelections.push({
                    id: product.id,
                    size: targetSize,
                    quantity: quantity
                });
            }

            // Sumar los complementos con cantidad > 0
            Object.entries(addonQuantities).forEach(([addonId, qty]) => {
                if (qty <= 0) return;
                const addon = addonsList.find(a => a.id === addonId);
                const addonSize = addon?.size || 'Unidad';
                const addonIndex = currentSelections.findIndex(s => s.id === addonId && s.size === addonSize);
                if (addonIndex >= 0) {
                    currentSelections[addonIndex].quantity += qty;
                } else {
                    currentSelections.push({
                        id: addonId,
                        size: addonSize,
                        quantity: qty
                    });
                }
            });

            localStorage.setItem('cot_direct_selections', JSON.stringify(currentSelections));

            // Actualizar contador
            const newTotal = currentSelections.reduce((acc, item) => acc + item.quantity, 0);
            setCartItemCount(newTotal);

            // Trackear AddToCart en Meta Pixel
            trackProductAddToCart({
                id: product.id,
                name: product.name,
                price: unitPrice,
                category: product.category,
                quantity: quantity
            });

            return true;
        } catch (err) {
            console.error('Error guardando en carrito compartido:', err);
            return false;
        }
    };

    const handleAddToCart = () => {
        saveToSharedCart();
        const addonText = activeAddonsCount > 0 ? ` y ${activeAddonsCount} complemento(s)` : '';
        setToastMessage(`¡Agregaste ${quantity}x ${product.name}${addonText} al pedido!`);
        setTimeout(() => setToastMessage(null), 4500);
    };

    const handleBuyNow = () => {
        saveToSharedCart();
        router.push('/barriles?checkout=open');
    };

    // Mensaje preconfigurado para WhatsApp
    const waMessage = encodeURIComponent(
        `Hola Cocktails on Tap, estoy viendo el barril de 5L de ${product.name} (${formatCurrency(unitPrice)}) y tengo las siguientes consultas:`
    );
    const waUrl = `${WHATSAPP_URL}?text=${waMessage}`;

    return (
        <div className="w-full max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Toast de confirmación flotante */}
            {toastMessage && (
                <div className="fixed top-20 right-4 sm:right-8 z-50 bg-zinc-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-slide-up max-w-md">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 text-[0.9rem] font-medium leading-tight">{toastMessage}</div>
                    <Link
                        href="/barriles"
                        className="text-xs bg-primary text-white font-black px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors no-underline whitespace-nowrap"
                    >
                        Ver Pedido
                    </Link>
                </div>
            )}

            {/* Barra de navegación superior / Breadcrumb */}
            <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 pl-14 sm:pl-0">
                <Link
                    href="/barriles"
                    className="inline-flex items-center gap-2 text-brand-text-muted hover:text-primary transition-colors text-[0.88rem] sm:text-[0.92rem] font-semibold no-underline group whitespace-nowrap min-w-0"
                >
                    <div className="p-2 rounded-full bg-white border border-brand-border group-hover:border-primary/40 transition-colors shadow-xs shrink-0">
                        <ArrowLeft className="w-4 h-4 text-brand-text-muted group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
                    </div>
                    <span className="hidden sm:inline">Volver a todos los barriles</span>
                    <span className="sm:hidden font-bold">Volver a barriles</span>
                </Link>

                {cartItemCount > 0 && (
                    <Link
                        href="/barriles"
                        className="inline-flex items-center gap-1.5 sm:gap-2 bg-white border border-brand-border hover:border-primary px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-brand-text text-[0.82rem] sm:text-[0.85rem] font-bold shadow-xs transition-all hover:shadow-md no-underline shrink-0 whitespace-nowrap"
                    >
                        <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
                        <span className="hidden sm:inline">Ver mi pedido</span>
                        <span className="sm:hidden">Pedido</span>
                        <span className="bg-primary text-white text-[0.7rem] px-2 py-0.5 rounded-full font-black">
                            {cartItemCount}
                        </span>
                    </Link>
                )}
            </div>

            {/* Cuadrícula Principal de 2 Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-16">
                
                {/* Columna Izquierda: Galería e Infografía de Producto */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white border border-brand-border shadow-lg">
                        <Image
                            src={displayImage}
                            alt={product.name}
                            fill
                            priority
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 45vw"
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                            <span className="bg-emerald-500/95 backdrop-blur-md text-white text-[0.7rem] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md">
                                25 Cócteles
                            </span>
                        </div>
                    </div>

                    {/* Perfil de Sabor Visual */}
                    <div className="bg-white rounded-3xl p-6 border border-brand-border shadow-sm">
                        <h4 className="text-[0.95rem] font-extrabold text-brand-text uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span>Perfil de Sabor</span>
                        </h4>
                        <div className="space-y-3.5">
                            {[
                                { label: 'Dulzor', val: flavorProfile.sweetness, color: 'bg-amber-400' },
                                { label: 'Acidez', val: flavorProfile.acidity, color: 'bg-emerald-400' },
                                { label: 'Intensidad', val: flavorProfile.intensity, color: 'bg-rose-400' },
                                { label: 'Refrescancia', val: flavorProfile.freshness, color: 'bg-blue-400' }
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between text-xs font-semibold">
                                    <span className="text-brand-text w-24">{item.label}</span>
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden mx-3">
                                        <div
                                            className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                            style={{ width: `${(item.val / 5) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-brand-text-muted w-8 text-right">{item.val}/5</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ficha Técnica Rápida */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-1">
                            <span className="text-brand-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider text-[0.65rem]">
                                <Wine className="w-3.5 h-3.5 text-primary" />
                                Graduación
                            </span>
                            <span className="font-extrabold text-brand-text text-[0.95rem]">{abv}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-1">
                            <span className="text-brand-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider text-[0.65rem]">
                                <Thermometer className="w-3.5 h-3.5 text-primary" />
                                Temperatura
                            </span>
                            <span className="font-extrabold text-brand-text text-[0.95rem]">{servingTemperature}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-1 col-span-2">
                            <span className="text-brand-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider text-[0.65rem]">
                                <GlassWater className="w-3.5 h-3.5 text-primary" />
                                Vaso & Cristalería Recomendada
                            </span>
                            <span className="font-medium text-brand-text text-[0.85rem]">{glassware}</span>
                        </div>
                        {garnish && (
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-1 col-span-2">
                                <span className="text-brand-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider text-[0.65rem]">
                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                    Decoración / Garnish Sugerido
                                </span>
                                <span className="font-medium text-brand-text text-[0.85rem]">{garnish}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Información Comercial, Precio, Cross-Selling y Botones */}
                <div className="lg:col-span-7 flex flex-col">
                    
                    {/* Badge de Categoría */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-primary/10 text-primary text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                            {product.category}
                        </span>
                        <span className="text-brand-text-muted text-xs font-semibold">
                            • Barril Desechable Delivery
                        </span>
                    </div>

                    {/* Título Principal */}
                    <h1 className="text-3xl sm:text-4xl font-black text-brand-text tracking-tight mb-2">
                        {product.name}
                    </h1>

                    {/* Subtítulo / Headline */}
                    <p className="text-brand-text-muted text-[1.05rem] font-medium leading-relaxed mb-6">
                        {headline}
                    </p>

                    {/* Bloque de Precio y Rendimiento */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 mb-8">
                        <div className="flex flex-wrap items-baseline gap-3 mb-3">
                            <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                                {formatCurrency(unitPrice)}
                            </span>
                            {hasDiscount && (
                                <>
                                    <span className="text-lg text-brand-text-muted line-through font-normal">
                                        {formatCurrency(originalPrice)}
                                    </span>
                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                                        Ahorras {formatCurrency(originalPrice - unitPrice)}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Comparador de Ahorro "Party Math" */}
                        <div className="bg-white rounded-2xl p-4 border border-brand-border flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5 shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="text-[0.9rem] leading-relaxed">
                                <strong className="text-brand-text font-extrabold block">
                                    Rinde 25 cócteles de 200 ml (~{formatCurrency(Math.round(unitPrice / 25))} por trago)
                                </strong>
                                <span className="text-brand-text-muted text-xs block mt-0.5">
                                    En un bar o restaurante pagarías $6.500+ por cóctel ($162.500 en total). Con este barril disfrutas calidad premium ahorrando más del 70%.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Descripción Comercial Completa */}
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-brand-text mb-2.5">Descripción de la receta</h3>
                        <p className="text-brand-text-muted text-[0.95rem] leading-relaxed mb-4">
                            {commercialDesc}
                        </p>
                        
                        {/* Ingredientes */}
                        <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-4">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 block mb-1.5">
                                Ingredientes 100% Reales:
                            </span>
                            <p className="text-[0.88rem] text-amber-950/80 font-medium">
                                {product.description}
                            </p>
                        </div>
                    </div>

                    {/* Sección de Cross-Selling: "Arma tu experiencia completa (Perfect Serve)" */}
                    {addonsList.length > 0 && (
                        <div className="bg-white border border-brand-border rounded-3xl p-6 mb-8 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[1.05rem] font-extrabold text-brand-text flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <span>Arma tu experiencia completa (Perfect Serve)</span>
                                </h3>
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                    Opcional
                                </span>
                            </div>
                            <p className="text-brand-text-muted text-xs mb-4">
                                Complementos especialmente recomendados para este cóctel. Añade la cantidad que necesites:
                            </p>

                            <div className="space-y-3">
                                {addonsList.map(addon => {
                                    const qty = addonQuantities[addon.id] || 0;
                                    const isSelected = qty > 0;
                                    return (
                                        <div
                                            key={addon.id}
                                            className={`w-full p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                isSelected
                                                    ? 'border-primary bg-primary/5 shadow-sm'
                                                    : 'border-brand-border bg-slate-50/60 hover:border-slate-300'
                                            }`}
                                        >
                                            <div 
                                                onClick={() => toggleAddon(addon.id)}
                                                className="flex items-center gap-3 cursor-pointer flex-1 select-none"
                                            >
                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                                                    isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[0.9rem] font-bold text-brand-text block leading-tight">
                                                        {addon.name} ({addon.size})
                                                    </span>
                                                    <span className="text-[0.75rem] text-brand-text-muted block mt-0.5 line-clamp-1">
                                                        {addon.description}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-border/60">
                                                <span className="text-[0.9rem] font-black text-brand-text">
                                                    {isSelected ? formatCurrency(addon.price * qty) : `+${formatCurrency(addon.price)}`}
                                                </span>

                                                {isSelected ? (
                                                    <div className="flex items-center border border-primary/30 rounded-xl bg-white p-0.5 shadow-xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddonQtyChange(addon.id, -1)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-brand-text transition-colors cursor-pointer"
                                                            aria-label="Restar unidad"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="w-7 text-center font-black text-brand-text text-xs">
                                                            {qty}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddonQtyChange(addon.id, 1)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-brand-text transition-colors cursor-pointer"
                                                            aria-label="Sumar unidad"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAddon(addon.id)}
                                                        className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                                                    >
                                                        + Agregar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {activeAddonsCount > 0 && (
                                <div className="mt-4 pt-4 border-t border-brand-border flex items-center justify-between text-xs">
                                    <span className="text-brand-text-muted font-bold">
                                        Subtotal complementos ({activeAddonsCount} {activeAddonsCount === 1 ? 'ítem' : 'ítems'}):
                                    </span>
                                    <span className="text-sm font-black text-primary">
                                        +{formatCurrency(addonsTotal)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Panel de Compra y Botones CTA */}
                    <div className="bg-white border-2 border-primary/20 rounded-3xl p-6 shadow-md mb-8">
                        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                            {/* Selector de Cantidad de Barriles */}
                            <div className="flex items-center justify-between border border-brand-border rounded-2xl p-1 bg-slate-50 w-full sm:w-auto shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="p-2.5 rounded-xl hover:bg-white text-brand-text transition-colors disabled:opacity-40 cursor-pointer"
                                    disabled={quantity <= 1}
                                    aria-label="Restar barril"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-12 text-center font-black text-brand-text text-[1.05rem]">
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="p-2.5 rounded-xl hover:bg-white text-brand-text transition-colors cursor-pointer"
                                    aria-label="Sumar barril"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Resumen de Total */}
                            <div className="text-center sm:text-left flex-1">
                                <span className="text-xs text-brand-text-muted font-bold block uppercase tracking-wider">
                                    Total del Pedido
                                </span>
                                <span className="text-2xl font-black text-brand-text">
                                    {formatCurrency(totalBundlePrice)}
                                </span>
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={handleAddToCart}
                                className="flex-1 py-3.5 px-6 rounded-2xl bg-brand-text text-white font-black text-[0.95rem] hover:bg-slate-800 transition-all hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Agregar al Pedido</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleBuyNow}
                                className="flex-1 py-3.5 px-6 rounded-2xl bg-primary text-white font-black text-[0.95rem] hover:bg-primary-dark transition-all shadow-[0_4px_15px_rgba(226,160,73,0.35)] hover:shadow-xl active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Comprar Ahora →</span>
                            </button>
                        </div>

                        {/* Botón WhatsApp */}
                        <div className="mt-4 pt-4 border-t border-brand-border/60 text-center">
                            <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs font-bold text-[#128c7e] hover:underline no-underline"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>¿Tienes preguntas antes de ordenar? Escríbenos por WhatsApp</span>
                            </a>
                        </div>
                    </div>

                    {/* Sellos de Confianza / Garantía */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-brand-text-muted">
                        <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl p-3 border border-slate-200/60">
                            <Truck className="w-4 h-4 text-primary shrink-0" />
                            <span>Despacho a todo Chile</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl p-3 border border-slate-200/60">
                            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Pides, recibes y disfrutas</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl p-3 border border-slate-200/60">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Dura 3 semanas refrigerado</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sección Educativa: "La forma más fácil de disfrutar coctelería premium" */}
            <div className="bg-zinc-900 text-white rounded-3xl p-8 sm:p-12 mb-16 relative overflow-hidden">
                <div className="max-w-2xl mb-10">
                    <span className="text-primary text-xs font-black uppercase tracking-wider block mb-2">
                        Tu barra abierta en casa
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
                        La forma más fácil de disfrutar coctelería premium
                    </h2>
                    <p className="text-zinc-300 text-[0.95rem] leading-relaxed">
                        Pide tus cócteles favoritos y recíbelos en la puerta de tu casa en cualquier rincón de Chile. Nuestro barril Party Keg está pensado para que solo tengas que enfriar, servir en segundos y compartir copa tras copa cuando tú quieras, con la frescura intacta hasta por 3 semanas.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-xl bg-primary text-white font-black text-lg flex items-center justify-center mb-4 shadow-md">
                            1
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">Enfría en tu refrigerador</h4>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            Con 28 cm de alto por 17 cm de diámetro, cabe cómodo en cualquier refrigerador convencional o cooler. Déjalo enfriar unas horas antes de tu junta para servirlo en su punto perfecto.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-xl bg-primary text-white font-black text-lg flex items-center justify-center mb-4 shadow-md">
                            2
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">Tira del grifo integrado</h4>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            Viene 100% listo para usar con su propia válvula dosificadora incorporada. Solo levanta la manilla, abre el grifo y sirve sin armar ni conectar nada.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-xl bg-primary text-white font-black text-lg flex items-center justify-center mb-4 shadow-md">
                            3
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">Cócteles en 3 seg a tu ritmo</h4>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            Llena tu vaso con hielo y disfruta al instante cócteles con calidad de bar. Su atmósfera protectora conserva la frescura hasta por 3 semanas refrigerado: puedes disfrutarlo hoy y seguir el próximo fin de semana.
                        </p>
                    </div>
                </div>
            </div>

            {/* Cócteles Relacionados / Otras Variedades */}
            {sortedRelatedProducts.length > 0 && (
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-brand-text">También te podría gustar</h3>
                            <p className="text-brand-text-muted text-xs mt-1">Explora otras variedades de nuestra carta de barriles de 5L</p>
                        </div>
                        <Link
                            href="/barriles"
                            className="text-xs font-bold text-primary hover:underline no-underline"
                        >
                            Ver carta completa →
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {sortedRelatedProducts.slice(0, 4).map(rel => {
                            const relDisposable = rel.sizes.find(s => s.isDisposable);
                            const relPrice = relDisposable?.offerPrice || rel.sizes[0]?.offerPrice || 44990;
                            const relImage = relDisposable?.image || rel.image;
                            const relSlug = slugifyProductName(rel.name);
                            return (
                                <Link
                                    key={rel.id}
                                    href={`/barriles/${relSlug}`}
                                    className="bg-white rounded-2xl overflow-hidden border border-brand-border shadow-sm hover:shadow-md transition-all group no-underline flex flex-col"
                                >
                                    <div className="aspect-square bg-slate-50 relative overflow-hidden">
                                        <Image
                                            src={relImage}
                                            alt={rel.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            sizes="(max-width: 768px) 50vw, 25vw"
                                        />
                                    </div>
                                    <div className="p-4 flex flex-col flex-1">
                                        <span className="text-[0.65rem] font-bold text-primary uppercase tracking-wider block mb-1">
                                            {rel.category}
                                        </span>
                                        <h4 className="text-[0.95rem] font-bold text-brand-text group-hover:text-primary transition-colors line-clamp-1 mb-2">
                                            {rel.name}
                                        </h4>
                                        <div className="mt-auto flex items-baseline justify-between pt-2 border-t border-brand-border/60">
                                            <span className="text-sm font-black text-emerald-600">
                                                {formatCurrency(relPrice)}
                                            </span>
                                            <span className="text-[0.7rem] text-brand-text-muted font-bold">
                                                5L • 25 tragos
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
