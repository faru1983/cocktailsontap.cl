'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronRight, Mail, Globe, Instagram, Facebook } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons';
import { SITE_URL, WHATSAPP_URL, WHATSAPP_LABEL } from '@/lib/config';


export default function Footer() {
    const pathname = usePathname();
    if (pathname?.startsWith('/admin')) return null;

    return (
        <footer className="bg-[#0d1117] text-white/80 pt-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Grid principal */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-16 text-center md:text-left">
                    {/* Columna 1 — Logo + descripción */}
                    <div className="flex flex-col items-center md:items-start">
                        <Image
                            src="/assets/logo.webp"
                            alt="Cocktails On Tap Logo"
                            width={160}
                            height={80}
                            className="w-[140px] md:w-[160px] h-auto mb-6 brightness-0 invert opacity-100"
                        />
                        <p className="text-[0.9rem] leading-[1.65] text-white/50 max-w-[280px]">
                            Revolucionamos la forma de disfrutar cócteles en eventos con nuestro innovador sistema de autoservicio.
                        </p>
                    </div>

                    {/* Columna 2 — Navegación */}
                    <div className="flex flex-col items-center md:items-start transition-all">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Navegación</h4>
                        <ul className="flex flex-col gap-3 mt-2">
                            {[
                                ['/#inicio', 'Inicio'],
                                ['/#instagram', 'Nosotros'],
                                ['/#como-funciona', 'Cómo Funciona'],
                                ['/#dispensadores', 'Dispensadores'],
                                ['/#que-incluye', 'Qué Incluye'],
                                ['/#nuestros-cocteles', 'Cócteles'],
                                ['/cotizar', 'Cotizar Ahora'],
                            ].map(([href, label]) => (
                                <li key={href}>
                                    <a href={href} className="flex items-center justify-center md:justify-start gap-2 text-[0.95rem] text-white/50 transition-colors duration-200 hover:text-primary group">
                                        <ChevronRight className="text-primary w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /> {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Columna 3 — Contacto */}
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Contacto</h4>
                        <div className="flex flex-col gap-5 mt-4">
                            <a href="mailto:contacto@cocktailsontap.cl" className="flex items-center justify-center md:justify-start gap-3 text-white/60 text-[0.95rem] transition-colors duration-200 hover:text-white group">
                                <Mail className="text-primary w-[20px] h-[20px] shrink-0" />
                                <span className="group-hover:text-primary transition-colors">contacto@cocktailsontap.cl</span>
                            </a>
                            <a
                                href={`${WHATSAPP_URL}?text=Hola,%20estoy%20escribiendo%20desde%20su%20pagina%20web!`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center md:justify-start gap-3 text-white/60 text-[0.95rem] transition-colors duration-200 hover:text-white group"
                            >
                                <WhatsappIcon className="text-primary w-[20px] h-[20px] shrink-0" />
                                <span className="group-hover:text-primary transition-colors">{WHATSAPP_LABEL}</span>
                            </a>
                        </div>
                    </div>

                    {/* Columna 4 — Redes sociales */}
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Síguenos</h4>
                        <div className="flex justify-center md:justify-start gap-3 mt-4">
                            <a href="https://instagram.com/cocktailsontap.chile" className="w-12 h-12 rounded-[12px] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white/80 transition-all duration-300 hover:bg-primary hover:border-primary hover:text-white hover:-translate-y-[3px] hover:shadow-[0_4px_12px_rgba(226,160,73,0.3)]" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <Instagram className="w-5 h-5" />
                            </a>
                            <a href="https://facebook.com/CocktailsOnTapCL" className="w-12 h-12 rounded-[12px] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white/80 transition-all duration-300 hover:bg-primary hover:border-primary hover:text-white hover:-translate-y-[3px] hover:shadow-[0_4px_12px_rgba(226,160,73,0.3)]" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href={`${SITE_URL}/`} className="w-12 h-12 rounded-[12px] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white/80 transition-all duration-300 hover:bg-primary hover:border-primary hover:text-white hover:-translate-y-[3px] hover:shadow-[0_4px_12px_rgba(226,160,73,0.3)]" target="_blank" rel="noopener noreferrer" aria-label="Sitio web">
                                <Globe className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Línea divisoria + copyright */}
                <div className="border-t border-white/5 py-10 flex flex-col items-center justify-center gap-2 text-[0.85rem] text-white/40 text-center">
                    <p>© 2026 Cocktails On Tap Chile. Todos los derechos reservados.</p>
                    <p>
                        Sitio desarrollado por{' '}
                        <a href="https://wa.me/56966755025?text=Me%20interesa%20cotizar%20el%20dise%C3%B1o%20de%20una%20pagina%20web!" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            FaRu
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}



