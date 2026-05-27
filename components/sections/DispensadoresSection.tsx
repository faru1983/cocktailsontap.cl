import Carousel from '@/components/shared/Carousel';

const DISPENSADORES = [
    { bgImage: '/assets/dispensador3.webp', title: 'Dispensador Portátil', description: 'Ideal para eventos simples, sin necesidad de energía eléctrica y adaptable a cualquier espacio.' },
    { bgImage: '/assets/dispensador1.webp', title: '2 Salidas Simultáneas', description: 'Capacidad hasta 20L. 2 salidas simultáneas. Compatible con barriles de 5 y 10 litros.' },
    { bgImage: '/assets/dispensador2.webp', title: 'Muro de Coctelería', description: 'Opción decorativa y elegante para matrimonios y eventos corporativos de gran escala.' },
    { bgImage: '/assets/dispensador4.webp', title: 'Alta Convocatoria', description: 'Compatible con barriles de 10, 20 y 30 litros. Opcional personalización de vasos y copas.' },
];

export default function DispensadoresSection() {
    return (
        <section className="py-14 bg-white" id="dispensadores">
            <div className="max-w-[1200px] mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-brand-text">
                        Nuestros Dispensadores
                    </h2>
                    <div className="w-[60px] h-1 bg-gradient-to-r from-primary to-primary-dark rounded-[2px] mx-auto mt-4" />
                    <p className="max-w-[800px] mx-auto mt-6 text-brand-text-muted text-[1.1rem]">
                        Contamos con dos tipos de dispensadores: un sistema portátil, ideal para eventos simples y adaptable
                        a cualquier espacio, y un Muro de Coctelería, decorativo y elegante, perfecto para matrimonios,
                        eventos corporativos y celebraciones de gran escala, con opción de personalización.
                    </p>
                </div>
                <Carousel items={DISPENSADORES} />
            </div>
        </section>
    );
}
