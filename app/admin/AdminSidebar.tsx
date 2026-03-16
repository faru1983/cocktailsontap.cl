'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminLogout } from '@/app/actions/admin/authActions';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/quotes', label: 'Cotizaciones', icon: '📋' },
    { href: '/admin/clients', label: 'Clientes', icon: '👥' },
    { href: '/admin/logs', label: 'Sincronización', icon: '🔧' },
    { href: '/admin/settings', label: 'Configuración', icon: '⚙️' },
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside style={{
            width: '240px',
            minWidth: '240px',
            background: '#161b27',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 0',
        }}>
            {/* Brand */}
            <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🍸</span>
                    <div>
                        <div style={{ color: '#E2A049', fontWeight: 800, fontSize: '13px', lineHeight: 1.2 }}>
                            Cocktails on Tap
                        </div>
                        <div style={{ color: '#475569', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Control Center
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav Links */}
            <nav style={{ flex: 1, padding: '16px 12px' }}>
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
                                padding: '10px 12px',
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
                            width: '100%',
                            padding: '10px 12px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '10px',
                            color: '#f87171',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                        }}
                    >
                        🚪 Cerrar Sesión
                    </button>
                </form>
            </div>
        </aside>
    );
}
