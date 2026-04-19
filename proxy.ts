import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'admin_session';

async function hashPassword(password: string): Promise<string> {
    const salt = process.env.AUTH_SALT || 'development_otp_salt_2026';
    const msgBuffer = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect /admin routes (but not /admin/login itself)
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        const session = request.cookies.get(SESSION_COOKIE);
        const password = process.env.ADMIN_PASSWORD;

        if (!password || !session?.value) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('from', pathname);
            return NextResponse.redirect(loginUrl);
        }

        const validToken = await hashPassword(password);
        if (session.value !== validToken) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('from', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin', '/admin/:path*'],
};
