import { headers } from 'next/headers';

type RateLimitOptions = {
    limit: number;
    windowMs: number;
};

type RateLimitResult = {
    ok: boolean;
    retryAfterSec?: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

const store = new Map<string, Bucket>();

function pruneExpired(now: number) {
    if (store.size < 5000) return;
    for (const [key, bucket] of store) {
        if (bucket.resetAt <= now) store.delete(key);
    }
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    pruneExpired(now);
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { ok: true };
    }

    if (bucket.count >= opts.limit) {
        return {
            ok: false,
            retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
    }

    bucket.count += 1;
    return { ok: true };
}

/** IP del cliente priorizando headers confiables de Vercel/reverse proxy para prevenir IP spoofing. */
export async function getClientIp(): Promise<string> {
    const h = await headers();
    const realIp = h.get('x-real-ip');
    if (realIp) return realIp.trim();

    const vercelIp = h.get('x-vercel-ip');
    if (vercelIp) return vercelIp.trim();

    const forwarded = h.get('x-forwarded-for');
    if (forwarded) {
        // En proxies/Vercel, si hay múltiples IPs, la IP del cliente real agregada por el edge confiable es la última
        const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
        return parts[parts.length - 1] || 'unknown';
    }

    return 'unknown';
}

export async function enforceRateLimit(
    routeKey: string,
    opts: RateLimitOptions
): Promise<RateLimitResult> {
    const ip = await getClientIp();
    return rateLimit(`${routeKey}:${ip}`, opts);
}

export const RATE_LIMIT_MESSAGE =
    'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.';
