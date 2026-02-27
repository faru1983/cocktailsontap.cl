import Carousel from '@/components/Carousel';

const STEPS = [
    { bgImage: '/assets/pasos_1.webp', badge: 'Paso 1', title: 'Hielo a Tope', description: 'Completa tu vaso o copa con mucho hielo. ¡Mientras más, mejor!' },
    { bgImage: '/assets/pasos_2.webp', badge: 'Paso 2', title: 'Tira la Canilla', description: 'Elige tu cóctel favorito y sirve hasta completar el vaso.' },
    { bgImage: '/assets/pasos_3.webp', badge: 'Paso 3', title: 'Decora', description: 'Dale el toque final con nuestro garnish deshidratado.' },
    { bgImage: '/assets/pasos_4.webp', badge: 'Paso 4', title: 'Disfruta', description: '¡Salud! Ya tienes un cóctel profesional en segundos.' },
];

export default function StepsSection() {
    return (
        <section className="py-14 bg-brand-bg" id="como-funciona">
            <div className="max-w-[1200px] mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-brand-text">
                        Disfruta en 4 Simples Pasos
                    </h2>
                    <div className="w-[60px] h-1 bg-gradient-to-r from-primary to-primary-dark rounded-[2px] mx-auto mt-4" />
                    <p className="max-w-[800px] mx-auto mt-6 text-brand-text-muted text-[1.1rem]">
                        La magia está en la producción previa. Preparamos tu cóctel favorito con un proceso especial
                        y lo almacenamos en barriles de acero inoxidable. Luego solo se conecta a nuestros dispensadores y, en 4
                        simples pasos, disfrutas un cóctel perfectamente preparado, con la calidad de los mejores bares.
                    </p>
                </div>
                <Carousel items={STEPS} />
            </div>
        </section>
    );
}
