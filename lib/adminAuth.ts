import { cookies } from 'next/headers';
import { createHash } from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

function hashPassword(password: string): string {
    return createHash('sha256').update(password + 'cot_salt_2026').digest('hex');
}

export function getAdminPasswordHash(): string {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('ADMIN_PASSWORD env var not set');
    return hashPassword(password);
}

export function createSessionToken(): string {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('ADMIN_PASSWORD env var not set');
    return hashPassword(password + Date.now().toString().slice(0, -3)); // ~1 second precision
}

export async function validateSession(): Promise<boolean> {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE);
    if (!session?.value) return false;

    const password = process.env.ADMIN_PASSWORD;
    if (!password) return false;

    // Session token is hash of password (time-insensitive, password-bound)
    const validToken = hashPassword(password);
    return session.value === validToken;
}

export function getSessionCookieOptions() {
    return {
        name: SESSION_COOKIE,
        value: hashPassword(process.env.ADMIN_PASSWORD || ''),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: SESSION_DURATION,
        path: '/admin',
    };
}
