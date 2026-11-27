-- Tipo de vasos elegidos por el cliente para eventos:
-- 'reusable'       = Vasos (450 ml) y Copas (480 ml) Reutilizables (en préstamo)
-- 'disposable_pet' = Vasos PET (desechables, 360 ml, sin devolución)
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS glassware_type text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'quotes_glassware_type_check'
    ) THEN
        ALTER TABLE public.quotes
            ADD CONSTRAINT quotes_glassware_type_check
            CHECK (glassware_type IS NULL OR glassware_type IN ('reusable', 'disposable_pet'));
    END IF;
END $$;

COMMENT ON COLUMN public.quotes.glassware_type IS
    'Modalidad de vasos para eventos: reusable (vasos 450 ml y copas 480 ml en préstamo) o disposable_pet (vasos PET desechables 360 ml).';
