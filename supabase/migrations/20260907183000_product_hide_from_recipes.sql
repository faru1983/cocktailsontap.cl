-- Productos de venta (hielo, decoración, bombillas) que no van al recetario
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hide_from_recipes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.hide_from_recipes IS
  'Si true, el producto se vende en catálogo pero no aparece en Recetario (no requiere receta)';

UPDATE public.products
SET hide_from_recipes = true
WHERE name IN (
  'Hielo Cubo',
  'Hielo Frappe',
  'Decoracción Limón',
  'Decoracción Naranja',
  'Decoración Menta Fresca',
  'Bombillas Largas'
);
