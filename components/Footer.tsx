import { WHATSAPP_URL, WHATSAPP_LABEL } from '@/lib/config';
import { Mail, Phone, Instagram, Facebook } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="relative bg-[#0a0a0a] pt-20 pb-10 overflow-hidden">
            {/* Gradientes de fondo */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] translate-y-1/2" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Marca */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                        <Link href="/" className="inline-block mb-6 group">
                            <span className="text-2xl font-black tracking-tighter text-white">
                                COCKTAILS <span className="text-primary italic">ON TAP</span>
                            </span>
                        </Link>
                        <p className="text-white/50 text-[0.95rem] leading-relaxed max-w-xs">
                            Llevamos la mejor coctelería premium directamente a tu evento. Barriles de 5L a 30L listos para servir.
                        </p>
                        <div className="flex gap-4 mt-8">
                            <a href="https://instagram.com/cocktailsontap.cl" target="_blank" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-primary hover:text-white transition-all duration-300">
                                <Instagram size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-primary hover:text-white transition-all duration-300">
                                <Facebook size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Enlaces Rápidos */}
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Navegación</h4>
                        <ul className="flex flex-col gap-4 mt-4">
                            <li><Link href="/" className="text-white/60 hover:text-primary transition-colors text-[0.95rem]">Inicio</Link></li>
                            <li><Link href="/cotizar" className="text-white/60 hover:text-primary transition-colors text-[0.95rem]">Cotizar Evento</Link></li>
                            <li><Link href="/tienda" className="text-white/60 hover:text-primary transition-colors text-[0.95rem]">Venta Directa</Link></li>
                            <li><Link href="/admin" className="text-white/60 hover:text-primary transition-colors text-[0.95rem]">Panel Admin</Link></li>
                        </ul>
                    </div>

                    {/* Contacto */}
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Contacto</h4>
                        <div className="flex flex-col gap-5 mt-4">
                            <a href="mailto:contacto@cocktailsontap.cl" className="flex items-center justify-center md:justify-start gap-3 text-white/60 text-[0.95rem] transition-colors duration-200 hover:text-white group">
                                <Mail className="text-primary w-[20px] h-[20px] shrink-0" />
                                <span className="group-hover:text-primary transition-colors">contacto@cocktailsontap.cl</span>
                            </a>
                            <a 
                                href={`${WHATSAPP_URL}?text=Hola,%20estoy%20escribiendo%20desde%20su%20pagina%20web!`}
                                target="_blank"
                                className="flex items-center justify-center md:justify-start gap-3 text-white/60 text-[0.95rem] transition-colors duration-200 hover:text-white group"
                            >
                                <Phone className="text-primary w-[20px] h-[20px] shrink-0" />
                                <span className="group-hover:text-primary transition-colors">{WHATSAPP_LABEL}</span>
                            </a>
                        </div>
                    </div>

                    {/* Newsletter / CTA */}
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-[1.1rem] text-white mb-6 pb-[0.4rem] border-b-[3px] border-primary inline-block tracking-[0.5px]">Premium</h4>
                        <p className="text-white/50 text-[0.85rem] mt-4 mb-6 leading-relaxed">
                            Suscríbete para recibir ofertas exclusivas y nuevos lanzamientos.
                        </p>
                        <div className="flex w-full max-w-[240px]">
                            <input 
                                type="email" 
                                placeholder="Tu email..." 
                                className="w-full bg-white/5 border border-white/10 rounded-l-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-r-xl transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-white/30 text-xs tracking-wider">
                        © {year} COCKTAILS ON TAP. TODOS LOS DERECHOS RESERVADOS.
                    </p>
                    <div className="flex gap-8">
                        <Link href="/terminos" className="text-white/30 hover:text-white/60 text-xs transition-colors">Términos</Link>
                        <Link href="/privacidad" className="text-white/30 hover:text-white/60 text-xs transition-colors">Privacidad</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function ChevronRight({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    );
}
