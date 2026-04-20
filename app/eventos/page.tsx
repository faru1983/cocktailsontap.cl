import type { Metadata } from 'next';
import CotizarGateway from '@/components/wizard/CotizarGateway';
import { fetchAllProductData } from '@/lib/serverData';

export const metadata: Metadata = {
    title: 'Cotiza tu Evento - Cocktails on Tap Chile',
    description: 'Calcula el servicio ideal para tu boda, fiesta o evento corporativo en segundos.',
};

export default async function EventosPage() {
    const { cocktails, eventTypes, comunas, categories } = await fetchAllProductData();

    return (
        <main data-page="eventos" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <div className="flex-1">
                <CotizarGateway
                    cocktails={cocktails}
                    eventTypes={eventTypes}
                    comunas={comunas}
                    categories={categories}
                    initialServiceType="event"
                />
            </div>
        </main>
    );
}
