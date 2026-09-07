'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminLogout } from '@/app/actions/admin/authActions';
import {
    LayoutDashboard,
    Banknote,
    ClipboardList,
    Users,
    GlassWater,
    BookOpen,
    BarChart3,
    Bell,
    Download,
    Settings,
    LogOut,
    Menu,
    X,
    Martini,
} from 'lucide-react';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/gastos', label: 'Gastos', icon: Banknote },
    { href: '/admin/quotes', label: 'Cotizaciones', icon: ClipboardList },
    { href: '/admin/clients', label: 'Clientes', icon: Users },
    { href: '/admin/products', label: 'Productos', icon: GlassWater },
    { href: '/admin/recetario', label: 'Recetario', icon: BookOpen },
    { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { href: '/admin/reminders', label: 'Recordatorios', icon: Bell },
    { href: '/admin/exportar', label: 'Exportar', icon: Download },
    { href: '/admin/settings', label: 'Configuración', icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const sidebarContent = (
        <>
            <div className="px-5 py-6 border-b border-admin-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Martini size={18} />
                    </div>
                    <div>
                        <div className="text-primary font-black text-xs leading-tight">Cocktails on Tap</div>
                        <div className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Control Center</div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar menú"
                    className="p-1 text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer lg:hidden"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto hide-scrollbar">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] no-underline border-l-2 ${
                                isActive
                                    ? 'bg-primary/12 text-white font-bold border-primary'
                                    : 'bg-transparent text-slate-500 font-medium border-transparent hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            <Icon size={18} className={isActive ? 'text-primary' : 'text-slate-600'} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-admin-border">
                <form action={adminLogout}>
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl text-red-500 text-[13px] font-bold transition-all cursor-pointer"
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </form>
            </div>
        </>
    );

    if (!isMounted) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Abrir menú"
                className={`fixed top-4 z-60 lg:hidden bg-admin-surface border border-admin-border rounded-xl text-primary p-2.5 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
                    open ? '-left-16' : 'left-4'
                }`}
            >
                <Menu size={20} />
            </button>

            {open && (
                <div
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    aria-hidden
                />
            )}

            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-60 bg-admin-sidebar border-r border-admin-border flex flex-col transition-transform duration-300 ease-in-out overflow-y-auto lg:translate-x-0 ${
                    open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
