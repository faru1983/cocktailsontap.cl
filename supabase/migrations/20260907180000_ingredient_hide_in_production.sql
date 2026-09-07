-- Insumos de costeo (hielo, decoración, packaging) que no deben salir en producción
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS hide_in_production boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ingredients.hide_in_production IS
  'Si true, el insumo se usa en costeo de recetas pero no aparece en la lista de producción';

UPDATE public.ingredients
SET hide_in_production = true
WHERE name IN (
  'Hielo Cubo/Frappe',
  'Decoración Desidratada',
  'Decoración Menta',
  'Barril Pet 5L Talos'
);
