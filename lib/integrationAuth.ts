import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

export type IntegrationAuthResult =
    | { ok: true }
    | { ok: false; status: 401 | 503; error: string };

/**
 * Valida Authorization: Bearer <INTEGRATION_API_KEY>.
 */
export function verifyIntegrationAuth(request: Request): IntegrationAuthResult {
    const expected = process.env.INTEGRATION_API_KEY?.trim();
    if (!expected) {
        return {
            ok: false,
            status: 503,
            error: 'INTEGRATION_API_KEY no configurada en el servidor.',
        };
    }

    const header = request.headers.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
        return { ok: false, status: 401, error: 'Falta Authorization: Bearer <token>.' };
    }

    const token = match[1].trim();
    if (!safeEqual(token, expected)) {
        return { ok: false, status: 401, error: 'Token de integración inválido.' };
    }

    return { ok: true };
}
