import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_SEC = 60 * 60 * 24 * 7; // 7 days

function getAuthKeyMaterial(): string {
    const password = process.env.ADMIN_PASSWORD;
    const salt = process.env.AUTH_SALT;
    if (!password || !salt) {
        throw new Error('ADMIN_PASSWORD or AUTH_SALT environment variable is missing.');
    }
    return `${salt}:${password}`;
}

function signSessionPayload(exp: number, nonce: string): string {
    const payload = `${exp}.${nonce}`;
    const hmac = createHmac('sha256', getAuthKeyMaterial()).update(payload).digest('hex');
    return `${payload}.${hmac}`;
}

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/** Crea token de sesión firmado: exp.nonce.hmac */
export function createSessionTokenValue(): string {
    const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SEC;
    const nonce = crypto.randomUUID();
    return signSessionPayload(exp, nonce);
}

/** Valida token exp.nonce.hmac (Node crypto). */
export function verifySessionTokenValue(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [expStr, nonce, hmac] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
    if (!nonce || !hmac) return false;

    let expected: string;
    try {
        expected = signSessionPayload(exp, nonce);
    } catch {
        return false;
    }

    return safeEqual(token, expected);
}

export async function validateSession(): Promise<boolean> {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE);
    if (!session?.value) return false;
    return verifySessionTokenValue(session.value);
}

/** Redirect a login si no hay sesión válida (RSC admin). */
export async function requireAdmin(): Promise<void> {
    const ok = await validateSession();
    if (!ok) redirect('/admin/login');
}

export function getSessionCookieOptions(token: string) {
    return {
        name: SESSION_COOKIE,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: SESSION_DURATION_SEC,
        path: '/admin',
    };
}

/** Compara password con ADMIN_PASSWORD de forma timing-safe. */
export function verifyAdminPassword(candidate: string): boolean {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/** Valida redirect post-login: solo rutas /admin relativas seguras. */
export function sanitizeAdminRedirect(from: string | null | undefined): string {
    const fallback = '/admin';
    if (!from || typeof from !== 'string') return fallback;
    const trimmed = from.trim();
    if (!trimmed.startsWith('/admin')) return fallback;
    if (trimmed.startsWith('//') || trimmed.includes('://') || trimmed.includes('\\')) return fallback;
    return trimmed;
}

export { SESSION_COOKIE, SESSION_DURATION_SEC };
