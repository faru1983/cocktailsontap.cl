import type { Metadata } from 'next';
import { validateSession } from '@/lib/adminAuth';
import AdminSidebar from './AdminSidebar';

export const metadata: Metadata = {
    title: 'Panel Admin — Cocktails on Tap',
    robots: 'noindex, nofollow',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const isValid = await validateSession();

    if (!isValid) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-admin-bg text-slate-200 font-sans">
            <AdminSidebar />
            <main className="min-h-screen pt-16 px-4 pb-8 lg:pl-60 lg:pt-8 lg:px-8">
                <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
        </div>
    );
}
