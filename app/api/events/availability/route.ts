import { NextRequest, NextResponse } from 'next/server';
import { getEventOccupancyByDateRange } from '@/lib/services/eventCapacityService';

export const dynamic = 'force-dynamic';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start') || '';
        const end = searchParams.get('end') || '';
        const excludeQuoteId = searchParams.get('excludeQuoteId') || undefined;

        if (!YMD_RE.test(start) || !YMD_RE.test(end)) {
            return NextResponse.json(
                { error: 'Parámetros start y end requeridos en formato YYYY-MM-DD' },
                { status: 400 },
            );
        }

        const startMs = Date.parse(`${start}T00:00:00Z`);
        const endMs = Date.parse(`${end}T00:00:00Z`);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
            return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
        }

        const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
        if (diffDays > 62) {
            return NextResponse.json({ error: 'El rango máximo de consulta es 62 días' }, { status: 400 });
        }

        const { config, days } = await getEventOccupancyByDateRange(start, end, excludeQuoteId);

        return NextResponse.json(
            { config, days },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
    } catch (error) {
        console.error('[GET /api/events/availability] Error:', error);
        return NextResponse.json({ error: 'Error al consultar disponibilidad' }, { status: 500 });
    }
}
