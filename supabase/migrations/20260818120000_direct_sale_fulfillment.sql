-- Venta directa: estado en reparto + datos de despacho
-- Ampliar status si hay constraint (PostgreSQL enum o check)

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'confirmed', 'in_delivery', 'cancelled', 'completed'));

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
