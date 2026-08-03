import { IntegrationContactSchema } from '@/lib/integrationSchemas';
import { verifyIntegrationAuth } from '@/lib/integrationAuth';
import { jsonError } from '@/lib/integrationApi';
import {
    resolveOrCreateClient,
    recordTouchpoint,
    type ClientTouchSource,
} from '@/lib/services/clientService';
import { sendMetaCapiEvent } from '@/lib/services/metaCapiService';

/**
 * POST /api/v1/contacts
 * Primer contacto WhatsApp (phone-only OK). Crea/resuelve persona + touchpoint.
 */
export async function POST(request: Request) {
    const auth = verifyIntegrationAuth(request);
    if (!auth.ok) {
        return jsonError(auth.status, auth.error);
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return jsonError(400, 'JSON inválido.');
    }

    const validation = IntegrationContactSchema.safeParse(raw);
    if (!validation.success) {
        const error = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        return jsonError(400, `Datos inválidos (${error}).`);
    }

    const dto = validation.data;

    try {
        const resolved = await resolveOrCreateClient({
            phone: dto.phone,
            email: dto.email || null,
            firstName: dto.firstName || undefined,
            lastName: dto.lastName || null,
            source: dto.source as ClientTouchSource,
            channel: dto.source === 'whatsapp' ? 'whatsapp' : dto.source === 'admin' ? 'admin' : 'web',
        });

        const touchpointId = await recordTouchpoint({
            clientId: resolved.clientId,
            channel: dto.source,
            type: dto.touchpointType,
            meta_ctwa_clid: dto.ctwaClid,
            meta_fbc: dto.fbc,
            meta_fbp: dto.fbp,
            payload: {
                ...dto.payload,
                created: resolved.created,
                merged: resolved.merged,
            },
        });

        let capi: { success: boolean; skipped?: boolean; error?: string } | undefined;
        if (dto.sendCapiLead) {
            const eventId = `contact_lead_${resolved.clientId}_${touchpointId || Date.now()}`;
            capi = await sendMetaCapiEvent({
                eventName: resolved.created ? 'Lead' : 'Contact',
                eventId,
                clientId: resolved.clientId,
                actionSource: 'chat',
                touchpointId: touchpointId || undefined,
                ctwaClid: dto.ctwaClid,
                fbc: dto.fbc,
                fbp: dto.fbp,
                customData: {
                    content_name: 'WhatsApp First Contact',
                    content_category: 'Messaging',
                },
            });
        }

        return Response.json({
            success: true,
            clientId: resolved.clientId,
            created: resolved.created,
            merged: resolved.merged,
            possibleDuplicate: resolved.possibleDuplicate,
            touchpointId,
            capi,
        });
    } catch (err: any) {
        console.error('POST /api/v1/contacts:', err);
        return jsonError(400, err?.message || 'No se pudo registrar el contacto.');
    }
}
