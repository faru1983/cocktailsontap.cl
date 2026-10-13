-- Migración de endurecimiento de seguridad:
-- 1. Restringir políticas en storage.objects para limitar mutaciones únicamente a service_role.
-- 2. Limitar tamaño de archivo (2MB) y tipos MIME autorizados en storage.buckets.
-- 3. Restringir políticas en site_settings y expense_payment_methods a service_role (bloqueando acceso anónimo PostgREST).
-- 4. Reasignar política duplicada de lectura en product_prices a service_role.

-- 1. Restringir políticas de mutación en storage.objects para service_role
ALTER POLICY "Admin Delete" ON storage.objects TO service_role;
ALTER POLICY "Admin Insert" ON storage.objects TO service_role;
ALTER POLICY "Admin Update" ON storage.objects TO service_role;

-- 2. Configurar cuota de 2MB y tipos MIME autorizados en el bucket product-images
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
WHERE id = 'product-images';

-- 3. Bloquear acceso anónimo API a site_settings
ALTER POLICY "Allow public read-only for internal system functions" ON public.site_settings TO service_role;

-- 4. Bloquear acceso anónimo API a expense_payment_methods
ALTER POLICY "Public read access" ON public.expense_payment_methods TO service_role;

-- 5. Limpiar política duplicada en product_prices
ALTER POLICY "Allow public read-only access to product_prices" ON public.product_prices TO service_role;
