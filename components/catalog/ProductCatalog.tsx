'use client';

import { useState } from 'react';
import type { Product, ICart } from '@/lib/types';
import ProductCard from '@/components/catalog/ProductCard';

interface ProductCatalogProps {
    products: Product[];
    categories?: string[];
    activeCategory: string;
    cart: ICart;
}

export default function ProductCatalog({ products, activeCategory, cart }: ProductCatalogProps) {
    const filtered = products.filter((p) => p.category === activeCategory);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8 items-start w-full mt-4">
            {filtered.map((product) => (
                <ProductCard key={product.id} product={product} cart={cart} />
            ))}
        </div>
    );
}
