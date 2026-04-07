'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { adminLogout } from '@/app/actions/admin/authActions';
import { 
    LayoutDashboard, 
    Banknote, 
    ClipboardList, 
    Users, 
    GlassWater, 
    BarChart3, 
    Bell, 
    RefreshCcw, 
    Settings,
    LogOut,
    Menu,
    X 
} from 'lucide-react';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/admin/gastos', label: 'Gastos', icon: <Banknote size={18} /> },
    { href: '/admin/quotes', label: 'Cotizaciones', icon: <ClipboardList size={18} /> },
    { href: '/admin/clients', label: 'Clientes', icon: <Users size={18} /> },
    { href: '/admin/products', label: 'Productos', icon: <GlassWater size={18} /> },
    { href: '/admin/estadisticas', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { href: '/admin/reminders', label: 'Recordatorios', icon: <Bell size={18} /> },
    { href: '/admin/logs', label: 'Sincronización', icon: <RefreshCcw size={18} /> },
    { href: '/admin/settings', label: 'Configuración', icon: <Settings size={18} /> },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Avoid SSR mismatch
    useEffect(() => { setIsMounted(true); }, []);

    // Close sidebar on route change (mobile)
    useEffect(() => { setOpen(false); }, [pathname]);

    const sidebarContent = (
        <>
            {/* Brand + toggle */}
            <div className="px-5 py-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-xl">🍸</span>
                    <div>
                        <div className="text-[#E2A049] font-black text-xs leading-tight">Cocktails on Tap</div>
                        <div className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Control Center</div>
                    </div>
                </div>
                {/* Close button (mobile) */}
                <button
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar menú"
                    className="p-1 text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] no-underline border-l-2 ${
                                isActive 
                                ? 'bg-[rgba(226,160,73,0.12)] text-white font-bold border-[#E2A049]' 
                                : 'bg-transparent text-slate-500 font-medium border-transparent hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            <span className={isActive ? 'text-[#E2A049]' : 'text-slate-600'}>
                                {item.icon}
                            </span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-white/5">
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
            {/* ── Hamburger button ── */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Abrir menú"
                className={`fixed top-4 z-60 bg-[#1e2433] border border-white/10 rounded-xl text-[#E2A049] p-2.5 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
                    open ? '-left-16' : 'left-4'
                }`}
            >
                <Menu size={20} />
            </button>

            {/* ── Overlay ── */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                />
            )}

            {/* ── Sidebar panel ── */}
            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-60 bg-[#161b27] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out overflow-y-auto ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
