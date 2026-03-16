'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
    return createHash('sha256').update(password + 'cot_salt_2026').digest('hex');
}

export async function adminLogin(formData: FormData): Promise<{ error?: string }> {
    const password = formData.get('password') as string;
    const from = formData.get('from') as string || '/admin';
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return { error: 'Configuración del servidor incompleta.' };
    
    if (password !== adminPassword) {
        return { error: 'Contraseña incorrecta.' };
    }

    const cookieStore = await cookies();
    cookieStore.set('admin_session', hashPassword(adminPassword), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/admin',
    });

    redirect(from.startsWith('/admin') ? from : '/admin');
}

export async function adminLogout() {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    redirect('/admin/login');
}
