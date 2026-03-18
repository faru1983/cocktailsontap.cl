'use client';

import Link from 'next/link';

interface DashboardRowProps {
    href: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export function DashboardRow({ href, children, className, style }: DashboardRowProps) {
    return (
        <tr 
            style={{ ...style, cursor: 'pointer', transition: 'background 0.2s' }}
            onClick={() => window.location.href = href}
            className={className}
        >
            {children}
        </tr>
    );
}
