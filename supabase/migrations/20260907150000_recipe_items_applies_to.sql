-- Alcance por línea de receta: all | disposable | event
ALTER TABLE public.recipe_items
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all';

ALTER TABLE public.recipe_items
  DROP CONSTRAINT IF EXISTS recipe_items_applies_to_check;

ALTER TABLE public.recipe_items
  ADD CONSTRAINT recipe_items_applies_to_check
  CHECK (applies_to = ANY (ARRAY['all'::text, 'disposable'::text, 'event'::text]));

COMMENT ON COLUMN public.recipe_items.applies_to IS 'all = ambos canales; disposable = solo barriles desechables; event = solo eventos';

-- Unidad "u" (unidad) para envases/packaging (ej. Barril Pet)
ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_format_unit_check;

ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_format_unit_check
  CHECK (format_unit = ANY (ARRAY['ml'::text, 'g'::text, 'u'::text]));

-- Insumo packaging desechables (idempotente)
INSERT INTO public.ingredients (name, category, format_qty, format_unit, format_price, supplier, is_active)
SELECT 'Barril Pet 5L Talos', 'Otros', 1, 'u', 7000, 'Bayer Imports', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredients WHERE lower(name) = lower('Barril Pet 5L Talos')
);

INSERT INTO public.recipe_items (recipe_id, ingredient_id, qty_base, applies_to)
SELECT r.id, i.id, 1, 'disposable'
FROM public.recipes r
CROSS JOIN public.ingredients i
WHERE i.name = 'Barril Pet 5L Talos'
  AND r.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.product_prices pp
    WHERE pp.product_id = r.product_id
      AND pp.is_disposable = true
      AND coalesce(pp.is_active, true) = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.recipe_items ri
    WHERE ri.recipe_id = r.id AND ri.ingredient_id = i.id
  );
