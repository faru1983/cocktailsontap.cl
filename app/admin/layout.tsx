import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { validateSession } from '@/lib/adminAuth';
import { getQuickExpenseMeta } from '@/lib/services/quickExpenseService';
import AdminSidebar from './AdminSidebar';
import AdminPwaRegister from './AdminPwaRegister';
import QuickExpenseMobile from './QuickExpenseMobile';

export const metadata: Metadata = {
    title: 'Panel Admin — Cocktails on Tap',
    robots: 'noindex, nofollow',
    manifest: '/admin-manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'COT Admin',
    },
    icons: {
        icon: [
            { url: '/assets/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/assets/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [{ url: '/assets/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
};

export const viewport: Viewport = {
    themeColor: '#0d1117',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const isValid = await validateSession();

    if (!isValid) {
        return (
            <>
                <AdminPwaRegister />
                {children}
            </>
        );
    }

    const quickExpenseMeta = await getQuickExpenseMeta();

    return (
        <div className="min-h-screen bg-admin-bg text-slate-200 font-sans">
            <AdminPwaRegister />
            <AdminSidebar />
            <main className="min-h-screen pt-16 px-4 pb-20 lg:pb-8 lg:pl-60 lg:pt-8 lg:px-8">
                <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
            <Suspense fallback={null}>
                <QuickExpenseMobile meta={quickExpenseMeta} />
            </Suspense>
        </div>
    );
}
