-- Barril Pet al final del orden por created_at en cada receta
UPDATE public.recipe_items ri
SET created_at = sub.max_ts + interval '1 second'
FROM (
  SELECT ri2.recipe_id, MAX(ri2.created_at) AS max_ts
  FROM public.recipe_items ri2
  GROUP BY ri2.recipe_id
) sub,
public.ingredients i
WHERE ri.recipe_id = sub.recipe_id
  AND i.id = ri.ingredient_id
  AND i.name = 'Barril Pet 5L Talos';
