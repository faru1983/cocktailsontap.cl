import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Login — Admin',
    robots: 'noindex, nofollow',
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
