'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, ChevronDown } from 'lucide-react';

export default function HeroSection() {

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden" id="inicio">
            <div className="absolute inset-0 bg-[#1a1a2e] after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-b after:from-black/40 after:to-black/60">
                <video autoPlay muted loop playsInline poster="/assets/hero-bg.webp"
                    className="w-full h-full object-cover">
                    <source src="/assets/hero-bg.webm" type="video/webm" />
                </video>
            </div>

            <div className="max-w-[1200px] w-full mx-auto px-6 relative z-10 text-center py-8 flex flex-col items-center">
                <div className={`transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col items-center w-full ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/logo.webp"
                        alt="Cocktails on Tap Logo"
                        className="max-w-[160px] md:max-w-[200px] mb-6 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]"
                    />
                    <h1 className="text-white text-[clamp(2rem,5vw,3.5rem)] font-extrabold mb-4">
                        Cocktails on Tap
                    </h1>
                    <p className="text-white/90 text-[1rem] md:text-[1.25rem] mb-10 max-w-2xl mx-auto">
                        Somos el primer Bar Móvil Autoservicio para Eventos. Instalamos una estación de
                        coctelería completa para que tus invitados se sirvan solos. Tú eliges los cócteles,
                        nosotros nos encargamos de todo.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link href="/cotizar" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[1.1rem] px-8 py-4 rounded-full shadow-[0_4px_15px_rgba(226,160,73,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(226,160,73,0.4)] hover:brightness-110">
                            <Calculator className="w-5 h-5" /> Cotizar Ahora
                        </Link>

                    </div>
                </div>

                <div className={`mt-12 transition-all duration-1000 delay-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <a href="#instagram" className="inline-flex flex-col items-center justify-center text-white/60 hover:text-white transition-colors gap-2">
                        <div className="w-5 h-8 border-2 border-current rounded-full relative flex justify-center py-1.5">
                            <div className="w-1 h-1.5 bg-current rounded-full animate-scroll-mouse" />
                        </div>
                        <ChevronDown className="w-4 h-4 animate-bounce opacity-50" />

                    </a>
                </div>
            </div>
        </section>
    );
}
