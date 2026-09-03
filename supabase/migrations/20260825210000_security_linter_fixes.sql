-- Supabase security linter: function search_path + explicit deny policies on service-only tables.

CREATE OR REPLACE FUNCTION public.prevent_geo_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'No se permite borrar %; desactívala con is_active=false', TG_TABLE_NAME;
END;
$function$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    '_backup_clients_20260803',
    '_backup_quotes_client_fk_20260803',
    'admin_settings',
    'client_identifiers',
    'client_merge_logs',
    'client_stage_events',
    'client_touchpoints',
    'clients',
    'expense_categories',
    'expense_subcategories',
    'expenses',
    'ingredients',
    'quote_items',
    'quotes',
    'recipe_items',
    'recipes',
    'reminder_logs',
    'reminder_suppressions',
    'reminder_templates',
    'sync_logs'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY deny_api_access ON public.%I FOR ALL USING (false)',
      tbl
    );
  END LOOP;
END $$;
