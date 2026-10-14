import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchAllProductData } from '@/lib/serverData';
import { slugifyProductName, getProductEnrichedInfo } from '@/lib/productDetails';
import ProductDetailView from '@/components/products/ProductDetailView';
import FloatingWhatsapp from '@/components/shared/FloatingWhatsapp';
import { SITE_URL } from '@/lib/config';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { products } = await fetchAllProductData();
    
    const product = products.find(p => slugifyProductName(p.name) === slug || p.id === slug);
    if (!product) return {};

    const enriched = getProductEnrichedInfo(product.name, product.category);
    const headline = product.pdp_metadata?.headline?.trim() || enriched.headline;
    const disposableSize = product.sizes.find(s => s.isDisposable);
    const price5L = disposableSize?.offerPrice || product.sizes[0]?.offerPrice || 44990;
    const productImage = disposableSize?.image || product.image;
    const title = `${product.name} (Barril 5L) - Cocktails on Tap Chile`;
    const description = `${headline} Barril desechable de 5L de ${product.name}. Rinde 25 cócteles listos para servir ($${price5L.toLocaleString('es-CL')}). Grifo integrado, sin retorno de equipos. Despacho en Santiago y regiones.`;
    const canonicalUrl = `${SITE_URL}/barriles/${slug}`;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: 'Cocktails on Tap Chile',
            images: [
                {
                    url: productImage,
                    width: 800,
                    height: 800,
                    alt: `Barril de 5L ${product.name}`,
                },
            ],
            locale: 'es_CL',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [productImage],
        },
    };
}

export default async function ProductDetailPage({ params }: Props) {
    const { slug } = await params;
    const { products } = await fetchAllProductData();

    // Buscar producto por slug o por ID
    const product = products.find(p => slugifyProductName(p.name) === slug || p.id === slug);
    if (!product) {
        notFound();
    }

    // Filtrar complementos (categoría Otros)
    const availableAddons = products.filter(p => p.category === 'Otros');

    // Filtrar productos relacionados (misma categoría o cócteles, excluyendo el actual y Otros)
    const relatedProducts = products
        .filter(p => p.id !== product.id && p.category !== 'Otros')
        .sort((a, b) => {
            if (a.category === product.category && b.category !== product.category) return -1;
            if (a.category !== product.category && b.category === product.category) return 1;
            return 0;
        });

    const disposableSize = product.sizes.find(s => s.isDisposable);
    const priceValue = disposableSize ? disposableSize.offerPrice : (product.sizes[0]?.offerPrice || 44990);
    const productImage = disposableSize?.image || product.image;

    // JSON-LD para Google Rich Snippets (Schema.org Product)
    const schemaJson = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: `Barril 5L ${product.name}`,
        image: [productImage],
        description: product.pdp_metadata?.commercial_desc || product.description,
        sku: `KEG-5L-${slug.toUpperCase()}`,
        brand: {
            '@type': 'Brand',
            name: 'Cocktails on Tap Chile'
        },
        offers: {
            '@type': 'Offer',
            url: `${SITE_URL}/barriles/${slug}`,
            priceCurrency: 'CLP',
            price: priceValue.toString(),
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition'
        }
    };

    return (
        <main className="min-h-screen bg-brand-bg relative flex flex-col pt-6 md:pt-10 pb-20">
            {/* Schema.org Product Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }}
            />

            <ProductDetailView
                product={product}
                relatedProducts={relatedProducts}
                availableAddons={availableAddons}
            />

            <FloatingWhatsapp
                message={`Hola, estoy en la web viendo el barril de 5L de ${product.name} y tengo unas dudas:`}
            />
        </main>
    );
}
