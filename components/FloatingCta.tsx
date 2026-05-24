'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calculator } from 'lucide-react';

export default function FloatingCta() {

    const [visible, setVisible] = useState(false);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 20000);
        return () => clearTimeout(t);
    }, []);

    if (closed) return null;

    return (
        <div
            id="wrapper-cotizar"
            className={`fixed z-[100] transition-all duration-500 bottom-8 right-8 ${visible ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-5 invisible'}`}
        >
            <div className="relative">
                <button
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white border border-brand-border flex items-center justify-center text-brand-text-muted hover:text-brand-text hover:scale-110 transition-all shadow-md cursor-pointer z-10 text-lg leading-none"
                    onClick={() => setClosed(true)}
                    aria-label="Cerrar"
                >
                    <span className="-translate-y-[1px]">&times;</span>
                </button>
                <Link
                    href="/cotizar"
                    className="bg-gradient-to-br from-primary to-primary-dark text-white px-6 py-3 rounded-full font-extrabold flex items-center gap-2 shadow-[0_10px_25px_rgba(226,160,73,0.4)] transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(226,160,73,0.5)] hover:brightness-110 border border-white/20 text-[0.95rem] no-underline animate-pulse-orange"
                    aria-label="Cotizar Ahora"
                >
                    <Calculator className="w-4 h-4" /> Cotizar
                </Link>
            </div>
        </div>
    );
}
