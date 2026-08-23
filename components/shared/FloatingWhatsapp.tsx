'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WhatsappIcon } from './icons';
import { WHATSAPP_URL } from '@/lib/config';

const DEFAULT_MESSAGE = 'Hola, estoy cotizando desde la pagina web y tengo algunas dudas.';
const STORAGE_KEY = 'cot-floating-whatsapp-pos';
const BUTTON_SIZE = 48;
const EDGE_PADDING = 12;

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

function getDefaultPosition(): Position {
    if (typeof window === 'undefined') return { x: EDGE_PADDING, y: 0 };
    return clampPosition(
        EDGE_PADDING,
        window.innerHeight - BUTTON_SIZE - 96,
    );
}

export default function FloatingWhatsapp({ message = DEFAULT_MESSAGE }: FloatingWhatsappProps) {
    const [visible, setVisible] = useState(false);
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

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as Position;
                if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                    setPosition(clampPosition(parsed.x, parsed.y));
                    return;
                }
            }
        } catch {
            /* ignore corrupt storage */
        }
        setPosition(getDefaultPosition());
    }, []);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => {
        const onResize = () => {
            setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : getDefaultPosition()));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const persistPosition = useCallback((pos: Position) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {
            /* ignore quota errors */
        }
    }, []);

    const handlePointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
        if (!position) return;
        const target = event.currentTarget;
        dragRef.current = {
            active: true,
            moved: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
        };
        target.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
        const drag = dragRef.current;
        if (!drag.active || event.pointerId !== drag.pointerId) return;

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;

        const next = clampPosition(drag.originX + dx, drag.originY + dy);
        positionRef.current = next;
        setPosition(next);
    };

    const finishDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
        const drag = dragRef.current;
        if (!drag.active || event.pointerId !== drag.pointerId) return;

        drag.active = false;
        event.currentTarget.releasePointerCapture(event.pointerId);

        if (positionRef.current) persistPosition(positionRef.current);
    };

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (dragRef.current.moved) {
            event.preventDefault();
            dragRef.current.moved = false;
        }
    };

    if (!position) return null;

    const whatsappUrl = `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;

    return (
        <div
            id="floating-whatsapp"
            style={{ left: position.x, top: position.y }}
            className={`fixed z-[90] touch-none transition-opacity duration-500 ${
                visible ? 'opacity-100 visible' : 'opacity-0 invisible'
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
