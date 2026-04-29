'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, ShoppingCart } from 'lucide-react';
import { calculateSmartConfig } from '@/hooks/useWizard';
import type { useWizard } from '@/hooks/useWizard';
import type { Product, CocktailForWizard, ICart, ProductPrice } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import CategoryTabs from '../ui/CategoryTabs';
import CartModal from '@/components/catalog/CartModal';

type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    categories: string[];
}

export default function WizardStep3({ wizard, cocktails, categories }: Props) {
    const { state, updateQuantity, toggleCategory, goToStep } = wizard;
    const [cartOpen, setCartOpen] = useState(false);
    const { config: suggestedConfig, liters: suggestedLiters } = calculateSmartConfig(state.consumption.guests, state.consumption.drinksPerPerson);

    // Mantenemos la categoría activa del wizard o la primera disponible
    const currentCategory = state.expandedCategoryId || categories[0] || '';
    const catalogRef = useRef<HTMLDivElement>(null);

    // Función para cambiar de categoría y hacer scroll manual al catálogo
    const handleCategoryChange = (cat: string) => {
        if (cat === currentCategory) return;

        toggleCategory(cat);

        // Hacemos el scroll manual solo cuando el usuario selecciona una categoría
        if (catalogRef.current) {
            const navbarHeight = 85;
            const elementPosition = catalogRef.current.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - navbarHeight;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    // 1. Mapeamos CocktailForWizard a Product con useMemo para rendimiento
    const mappedProducts: Product[] = useMemo(() => cocktails.map(c => {
        // Encontramos si ya hay una selección de este cóctel para marcar el tamaño por defecto
        const existingSelection = state.selections.find(s => s.id === c.id);

        return {
            id: c.id,
            name: c.name,
            description: c.desc,
            image: c.image,
            category: c.category,
            selectedSize: existingSelection?.size, // Esto recordará el último tamaño del carrito
            sizes: Object.entries(c.prices)
                .filter(([size]) => !size.toLowerCase().includes('desechable'))
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

    // 2. Objeto de "carrito" adaptado al Wizard
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

    // 3. Mapeo para el CartModal (que espera CartItem[])
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

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">3. Selección de Cócteles</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Elige las variedades y tamaños que prefieras para tu evento.</p>

            {/* Sección de Sugerencia y Rendimientos Rediseñada */}
            <div className="mb-10 space-y-10">
                {/* Cuadro de Sugerencia Premium */}
                <div className="relative group overflow-hidden bg-gradient-to-br from-brand-text/5 to-primary/5 border-2 border-primary/20 rounded-[28px] p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/40">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
                    <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-brand-text/5 rounded-full blur-3xl" />
                    
                    <div className="relative z-1 flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-primary/20 shadow-sm mb-4">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-[0.75rem] uppercase text-primary font-black tracking-widest">Sugerencia del Experto</span>
                        </div>

                        <p className="text-brand-text-muted text-[0.85rem] font-black uppercase tracking-widest mb-2 opacity-80">
                            Para {state.consumption.guests} invitados · {state.consumption.drinksPerPerson} tragos p/p
                        </p>
                        
                        <div className="text-[1.8rem] md:text-[2.2rem] font-black text-brand-text leading-[1.1] mb-2 text-balance">
                            {suggestedConfig}
                        </div>
                        
                        <div className="flex items-center gap-2 text-brand-text-muted font-bold text-[1rem]">
                            <div className="w-8 h-[2px] bg-primary/30" />
                            <span>Volumen Total: {suggestedLiters}L</span>
                            <div className="w-8 h-[2px] bg-primary/30" />
                        </div>
                    </div>
                </div>

                {/* Rendimientos Aproximados Estilo Landing */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-[1px] w-12 bg-brand-border" />
                        <span className="text-[0.75rem] uppercase font-bold text-brand-text-muted tracking-[2px]">Rendimientos por Formato</span>
                        <div className="h-[1px] w-12 bg-brand-border" />
                    </div>
                    
                    <div className="flex justify-center flex-wrap gap-4 md:gap-8 w-full max-w-[600px] mx-auto">
                        {[
                            { l: '5L', t: '25', delay: 0 },
                            { l: '10L', t: '50', delay: 0.2 },
                            { l: '20L', t: '100', delay: 0.4 },
                            { l: '30L', t: '150', delay: 0.6 }
                        ].map((r) => (
                            <div key={r.l} className="flex-1 min-w-[75px] max-w-[110px]">
                                <div 
                                    className="w-full aspect-square rounded-full bg-white border-[3px] border-primary flex flex-col items-center justify-center p-2 text-center animate-pulse transition-all duration-300 hover:animate-none hover:scale-110 hover:border-primary-dark hover:bg-primary/10 hover:shadow-[0_8px_25px_rgba(226,160,73,0.3)] shadow-[0_4px_12px_rgba(226,160,73,0.15)]"
                                    style={{ animationDelay: `${r.delay}s` }}
                                >
                                    <p className="text-primary font-black text-[1.1rem] md:text-[1.3rem] leading-none m-0">{r.l}</p>
                                    <p className="text-brand-text font-black text-[0.9rem] md:text-[1rem] leading-[1.2] m-0">{r.t}</p>
                                    <p className="text-brand-text-muted text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.5px] font-bold m-0 mt-0.5">Cócteles</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Barra de categorías shared */}
            <CategoryTabs
                categories={categories}
                activeCategory={currentCategory}
                onCategoryChange={handleCategoryChange}
                stickyTop="top-[-1px]"
                fullWidth={true}
            >
                <button
                    type="button"
                    className="bg-brand-text text-white border-none rounded-full px-5 py-2.5 flex items-center gap-2 text-[0.9rem] cursor-pointer transition-all hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 shrink-0 relative"
                    onClick={() => setCartOpen(true)}
                >
                    <ShoppingCart className="w-5 h-5" />
                    {totalItems > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[0.7rem] font-extrabold border-2 border-white shadow-sm">
                            {totalItems}
                        </span>
                    )}
                </button>
            </CategoryTabs>

            {/* Catálogo de productos */}
            <div className="w-full" ref={catalogRef}>
                <ProductCatalog
                    products={mappedProducts}
                    activeCategory={currentCategory}
                    cart={wizardCart}
                />
            </div>

            <CartModal
                items={cartItems as any}
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                onUpdateQuantity={(id, size, newQty) => {
                    const current = state.selections.find(s => s.id === id && s.size === size)?.quantity ?? 0;
                    updateQuantity(id, size, newQty - current);
                }}
                onRemove={(id, size) => {
                    const current = state.selections.find(s => s.id === id && s.size === size)?.quantity ?? 0;
                    updateQuantity(id, size, -current);
                }}
                getTotalPrice={() => summaryData.totalPrice - (summaryData.shippingCost || 0)}
                ctaLabel="Confirmar selección"
                onCtaClick={() => {
                    setCartOpen(false);
                    goToStep(4);
                }}
            />
        </div>
    );
}
