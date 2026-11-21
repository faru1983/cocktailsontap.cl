-- Soporte de variantes / complementos configurables por producto (ej. bebida en combinados, tónica en Gin Tonic)

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS variant_config jsonb;

ALTER TABLE public.quote_items
    ADD COLUMN IF NOT EXISTS variant text;

-- Configuración inicial para categoría Combinados (Piscolas y Whiskcola)
UPDATE public.products p
SET variant_config = jsonb_build_object(
    'label', 'Elige tu bebida',
    'default', 'Coca Original',
    'options', jsonb_build_array('Coca Original', 'Coca Zero', 'Sprite', 'Sprite Zero')
)
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name = 'Combinados'
  AND p.variant_config IS NULL;
