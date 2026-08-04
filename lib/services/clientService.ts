import { createServerClient } from '@/lib/supabaseServer';
import { normalizePhoneE164 } from '@/lib/phone';

export type IdentifierType = 'email' | 'phone';
export type ClientTouchSource = 'web' | 'admin' | 'whatsapp' | 'meta' | 'merge' | 'migration';

export interface ResolveClientInput {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: ClientTouchSource;
    /** Prefer this channel when merge is unsafe (whatsapp → phone, web → email). */
    channel?: 'web' | 'admin' | 'whatsapp';
}

export interface ResolveClientResult {
    clientId: string;
    created: boolean;
    merged: boolean;
    possibleDuplicate: boolean;
}

export interface ClientIdentifierRow {
    id: string;
    client_id: string;
    type: IdentifierType;
    value: string;
    is_primary: boolean;
    source: string | null;
    created_at: string;
}

function normalizeEmail(email?: string | null): string | null {
    const v = (email || '').trim().toLowerCase();
    return v || null;
}

function normalizeNamePart(value?: string | null): string {
    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

/** Nombres genéricos del CRM que deben reemplazarse cuando llega un pushName real. */
function isPlaceholderClientName(value?: string | null): boolean {
    const raw = (value || '').trim();
    if (!raw) return true;
    const lower = raw.toLowerCase();
    if (['whatsapp', 'whats app', 'cliente', 'cliente wa', 'lead'].includes(lower)) return true;
    // "Cliente +56912345678" / "Cliente 569..."
    if (/^cliente(\s+\+?\d[\d\s-]*)?$/i.test(raw)) return true;
    return false;
}

/** Fallback cuando WhatsApp aún no envió pushName. */
function defaultClientDisplayName(phone?: string | null): string {
    const e164 = phone ? normalizePhoneE164(phone) : null;
    return e164 ? `Cliente ${e164}` : 'Cliente';
}

function namesCompatible(
    a: { first_name?: string | null; last_name?: string | null },
    b: { first_name?: string | null; last_name?: string | null }
): boolean {
    const af = normalizeNamePart(a.first_name);
    const bf = normalizeNamePart(b.first_name);
    if (!af || !bf) return true; // incomplete name → allow merge
    if (af !== bf && !af.startsWith(bf) && !bf.startsWith(af)) return false;

    const al = normalizeNamePart(a.last_name);
    const bl = normalizeNamePart(b.last_name);
    if (!al || !bl) return true;
    return al === bl || al.startsWith(bl) || bl.startsWith(al);
}

async function findIdentifier(type: IdentifierType, value: string) {
    const db = createServerClient();
    const { data } = await db
        .from('client_identifiers')
        .select('id, client_id, type, value, is_primary')
        .eq('type', type)
        .eq('value', value)
        .maybeSingle();
    return data;
}

async function getClientRow(clientId: string) {
    const db = createServerClient();
    const { data } = await db
        .from('clients')
        .select('id, first_name, last_name, email, phone, google_contact_id, merged_into_id, possible_duplicate')
        .eq('id', clientId)
        .maybeSingle();
    return data;
}

async function resolveCanonicalClientId(clientId: string): Promise<string> {
    let current = clientId;
    for (let i = 0; i < 5; i++) {
        const row = await getClientRow(current);
        if (!row?.merged_into_id) return current;
        current = row.merged_into_id;
    }
    return current;
}

async function countCompletedQuotes(clientId: string): Promise<number> {
    const db = createServerClient();
    const { count } = await db
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('status', ['confirmed', 'completed']);
    return count || 0;
}

async function countIdentifiers(clientId: string): Promise<number> {
    const db = createServerClient();
    const { count } = await db
        .from('client_identifiers')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
    return count || 0;
}

/** Ficha pobre: sin ventas cerradas y pocos identifiers. */
async function isPoorProfile(clientId: string): Promise<boolean> {
    const [quotes, ids] = await Promise.all([
        countCompletedQuotes(clientId),
        countIdentifiers(clientId),
    ]);
    return quotes === 0 && ids <= 2;
}

async function isSafeMerge(aId: string, bId: string): Promise<boolean> {
    const [a, b] = await Promise.all([getClientRow(aId), getClientRow(bId)]);
    if (!a || !b) return false;
    if (namesCompatible(a, b)) return true;
    const [poorA, poorB] = await Promise.all([isPoorProfile(aId), isPoorProfile(bId)]);
    return poorA || poorB;
}

async function syncPrimaryMirror(clientId: string): Promise<void> {
    const db = createServerClient();
    const { data: identifiers } = await db
        .from('client_identifiers')
        .select('type, value, is_primary')
        .eq('client_id', clientId);

    const primaryEmail =
        identifiers?.find((i) => i.type === 'email' && i.is_primary)?.value
        ?? identifiers?.find((i) => i.type === 'email')?.value
        ?? null;
    const primaryPhone =
        identifiers?.find((i) => i.type === 'phone' && i.is_primary)?.value
        ?? identifiers?.find((i) => i.type === 'phone')?.value
        ?? null;

    await db
        .from('clients')
        .update({
            email: primaryEmail,
            phone: primaryPhone,
            updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
}

async function ensureIdentifier(
    clientId: string,
    type: IdentifierType,
    value: string,
    source?: string,
    makePrimaryIfFirst = true
): Promise<'added' | 'exists_same' | 'exists_other'> {
    const db = createServerClient();
    const existing = await findIdentifier(type, value);
    if (existing) {
        return existing.client_id === clientId ? 'exists_same' : 'exists_other';
    }

    const { count } = await db
        .from('client_identifiers')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('type', type);

    const isPrimary = makePrimaryIfFirst && (count || 0) === 0;

    const { error } = await db.from('client_identifiers').insert({
        client_id: clientId,
        type,
        value,
        is_primary: isPrimary,
        source: source || null,
    });

    if (error) {
        // Race on unique: re-check ownership
        const again = await findIdentifier(type, value);
        if (again?.client_id === clientId) return 'exists_same';
        if (again) return 'exists_other';
        console.error('ensureIdentifier error:', error);
        throw new Error(error.message);
    }

    return 'added';
}

/**
 * Merge absorbed → survivor. Moves identifiers, quotes, touchpoints; soft-retires absorbed.
 */
export async function mergeClients(
    fromClientId: string,
    intoClientId: string,
    reason: string,
    source?: string
): Promise<string> {
    if (fromClientId === intoClientId) return intoClientId;

    const db = createServerClient();
    const survivor = await resolveCanonicalClientId(intoClientId);
    const absorbed = await resolveCanonicalClientId(fromClientId);
    if (survivor === absorbed) return survivor;

    const [survRow, absRow] = await Promise.all([getClientRow(survivor), getClientRow(absorbed)]);
    if (!survRow || !absRow) throw new Error('Cliente no encontrado para merge');

    // Move identifiers (skip conflicts already on survivor)
    const { data: absIdentifiers } = await db
        .from('client_identifiers')
        .select('*')
        .eq('client_id', absorbed);

    for (const ident of absIdentifiers || []) {
        const onSurvivor = await findIdentifier(ident.type, ident.value);
        if (onSurvivor) {
            await db.from('client_identifiers').delete().eq('id', ident.id);
            continue;
        }
        // Demote primary if survivor already has primary of same type
        let isPrimary = ident.is_primary;
        if (isPrimary) {
            const { data: existingPrimary } = await db
                .from('client_identifiers')
                .select('id')
                .eq('client_id', survivor)
                .eq('type', ident.type)
                .eq('is_primary', true)
                .maybeSingle();
            if (existingPrimary) isPrimary = false;
        }
        await db
            .from('client_identifiers')
            .update({ client_id: survivor, is_primary: isPrimary })
            .eq('id', ident.id);
    }

    await db.from('quotes').update({ client_id: survivor }).eq('client_id', absorbed);
    await db.from('client_touchpoints').update({ client_id: survivor }).eq('client_id', absorbed);

    // Prefer survivor google id; keep absorbed if survivor empty
    if (!survRow.google_contact_id && absRow.google_contact_id) {
        await db
            .from('clients')
            .update({ google_contact_id: absRow.google_contact_id })
            .eq('id', survivor);
    }

    // Enrich name if survivor incomplete
    const namePatch: Record<string, string | null> = {};
    if (!survRow.first_name?.trim() && absRow.first_name) namePatch.first_name = absRow.first_name;
    if (!survRow.last_name?.trim() && absRow.last_name) namePatch.last_name = absRow.last_name;
    if (Object.keys(namePatch).length) {
        await db.from('clients').update(namePatch).eq('id', survivor);
    }

    await db
        .from('clients')
        .update({
            merged_into_id: survivor,
            possible_duplicate: false,
            updated_at: new Date().toISOString(),
        })
        .eq('id', absorbed);

    await db.from('client_merge_logs').insert({
        from_client_id: absorbed,
        into_client_id: survivor,
        reason,
        source: source || null,
        details: {
            absorbed_email: absRow.email,
            absorbed_phone: absRow.phone,
            survivor_email: survRow.email,
            survivor_phone: survRow.phone,
        },
    });

    await syncPrimaryMirror(survivor);
    return survivor;
}

async function pickMergeSurvivor(aId: string, bId: string): Promise<{ survivor: string; absorbed: string }> {
    const [qa, qb] = await Promise.all([countCompletedQuotes(aId), countCompletedQuotes(bId)]);
    if (qa !== qb) {
        return qa > qb ? { survivor: aId, absorbed: bId } : { survivor: bId, absorbed: aId };
    }
    const [ia, ib] = await Promise.all([countIdentifiers(aId), countIdentifiers(bId)]);
    if (ia !== ib) {
        return ia >= ib ? { survivor: aId, absorbed: bId } : { survivor: bId, absorbed: aId };
    }
    return { survivor: aId, absorbed: bId };
}

/**
 * Resolve or create a person by phone and/or email (phone-first matching).
 */
export async function resolveOrCreateClient(input: ResolveClientInput): Promise<ResolveClientResult> {
    const db = createServerClient();
    const email = normalizeEmail(input.email);
    const phone = input.phone ? normalizePhoneE164(input.phone) : null;
    const source = input.source || 'web';
    const channel = input.channel || (source === 'whatsapp' ? 'whatsapp' : source === 'admin' ? 'admin' : 'web');

    if (!email && !phone) {
        throw new Error('Se requiere email o teléfono para resolver un cliente.');
    }

    const phoneMatch = phone ? await findIdentifier('phone', phone) : null;
    const emailMatch = email ? await findIdentifier('email', email) : null;

    let phoneClientId = phoneMatch ? await resolveCanonicalClientId(phoneMatch.client_id) : null;
    let emailClientId = emailMatch ? await resolveCanonicalClientId(emailMatch.client_id) : null;

    let clientId: string | null = null;
    let created = false;
    let merged = false;
    let possibleDuplicate = false;

    if (phoneClientId && emailClientId && phoneClientId !== emailClientId) {
        const safe = await isSafeMerge(phoneClientId, emailClientId);
        if (safe) {
            const { survivor, absorbed } = await pickMergeSurvivor(phoneClientId, emailClientId);
            clientId = await mergeClients(
                absorbed,
                survivor,
                `Auto-merge: phone and email pointed to different clients`,
                source
            );
            merged = true;
        } else {
            // Prefer channel identity
            clientId = channel === 'whatsapp' ? phoneClientId : (emailClientId || phoneClientId);
            possibleDuplicate = true;
            await db
                .from('clients')
                .update({ possible_duplicate: true, updated_at: new Date().toISOString() })
                .in('id', [phoneClientId, emailClientId]);
        }
    } else {
        clientId = phoneClientId || emailClientId;
    }

    if (!clientId) {
        const rawName = (input.firstName || '').trim();
        const firstName = isPlaceholderClientName(rawName)
            ? defaultClientDisplayName(phone)
            : rawName;
        const { data: createdClient, error } = await db
            .from('clients')
            .insert({
                first_name: firstName,
                last_name: input.lastName?.trim() || null,
                email: email,
                phone: phone,
                first_touch_source: source,
                first_touch_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (error || !createdClient?.id) {
            console.error('resolveOrCreateClient create error:', error);
            throw new Error(error?.message || 'No se pudo crear el cliente.');
        }
        clientId = createdClient.id as string;
        created = true;

        if (phone) await ensureIdentifier(clientId, 'phone', phone, source, true);
        if (email) await ensureIdentifier(clientId, 'email', email, source, true);
        await syncPrimaryMirror(clientId);
    } else {
        // Attach missing identifiers when same person / after merge
        if (phone) {
            const phoneResult = await ensureIdentifier(clientId, 'phone', phone, source, true);
            if (phoneResult === 'exists_other' && !possibleDuplicate) {
                // Should be rare after merge path; flag
                possibleDuplicate = true;
                await db
                    .from('clients')
                    .update({ possible_duplicate: true, updated_at: new Date().toISOString() })
                    .eq('id', clientId);
            }
        }
        if (email) {
            const emailResult = await ensureIdentifier(clientId, 'email', email, source, true);
            if (emailResult === 'exists_other' && !possibleDuplicate) {
                possibleDuplicate = true;
                await db
                    .from('clients')
                    .update({ possible_duplicate: true, updated_at: new Date().toISOString() })
                    .eq('id', clientId);
            }
        }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const row = await getClientRow(clientId);
        const incomingName = input.firstName?.trim() || '';
        if (incomingName && !isPlaceholderClientName(incomingName) && isPlaceholderClientName(row?.first_name)) {
            patch.first_name = incomingName;
        }
        if (input.lastName?.trim() && !row?.last_name) {
            patch.last_name = input.lastName.trim();
        }
        if (Object.keys(patch).length > 1) {
            await db.from('clients').update(patch).eq('id', clientId);
        }
        await syncPrimaryMirror(clientId);
    }

    return { clientId: clientId!, created, merged, possibleDuplicate };
}

export async function recordTouchpoint(opts: {
    clientId: string;
    channel: string;
    type: string;
    meta_ctwa_clid?: string | null;
    meta_fbc?: string | null;
    meta_fbp?: string | null;
    payload?: Record<string, unknown>;
}): Promise<string | null> {
    const db = createServerClient();
    const { data, error } = await db
        .from('client_touchpoints')
        .insert({
            client_id: opts.clientId,
            channel: opts.channel,
            type: opts.type,
            meta_ctwa_clid: opts.meta_ctwa_clid || null,
            meta_fbc: opts.meta_fbc || null,
            meta_fbp: opts.meta_fbp || null,
            payload: opts.payload || {},
        })
        .select('id')
        .single();

    if (error) {
        console.error('recordTouchpoint error:', error);
        return null;
    }
    return data?.id ?? null;
}

export async function listClientIdentifiers(clientId: string): Promise<ClientIdentifierRow[]> {
    const db = createServerClient();
    const { data } = await db
        .from('client_identifiers')
        .select('*')
        .eq('client_id', clientId)
        .order('type')
        .order('is_primary', { ascending: false });
    return (data || []) as ClientIdentifierRow[];
}

export async function setPrimaryIdentifier(
    clientId: string,
    identifierId: string
): Promise<{ success: boolean; error?: string }> {
    const db = createServerClient();
    const { data: ident } = await db
        .from('client_identifiers')
        .select('*')
        .eq('id', identifierId)
        .eq('client_id', clientId)
        .maybeSingle();

    if (!ident) return { success: false, error: 'Identificador no encontrado.' };

    await db
        .from('client_identifiers')
        .update({ is_primary: false })
        .eq('client_id', clientId)
        .eq('type', ident.type);

    await db.from('client_identifiers').update({ is_primary: true }).eq('id', identifierId);
    await syncPrimaryMirror(clientId);
    return { success: true };
}

export async function listRecentMerges(limit = 20) {
    const db = createServerClient();
    const { data } = await db
        .from('client_merge_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

export async function getClientIdentifiersForCapi(clientId: string): Promise<{
    emails: string[];
    phones: string[];
}> {
    const ids = await listClientIdentifiers(clientId);
    return {
        emails: ids.filter((i) => i.type === 'email').map((i) => i.value),
        phones: ids.filter((i) => i.type === 'phone').map((i) => i.value),
    };
}

/** Update person + identifiers from quote confirmation / admin edit. */
export async function syncClientFromContact(
    clientId: string,
    contact: { firstName?: string; lastName?: string | null; email?: string | null; phone?: string | null },
    source: ClientTouchSource = 'web'
): Promise<void> {
    const db = createServerClient();
    const email = normalizeEmail(contact.email);
    const phone = contact.phone ? normalizePhoneE164(contact.phone) : null;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (contact.firstName?.trim()) patch.first_name = contact.firstName.trim();
    if (contact.lastName !== undefined) patch.last_name = contact.lastName?.trim() || null;
    await db.from('clients').update(patch).eq('id', clientId);

    if (phone) await ensureIdentifier(clientId, 'phone', phone, source, true);
    if (email) await ensureIdentifier(clientId, 'email', email, source, true);
    await syncPrimaryMirror(clientId);
}
