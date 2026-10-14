-- Migration: Agregar pdp_metadata a products para enriquecimiento comercial de páginas PDP de Barriles de 5L
ALTER TABLE products ADD COLUMN IF NOT EXISTS pdp_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.pdp_metadata IS 'Metadatos comerciales para PDP (/barriles/[slug]): headline, commercial_desc, abv, serving_temperature, glassware, garnish, flavor_profile, recommended_addon_ids, related_product_ids';
