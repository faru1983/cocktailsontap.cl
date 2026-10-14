'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { WhatsappIcon } from './icons';
import { WHATSAPP_URL } from '@/lib/config';

const DEFAULT_MESSAGE = 'Hola, estoy cotizando desde la pagina web y tengo algunas dudas.';
const LEGACY_STORAGE_KEY = 'cot-floating-whatsapp-pos';
const BUTTON_SIZE = 48;
const EDGE_PADDING = 16;

interface FloatingWhatsappProps {
    /** Mensaje prearmado al abrir WhatsApp */
    message?: string;
}

interface Position {
    x: number;
    y: number;
}

function clampPosition(x: number, y: number): Position {
    if (typeof window === 'undefined') return { x, y };
    return {
        x: Math.max(EDGE_PADDING, Math.min(window.innerWidth - BUTTON_SIZE - EDGE_PADDING, x)),
        y: Math.max(EDGE_PADDING, Math.min(window.innerHeight - BUTTON_SIZE - EDGE_PADDING, y)),
    };
}

export default function FloatingWhatsapp({ message = DEFAULT_MESSAGE }: FloatingWhatsappProps) {
    const pathname = usePathname();
    const isWizard = pathname?.startsWith('/eventos') || pathname?.startsWith('/barriles');
    const [visible, setVisible] = useState(false);
    const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);
    const positionRef = useRef<Position | null>(null);
    const dragRef = useRef({
        active: false,
        moved: false,
        pointerId: -1,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
    });

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 20000);
        return () => clearTimeout(timer);
    }, []);

    // Limpiar residuos antiguos de localStorage que forzaban la posición al lado izquierdo
    useEffect(() => {
        try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => {
        const onResize = () => {
            setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!isWizard) {
            setHiddenOnScroll(false);
            return;
        }

        let lastScrollY = window.scrollY;

        const onScroll = () => {
            if (dragRef.current.active) return;
            const currentScrollY = window.scrollY;
            if (currentScrollY <= 30) {
                setHiddenOnScroll(false);
            } else if (currentScrollY > lastScrollY + 8) {
                setHiddenOnScroll(true);
            } else if (currentScrollY < lastScrollY - 8) {
                setHiddenOnScroll(false);
            }
            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [isWizard]);

    const handlePointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        dragRef.current = {
            active: true,
            moved: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: positionRef.current?.x ?? rect.left,
            originY: positionRef.current?.y ?? rect.top,
        };
        target.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
        const drag = dragRef.current;
        if (!drag.active || event.pointerId !== drag.pointerId) return;

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            drag.moved = true;
        }

        if (drag.moved) {
            const next = clampPosition(drag.originX + dx, drag.originY + dy);
            positionRef.current = next;
            setPosition(next);
        }
    };

    const finishDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
        const drag = dragRef.current;
        if (!drag.active || event.pointerId !== drag.pointerId) return;

        drag.active = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (dragRef.current.moved) {
            event.preventDefault();
            dragRef.current.moved = false;
        }
    };

    const whatsappUrl = `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
    const shouldHide = isWizard && hiddenOnScroll;

    return (
        <div
            id="floating-whatsapp"
            style={position ? { left: position.x, top: position.y } : undefined}
            className={`fixed z-[90] touch-none transition-[opacity,transform] duration-300 ease-in-out ${
                !position ? 'left-4 sm:left-6 bottom-24' : ''
            } ${
                visible && !shouldHide
                    ? 'opacity-100 scale-100 visible pointer-events-auto'
                    : 'opacity-0 scale-75 invisible pointer-events-none'
            }`}
        >
            <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onClick={handleClick}
                className="relative flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-white/15 bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25 transition-[transform,box-shadow] hover:bg-[#20ba5a] hover:shadow-xl hover:shadow-[#25D366]/30 active:cursor-grabbing active:scale-95"
                aria-label="Escríbenos por WhatsApp. Arrastra para mover."
                title="WhatsApp — arrastra para mover"
            >
                <WhatsappIcon className="pointer-events-none h-5 w-5" />
            </a>
        </div>
    );
}
