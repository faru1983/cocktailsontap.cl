import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CotizarGateway from '@/components/wizard/CotizarGateway';
import { fetchAllProductData } from '@/lib/serverData';

export const metadata: Metadata = {
    title: 'Cotiza tu Evento - Cocktails on Tap Chile',
    description: 'Utiliza nuestra herramienta de auto-cotización para calcular el servicio ideal para tu boda, fiesta o evento corporativo en segundos.',
};

// Server Component: precarga datos en el servidor con caché de 5 minutos.
// Supabase no recibe ninguna llamada desde el browser del cliente.
export default async function CotizarPage() {
    const { cocktails, eventTypes, comunas, regions, categories } = await fetchAllProductData();

    return (
        <main data-page="cotizar" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <h1 className="sr-only">Cotiza tu Evento de Cócteles - Cocktails on Tap Chile</h1>

            <div className="flex-1">
                <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>
                    <CotizarGateway
                        cocktails={cocktails}
                        eventTypes={eventTypes}
                        comunas={comunas}
                        regions={regions}
                        categories={categories}
                    />
                </Suspense>
            </div>
        </main>
    );
}
