import { IntegrationContactSchema } from '@/lib/integrationSchemas';
import { verifyIntegrationAuth } from '@/lib/integrationAuth';
import { jsonError } from '@/lib/integrationApi';
import {
    resolveOrCreateClient,
    recordTouchpoint,
    type ClientTouchSource,
} from '@/lib/services/clientService';
import {
    advanceClientStage,
    type ClientLifecycleStage,
} from '@/lib/services/clientLifecycleService';
import { isMetaCapiConfigured } from '@/lib/services/metaCapiService';

const ENGAGE_TOUCHPOINT_TYPES = new Set([
    'human_reply',
    'engaged',
    'intent_selected',
    'menu_choice',
]);

/**
 * POST /api/v1/contacts
 * Primer contacto / engagement WhatsApp (phone-only OK).
 * - bot_started → curious + Lead (si nuevo o aún curious)
 * - human_reply / intent_selected → engaged + Contact
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

        const isEngage = ENGAGE_TOUCHPOINT_TYPES.has(dto.touchpointType);
        const targetStage: ClientLifecycleStage = isEngage ? 'engaged' : 'curious';
        const fireCapi = dto.sendCapiLead !== false;

        const stage = await advanceClientStage(resolved.clientId, targetStage, {
            reason: isEngage
                ? `WhatsApp engagement (${dto.touchpointType})`
                : `WhatsApp first contact (${dto.touchpointType})`,
            source: dto.source,
            touchpointId,
            fireCapi,
            ctwaClid: dto.ctwaClid,
            fbc: dto.fbc,
            fbp: dto.fbp,
        });

        return Response.json({
            success: true,
            clientId: resolved.clientId,
            created: resolved.created,
            merged: resolved.merged,
            possibleDuplicate: resolved.possibleDuplicate,
            touchpointId,
            lifecycleStage: stage.toStage,
            stageChanged: stage.changed,
            metaEventSent: stage.metaEventSent,
            metaCapiConfigured: isMetaCapiConfigured(),
        });
    } catch (err: any) {
        console.error('POST /api/v1/contacts:', err);
        return jsonError(400, err?.message || 'No se pudo registrar el contacto.');
    }
}
