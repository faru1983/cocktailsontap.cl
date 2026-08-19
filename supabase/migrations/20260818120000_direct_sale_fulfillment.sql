-- Venta directa: estado en reparto + datos de despacho
-- La columna status usa el enum quote_status (no CHECK constraint)

ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'in_delivery' AFTER 'confirmed';

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS dispatch_mode text,
  ADD COLUMN IF NOT EXISTS dispatch_carrier_name text,
  ADD COLUMN IF NOT EXISTS dispatch_tracking_url text,
  ADD COLUMN IF NOT EXISTS dispatch_tracking_number text,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

COMMENT ON COLUMN quotes.dispatch_mode IS 'own | carrier — solo venta directa en reparto';
COMMENT ON COLUMN quotes.dispatch_carrier_name IS 'Nombre empresa de envío (Blue Express u otra)';
COMMENT ON COLUMN quotes.dispatch_tracking_url IS 'URL de seguimiento del carrier';
COMMENT ON COLUMN quotes.dispatch_tracking_number IS 'Número de seguimiento ingresado manualmente';
