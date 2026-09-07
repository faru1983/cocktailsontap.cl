-- Insumos de evento en recetas base 5L: hielo, decoración desidratada y menta (mojitos / Moscow Mule)

-- Hielo 4000g — todas las recetas activas base 5L, solo eventos
INSERT INTO public.recipe_items (recipe_id, ingredient_id, qty_base, applies_to)
SELECT r.id, i.id, 4000, 'event'
FROM public.recipes r
CROSS JOIN public.ingredients i
WHERE i.name = 'Hielo Cubo/Frappe'
  AND r.is_active = true
  AND r.base_liters = 5
  AND NOT EXISTS (
    SELECT 1 FROM public.recipe_items ri
    WHERE ri.recipe_id = r.id AND ri.ingredient_id = i.id
  );

-- Decoración Desidratada 1u — todas las recetas activas base 5L, solo eventos
INSERT INTO public.recipe_items (recipe_id, ingredient_id, qty_base, applies_to)
SELECT r.id, i.id, 1, 'event'
FROM public.recipes r
CROSS JOIN public.ingredients i
WHERE i.name = 'Decoración Desidratada'
  AND r.is_active = true
  AND r.base_liters = 5
  AND NOT EXISTS (
    SELECT 1 FROM public.recipe_items ri
    WHERE ri.recipe_id = r.id AND ri.ingredient_id = i.id
  );

-- Decoración Menta 1u — mojitos y Moscow Mule, solo eventos
INSERT INTO public.recipe_items (recipe_id, ingredient_id, qty_base, applies_to)
SELECT r.id, i.id, 1, 'event'
FROM public.recipes r
JOIN public.products p ON p.id = r.product_id
CROSS JOIN public.ingredients i
WHERE i.name = 'Decoración Menta'
  AND r.is_active = true
  AND r.base_liters = 5
  AND (p.name ILIKE 'Mojito%' OR p.name = 'Moscow Mule')
  AND NOT EXISTS (
    SELECT 1 FROM public.recipe_items ri
    WHERE ri.recipe_id = r.id AND ri.ingredient_id = i.id
  );
