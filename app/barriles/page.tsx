import type { Metadata } from 'next';
import CotizarGateway from '@/components/wizard/CotizarGateway';
import { fetchAllProductData } from '@/lib/serverData';

export const metadata: Metadata = {
    title: 'Compra Directa - Cocktails on Tap Chile',
    description: 'Barriles desechables de 5 Litros. Formato delivery listo para servir, sin retorno de equipos.',
};

export default async function BarrilesPage() {
    const { cocktails, eventTypes, comunas, categories } = await fetchAllProductData();

    return (
        <main data-page="barriles" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <div className="flex-1">
                <CotizarGateway
                    cocktails={cocktails}
                    eventTypes={eventTypes}
                    comunas={comunas}
                    categories={categories}
                    initialServiceType="direct"
                />
            </div>
        </main>
    );
}
