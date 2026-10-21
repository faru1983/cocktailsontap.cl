-- ==============================================================================
-- Migración: Endurecimiento de Privilegios (Oct 30 2026), RLS e Índices FK
-- Fecha: 2026-10-21
-- Proyecto: prhauxtawacvwuxjngjx
-- Estado: Aplicada y verificada en vivo
-- ==============================================================================

-- 1. Asegurar privilegios completos a service_role (backend Next.js / Server Actions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 2. Configurar ALTER DEFAULT PRIVILEGES para futuras tablas (Preparación oficial 30 Oct 2026)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- 3. Revocar TODOS los privilegios de tablas privadas a anon y authenticated
REVOKE ALL ON TABLE
    public.quotes,
    public.quote_items,
    public.clients,
    public.client_identifiers,
    public.client_touchpoints,
    public.client_stage_events,
    public.client_merge_logs,
    public.site_settings,
    public.admin_settings,
    public.expenses,
    public.expense_categories,
    public.expense_subcategories,
    public.expense_payment_methods,
    public.ingredients,
    public.recipes,
    public.recipe_items,
    public.reminder_templates,
    public.reminder_logs,
    public.reminder_suppressions,
    public._backup_clients_20260803,
    public._backup_quotes_client_fk_20260803
FROM anon, authenticated;

-- 4. En tablas de catálogo público: Revocar escritura/truncate a anon y authenticated, permitir solo SELECT a anon
REVOKE ALL ON TABLE
    public.products,
    public.product_prices,
    public.categories,
    public.comunas,
    public.regions,
    public.event_types,
    public.measurement_units
FROM anon, authenticated;

GRANT SELECT ON TABLE
    public.products,
    public.product_prices,
    public.categories,
    public.comunas,
    public.regions,
    public.event_types,
    public.measurement_units
TO anon;

-- 5. Endurecer políticas RLS públicas para exponer únicamente registros activos a la Data API
ALTER POLICY "Allow public read-only access to products" ON public.products USING (is_active = true);
ALTER POLICY "Allow public read access for categories" ON public.categories USING (is_active = true);
ALTER POLICY "Allow public read access for comunas" ON public.comunas USING (is_active = true);
ALTER POLICY "Allow public read access to product_prices" ON public.product_prices USING (
    is_active = true AND EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_prices.product_id AND p.is_active = true
    )
);

-- 6. Crear los 9 índices en claves foráneas (optimización de JOINs, filtros y borrados en cascada)
CREATE INDEX IF NOT EXISTS idx_clients_merged_into_id ON public.clients (merged_into_id);
CREATE INDEX IF NOT EXISTS idx_client_stage_events_quote_id ON public.client_stage_events (quote_id);
CREATE INDEX IF NOT EXISTS idx_client_stage_events_touchpoint_id ON public.client_stage_events (touchpoint_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_unit_id ON public.quote_items (unit_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_unit_id ON public.product_prices (unit_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_subcategory_id ON public.expenses (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_expense_subcategories_category_id ON public.expense_subcategories (category_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_template_id ON public.reminder_logs (template_id);
