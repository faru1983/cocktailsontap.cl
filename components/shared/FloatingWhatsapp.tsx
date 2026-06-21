'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WhatsappIcon } from './icons';
import { WHATSAPP_NUMBER } from '@/lib/config';

export default function FloatingWhatsapp() {
    const [visible, setVisible] = useState(false);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(true);
        }, 20000); // 20 segundos

        return () => clearTimeout(timer);
    }, []);

    if (closed) return null;

    const message = 'Hola, estoy cotizando desde la pagina web y tengo algunas dudas.';
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    return (
        <div
            id="floating-whatsapp"
            className={`fixed z-[100] bottom-8 right-8 transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-5 invisible'
            }`}
        >
            <div className="relative group">
                {/* Botón Cerrar (X) */}
                <button
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white border border-brand-border flex items-center justify-center text-brand-text-muted hover:text-brand-text hover:scale-110 transition-all shadow-md cursor-pointer z-10"
                    onClick={() => setClosed(true)}
                    aria-label="Cerrar"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
                {/* Enlace WhatsApp */}
                <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#25D366] hover:bg-[#20ba5a] text-white p-4 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(37,211,102,0.4)] transition-all hover:-translate-y-1 hover:scale-105 hover:shadow-[0_15px_30px_rgba(37,211,102,0.6)] border border-white/10"
                    aria-label="Escríbenos por WhatsApp"
                >
                    <WhatsappIcon className="w-7 h-7" />
                </a>
            </div>
        </div>
    );
}
