import type { Metadata } from 'next';
import { validateSession } from '@/lib/adminAuth';
import { redirect } from 'next/navigation';
import AdminSidebar from './AdminSidebar';

export const metadata: Metadata = {
    title: 'Panel Admin — Cocktails on Tap',
    robots: 'noindex, nofollow',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const isValid = await validateSession();

    // Si no está validado, dejamos que el middleware maneje la redirección
    // y solo renderizamos el contenido (que será el login) sin el sidebar.
    if (!isValid) {
        return <>{children}</>;
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            display: 'flex',
            fontFamily: "'Outfit', -apple-system, sans-serif",
            color: '#e2e8f0',
        }}>
            <AdminSidebar />
            <main style={{
                flex: 1,
                overflow: 'auto',
                padding: '32px',
                minHeight: '100vh',
            }}>
                {children}
            </main>
        </div>
    );
}
