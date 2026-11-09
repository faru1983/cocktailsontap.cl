-- Nuevas columnas en quotes para estimación de entrega en venta directa
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS dispatch_estimated_date date,
  ADD COLUMN IF NOT EXISTS delivery_estimate_min date,
  ADD COLUMN IF NOT EXISTS delivery_estimate_max date,
  ADD COLUMN IF NOT EXISTS delivery_estimate_label text,
  ADD COLUMN IF NOT EXISTS delivery_estimate_days text;

COMMENT ON COLUMN quotes.dispatch_estimated_date IS 'Fecha operativa en que el taller entrega al courier o inicia reparto';
COMMENT ON COLUMN quotes.delivery_estimate_label IS 'Rango legible de entrega mostrado al cliente (ej: 01 al 05 de Noviembre)';
COMMENT ON COLUMN quotes.delivery_estimate_days IS 'Plazo estimado en días hábiles (ej: 4–5 días hábiles)';
