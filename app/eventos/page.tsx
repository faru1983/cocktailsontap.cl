import { Suspense } from 'react';
import type { Metadata } from 'next';
import CotizarGateway from '@/components/wizard/CotizarGateway';
import { fetchAllProductData } from '@/lib/serverData';
import FloatingWhatsapp from '@/components/shared/FloatingWhatsapp';

export const metadata: Metadata = {
    title: 'Cotiza tu Evento - Cocktails on Tap Chile',
    description: 'Calcula el servicio ideal para tu boda, fiesta o evento corporativo en segundos.',
};

export default async function EventosPage() {
    const { cocktails, eventTypes, comunas, regions, categories } = await fetchAllProductData();

    return (
        <main data-page="eventos" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <h1 className="sr-only">Cotizar Servicio de Eventos con Barra Móvil - Cocktails on Tap Chile</h1>
            <div className="flex-1">
                <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>
                    <CotizarGateway
                        cocktails={cocktails}
                        eventTypes={eventTypes}
                        comunas={comunas}
                        regions={regions}
                        categories={categories}
                        initialServiceType="event"
                    />
                </Suspense>
            </div>
            <FloatingWhatsapp message="Hola, estoy cotizando un evento y tengo las siguientes dudas:" />
        </main>
    );
}

