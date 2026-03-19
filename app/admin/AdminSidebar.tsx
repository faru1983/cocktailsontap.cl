'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { adminLogout } from '@/app/actions/admin/authActions';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/quotes', label: 'Cotizaciones', icon: '📋' },
    { href: '/admin/clients', label: 'Clientes', icon: '👥' },
    { href: '/admin/estadisticas', label: 'Estadísticas', icon: '📈' },
    { href: '/admin/reminders', label: 'Recordatorios', icon: '🔔' },
    { href: '/admin/logs', label: 'Sincronización', icon: '🔧' },
    { href: '/admin/settings', label: 'Configuración', icon: '⚙️' },
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
            <div style={{ padding: '0 16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🍸</span>
                    <div>
                        <div style={{ color: '#E2A049', fontWeight: 800, fontSize: '13px', lineHeight: 1.2 }}>Cocktails on Tap</div>
                        <div style={{ color: '#475569', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Control Center</div>
                    </div>
                </div>
                {/* Collapse button */}
                <button
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar menú"
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px', padding: '4px', lineHeight: 1 }}
                >
                    ✕
                </button>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '16px 10px' }}>
                {navItems.map((item) => {
                    const isActive = item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '11px 12px',
                                borderRadius: '10px',
                                marginBottom: '4px',
                                textDecoration: 'none',
                                color: isActive ? '#ffffff' : '#64748b',
                                background: isActive ? 'rgba(226,160,73,0.12)' : 'transparent',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: '14px',
                                transition: 'all 0.15s',
                                borderLeft: isActive ? '3px solid #E2A049' : '3px solid transparent',
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div style={{ padding: '12px' }}>
                <form action={adminLogout}>
                    <button
                        type="submit"
                        style={{
                            width: '100%', padding: '10px 12px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '10px', color: '#f87171', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                    >
                        🚪 Cerrar Sesión
                    </button>
                </form>
            </div>
        </>
    );

    if (!isMounted) return null;

    return (
        <>
            {/* ── Hamburger button (visible cuando sidebar está cerrado) ── */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Abrir menú"
                style={{
                    position: 'fixed',
                    top: '16px',
                    left: open ? '-60px' : '16px', // hide when open to avoid overlap
                    zIndex: 60,
                    background: '#1e2433',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#E2A049',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '8px 12px',
                    lineHeight: 1,
                    transition: 'left 0.3s ease',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
            >
                ☰
            </button>

            {/* ── Overlay (mobile only, closes sidebar) ── */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 40,
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* ── Sidebar panel ── */}
            <aside
                style={{
                    position: 'fixed',
                    top: 0, left: 0, bottom: 0,
                    zIndex: 50,
                    width: '240px',
                    background: '#161b27',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px 0',
                    transform: open ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowY: 'auto',
                }}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
