import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con service_role_key.
 * SOLO para uso en Server Actions y Server Components (nunca en el cliente).
 * La service_role bypasses RLS y tiene acceso total a la base de datos.
 */
export function createServerClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
        );
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
