import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runReminderJob } from '@/lib/services/reminderService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected) return false;

    const header = request.headers.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const token = match?.[1]?.trim() || '';
    if (!token) return false;

    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * GET/POST /api/cron/reminders
 * Vercel Cron (diario: 0 13 * * * = 13:00 UTC ≈ 09:00 Chile en invierno).
 * No-op si cron deshabilitado. El disparo UTC no se bloquea por DST Chile.
 */
async function handle(request: Request) {
    if (!process.env.CRON_SECRET?.trim()) {
        return NextResponse.json({ error: 'CRON_SECRET no configurada' }, { status: 503 });
    }
    if (!authorizeCron(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const summary = await runReminderJob({ respectSchedule: true });
    return NextResponse.json(summary);
}

export async function GET(request: Request) {
    return handle(request);
}

export async function POST(request: Request) {
    return handle(request);
}
