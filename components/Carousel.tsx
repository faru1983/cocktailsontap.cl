'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';


interface CarouselItem {
    bgImage: string;
    badge?: string;
    title: string;
    description: string;
}

interface CarouselProps {
    items: CarouselItem[];
    autoplayInterval?: number;
}

export default function Carousel({ items, autoplayInterval = 4000 }: CarouselProps) {
    const [current, setCurrent] = useState(0);
    const [lightbox, setLightbox] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const touchStartX = useRef(0);
    const n = items.length;

    const startAutoplay = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % n), autoplayInterval);
    }, [n, autoplayInterval]);

    const stopAutoplay = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => { startAutoplay(); return stopAutoplay; }, [startAutoplay, stopAutoplay]);

    const goNext = () => { setCurrent((c) => (c + 1) % n); startAutoplay(); };
    const goPrev = () => { setCurrent((c) => (c - 1 + n) % n); startAutoplay(); };

    const getPos = (index: number): 'active' | 'prev' | 'next' | 'hidden' => {
        const rel = (index - current + n) % n;
        if (rel === 0) return 'active';
        if (rel === 1) return 'next';
        if (rel === n - 1) return 'prev';
        return 'hidden';
    };

    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.changedTouches[0].screenX; stopAutoplay(); };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const diff = e.changedTouches[0].screenX - touchStartX.current;
        if (diff < -50) goNext(); else if (diff > 50) goPrev();
        startAutoplay();
    };

    const cardStyles: Record<string, string> = {
        active: "translate-x-0 scale-100 opacity-100 z-[3] shadow-[0_20px_60px_rgba(0,0,0,0.35)] cursor-zoom-in rotate-0",
        prev: "-translate-x-[260px] scale-[0.82] -rotate-[4deg] opacity-65 z-[2] shadow-[0_8px_30px_rgba(0,0,0,0.2)]",
        next: "translate-x-[260px] scale-[0.82] rotate-[4deg] opacity-65 z-[2] shadow-[0_8px_30px_rgba(0,0,0,0.2)]",
        hidden: "translate-x-0 scale-[0.6] opacity-0 pointer-events-none z-[1]"
    };

    return (
        <>
            <div
                className="relative pb-12"
                onMouseEnter={stopAutoplay}
                onMouseLeave={startAutoplay}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="relative h-[480px] flex items-center justify-center">
                    {items.map((item, index) => {
                        const pos = getPos(index);
                        return (
                            <div
                                key={index}
                                className={`absolute w-[260px] h-[390px] rounded-[24px] overflow-hidden cursor-pointer transition-all duration-[550ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] will-change-transform ${cardStyles[pos]}`}
                                onClick={() => {
                                    if (pos === 'active') {
                                        setLightbox(item.bgImage);
                                    } else if (pos === 'prev') {
                                        goPrev();
                                    } else if (pos === 'next') {
                                        goNext();
                                    }
                                }}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url('${item.bgImage}')` }}
                                />
                                {pos === 'active' && (
                                    <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/75 via-black/10 to-transparent text-white">
                                        {item.badge && <div className="inline-block bg-primary text-white font-extrabold text-[0.75rem] uppercase tracking-[1px] px-3 py-1 rounded-[20px] mb-2 w-fit">{item.badge}</div>}
                                        <h3 className="text-[1.25rem] font-extrabold mb-1.5">{item.title}</h3>
                                        <p className="text-[0.85rem] opacity-90 leading-[1.45]">{item.description}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Flechas */}
                <button
                    className="absolute top-1/2 -translate-y-1/2 z-10 bg-white/90 border-none w-11 h-11 rounded-full cursor-pointer text-[0.95rem] text-brand-text flex items-center justify-center transition-all duration-200 shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-primary hover:text-white hover:-translate-y-1/2 hover:scale-105 left-[calc(50%-200px)] max-md:left-4"
                    onClick={goPrev}
                    aria-label="Anterior"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                    className="absolute top-1/2 -translate-y-1/2 z-10 bg-white/90 border-none w-11 h-11 rounded-full cursor-pointer text-[0.95rem] text-brand-text flex items-center justify-center transition-all duration-200 shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-primary hover:text-white hover:-translate-y-1/2 hover:scale-105 right-[calc(50%-200px)] max-md:right-4"
                    onClick={goNext}
                    aria-label="Siguiente"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>


                {/* Dots */}
                <div className="flex justify-center gap-2 absolute bottom-0 left-0 right-0">
                    {items.map((_, i) => (
                        <button
                            key={i}
                            className={`h-2 rounded-full border-none cursor-pointer transition-all duration-300 p-0 ${i === current ? 'bg-primary w-6' : 'bg-brand-border w-2'}`}
                            onClick={() => { setCurrent(i); startAutoplay(); }}
                            aria-label={`Ir a slide ${i + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn cursor-zoom-out" onClick={() => setLightbox(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh] cursor-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="absolute -top-12 right-0 bg-transparent border-none text-white text-4xl cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLightbox(null)}
                            aria-label="Cerrar"
                        >
                            &times;
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lightbox} alt="Vista ampliada" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                    </div>
                </div>
            )}
        </>
    );
}
