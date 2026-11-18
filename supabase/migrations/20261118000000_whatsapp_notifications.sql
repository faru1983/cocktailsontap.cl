-- Historial de notificaciones WhatsApp y configuración de interruptores
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    recipient_phone text,
    recipient_name text,
    message_preview text,
    status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    error text,
    source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'cron')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_notif_logs_created_at
    ON public.whatsapp_notification_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_notif_logs_quote_id
    ON public.whatsapp_notification_logs (quote_id);

ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.site_settings (key, value, category, is_active, description) VALUES
    ('wa_notify_enabled', 'true', 'whatsapp', true, 'Interruptor maestro para envíos automáticos de WhatsApp desde cocktailsontap.cl'),
    ('wa_notify_web_event_quote', 'true', 'whatsapp', true, 'Enviar copia por WhatsApp al cotizar un evento en la web'),
    ('wa_notify_web_direct_order', 'true', 'whatsapp', true, 'Enviar resumen y datos bancarios por WhatsApp al pedir barriles 5L en la web'),
    ('wa_notify_event_confirmed', 'true', 'whatsapp', true, 'Enviar confirmación y datos bancarios por WhatsApp al confirmar una reserva de evento'),
    ('wa_notify_payment_registered', 'true', 'whatsapp', true, 'Enviar comprobante por WhatsApp al registrar un pago o abono en /admin'),
    ('wa_notify_direct_dispatched', 'true', 'whatsapp', true, 'Enviar aviso de despacho y seguimiento por WhatsApp al marcar pedido en reparto'),
    ('wa_sync_deskcomm_leads', 'true', 'whatsapp', true, 'Registrar y avanzar leads en el embudo Pedidos de DeskcommCRM')
ON CONFLICT (key) DO NOTHING;
