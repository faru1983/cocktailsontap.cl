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
    const { cocktails, eventTypes, comunas, categories } = await fetchAllProductData();

    return (
        <main data-page="barriles" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <h1 className="sr-only">Compra Directa de Barriles Desechables - Cocktails on Tap Chile</h1>
            <div className="flex-1">
                {/* Banner de Oferta de Lanzamiento */}
                <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                    <div className="bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 border border-primary/20 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-center gap-3 text-center md:text-left shadow-sm animate-fade-in">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg animate-pulse shrink-0">
                            <span className="text-xl">✨</span>
                        </div>
                        <div>
                            <h4 className="text-primary font-black text-lg md:text-xl leading-tight">
                                Oferta de Lanzamiento
                            </h4>
                            <p className="text-brand-text font-medium text-[0.95rem]">
                                Precios incluyen <span className="font-bold underline decoration-primary decoration-2 underline-offset-2">20% de descuento</span> por tiempo limitado
                            </p>
                        </div>
                    </div>
                </div>

                <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>
                    <CotizarGateway
                        cocktails={cocktails}
                        eventTypes={eventTypes}
                        comunas={comunas}
                        categories={categories}
                        initialServiceType="direct"
                    />
                </Suspense>
            </div>
            <FloatingWhatsapp message="Hola, estoy en la web comprando unos barriles desechables y tengo las siguientes dudas:" />
        </main>
    );
}

