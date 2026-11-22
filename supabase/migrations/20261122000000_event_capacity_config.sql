-- Configuración de capacidad diaria de equipos para eventos (Dispensadores Portátiles y Muros)
INSERT INTO public.site_settings (key, value, category, is_active, description)
SELECT
    'event_capacity_config',
    '{"portableDispensers":10,"muroDispensers":1}',
    'shipping',
    true,
    'Capacidad diaria máxima de Dispensadores Portátiles (2 barriles c/u) y Muros de Coctelería'
WHERE NOT EXISTS (
    SELECT 1 FROM public.site_settings WHERE key = 'event_capacity_config'
);
