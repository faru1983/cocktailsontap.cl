'use client';

import Link from 'next/link';
import type { Product } from '@/lib/types';
import { GlassWater, Leaf, Sparkles } from 'lucide-react';

interface Props {
    products: Product[];
    categories: string[];
}

export default function CoctelesSection({ products, categories }: Props) {
    const menuCategories = categories.filter(c => c.trim().toLowerCase() !== 'otros');

    // Balancear en 2 columnas: Cocktails a la izquierda, Combinados y Mocktails a la derecha
    const leftCategories = menuCategories.filter(c => c.toLowerCase().includes('cocktail') || c.toLowerCase().includes('cóctel'));
    const rightCategories = menuCategories.filter(c => !leftCategories.includes(c));

    const effectiveLeft = leftCategories.length > 0 ? leftCategories : menuCategories.slice(0, 1);
    const effectiveRight = rightCategories.length > 0 ? rightCategories : menuCategories.slice(1);

    const renderCategoryBlock = (category: string) => {
        const categoryProducts = products.filter(p => p.category === category);
        if (categoryProducts.length === 0) return null;

        return (
            <div key={category} className="flex flex-col gap-6">
                <h3 className="text-2xl font-bold text-brand-text border-b-2 border-primary/20 pb-2 inline-block">
                    {category}
                </h3>
                <div className="flex flex-col gap-5">
                    {categoryProducts.map((product) => (
                        <div key={product.id} className="group">
                            <h4 className="text-lg font-bold text-brand-text group-hover:text-primary transition-colors">
                                {product.name}
                            </h4>
                            <p className="text-sm text-brand-text-muted mt-1 leading-relaxed">
                                {product.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <section className="py-20 bg-brand-bg relative overflow-hidden" id="nuestros-cocteles">
            <div className="max-w-[1000px] mx-auto px-6 relative z-10">
                {/* Header Section */}
                <div className="text-center mb-16">
                    <h2 className="text-[clamp(2rem,5vw,3rem)] font-extrabold text-brand-text mb-4">
                        Nuestros Cócteles
                    </h2>
                    <div className="w-[80px] h-1.5 bg-gradient-to-r from-primary to-primary-dark rounded-full mx-auto mb-8" />
                    
                    <p className="max-w-[700px] mx-auto text-brand-text-muted text-[1.1rem] md:text-[1.2rem] leading-relaxed mb-8">
                        Cada uno de nuestros cócteles se prepara de forma artesanal, utilizando 
                        ingredientes frescos, jugos naturales y destilados de primera calidad. 
                        Nuestra receta secreta: dedicación en cada barril para que tú y tus 
                        invitados disfruten de la coctelería perfecta sin esperas.
                    </p>

                    <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-brand-text-muted text-sm font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                            <Leaf className="w-5 h-5 text-primary" />
                            <span>100% Natural</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <GlassWater className="w-5 h-5 text-primary" />
                            <span>Listos para servir</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            <span>Calidad Premium</span>
                        </div>
                    </div>
                </div>

                {/* Menu Layout - 2 Columnas Balanceadas */}
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-16 items-start">
                    <div className="flex flex-col gap-16">
                        {effectiveLeft.map(renderCategoryBlock)}
                    </div>
                    <div className="flex flex-col gap-16">
                        {effectiveRight.map(renderCategoryBlock)}
                    </div>
                </div>

                {/* Call To Action */}
                <div className="mt-20 text-center bg-white rounded-3xl p-10 shadow-sm border border-brand-border">
                    <h3 className="text-2xl font-bold text-brand-text mb-4">¿Listo para celebrar?</h3>
                    <p className="text-brand-text-muted mb-8 max-w-[500px] mx-auto">
                        Cotiza tu evento con Muro de Coctelería o lleva tus barriles desechables para celebraciones más íntimas.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link 
                            href="/eventos"
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                            Cotizar Evento
                        </Link>
                        <Link 
                            href="/barriles"
                            className="bg-brand-dark hover:bg-brand-text text-white font-bold py-4 px-8 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                            Comprar Barriles
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

