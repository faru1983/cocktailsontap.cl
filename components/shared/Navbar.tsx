'use client';

import { useState, useEffect } from 'react';
import { Home, Layers, Wine, ClipboardList, Star, Calculator, X, Menu, Instagram } from 'lucide-react';
import { WhatsappIcon } from '@/components/shared/icons';
import { WHATSAPP_URL } from '@/lib/config';

const NAV_LINKS = [
    { href: '/#inicio', icon: Home, label: 'Inicio' },
    { href: '/#instagram', icon: Instagram, label: 'Nosotros' },
    { href: '/#como-funciona', icon: Layers, label: 'Cómo Funciona' },
    { href: '/#dispensadores', icon: Wine, label: 'Dispensadores' },
    { href: '/#que-incluye', icon: ClipboardList, label: 'Qué Incluye' },
    { href: '/#nuestros-cocteles', icon: Star, label: 'Cócteles' },
    { href: '/cotizar', icon: Calculator, label: 'Cotizar' },
    {
        href: `${WHATSAPP_URL}?text=Hola,%20estoy%20escribiendo%20desde%20su%20pagina%20web!`,
        icon: WhatsappIcon,
        label: 'WhatsApp',
        external: true,
    },
];

import { usePathname } from 'next/navigation';

export default function Navbar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    if (pathname?.startsWith('/admin')) return null;

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const onScroll = () => {
            setScrolled(true);
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => setScrolled(false), 300);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <>
            {/* Botón hamburguesa — siempre flotante */}
            <button
                className={`fixed top-[4.5rem] left-4 z-[200] flex items-center justify-center w-11 h-11 text-white rounded-full text-[1.1rem] transition-all duration-300 hover:scale-105 ${scrolled
                    ? 'bg-primary/55 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:bg-[#c17c28]/75'
                    : 'bg-primary shadow-[0_4px_15px_rgba(226,160,73,0.4)] hover:bg-primary-dark'
                    }`}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                onClick={() => setOpen((o) => !o)}
            >
                {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}

            </button>

            {/* Overlay semitransparente */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-[155]"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Panel lateral */}
            <nav
                className={`fixed top-0 h-screen w-[260px] flex flex-col bg-white pt-20 px-6 pb-8 gap-2 z-[160] shadow-[5px_0_20px_rgba(0,0,0,0.1)] transition-[left] duration-300 ease-in-out ${open ? 'left-0' : '-left-full'
                    }`}
            >
                {NAV_LINKS.map((link) => (
                    <a
                        key={link.href}
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-brand-text font-semibold text-[0.95rem] px-4 py-3 rounded-xl whitespace-nowrap transition-colors duration-200 hover:bg-primary hover:text-white"
                    >
                        <link.icon className="w-4 h-4" /> {link.label}

                    </a>
                ))}
            </nav>
        </>
    );
}
