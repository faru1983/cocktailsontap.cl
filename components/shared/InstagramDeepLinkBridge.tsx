'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ExternalLink, Instagram, Loader2 } from 'lucide-react';

interface InstagramDeepLinkBridgeProps {
    platform: 'ios' | 'android';
    title: string;
    subtitle: string;
    buttonLabel: string;
    iosAppUrl: string;
    androidIntentUrl: string;
    webUrl: string;
}

export default function InstagramDeepLinkBridge({
    platform,
    title,
    subtitle,
    buttonLabel,
    iosAppUrl,
    androidIntentUrl,
    webUrl,
}: InstagramDeepLinkBridgeProps) {
    const launchedRef = useRef(false);
    const appHref = platform === 'android' ? androidIntentUrl : iosAppUrl;

    useEffect(() => {
        if (launchedRef.current) return;
        launchedRef.current = true;

        if (platform === 'android') {
            window.location.replace(androidIntentUrl);
        } else {
            window.location.href = iosAppUrl;
        }
    }, [platform, androidIntentUrl, iosAppUrl]);

    return (
        <main className="relative min-h-dvh w-full bg-[#0d1117] text-white flex flex-col items-center justify-center px-6 py-10 overflow-hidden select-none">
            {/* Resplandor ambiental sutil de marca */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/15 blur-3xl"
            />

            <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center animate-fade-in">
                <Image
                    src="/assets/logo.webp"
                    alt="Cocktails on Tap"
                    width={150}
                    height={75}
                    priority
                    className="w-36 h-auto mb-8 brightness-0 invert"
                />

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/75 mb-5">
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span>Conectando con Instagram App</span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                    {title}
                </h1>
                <p className="text-sm text-white/60 leading-relaxed mb-8 max-w-[280px]">
                    {subtitle}
                </p>

                <a
                    href={appHref}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-primary hover:bg-primary-dark active:scale-[0.98] text-slate-950 font-bold text-base shadow-[0_8px_24px_rgba(226,160,73,0.35)] transition-all duration-200"
                >
                    <Instagram className="w-5 h-5 shrink-0" />
                    <span>{buttonLabel}</span>
                </a>

                <a
                    href={webUrl}
                    className="mt-5 inline-flex items-center gap-1.5 py-2 px-3 text-xs font-medium text-white/45 hover:text-white/80 transition-colors"
                >
                    <span>Ver en el navegador web</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>
        </main>
    );
}
