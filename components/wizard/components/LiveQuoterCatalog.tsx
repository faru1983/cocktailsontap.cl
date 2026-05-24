'use client';

import React, { useRef, useMemo } from 'react';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import type { useWizard } from '@/hooks/useWizard';
import { calculateLiveQuoterSuggestion } from '@/lib/wizardLogic';
import type { Product, CocktailForWizard, ICart } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import CategoryTabs from '@/components/ui/CategoryTabs';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    cocktails: CocktailForWizard[];
    categories: string[];
    onOpenCheckout: () => void;
    onBack: () => void;
}

export default function LiveQuoterCatalog({ wizard, cocktails, categories, onOpenCheckout, onBack }: Props) {
    const { state, updateQuantity, toggleCategory } = wizard;

    const currentCategory = state.expandedCategoryId || categories[0] || '';
    const catalogRef = useRef<HTMLDivElement>(null);

    const handleCategoryChange = (cat: string) => {
        if (cat === currentCategory) return;
        toggleCategory(cat);
        if (catalogRef.current) {
            const navbarHeight = 85;
            const elementPosition = catalogRef.current.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - navbarHeight;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };

    const mappedProducts: Product[] = useMemo(() => cocktails.map(c => {
        const existingSelection = state.selections.find(s => s.id === c.id);
        return {
            id: c.id,
            name: c.name,
            description: c.desc,
            image: c.image,
            category: c.category,
            selectedSize: existingSelection?.size,
            sizes: Object.entries(c.prices)
                .filter(([size]) => !size.toLowerCase().includes('desechable'))
                .filter(([size]) => !(state.dispenser === 'muro' && size === '5L'))
                .map(([size, p]) => ({
                    size,
                    price: p.price,
                    offerPrice: p.offerPrice,
                    sizeValue: p.sizeValue,
                    unitId: p.unitId,
                    isDisposable: p.isDisposable,
                    unit: p.unit,
                    image: p.image
                }))
        };
    }), [cocktails, state.selections]);

    const wizardCart: ICart = {
        addItem: (id, name, size, price, offer, sizeValue, unitId, isDisposable, image) => updateQuantity(id, size, 1),
        removeItem: (id, size) => {
            const current = state.selections.find(s => s.id === id && s.size === size)?.quantity ?? 0;
            updateQuantity(id, size, -current);
        },
        updateQuantity: (id, size, newQty) => {
            const current = state.selections.find(s => s.id === id && s.size === size)?.quantity ?? 0;
            updateQuantity(id, size, newQty - current);
        },
        getQuantity: (id, size) => state.selections.find(s => s.id === id && s.size === size)?.quantity ?? 0
    };

    const summaryData = wizard.calculateSummaryData();
    const cartItems = summaryData.items.map(item => ({
        productId: item.id,
        productName: item.name,
        size: item.selectedSize,
        quantity: item.quantity,
        price: item.totalNormalPrice / item.quantity,
        offerPrice: item.totalOfferPrice / item.quantity,
        image: item.image
    }));

    const totalItems = state.selections.reduce((sum, s) => sum + s.quantity, 0);

    const guests = state.consumption.guests || 0;
    const drinks = state.consumption.drinksPerPerson || 3;
    const suggestionInfo = useMemo(() => calculateLiveQuoterSuggestion(guests, drinks), [guests, drinks]);
    const recommendedLiters = suggestionInfo ? suggestionInfo.recommendedLiters : 0;
    const suggestionText = suggestionInfo ? suggestionInfo.compactSuggestionText : '';
    const currentLiters = summaryData.totalLiters;
    
    // Calcula el porcentaje de avance respecto a la meta (max 100%)
    const fillPercentage = recommendedLiters > 0 ? Math.min(100, (currentLiters / recommendedLiters) * 100) : 0;
    const isGoalMet = currentLiters >= recommendedLiters && recommendedLiters > 0;
    const minLitersMet = currentLiters >= 10;

    return (
        <div className="flex flex-col pb-32">
            {/* Header Title */}
            <div className="mb-8 text-center md:text-left">
                <p className="text-primary font-black tracking-widest uppercase text-sm mb-2">Paso 2</p>
                <h2 className="text-3xl md:text-4xl font-black text-brand-text">Selecciona tus Cócteles</h2>
            </div>

            {/* Rendimientos Aproximados */}
            <div className="flex flex-col items-center mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-[1px] w-12 sm:w-20 bg-brand-border" />
                    <span className="text-[0.7rem] sm:text-[0.75rem] uppercase font-bold text-brand-text-muted tracking-[2px] text-center">Rendimientos por Formato</span>
                    <div className="h-[1px] w-12 sm:w-20 bg-brand-border" />
                </div>
                
                <div className="flex justify-center flex-wrap gap-4 md:gap-8 w-full max-w-[600px] mx-auto">
                    {[
                        { l: '5L', t: '25', delay: 0 },
                        { l: '10L', t: '50', delay: 0.2 },
                        { l: '20L', t: '100', delay: 0.4 },
                        { l: '30L', t: '150', delay: 0.6 }
                    ]
                    .filter(r => !(state.dispenser === 'muro' && r.l === '5L'))
                    .map((r) => (
                        <div key={r.l} className="flex-1 min-w-[75px] max-w-[110px]">
                            <div 
                                className="w-full aspect-square rounded-full bg-white border-[3px] border-[#F2C999] flex flex-col items-center justify-center p-2 text-center animate-pulse transition-all duration-300 hover:animate-none hover:scale-110 hover:border-primary-dark hover:bg-primary/5 hover:shadow-[0_8px_25px_rgba(226,160,73,0.3)] shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                                style={{ animationDelay: `${r.delay}s`, animationDuration: '3s' }}
                            >
                                <p className="text-[#E2A049] font-black text-[1.1rem] md:text-[1.3rem] leading-none m-0">{r.l}</p>
                                <p className="text-brand-text font-black text-[0.9rem] md:text-[1rem] leading-[1.2] m-0">{r.t}</p>
                                <p className="text-brand-text-muted text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.5px] font-bold m-0 mt-0.5">Cócteles</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Categorías */}
            <CategoryTabs
                categories={categories}
                activeCategory={currentCategory}
                onCategoryChange={handleCategoryChange}
                stickyTop="top-[0px] z-30"
                fullWidth={true}
            />

            {/* Catálogo */}
            <div className="w-full mt-6" ref={catalogRef}>
                <ProductCatalog
                    products={mappedProducts}
                    activeCategory={currentCategory}
                    cart={wizardCart}
                />
            </div>

            {/* Bottom Bar Fija */}
            <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none">
                <div className="max-w-[1400px] mx-auto">
                    <div className="bg-white/90 backdrop-blur-md border border-brand-border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-[0_-5px_30px_rgba(0,0,0,0.1)] pointer-events-auto">
                        
                        <button
                            type="button"
                            onClick={onBack}
                            className="group shrink-0 inline-flex items-center justify-center p-2.5 rounded-xl border-2 border-brand-border text-brand-text-muted transition-all hover:text-primary hover:border-primary/50 bg-white"
                        >
                            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        </button>

                        <div className="flex items-center justify-end flex-1 px-2 sm:px-4">
                            <div className="flex items-center gap-3 sm:gap-5 w-full max-w-lg">
                                {/* Columna 1: Info Base (Espacio dinámico) */}
                                <div className="flex flex-col justify-center flex-1 text-right border-r border-brand-border/60 pr-3 sm:pr-5">
                                    <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-brand-text-muted uppercase tracking-wider leading-none mb-1">
                                        {guests} Inv / {drinks} Tragos
                                    </span>
                                    <span className="text-[0.75rem] sm:text-[0.85rem] font-bold text-primary leading-tight">
                                        Barriles: {suggestionText}
                                    </span>
                                </div>
                                
                                {/* Columna 2: Progreso (Espacio fijo) */}
                                <div className="flex flex-col justify-center shrink-0 w-[70px] sm:w-[90px] text-left">
                                    <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-brand-text-muted uppercase tracking-wider leading-none mb-1">
                                        Volumen
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-[1.1rem] sm:text-[1.3rem] font-black leading-none ${minLitersMet ? (isGoalMet ? 'text-[#25D366]' : 'text-brand-text') : 'text-red-500'}`}>
                                            {currentLiters}
                                        </span>
                                        <span className="text-[0.85rem] sm:text-[0.95rem] font-bold text-brand-text-muted leading-none">
                                            / {recommendedLiters}L
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onOpenCheckout}
                            className="group relative shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-black text-[0.95rem] sm:text-[1rem] transition-all hover:bg-primary-dark shadow-[0_4px_15px_rgba(226,160,73,0.3)]"
                        >
                            <ShoppingCart className="w-5 h-5 transition-transform group-hover:scale-110" />
                            <span className="hidden sm:inline">Cotizar</span>
                            <span className="sm:hidden">Cotizar</span>
                            {totalItems > 0 && (
                                <span className="absolute -top-2 -right-2 bg-brand-text text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[0.7rem] font-extrabold border-2 border-white shadow-sm">
                                    {totalItems}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
