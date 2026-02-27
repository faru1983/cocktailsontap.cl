'use client';

import { useEffect } from 'react';
import { Instagram } from 'lucide-react';

export default function InstagramSection() {

    useEffect(() => {
        // Load EmbedSocial script
        if (!document.getElementById('EmbedSocialHashtagScript')) {
            const js = document.createElement('script');
            js.id = 'EmbedSocialHashtagScript';
            js.src = 'https://embedsocial.com/cdn/ht.js';
            document.head.appendChild(js);
        }
    }, []);

    return (
        <section className="py-14 bg-white" id="instagram">
            <div className="max-w-[1200px] mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-brand-text">
                        Conoce más sobre lo que hacemos
                    </h2>
                    <div className="w-[60px] h-1 bg-gradient-to-r from-primary to-primary-dark rounded-[2px] mx-auto mt-4" />
                </div>
                <div className="text-center mb-8">
                    <a
                        href="https://instagram.com/cocktailsontap.chile"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white text-[1rem] bg-gradient-to-br from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(220,39,67,0.35)]"
                    >
                        <Instagram className="w-5 h-5" /> Seguir en Instagram

                    </a>
                    <div className="mt-12">
                        <div className="embedsocial-hashtag" data-ref="8ed1c93406be28a51afb40d36b29658398edf2fb" />
                    </div>
                </div>
            </div>
        </section>
    );
}
