-- Etiqueta de transporte libre para mostrar en lugar del costo ($0 no siempre es "Gratis")
-- Ejemplos: 'Por Pagar', 'Por Coordinar', null (usa lógica automática)

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS shipping_label text;

COMMENT ON COLUMN quotes.shipping_label IS 'Etiqueta personalizada de transporte (ej: "Por Pagar"). Anula la etiqueta automática en la vista pública.';
