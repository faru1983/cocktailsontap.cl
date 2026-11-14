import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyIntegrationAuth } from '@/lib/integrationAuth';
import { jsonError } from '@/lib/integrationApi';
import { createCocktailsMcpServer } from '@/lib/mcp/cocktailsMcpServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleMcpRequest(request: NextRequest): Promise<Response> {
    const auth = await verifyIntegrationAuth(request);
    if (!auth.ok) {
        return jsonError(auth.status, auth.error);
    }

    const server = createCocktailsMcpServer({
        contactPhone: request.headers.get('x-deskcomm-contato-telefone') ?? undefined,
        contactId: request.headers.get('x-deskcomm-contato-id') ?? undefined,
        channel: request.headers.get('x-deskcomm-canal') ?? undefined,
    });

    const transport = new WebStandardStreamableHTTPServerTransport({});
    await server.connect(transport);
    return transport.handleRequest(request as unknown as Request);
}

export async function POST(request: NextRequest) {
    return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
    return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyIntegrationAuth(request);
    if (!auth.ok) {
        return jsonError(auth.status, auth.error);
    }
    return NextResponse.json({ ok: true }, { status: 200 });
}
