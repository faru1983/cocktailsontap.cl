'use client';

import { useEffect } from 'react';

/** Registra el Service Worker exclusivo de /admin para habilitar la instalación PWA. */
export default function AdminPwaRegister() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        navigator.serviceWorker
            .register('/admin-sw.js', { scope: '/admin' })
            .catch(() => {
                // En desarrollo local sin HTTPS o si el navegador bloquea SW, ignorar silenciosamente
            });
    }, []);

    return null;
}
