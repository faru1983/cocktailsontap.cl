import type { Metadata } from 'next';
import { fetchAllProductData } from '@/lib/serverData';
import EventosAdsLanding from '@/components/landing/EventosAdsLanding';

export const metadata: Metadata = {
    title: 'Barra Móvil de Cócteles en Barril para Eventos | Cocktails on Tap',
    description: 'Estación de cócteles autoservicio para matrimonios, cumpleaños y empresas en Chile. Hielo, copas, garnish y accesorios incluidos a $0.',
    openGraph: {
        title: 'Barra Móvil de Cócteles Autoservicio | Cocktails on Tap Chile',
        description: 'Tus invitados se sirven solos cócteles clásicos en 5 segundos. Hielo, vasos y garnish incluidos a $0 sin límite de horario.',
        images: ['/assets/hero-bg.webp'],
    },
};

export default async function EventosLandingPage() {
    const { cocktails, comunas, regions, eventTypes } = await fetchAllProductData();

    return (
        <EventosAdsLanding
            cocktails={cocktails}
            comunas={comunas}
            regions={regions}
            eventTypes={eventTypes}
        />
    );
}
