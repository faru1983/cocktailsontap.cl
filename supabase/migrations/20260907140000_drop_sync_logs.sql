-- Remove legacy sync_logs table (admin /admin/logs UI retired; audit via quotes.comments).
DROP TABLE IF EXISTS public.sync_logs;
