'use client';

import { useState, useRef, useCallback } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/lib/types';
import ProductCatalog from '@/components/catalog/ProductCatalog';
import CartModal from '../catalog/CartModal';

const YIELDS = [
    { liters: '5L', count: 25 },
    { liters: '10L', count: 50 },
    { liters: '20L', count: 100 },
    { liters: '30L', count: 150 },
];

interface Props {
    products: Product[];
    categories: string[];
}

export default function CoctelesSection({ products, categories }: Props) {
    const cart = useCart();
    const [cartOpen, setCartOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('');
    const stickyBarRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    const currentCategory = activeCategory || categories[0] || '';

    const handleCategoryChange = useCallback((cat: string) => {
        setActiveCategory(cat);
        setTimeout(() => {
            if (!gridRef.current) return;
            const stickyH = stickyBarRef.current?.offsetHeight ?? 52;
            const top = gridRef.current.getBoundingClientRect().top + window.scrollY - stickyH - 8;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 50);
    }, []);

    return (
        <section className="py-14 bg-white" id="nuestros-cocteles">
            <div className="max-w-[1200px] mx-auto px-6 pt-14 text-center">
                <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-brand-text">
                    Nuestros Cócteles
                </h2>
                <div className="w-[60px] h-1 bg-gradient-to-r from-primary to-primary-dark rounded-[2px] mx-auto mt-4" />
                <p className="max-w-[800px] mx-auto mt-6 text-brand-text-muted text-[1.1rem]">
                    Preparamos tus mezclas favoritas con ingredientes de primera calidad. Aquí puedes ver los precios y
                    rendimiento aproximado según el formato del barril.
                </p>

                <div className="flex justify-center gap-[clamp(0.75rem,3vw,2rem)] flex-nowrap mt-8 mb-8">
                    {YIELDS.map((y, i) => (
                        <div key={y.liters} className="flex-[0_0_clamp(72px,18vw,130px)]">
                            <div
                                className="w-full aspect-square rounded-full bg-white border-[3px] border-primary flex flex-col items-center justify-center p-2 text-center animate-pulse transition-all duration-250 cursor-default hover:animate-none hover:scale-110 hover:border-primary-dark hover:bg-primary/10 hover:shadow-[0_8px_28px_rgba(226,160,73,0.3)] shadow-[0_4px_16px_rgba(226,160,73,0.18)]"
                                style={{ animationDelay: `${i * 0.6}s` }}
                            >
                                <p className="text-primary font-black text-[clamp(0.9rem,3.5vw,1.5rem)] leading-none m-0">{y.liters}</p>
                                <p className="text-brand-text font-black text-[clamp(0.75rem,3vw,1.05rem)] leading-[1.2] m-0">{y.count}</p>
                                <p className="text-brand-text-muted text-[clamp(0.5rem,1.8vw,0.65rem)] uppercase tracking-[0.5px] font-bold m-0 mt-0.5">Cócteles</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Barra de categorías STICKY */}
            <div className="sticky top-0 z-[89] py-2.5 bg-white/95 backdrop-blur-md border-b border-brand-border/50 shadow-sm" ref={stickyBarRef}>
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="flex items-center gap-4 flex-nowrap overflow-visible">
                        <div className="flex-1 min-w-0 overflow-x-auto flex flex-nowrap gap-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    className={`px-5 py-2.5 rounded-full border-2 font-bold text-[0.9rem] cursor-pointer transition-all whitespace-nowrap ${cat === currentCategory
                                        ? 'bg-primary border-primary text-white shadow-md'
                                        : 'bg-white border-brand-border text-brand-text hover:bg-primary/5 hover:border-primary hover:text-primary'
                                        }`}
                                    onClick={() => handleCategoryChange(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <button
                            className="bg-brand-text text-white border-none rounded-full px-5 py-2.5 flex items-center gap-2 text-[0.9rem] cursor-pointer transition-all hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 shrink-0"
                            onClick={() => setCartOpen(true)}
                        >
                            <ShoppingCart className="w-5 h-5" />

                            {cart.getTotalItems() > 0 && (
                                <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[0.7rem] font-extrabold ml-1 border border-white/20">
                                    {cart.getTotalItems()}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid de productos */}
            <div className="max-w-[1200px] mx-auto px-6 pb-14" ref={gridRef}>
                <ProductCatalog
                    products={products}
                    activeCategory={currentCategory}
                    cart={cart}
                />
            </div>

            <CartModal
                items={cart.items}
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                onUpdateQuantity={cart.updateQuantity}
                onRemove={cart.removeItem}
                onShare={cart.shareViaWhatsApp}
                getTotalPrice={cart.getTotalPrice}
            />
        </section>
    );
}
