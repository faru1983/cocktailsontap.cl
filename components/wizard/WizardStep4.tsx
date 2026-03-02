'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { calculateSmartConfig } from '@/hooks/useWizard';
import type { useWizard } from '@/hooks/useWizard';
import type { CocktailForWizard, Product, ICart } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';

type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    categories: string[];
}

export default function WizardStep4({ wizard, cocktails, categories }: Props) {
    const { state, updateQuantity, toggleCategory } = wizard;
    const { liters: suggestedLiters } = calculateSmartConfig(state.consumption.guests * state.consumption.drinksPerPerson);

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
    const mappedProducts: Product[] = useMemo(() => cocktails.map(c => ({
        id: c.id,
        name: c.name,
        description: c.desc,
        image: c.image,
        category: c.category,
        sizes: Object.entries(c.prices).map(([size, p]) => ({
            size,
            price: p.price,
            offerPrice: p.offerPrice
        }))
    })), [cocktails]);

    // 2. Objeto de "carrito" adaptado al Wizard
    const wizardCart: ICart = {
        addItem: (id, name, size, price, offer) => updateQuantity(id, size, 1),
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

    return (
        <div className="flex flex-col">
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">4. Selección de Cócteles</h3>
            <p className="text-brand-text-muted text-[0.95rem] mb-8 leading-relaxed">Elige las variedades y tamaños que prefieras para tu evento.</p>

            <div className="mb-8">
                <div className="text-center mb-6">
                    <span className="text-[0.85rem] uppercase text-primary font-extrabold tracking-[1px]">Sugerencia de Volumen</span>
                    <div className="text-[1.5rem] font-black text-brand-text mt-1">{suggestedLiters} Litros Totales</div>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-[#f8fafc] p-5 rounded-2xl border border-[#edf2f7]">
                    {[{ l: '5L', t: '25 cócteles' }, { l: '10L', t: '50 cócteles' }, { l: '20L', t: '100 cócteles' }, { l: '30L', t: '150 cócteles' }].map((r, i) => (
                        <div key={r.l} className={`text-center ${i % 2 === 1 ? 'border-l border-[#e2e8f0]' : ''} ${i >= 2 ? 'border-t border-[#e2e8f0] pt-3' : ''}`}>
                            <div className="font-extrabold text-primary text-[1.1rem]">{r.l}</div>
                            <div className="text-[0.75rem] text-brand-text-muted uppercase font-bold tracking-wider">{r.t}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Barra de categorías */}
            <div className="sticky top-[-1px] bg-white z-10 -mx-6 mb-6 px-6 py-3 border-b border-brand-border">
                <div className="flex justify-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                className={`px-5 py-2.5 rounded-full font-bold text-[0.95rem] whitespace-nowrap transition-all duration-300 border-2 cursor-pointer
                                    ${cat === currentCategory
                                        ? 'bg-gradient-to-r from-primary to-primary-dark border-primary text-white shadow-[0_4px_15px_rgba(226,160,73,0.3)] shadow-primary/30'
                                        : 'bg-white border-brand-border text-brand-text hover:border-primary/50 hover:bg-[#fffbf0]'
                                    }`}
                                onClick={() => handleCategoryChange(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Catálogo de productos */}
            <div className="w-full" ref={catalogRef}>
                <ProductCatalog
                    products={mappedProducts}
                    activeCategory={currentCategory}
                    cart={wizardCart}
                />
            </div>
        </div>
    );
}
