import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Solo proteger rutas que empiecen con /admin pero NO sean /admin/login
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
        const session = request.cookies.get('admin_session');
        
        // Si no hay sesión, redireccionar al login transparente
        // Opcionalmente, podrías dejar que el layout lo maneje como está ahora,
        // Pero el middleware previene que Next.js renderice cualquier parte del árbol para estas rutas.
        if (!session) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    return NextResponse.next();
}

// Configurar el matcher para eficiencia (solo rutas admin)
export const config = {
    matcher: ['/admin/:path*'],
};
