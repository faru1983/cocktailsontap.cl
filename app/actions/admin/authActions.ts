'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    createSessionTokenValue,
    getSessionCookieOptions,
    sanitizeAdminRedirect,
    verifyAdminPassword,
} from '@/lib/adminAuth';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export async function adminLogin(formData: FormData): Promise<{ error?: string }> {
    const rl = await enforceRateLimit('adminLogin', { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) return { error: RATE_LIMIT_MESSAGE };

    const password = formData.get('password') as string;
    const from = formData.get('from') as string | null;

    if (!process.env.ADMIN_PASSWORD) {
        return { error: 'Configuración del servidor incompleta.' };
    }

    if (!verifyAdminPassword(password)) {
        return { error: 'Contraseña incorrecta.' };
    }

    const cookieStore = await cookies();
    const token = createSessionTokenValue();
    const opts = getSessionCookieOptions(token);
    cookieStore.set(opts.name, opts.value, {
        httpOnly: opts.httpOnly,
        secure: opts.secure,
        sameSite: opts.sameSite,
        maxAge: opts.maxAge,
        path: opts.path,
    });

    redirect(sanitizeAdminRedirect(from));
}

export async function adminLogout() {
    const cookieStore = await cookies();
    cookieStore.delete({ name: 'admin_session', path: '/admin' });
    redirect('/admin/login');
}
