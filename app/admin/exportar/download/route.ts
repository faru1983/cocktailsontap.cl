import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/adminAuth';
import { decodeExportConfig, parseExportConfig } from '@/lib/exportSchemas';
import {
    buildExportFilename,
    runExport,
    serializeExport,
} from '@/lib/services/exportService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function buildDownloadResponse(configInput: unknown) {
    let configResult;
    if (typeof configInput === 'string') {
        configResult = decodeExportConfig(configInput);
    } else {
        configResult = parseExportConfig(configInput);
    }

    if (!configResult.success) {
        return NextResponse.json({ error: configResult.error }, { status: 400 });
    }

    const config = configResult.data;
    const { rows, headers, columnKeys } = await runExport(config);
    const serialized = serializeExport(rows, columnKeys, headers, config.format);
    const filename = buildExportFilename(config);

    return new NextResponse(serialized.content, {
        status: 200,
        headers: {
            'Content-Type': serialized.mimeType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}

export async function GET(request: NextRequest) {
    const isAuth = await validateSession();
    if (!isAuth) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const encoded = request.nextUrl.searchParams.get('c');
    if (!encoded) {
        return NextResponse.json({ error: 'Falta configuración de export' }, { status: 400 });
    }

    try {
        return await buildDownloadResponse(encoded);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al exportar';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const isAuth = await validateSession();
    if (!isAuth) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const payload = body?.c ?? body?.config ?? body;
        return await buildDownloadResponse(payload);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al exportar';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
