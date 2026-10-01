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

    const response = NextResponse.next();

    // Cotizaciones con token: no indexar (refuerzo además de meta robots en la página)
    if (pathname.startsWith('/cotizar/')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // Atribución Meta CAPI: Capturar fbclid para generar cookie de primer dominio _fbc resistente a Safari ITP
    const fbclid = request.nextUrl.searchParams.get('fbclid');
    if (fbclid && fbclid.trim().length > 0) {
        const fbcValue = `fb.1.${Date.now()}.${fbclid.trim()}`;
        response.cookies.set('_fbc', fbcValue, {
            path: '/',
            maxAge: 90 * 24 * 60 * 60, // 90 días
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
    }

    // Inicializar _fbp si no existe aún en el navegador
    if (!request.cookies.has('_fbp')) {
        const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
        response.cookies.set('_fbp', `fb.1.${Date.now()}.${randomDigits}`, {
            path: '/',
            maxAge: 90 * 24 * 60 * 60,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|assets|favicon.ico|robots.txt|sitemap.xml).*)',
    ],
};
