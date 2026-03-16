import type { Metadata } from 'next';
import { validateSession } from '@/lib/adminAuth';
import AdminSidebar from './AdminSidebar';

export const metadata: Metadata = {
    title: 'Panel Admin — Cocktails on Tap',
    robots: 'noindex, nofollow',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const isValid = await validateSession();

    // Si no está validado renderizamos solo el login (sin sidebar ni estructura de panel)
    if (!isValid) {
        return <>{children}</>;
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            fontFamily: "'Outfit', -apple-system, sans-serif",
            color: '#e2e8f0',
        }}>
            {/* Sidebar como drawer fixed — no ocupa espacio en el flujo */}
            <AdminSidebar />

            {/* Contenido principal: padding superior para dejar espacio al botón hamburguesa */}
            <main style={{
                minHeight: '100vh',
                padding: '64px 16px 32px',     /* top: espacio para el hamburger */
            }}>
                {/* Contenedor con max-width para pantallas grandes */}
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
