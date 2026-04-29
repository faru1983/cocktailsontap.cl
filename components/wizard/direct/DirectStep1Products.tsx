'use client';

import { useRef, useMemo, useState } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { CocktailForWizard, Product, ICart } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import CategoryTabs from '../../ui/CategoryTabs';
import CartModal from '@/components/catalog/CartModal';
import { Box, Plus, ShoppingCart } from 'lucide-react';

type WizardHook = ReturnType<typeof useWizard>;

interface Props {
    wizard: WizardHook;
    cocktails: CocktailForWizard[];
    categories: string[];
}

export default function DirectStep1Products({ wizard, cocktails, categories }: Props) {
    const { state, updateQuantity, toggleCategory, goToStep } = wizard;
    const [cartOpen, setCartOpen] = useState(false);

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

    // 1. Mapeamos CocktailForWizard a Product con useMemo para rendimiento (Solo desechables 5L)
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
                .filter(([_, p]) => p.isDisposable || c.category === 'Otros') // Permitir Otros o productos desechables
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
            <h3 className="text-2xl font-extrabold text-brand-text mb-2">1. Barriles Desechables (5L)</h3>
            
            {currentCategory === 'Otros' ? (
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200 mb-8 flex gap-4 items-start shadow-sm animate-fade-in">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Plus className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-[0.95rem] text-brand-text-muted leading-relaxed">
                        <p className="mb-2"><strong className="text-blue-700 font-bold">¡Complementa tu pedido!</strong> Aquí encontrarás hielo y decoraciones para tus cócteles.</p>
                        <p>Asegúrate de tener todo lo necesario para disfrutar la mejor experiencia.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-[#fffbf0] rounded-2xl p-5 border border-primary/20 mb-8 flex gap-4 items-start shadow-sm">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Box className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-[0.95rem] text-brand-text-muted leading-relaxed">
                        <p className="mb-2">Nuestros barriles desechables de 5L rinden <strong className="text-primary font-bold">25 cócteles (aprox)</strong> cada uno.</p>
                        <p>Son de un solo uso, <strong className="text-brand-text">no requieren retorno ni máquina dispensadora</strong>, incluyen una válvula dosificadora (solo enfría y sirve).</p>
                    </div>
                </div>
            )}

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
                    goToStep(2);
                }}
            />
        </div>
    );
}
