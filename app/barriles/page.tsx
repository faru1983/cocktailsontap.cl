import { Suspense } from 'react';
import type { Metadata } from 'next';
import CotizarGateway from '@/components/wizard/CotizarGateway';
import { fetchAllProductData } from '@/lib/serverData';
import FloatingWhatsapp from '@/components/shared/FloatingWhatsapp';

export const metadata: Metadata = {
    title: 'Compra Directa - Cocktails on Tap Chile',
    description: 'Barriles desechables de 5 Litros. Formato delivery listo para servir, sin retorno de equipos.',
};

export default async function BarrilesPage() {
    const { cocktails, eventTypes, comunas, regions, categories } = await fetchAllProductData();

    return (
        <main data-page="barriles" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <h1 className="sr-only">Compra Directa de Barriles Desechables - Cocktails on Tap Chile</h1>
            <div className="flex-1">
                <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>
                    <CotizarGateway
                        cocktails={cocktails}
                        eventTypes={eventTypes}
                        comunas={comunas}
                        regions={regions}
                        categories={categories}
                        initialServiceType="direct"
                    />
                </Suspense>
            </div>
            <FloatingWhatsapp message="Hola, estoy en la web comprando unos barriles desechables y tengo las siguientes dudas:" />
        </main>
    );
}

