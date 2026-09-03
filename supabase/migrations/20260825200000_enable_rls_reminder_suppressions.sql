-- reminder_suppressions: admin + cron vía createServerClient (service_role).
-- Sin políticas para anon/authenticated: bloquea lectura/escritura pública en PostgREST.

ALTER TABLE public.reminder_suppressions ENABLE ROW LEVEL SECURITY;
