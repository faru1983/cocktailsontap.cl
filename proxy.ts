import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionTokenValue } from '@/lib/adminAuth';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect /admin routes (but not /admin/login itself)
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        const session = request.cookies.get(SESSION_COOKIE);

        if (!session?.value || !verifySessionTokenValue(session.value)) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('from', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Cotizaciones con token: no indexar (refuerzo además de meta robots en la página)
    if (pathname.startsWith('/cotizar/')) {
        const response = NextResponse.next();
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin', '/admin/:path*', '/cotizar/:path*'],
};
