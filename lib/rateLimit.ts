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

/** IP aproximada desde headers de Vercel/proxy. */
export async function getClientIp(): Promise<string> {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
    return h.get('x-real-ip') || 'unknown';
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
