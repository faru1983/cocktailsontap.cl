import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WizardShell from '@/components/wizard/WizardShell';
import { fetchAllProductData } from '@/lib/serverData';

export const metadata: Metadata = {
    title: 'Cotiza tu Evento - Cocktails on Tap Chile',
    description: 'Utiliza nuestra herramienta de auto-cotización para calcular el servicio ideal para tu boda, fiesta o evento corporativo en segundos.',
};

// Server Component: precarga datos en el servidor con caché de 5 minutos.
// Supabase no recibe ninguna llamada desde el browser del cliente.
export default async function CotizarPage() {
    const { cocktails, eventTypes, comunas, categories } = await fetchAllProductData();

    return (
        <main data-page="cotizar" className="min-h-screen bg-brand-bg relative flex flex-col pt-8 md:pt-12">
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <Link
                    href="/"
                    className="group inline-flex items-center gap-3 text-brand-text-muted no-underline font-semibold text-[0.95rem] transition-all hover:text-primary"
                >
                    <div className="p-2.5 rounded-full bg-white border border-brand-border group-hover:border-primary/30 group-hover:bg-primary/5 transition-all shadow-sm group-hover:shadow-md">
                        <ArrowLeft className="w-4 h-4 text-brand-text-muted group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
                    </div>
                    <span className="border-b border-transparent group-hover:border-primary/30 pb-0.5">Volver al inicio</span>
                </Link>
            </div>

            <div className="flex-1">
                <WizardShell
                    cocktails={cocktails}
                    eventTypes={eventTypes}
                    comunas={comunas}
                    categories={categories}
                />
            </div>
        </main>
    );
}
